import { type AdminCommunity, AdminCommunitySchema, type AdminIntakeUpdate } from "@hyphae/core";
import { boundedJson } from "./bounded-json.js";

export type AdminState =
  | { kind: "admin"; account: AdminCommunity }
  | {
      kind:
        | "loading"
        | "logged_out"
        | "forbidden"
        | "not_found"
        | "rate_limited"
        | "unavailable"
        | "conflict"
        | "write_unknown"
        | "session_expired";
    };

// Privy's refresh cannot be cancelled, so stop waiting and ignore any late result.
export async function renewAdminSession(
  readToken: () => Promise<string | null>,
  signal: AbortSignal,
) {
  signal.throwIfAborted();
  let cancel = () => {};
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stopped = new Promise<never>((_, reject) => {
    cancel = () => reject(new Error("session_unavailable"));
    signal.addEventListener("abort", cancel, { once: true });
    timer = setTimeout(cancel, 5500);
  });
  try {
    await Promise.race([
      Promise.resolve().then(() => {
        signal.throwIfAborted();
        return readToken();
      }),
      stopped,
    ]);
    signal.throwIfAborted();
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", cancel);
  }
}

export async function requestAdminState(
  mint: string,
  signal: AbortSignal,
  update?: AdminIntakeUpdate,
): Promise<AdminState> {
  const abort = new AbortController();
  const cancel = () => abort.abort();
  signal.addEventListener("abort", cancel, { once: true });
  if (signal.aborted) cancel();
  const timer = setTimeout(cancel, 10000);
  let stopWaiting = () => {};
  const cancelled = new Promise<never>((_, reject) => {
    stopWaiting = () => reject(new Error("unavailable"));
    abort.signal.addEventListener("abort", stopWaiting, { once: true });
  });
  try {
    abort.signal.throwIfAborted();
    const response = await Promise.race([
      fetch(`/api/admin/${encodeURIComponent(mint)}${update === undefined ? "" : "/intake"}`, {
        method: update === undefined ? "GET" : "PUT",
        credentials: "same-origin",
        cache: "no-store",
        redirect: "error",
        signal: abort.signal,
        ...(update === undefined
          ? {}
          : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(update) }),
      }),
      cancelled,
    ]);
    if (response.status !== 200) {
      void response.body?.cancel().catch(() => {});
      const states = {
        401: "logged_out",
        403: "forbidden",
        404: "not_found",
        409: "conflict",
        429: "rate_limited",
      } as const;
      return {
        kind:
          states[response.status as keyof typeof states] ??
          (update === undefined ? "unavailable" : "write_unknown"),
      };
    }
    const parsed = AdminCommunitySchema.safeParse(
      await boundedJson(response.body, 16384, abort.signal),
    );
    if (!parsed.success || parsed.data.community.mint !== mint)
      return { kind: update === undefined ? "unavailable" : "write_unknown" };
    return { kind: "admin", account: parsed.data };
  } catch {
    return { kind: update === undefined ? "unavailable" : "write_unknown" };
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", cancel);
    abort.signal.removeEventListener("abort", stopWaiting);
    cancel();
  }
}
