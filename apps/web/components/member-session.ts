import { MemberAccountSchema } from "@hyphae/core";
import type { MemberViewState } from "./member-account.js";

export function requestGeneration(): {
  invalidate(): void;
  run<T>(operation: (signal: AbortSignal) => Promise<T>, apply: (value: T) => void): Promise<void>;
} {
  let generation = 0;
  let controller: AbortController | undefined;
  const invalidate = () => {
    generation += 1;
    controller?.abort();
  };
  return {
    invalidate,
    async run(operation, apply) {
      invalidate();
      const current = generation;
      controller = new AbortController();
      const signal = controller.signal;
      const value = await operation(signal);
      if (current === generation && !signal.aborted) apply(value);
    },
  };
}

export async function readMemberState(mint: string, signal: AbortSignal): Promise<MemberViewState> {
  try {
    const response = await fetch(`/api/member/${encodeURIComponent(mint)}`, {
      cache: "no-store",
      credentials: "same-origin",
      signal: AbortSignal.any([signal, AbortSignal.timeout(6500)]),
    });
    if (response.status === 401) return { kind: "logged_out" };
    if (response.status === 429) return { kind: "rate_limited" };
    if (response.status !== 200) return { kind: "unavailable" };
    const parsed = MemberAccountSchema.safeParse(await response.json());
    if (!parsed.success || parsed.data.community.mint !== mint) return { kind: "unavailable" };
    return { kind: "account", account: parsed.data };
  } catch {
    return { kind: "unavailable" };
  }
}
