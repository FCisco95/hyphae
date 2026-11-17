import { z } from "zod";
import {
  type OperatorChallenge,
  type OperatorChallengeRequest,
  OperatorChallengeRequestSchema,
  OperatorChallengeSchema,
  type OperatorEpoch,
  type OperatorOverview,
  OperatorOverviewSchema,
  type OperatorPayable,
  OperatorPayableSchema,
  type OperatorSession,
  type OperatorSessionCreated,
  OperatorSessionCreatedSchema,
  OperatorSessionRequestSchema,
  OperatorSessionSchema,
  type OperatorStatus,
  OperatorStatusSchema,
} from "../../core/src/admin-api.js";
import { type AdminErrorCode, HyphaeAdminError } from "./index.js";

export type {
  OperatorChallenge,
  OperatorChallengeRequest,
  OperatorEpoch,
  OperatorOverview,
  OperatorPayable,
  OperatorSession,
  OperatorSessionCreated,
  OperatorStatus,
};

// The operator page's client: wallet sign-in by the community's on-chain admin and read-only
// views. A server (the Hyphae web proxy, later Organic's) holds the `hop_` session token; it is
// asked for once per request and never stored here. No automatic retries.

export interface OperatorClientOptions {
  /** Exact API base ending in /admin/v1 (optional trailing slash). */
  baseUrl: string;
  /** The current operator session token (`hop_...`), or null when signed out. */
  getSessionToken: () => string | null | Promise<string | null>;
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
  /** Optional headers for every request, e.g. the web proxy's visitor forwarding. */
  headers?: Record<string, string>;
}

export interface OperatorRequestOptions {
  signal?: AbortSignal;
}

const MINT = /^[A-Za-z0-9]{1,64}$/;
const TOKEN = /^hop_[A-Za-z0-9_-]{43}$/;
const MAX_BODY_BYTES = 64 * 1024;
const STATUS: Record<number, AdminErrorCode> = {
  400: "bad_request",
  401: "unauthorized",
  403: "forbidden",
  404: "not_found",
  409: "conflict",
  429: "rate_limited",
  503: "unavailable",
};

function retryAfter(value: string | null): number | undefined {
  if (value === null || !/^\d+$/.test(value)) return undefined;
  const seconds = Number(value);
  return Number.isSafeInteger(seconds) ? seconds : undefined;
}

export function createHyphaeOperatorClient(options: OperatorClientOptions) {
  let base: URL;
  try {
    if (typeof options?.baseUrl !== "string") throw new Error();
    base = new URL(options.baseUrl);
  } catch {
    throw new HyphaeAdminError("invalid_configuration");
  }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname);
  const timeoutMs = options.timeoutMs ?? 10_000;
  const fetchImpl = options.fetch ?? globalThis.fetch?.bind(globalThis);
  if (
    (base.protocol !== "https:" && !(base.protocol === "http:" && local)) ||
    base.username ||
    base.password ||
    base.search ||
    base.hash ||
    /[?#]/.test(options.baseUrl) ||
    !/^\/admin\/v1\/?$/.test(base.pathname) ||
    typeof options.getSessionToken !== "function" ||
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs < 1 ||
    timeoutMs > 2_147_483_647 ||
    typeof fetchImpl !== "function"
  )
    throw new HyphaeAdminError("invalid_configuration");
  const origin = `${base.href.replace(/\/$/, "")}/operator`;
  const extra = { ...(options.headers ?? {}) };

  async function call<T extends z.ZodType>(
    path: string,
    schema: T,
    init: { method: "GET" | "POST" | "DELETE"; body?: unknown; auth: boolean },
    { signal }: OperatorRequestOptions,
  ): Promise<z.infer<T>> {
    if (signal?.aborted) throw new HyphaeAdminError("aborted");
    const controller = new AbortController();
    let timedOut = false;
    const abort = () => controller.abort();
    signal?.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    const cancelled = () => new HyphaeAdminError(timedOut ? "timeout" : "aborted");
    let response: Response | undefined;
    try {
      let token: string | null = null;
      if (init.auth) {
        try {
          token = await options.getSessionToken();
        } catch {
          if (controller.signal.aborted) throw cancelled();
          throw new HyphaeAdminError("token_error");
        }
        if (controller.signal.aborted) throw cancelled();
        if (typeof token !== "string" || !TOKEN.test(token))
          throw new HyphaeAdminError("unauthorized");
      }
      try {
        response = await fetchImpl(`${origin}${path}`, {
          method: init.method,
          headers: {
            ...extra,
            accept: "application/json",
            ...(token ? { authorization: `Bearer ${token}` } : {}),
            ...(init.body === undefined ? {} : { "content-type": "application/json" }),
          },
          ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
          credentials: "omit",
          redirect: "error",
          cache: "no-store",
          signal: controller.signal,
        });
      } catch {
        if (controller.signal.aborted) throw cancelled();
        throw new HyphaeAdminError("network_error");
      }
      const length = response.headers.get("content-length");
      if (length && /^\d+$/.test(length) && Number(length) > MAX_BODY_BYTES)
        throw new HyphaeAdminError("response_too_large");
      const reader = response.body?.getReader();
      const bytes = new Uint8Array(MAX_BODY_BYTES);
      let size = 0;
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (size + value.byteLength > MAX_BODY_BYTES) {
            void reader.cancel().catch(() => {});
            throw new HyphaeAdminError("response_too_large");
          }
          bytes.set(value, size);
          size += value.byteLength;
        }
      }
      if (controller.signal.aborted) throw cancelled();
      let body: unknown;
      try {
        body = JSON.parse(
          new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, size)),
        );
      } catch {
        if (!response.ok)
          throw new HyphaeAdminError(STATUS[response.status] ?? "http_error", response.status);
        throw new HyphaeAdminError("invalid_json");
      }
      if (!response.ok) {
        const disabled =
          response.status === 404 &&
          typeof body === "object" &&
          body !== null &&
          (body as { error?: unknown }).error === "disabled";
        throw new HyphaeAdminError(
          disabled ? "disabled" : (STATUS[response.status] ?? "http_error"),
          response.status,
          response.status === 429 ? retryAfter(response.headers.get("retry-after")) : undefined,
        );
      }
      const parsed = schema.safeParse(body);
      if (!parsed.success) throw new HyphaeAdminError("schema_mismatch");
      return parsed.data;
    } catch (error) {
      if (controller.signal.aborted && !(error instanceof HyphaeAdminError)) throw cancelled();
      if (error instanceof HyphaeAdminError) throw error;
      throw new HyphaeAdminError("network_error");
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      controller.abort();
    }
  }

  const mintOf = (mint: string) => {
    if (typeof mint !== "string" || !MINT.test(mint)) throw new HyphaeAdminError("invalid_input");
    return mint;
  };
  const checked = <T extends { community?: { mint: string }; mint?: string }>(
    mint: string,
    v: T,
  ) => {
    if ((v.community?.mint ?? v.mint) !== mint) throw new HyphaeAdminError("identity_mismatch");
    return v;
  };

  return {
    /** Whether the operator surface is on. Off rejects with code "disabled". */
    status(opts: OperatorRequestOptions = {}): Promise<OperatorStatus> {
      return call("/status", OperatorStatusSchema, { method: "GET", auth: false }, opts);
    },
    /** A one-use, 5-minute sign-in message for `wallet` to sign. */
    requestChallenge(
      input: OperatorChallengeRequest,
      opts: OperatorRequestOptions = {},
    ): Promise<OperatorChallenge> {
      const parsed = OperatorChallengeRequestSchema.safeParse(input);
      if (!parsed.success) throw new HyphaeAdminError("invalid_input");
      return call(
        "/challenge",
        OperatorChallengeSchema,
        { method: "POST", body: parsed.data, auth: false },
        opts,
      );
    },
    /** Trades the base58 signature for a session token. Keep the token server-side. */
    createSession(
      input: { challengeId: string; signature: string },
      opts: OperatorRequestOptions = {},
    ): Promise<OperatorSessionCreated> {
      const parsed = OperatorSessionRequestSchema.safeParse({
        challenge_id: input?.challengeId,
        signature: input?.signature,
      });
      if (!parsed.success) throw new HyphaeAdminError("invalid_input");
      return call(
        "/session",
        OperatorSessionCreatedSchema,
        { method: "POST", body: parsed.data, auth: false },
        opts,
      );
    },
    session(opts: OperatorRequestOptions = {}): Promise<OperatorSession> {
      return call("/session", OperatorSessionSchema, { method: "GET", auth: true }, opts);
    },
    async endSession(opts: OperatorRequestOptions = {}): Promise<void> {
      await call(
        "/session",
        z.strictObject({ ended: z.literal(true) }),
        { method: "DELETE", auth: true },
        opts,
      );
    },
    async overview(mint: string, opts: OperatorRequestOptions = {}): Promise<OperatorOverview> {
      const m = mintOf(mint);
      return checked(
        m,
        await call(
          `/communities/${m}/overview`,
          OperatorOverviewSchema,
          { method: "GET", auth: true },
          opts,
        ),
      );
    },
    async payable(
      mint: string,
      epochIndex: number,
      opts: OperatorRequestOptions = {},
    ): Promise<OperatorPayable> {
      const m = mintOf(mint);
      if (!Number.isSafeInteger(epochIndex) || epochIndex < 0 || epochIndex > 999_999_999)
        throw new HyphaeAdminError("invalid_input");
      const result = await call(
        `/communities/${m}/epochs/${epochIndex}/payable`,
        OperatorPayableSchema,
        { method: "GET", auth: true },
        opts,
      );
      if (result.epoch_index !== epochIndex) throw new HyphaeAdminError("identity_mismatch");
      return result;
    },
  };
}

export type HyphaeOperatorClient = ReturnType<typeof createHyphaeOperatorClient>;
