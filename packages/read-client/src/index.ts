import type { z } from "zod";
// Bundle the canonical consumer schemas; adopters need no workspace package at runtime.
import { ReadApiV1Loose } from "../../core/src/read-api.js";

export type Community = z.infer<typeof ReadApiV1Loose.community>;
export type Epoch = z.infer<typeof ReadApiV1Loose.epoch>;
export type Contributions = z.infer<typeof ReadApiV1Loose.contributions>;
export type Leaderboard = z.infer<typeof ReadApiV1Loose.leaderboard>;
export type Contribution = z.infer<typeof ReadApiV1Loose.contribution>;
export type Claim = z.infer<typeof ReadApiV1Loose.claim>;
export type WalletClaims = z.infer<typeof ReadApiV1Loose.walletClaims>;
export type WalletRecord = z.infer<typeof ReadApiV1Loose.walletRecord>;

export type ReadErrorCode =
  | "invalid_configuration"
  | "invalid_input"
  | "aborted"
  | "timeout"
  | "network_error"
  | "bad_request"
  | "not_found"
  | "rate_limited"
  | "unavailable"
  | "http_error"
  | "invalid_json"
  | "schema_mismatch"
  | "identity_mismatch";

export class HyphaeReadError extends Error {
  readonly name = "HyphaeReadError";

  constructor(
    readonly code: ReadErrorCode,
    readonly status?: number,
    readonly retryAfterSeconds?: number,
  ) {
    super(code);
  }
}

export interface ClientOptions {
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
}

export interface ReadOptions {
  signal?: AbortSignal;
}

export interface PageOptions extends ReadOptions {
  offset?: number;
  limit?: number;
}

export interface ContributionsOptions extends PageOptions {
  member?: string;
}

const MINT = /^[A-Za-z0-9]{1,64}$/;
const WALLET = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function text(value: string, pattern: RegExp) {
  if (typeof value !== "string" || !pattern.test(value)) throw new HyphaeReadError("invalid_input");
  return value;
}

function integer(value: number, min: number, max: number) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new HyphaeReadError("invalid_input");
  }
  return value;
}

function paging(options: PageOptions) {
  const offset = integer(options.offset ?? 0, 0, 999_999_999);
  const limit = integer(options.limit ?? 50, 1, 100);
  return { offset, limit };
}

function retryAfter(value: string | null): number | undefined {
  if (value === null) return undefined;
  if (/^\d+$/.test(value)) {
    const seconds = Number(value);
    return Number.isSafeInteger(seconds) ? seconds : undefined;
  }
  const time = Date.parse(value);
  return Number.isFinite(time) ? Math.max(0, Math.ceil((time - Date.now()) / 1000)) : undefined;
}

export function createHyphaeReadClient(options: ClientOptions = {}) {
  let base: URL;
  try {
    base = new URL(options.baseUrl ?? "https://hyphae-api.fly.dev/v1");
  } catch {
    throw new HyphaeReadError("invalid_configuration");
  }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname);
  if (
    (base.protocol !== "https:" && !(base.protocol === "http:" && local)) ||
    base.username ||
    base.password ||
    base.search ||
    base.hash ||
    !/^\/v1\/?$/.test(base.pathname)
  )
    throw new HyphaeReadError("invalid_configuration");
  const timeoutMs = options.timeoutMs ?? 10_000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 2_147_483_647) {
    throw new HyphaeReadError("invalid_configuration");
  }
  const fetchImpl = options.fetch ?? globalThis.fetch?.bind(globalThis);
  if (typeof fetchImpl !== "function") throw new HyphaeReadError("invalid_configuration");
  const origin = base.href.replace(/\/$/, "");

  async function get<T>(
    path: string,
    schema: z.ZodType<T>,
    identity: (data: T) => boolean,
    { signal }: ReadOptions,
  ): Promise<T> {
    if (signal?.aborted) throw new HyphaeReadError("aborted");
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener("abort", abort, { once: true });
    let timedOut = false;
    const cancelled = new Promise<never>((_resolve, reject) => {
      controller.signal.addEventListener(
        "abort",
        () => {
          reject(new HyphaeReadError(timedOut ? "timeout" : "aborted"));
        },
        { once: true },
      );
    });
    const wait = <U>(operation: () => Promise<U>) =>
      Promise.race([
        Promise.resolve().then(() => {
          if (controller.signal.aborted)
            throw new HyphaeReadError(timedOut ? "timeout" : "aborted");
          return operation();
        }),
        cancelled,
      ]);
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    try {
      const response = await wait(() =>
        fetchImpl(`${origin}${path}`, {
          method: "GET",
          headers: { accept: "application/json" },
          credentials: "omit",
          redirect: "error",
          cache: "no-store",
          signal: controller.signal,
        }),
      );
      if (!response.ok) {
        const codes: Record<number, ReadErrorCode> = {
          400: "bad_request",
          404: "not_found",
          429: "rate_limited",
          503: "unavailable",
        };
        throw new HyphaeReadError(
          codes[response.status] ?? "http_error",
          response.status,
          response.status === 429 ? retryAfter(response.headers.get("retry-after")) : undefined,
        );
      }
      let body: unknown;
      try {
        body = await wait(() => response.json());
      } catch (error) {
        if (error instanceof Error && error.name === "TimeoutError")
          throw new HyphaeReadError("timeout");
        if (controller.signal.aborted) throw new HyphaeReadError(timedOut ? "timeout" : "aborted");
        throw new HyphaeReadError("invalid_json");
      }
      let parsed: ReturnType<typeof schema.safeParse>;
      try {
        parsed = schema.safeParse(body);
      } catch {
        // A malformed integer can make a shared arithmetic refinement throw.
        throw new HyphaeReadError("schema_mismatch");
      }
      if (!parsed.success) throw new HyphaeReadError("schema_mismatch");
      if (!identity(parsed.data)) throw new HyphaeReadError("identity_mismatch");
      return parsed.data;
    } catch (error) {
      if (error instanceof HyphaeReadError) throw error;
      throw new HyphaeReadError(
        timedOut || (error instanceof Error && error.name === "TimeoutError")
          ? "timeout"
          : signal?.aborted
            ? "aborted"
            : "network_error",
      );
    } finally {
      // Abort also closes an unread HTTP-error body; never leave that stream running.
      controller.abort();
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    }
  }

  return {
    getCommunity(mint: string, opts: ReadOptions = {}): Promise<Community> {
      text(mint, MINT);
      return get(`/communities/${mint}`, ReadApiV1Loose.community, (d) => d.mint === mint, opts);
    },
    getEpoch(mint: string, index: number, opts: ReadOptions = {}): Promise<Epoch> {
      text(mint, MINT);
      integer(index, 1, 999_999_999);
      return get(
        `/communities/${mint}/epochs/${index}`,
        ReadApiV1Loose.epoch,
        (d) => d.community.mint === mint && d.index === index,
        opts,
      );
    },
    getContributions(
      mint: string,
      index: number,
      opts: ContributionsOptions = {},
    ): Promise<Contributions> {
      text(mint, MINT);
      integer(index, 1, 999_999_999);
      const page = paging(opts);
      const member = opts.member === undefined ? undefined : text(opts.member, UUID).toLowerCase();
      const query = new URLSearchParams({ offset: String(page.offset), limit: String(page.limit) });
      if (member !== undefined) query.set("member", member);
      return get(
        `/communities/${mint}/epochs/${index}/contributions?${query}`,
        ReadApiV1Loose.contributions,
        (d) =>
          d.community.mint === mint &&
          d.epoch.index === index &&
          d.offset === page.offset &&
          d.limit === page.limit &&
          (member === undefined || d.contributions.every((c) => c.member_id === member)),
        opts,
      );
    },
    getLeaderboard(mint: string, index: number, opts: PageOptions = {}): Promise<Leaderboard> {
      text(mint, MINT);
      integer(index, 1, 999_999_999);
      const page = paging(opts);
      const query = new URLSearchParams({
        epoch: String(index),
        offset: String(page.offset),
        limit: String(page.limit),
      });
      return get(
        `/communities/${mint}/leaderboard?${query}`,
        ReadApiV1Loose.leaderboard,
        (d) =>
          d.community.mint === mint &&
          d.epoch.index === index &&
          d.offset === page.offset &&
          d.limit === page.limit,
        opts,
      );
    },
    getContribution(id: string, opts: ReadOptions = {}): Promise<Contribution> {
      const normalized = text(id, UUID).toLowerCase();
      return get(
        `/contributions/${normalized}`,
        ReadApiV1Loose.contribution,
        (d) => d.id === normalized,
        opts,
      );
    },
    getClaim(mint: string, index: number, wallet: string, opts: ReadOptions = {}): Promise<Claim> {
      text(mint, MINT);
      integer(index, 1, 999_999_999);
      text(wallet, WALLET);
      return get(
        `/communities/${mint}/epochs/${index}/claims/${wallet}`,
        ReadApiV1Loose.claim,
        (d) => d.community.mint === mint && d.epoch.index === index && d.wallet === wallet,
        opts,
      );
    },
    getWalletClaims(wallet: string, opts: PageOptions = {}): Promise<WalletClaims> {
      text(wallet, WALLET);
      const page = paging(opts);
      const query = new URLSearchParams({ offset: String(page.offset), limit: String(page.limit) });
      return get(
        `/wallets/${wallet}/claims?${query}`,
        ReadApiV1Loose.walletClaims,
        (d) => d.wallet === wallet && d.offset === page.offset && d.limit === page.limit,
        opts,
      );
    },
    getWalletRecord(wallet: string, opts: PageOptions = {}): Promise<WalletRecord> {
      text(wallet, WALLET);
      const page = paging(opts);
      const query = new URLSearchParams({ offset: String(page.offset), limit: String(page.limit) });
      return get(
        `/wallets/${wallet}/record?${query}`,
        ReadApiV1Loose.walletRecord,
        (d) => d.wallet === wallet && d.offset === page.offset && d.limit === page.limit,
        opts,
      );
    },
  };
}

export type HyphaeReadClient = ReturnType<typeof createHyphaeReadClient>;
