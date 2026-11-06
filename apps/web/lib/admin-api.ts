import {
  AdminCommunitySchema,
  type AdminIntakeUpdate,
  AdminIntakeUpdateSchema,
} from "@hyphae/core";
import { boundedJson } from "./bounded-json.js";

const unavailable = () => ({ status: 503, body: { error: "unavailable" } });
const failures: Record<number, string> = {
  400: "invalid_request",
  401: "unauthorized",
  403: "forbidden",
  404: "not_found",
  409: "conflict",
  429: "unavailable",
  503: "unavailable",
};

export async function requestPrivateAdmin({
  mint,
  token,
  apiUrl,
  update,
  signal,
  webToken,
  visitor,
}: {
  mint: string;
  token: string;
  apiUrl: string;
  update?: AdminIntakeUpdate;
  signal?: AbortSignal;
  webToken?: string;
  visitor?: string;
}): Promise<{ status: number; body: unknown; retryAfter?: string }> {
  const abort = new AbortController();
  const cancel = () => abort.abort();
  signal?.addEventListener("abort", cancel, { once: true });
  if (signal?.aborted) cancel();
  const timer = setTimeout(cancel, 5500);
  let stopWaiting = () => {};
  const cancelled = new Promise<never>((_, reject) => {
    stopWaiting = () => reject(new Error("unavailable"));
    abort.signal.addEventListener("abort", stopWaiting, { once: true });
  });
  try {
    abort.signal.throwIfAborted();
    const url = new URL(apiUrl);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== "/"
    )
      return unavailable();
    if (
      !/^[A-Za-z0-9]{1,64}$/.test(mint) ||
      token.length > 4096 ||
      !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)
    )
      return unavailable();
    if (update !== undefined && !AdminIntakeUpdateSchema.safeParse(update).success)
      return unavailable();
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
    if (update !== undefined) headers["Content-Type"] = "application/json";
    if (webToken && visitor && /^[0-9A-Fa-f:.]{1,45}$/.test(visitor)) {
      headers["x-hyphae-web-token"] = webToken;
      headers["x-hyphae-visitor"] = visitor;
    }
    const upstream = await Promise.race([
      fetch(
        `${url.origin}/admin/v1/communities/${encodeURIComponent(mint)}${update === undefined ? "" : "/intake"}`,
        {
          method: update === undefined ? "GET" : "PUT",
          headers,
          ...(update === undefined ? {} : { body: JSON.stringify(update) }),
          credentials: "omit",
          cache: "no-store",
          redirect: "error",
          signal: abort.signal,
        },
      ),
      cancelled,
    ]);
    if (upstream.status !== 200) {
      void upstream.body?.cancel().catch(() => {});
      const retry = upstream.headers.get("retry-after");
      return {
        status: failures[upstream.status] ? upstream.status : 503,
        body: { error: failures[upstream.status] ?? "unavailable" },
        ...(upstream.status === 429 && retry && /^\d{1,6}$/.test(retry)
          ? { retryAfter: retry }
          : {}),
      };
    }
    const parsed = AdminCommunitySchema.safeParse(
      await boundedJson(upstream.body, 16384, abort.signal),
    );
    if (!parsed.success || parsed.data.community.mint !== mint) return unavailable();
    return { status: 200, body: parsed.data };
  } catch {
    return unavailable();
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
    abort.signal.removeEventListener("abort", stopWaiting);
    cancel();
  }
}
