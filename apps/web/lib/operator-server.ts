import {
  createHyphaeOperatorClient,
  HyphaeAdminError,
  type HyphaeOperatorClient,
} from "@hyphae/admin-client/source";
import { boundedJson } from "./bounded-json.js";

// Server side of the operator page. The browser never sees the session token: it lives in an
// httpOnly, Secure, SameSite=Strict cookie that only these handlers read, and every call to the
// API goes through @hyphae/admin-client.

export const OPERATOR_COOKIE = "__Host-hyphae-operator";
const TOKEN = /^hop_[A-Za-z0-9_-]{43}$/;
export const PRIVATE = { "Cache-Control": "private, no-store", Vary: "Cookie" } as const;
export const SESSION_MAX_AGE = 4 * 3600;

export const failure = (status: number, code: string, extra: Record<string, string> = {}) =>
  Response.json({ error: code }, { status, headers: { ...PRIVATE, ...extra } });
export const unsupported = () => failure(405, "invalid_request");

// The one operator cookie in a Cookie header, or null (missing, repeated or malformed).
export function operatorToken(cookieHeader: string | null): string | null {
  const values =
    cookieHeader
      ?.split(";")
      .map((part) => part.trim())
      .filter((part) => part.startsWith(`${OPERATOR_COOKIE}=`))
      .map((part) => part.slice(OPERATOR_COOKIE.length + 1)) ?? [];
  const [token] = values;
  return values.length === 1 && token && TOKEN.test(token) ? token : null;
}

export function sessionCookie(token: string, expiresAt: string, now = Date.now()): string {
  const seconds = Math.floor((Date.parse(expiresAt) - now) / 1000);
  const maxAge = Math.max(0, Math.min(SESSION_MAX_AGE, Number.isFinite(seconds) ? seconds : 0));
  return `${OPERATOR_COOKIE}=${token}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict`;
}
export const clearedCookie = `${OPERATOR_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;

// The visitor's address for the API's rate limits, forwarded only on Vercel with the web token.
export function visitorOf(headers: Headers): string | null {
  return process.env.VERCEL === "1" ? headers.get("x-real-ip") : null;
}

// Null when the API is not configured: the page then says it is unavailable.
export function operatorClient(
  token: string | null,
  visitor: string | null,
): HyphaeOperatorClient | null {
  const apiUrl = process.env.HYPHAE_API_URL;
  if (!apiUrl) return null;
  let origin: string;
  try {
    const url = new URL(apiUrl);
    if (url.pathname !== "/" || url.search || url.hash || url.username || url.password) return null;
    origin = url.origin;
  } catch {
    return null;
  }
  const webToken = process.env.HYPHAE_API_TOKEN;
  try {
    return createHyphaeOperatorClient({
      baseUrl: `${origin}/admin/v1`,
      getSessionToken: () => token,
      timeoutMs: 5500,
      ...(webToken && visitor && /^[0-9A-Fa-f:.]{1,45}$/.test(visitor)
        ? { headers: { "x-hyphae-web-token": webToken, "x-hyphae-visitor": visitor } }
        : {}),
    });
  } catch {
    return null;
  }
}

const STATUS: Record<string, number> = {
  bad_request: 400,
  invalid_input: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  disabled: 404,
  rate_limited: 429,
};

// The API's answer as the proxy's answer: fixed codes only, never a provider's text.
export function fromClientError(error: unknown): Response {
  if (!(error instanceof HyphaeAdminError)) return failure(503, "unavailable");
  const status = STATUS[error.code] ?? 503;
  const code =
    error.code === "disabled"
      ? "disabled"
      : status === 400
        ? "invalid_request"
        : status === 503 || status === 429
          ? "unavailable"
          : error.code;
  return failure(
    status,
    code,
    status === 429 && error.retryAfterSeconds !== undefined
      ? { "Retry-After": String(error.retryAfterSeconds) }
      : {},
  );
}

// A state-changing request from this site only: same Origin, a JSON body of at most 1 KiB.
export async function sameSiteJson(request: Request): Promise<unknown | Response> {
  const url = new URL(request.url);
  if (request.headers.get("origin") !== url.origin) return failure(403, "forbidden");
  if (
    !/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers.get("content-type") ?? "")
  )
    return failure(400, "invalid_request");
  try {
    return await boundedJson(request.body, 1024, AbortSignal.timeout(2000));
  } catch {
    return failure(400, "invalid_request");
  }
}

const MINT = /^[A-Za-z0-9]{1,64}$/;
// Part B's proxy: a session cookie, a well-formed mint and, for a POST, this site's Origin and a
// small JSON body. The API decides everything else; its answer passes through as fixed codes.
export async function operatorAction<T>(
  request: Request,
  mint: string,
  work: (client: HyphaeOperatorClient, body: unknown) => Promise<T>,
): Promise<Response> {
  if (!MINT.test(mint)) return failure(400, "invalid_request");
  let body: unknown = null;
  if (request.method === "POST") {
    const parsed = await sameSiteJson(request);
    if (parsed instanceof Response) return parsed;
    body = parsed;
  }
  const token = operatorToken(request.headers.get("cookie"));
  if (!token) return failure(401, "unauthorized");
  const client = operatorClient(token, visitorOf(request.headers));
  if (!client) return failure(503, "unavailable");
  try {
    return Response.json(await work(client, body), { headers: PRIVATE });
  } catch (error) {
    return fromClientError(error);
  }
}

const field = (body: unknown, key: string): string =>
  typeof body === "object" &&
  body !== null &&
  typeof (body as Record<string, unknown>)[key] === "string"
    ? ((body as Record<string, unknown>)[key] as string)
    : "";
export const submitInput = (body: unknown) => ({
  buildId: field(body, "build_id"),
  signature: field(body, "signature"),
});
export const feeRecipientOf = (body: unknown) => ({ feeRecipient: field(body, "fee_recipient") });
// A build reads the chain; a submit waits for the transaction's confirmation.
export const BUILD_TIMEOUT_MS = 25_000;
export const SUBMIT_TIMEOUT_MS = 95_000;
