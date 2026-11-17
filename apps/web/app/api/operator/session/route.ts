import {
  clearedCookie,
  failure,
  fromClientError,
  operatorClient,
  operatorToken,
  PRIVATE,
  sameSiteJson,
  sessionCookie,
  unsupported,
  visitorOf,
} from "../../../../lib/operator-server.js";

export const dynamic = "force-dynamic";

// Sign in: trade the signed challenge for a session; the token goes only into the cookie.
export async function POST(request: Request) {
  const body = await sameSiteJson(request);
  if (body instanceof Response) return body;
  const client = operatorClient(null, visitorOf(request.headers));
  if (!client) return failure(503, "unavailable");
  try {
    const input = body as { challenge_id?: unknown; signature?: unknown };
    const created = await client.createSession({
      challengeId: String(input?.challenge_id ?? ""),
      signature: String(input?.signature ?? ""),
    });
    const { token, ...session } = created;
    return Response.json(session, {
      headers: { ...PRIVATE, "Set-Cookie": sessionCookie(token, created.expires_at) },
    });
  } catch (error) {
    return fromClientError(error);
  }
}

// Sign out: end the API session if there is one, and always clear the cookie.
export async function DELETE(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return failure(403, "forbidden");
  const token = operatorToken(request.headers.get("cookie"));
  const client = token ? operatorClient(token, visitorOf(request.headers)) : null;
  if (client) await client.endSession().catch(() => undefined);
  return Response.json({ ended: true }, { headers: { ...PRIVATE, "Set-Cookie": clearedCookie } });
}
export const GET = unsupported;
export const PUT = unsupported;
export const PATCH = unsupported;
