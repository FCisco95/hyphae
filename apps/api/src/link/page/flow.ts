export type Post = (
  path: string,
  body: unknown,
) => Promise<{ ok: boolean; data: Record<string, unknown> }>;

// A body that is not a JSON object (null, text, a number, an array) is a server we cannot read, the
// same as no body at all. Callers can then rely on `data` being an object.
export async function answerOf(r: {
  ok: boolean;
  json: () => Promise<unknown>;
}): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const body = await r.json().catch(() => undefined);
  const isObject = typeof body === "object" && body !== null && !Array.isArray(body);
  return {
    ok: r.ok,
    data: isObject ? (body as Record<string, unknown>) : { error: "link_unavailable" },
  };
}

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
