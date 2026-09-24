export type Post = (
  path: string,
  body: unknown,
) => Promise<{ ok: boolean; data: Record<string, unknown> }>;

export type Outcome = { linked: string } | { error: string };

// The link may commit even when its answer is lost, whether as link_unavailable or as a dropped
// connection. Either way ask /status, which reads durable state; never resend the proof.
export async function verifyAndReconcile(
  post: Post,
  token: string,
  proof: { requestId: string; nonce: string; message: string; signature: string },
): Promise<Outcome> {
  const done = await post("verify", { token, ...proof }).catch(() => undefined);
  if (done?.ok && typeof done.data.wallet === "string") return { linked: done.data.wallet };
  if (done && done.data.error !== "link_unavailable") {
    return { error: typeof done.data.error === "string" ? done.data.error : "link_unavailable" };
  }
  const status = await post("status", { token }).catch(() => undefined);
  if (status?.ok && status.data.linked === true && typeof status.data.wallet === "string") {
    return { linked: status.data.wallet };
  }
  return { error: "link_unavailable" };
}
