// Bundle canonical schemas so consumers need no workspace package at runtime.

import type { AdminCommunity, AdminIntakeUpdate } from "../../core/src/admin-api.js";
import { AdminCommunitySchema, AdminIntakeUpdateSchema } from "../../core/src/admin-api.js";

export type { AdminCommunity, AdminIntakeUpdate };

export type AdminErrorCode =
  | "invalid_configuration"
  | "invalid_input"
  | "unauthorized"
  | "forbidden"
  | "conflict"
  | "token_error"
  | "aborted"
  | "timeout"
  | "network_error"
  | "bad_request"
  | "not_found"
  | "rate_limited"
  | "unavailable"
  | "http_error"
  | "response_too_large"
  | "invalid_json"
  | "schema_mismatch"
  | "identity_mismatch";

export class HyphaeAdminError extends Error {
  readonly name = "HyphaeAdminError";

  constructor(
    readonly code: AdminErrorCode,
    readonly status?: number,
    readonly retryAfterSeconds?: number,
  ) {
    super(code);
  }
}

export interface ClientOptions {
  /** Exact API base ending in /admin/v1 (optional trailing slash). */
  baseUrl: string;
  /** Current app-bound user credential; called once per request, never persisted. */
  getAccessToken: () => string | null | Promise<string | null>;
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
}

export interface RequestOptions {
  signal?: AbortSignal;
}

const MINT = /^[A-Za-z0-9]{1,64}$/;
const COMPACT_JWT = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const MAX_BODY_BYTES = 16 * 1024;

function validateMint(mint: string) {
  if (typeof mint !== "string" || !MINT.test(mint)) throw new HyphaeAdminError("invalid_input");
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

export function createHyphaeAdminClient(options: ClientOptions) {
  let base: URL;
  try {
    if (typeof options?.baseUrl !== "string") throw new Error();
    base = new URL(options.baseUrl);
  } catch {
    throw new HyphaeAdminError("invalid_configuration");
  }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname);
  if (
    (base.protocol !== "https:" && !(base.protocol === "http:" && local)) ||
    base.username ||
    base.password ||
    base.search ||
    base.hash ||
    /[?#]/.test(options.baseUrl) ||
    !/^\/admin\/v1\/?$/.test(base.pathname) ||
    typeof options.getAccessToken !== "function"
  ) {
    throw new HyphaeAdminError("invalid_configuration");
  }
  const timeoutMs = options.timeoutMs ?? 10_000;
  const fetchImpl = options.fetch ?? globalThis.fetch?.bind(globalThis);
  if (
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs < 1 ||
    timeoutMs > 2_147_483_647 ||
    typeof fetchImpl !== "function"
  ) {
    throw new HyphaeAdminError("invalid_configuration");
  }
  const origin = base.href.replace(/\/$/, "");
  const getAccessToken = options.getAccessToken;

  async function request(
    mint: string,
    update: AdminIntakeUpdate | undefined,
    { signal }: RequestOptions,
  ): Promise<AdminCommunity> {
    if (signal?.aborted) throw new HyphaeAdminError("aborted");
    const controller = new AbortController();
    let timedOut = false;
    let response: Response | undefined;
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    const abort = () => controller.abort();
    signal?.addEventListener("abort", abort, { once: true });
    const cancellationError = () => new HyphaeAdminError(timedOut ? "timeout" : "aborted");
    const cancelled = new Promise<never>((_resolve, reject) => {
      controller.signal.addEventListener("abort", () => reject(cancellationError()), {
        once: true,
      });
    });
    const checkCancellation = () => {
      if (controller.signal.aborted) throw cancellationError();
    };
    const wait = <T>(operation: () => T | Promise<T>): Promise<T> =>
      Promise.race([
        Promise.resolve().then(() => {
          checkCancellation();
          return operation();
        }),
        cancelled,
      ]);
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    try {
      let token: string | null;
      try {
        token = await wait(getAccessToken);
      } catch {
        checkCancellation();
        throw new HyphaeAdminError("token_error");
      }
      checkCancellation();
      if (typeof token !== "string" || token.length > 4096 || !COMPACT_JWT.test(token)) {
        throw new HyphaeAdminError("unauthorized");
      }
      response = await wait(async () => {
        const result = await fetchImpl(`${origin}/communities/${mint}${update ? "/intake" : ""}`, {
          method: update ? "PUT" : "GET",
          headers: {
            accept: "application/json",
            authorization: `Bearer ${token}`,
            ...(update ? { "content-type": "application/json" } : {}),
          },
          ...(update ? { body: JSON.stringify(update) } : {}),
          credentials: "omit",
          redirect: "error",
          cache: "no-store",
          signal: controller.signal,
        });
        // A custom transport may resolve after cancellation and ignore the signal.
        if (controller.signal.aborted) {
          void result.body?.cancel().catch(() => {});
          throw cancellationError();
        }
        return result;
      });
      if (!response.ok) {
        const codes: Record<number, AdminErrorCode> = {
          400: "bad_request",
          401: "unauthorized",
          403: "forbidden",
          404: "not_found",
          409: "conflict",
          429: "rate_limited",
          503: "unavailable",
        };
        throw new HyphaeAdminError(
          codes[response.status] ?? "http_error",
          response.status,
          response.status === 429 ? retryAfter(response.headers.get("retry-after")) : undefined,
        );
      }
      const contentLength = response.headers.get("content-length");
      if (contentLength && /^\d+$/.test(contentLength) && Number(contentLength) > MAX_BODY_BYTES) {
        throw new HyphaeAdminError("response_too_large");
      }
      reader = response.body?.getReader();
      const bytes = new Uint8Array(MAX_BODY_BYTES);
      let size = 0;
      if (reader) {
        const bodyReader = reader;
        while (true) {
          const { done, value } = await wait(() => bodyReader.read());
          if (done) break;
          if (size + value.byteLength > MAX_BODY_BYTES) {
            throw new HyphaeAdminError("response_too_large");
          }
          bytes.set(value, size);
          size += value.byteLength;
        }
      }
      checkCancellation();
      let body: unknown;
      try {
        body = JSON.parse(
          new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, size)),
        );
      } catch {
        throw new HyphaeAdminError("invalid_json");
      }
      const parsed = AdminCommunitySchema.safeParse(body);
      if (!parsed.success) throw new HyphaeAdminError("schema_mismatch");
      if (parsed.data.community.mint !== mint) throw new HyphaeAdminError("identity_mismatch");
      return parsed.data;
    } catch (error) {
      if (controller.signal.aborted) throw cancellationError();
      if (error instanceof HyphaeAdminError) throw error;
      throw new HyphaeAdminError("network_error");
    } finally {
      // Do not await cancellation: a custom stream may never resolve cancel().
      controller.abort();
      if (reader) void reader.cancel().catch(() => {});
      else if (response?.body) void response.body.cancel().catch(() => {});
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    }
  }

  return {
    getCommunity(mint: string, opts: RequestOptions = {}): Promise<AdminCommunity> {
      validateMint(mint);
      return request(mint, undefined, opts);
    },
    setIntakePaused(
      mint: string,
      update: AdminIntakeUpdate,
      opts: RequestOptions = {},
    ): Promise<AdminCommunity> {
      validateMint(mint);
      const parsed = AdminIntakeUpdateSchema.safeParse(update);
      if (!parsed.success) throw new HyphaeAdminError("invalid_input");
      return request(mint, parsed.data, opts);
    },
  };
}

export type HyphaeAdminClient = ReturnType<typeof createHyphaeAdminClient>;
