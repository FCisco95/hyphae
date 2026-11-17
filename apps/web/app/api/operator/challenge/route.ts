import {
  failure,
  fromClientError,
  operatorClient,
  PRIVATE,
  sameSiteJson,
  unsupported,
  visitorOf,
} from "../../../../lib/operator-server.js";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await sameSiteJson(request);
  if (body instanceof Response) return body;
  const client = operatorClient(null, visitorOf(request.headers));
  if (!client) return failure(503, "unavailable");
  try {
    const input = body as { mint?: unknown; wallet?: unknown };
    const challenge = await client.requestChallenge({
      mint: String(input?.mint ?? ""),
      wallet: String(input?.wallet ?? ""),
    });
    return Response.json(challenge, { headers: PRIVATE });
  } catch (error) {
    return fromClientError(error);
  }
}
export const GET = unsupported;
export const PUT = unsupported;
export const PATCH = unsupported;
export const DELETE = unsupported;
