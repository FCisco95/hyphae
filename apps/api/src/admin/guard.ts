export type AdminErrorCode =
  | "invalid_request"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "unavailable";

export class AdminError extends Error {
  constructor(
    readonly code: AdminErrorCode,
    readonly status: 400 | 401 | 403 | 404 | 409 | 429 | 503,
  ) {
    super(code);
  }
}

export function assertActive(signal: AbortSignal, deadline?: number): void {
  if (signal.aborted || (deadline !== undefined && Date.now() >= deadline))
    throw new AdminError("unavailable", 503);
}

// Providers and queued database work can ignore AbortSignal. The caller must also check it
// inside the transaction, on both sides of the update, before allowing a commit.
export async function within<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) {
    void Promise.resolve(work).catch(() => undefined);
  }
  assertActive(signal);
  let cancel!: () => void;
  const aborted = new Promise<never>((_, reject) => {
    cancel = () => reject(new AdminError("unavailable", 503));
    signal.addEventListener("abort", cancel, { once: true });
  });
  try {
    const result = await Promise.race([work, aborted]);
    assertActive(signal);
    return result;
  } finally {
    signal.removeEventListener("abort", cancel);
  }
}
