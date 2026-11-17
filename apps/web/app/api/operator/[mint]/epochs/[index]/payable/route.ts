import {
  failure,
  fromClientError,
  operatorClient,
  operatorToken,
  PRIVATE,
  unsupported,
  visitorOf,
} from "../../../../../../../lib/operator-server.js";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ mint: string; index: string }> },
) {
  const { mint, index } = await context.params;
  if (!/^[A-Za-z0-9]{1,64}$/.test(mint) || !/^(0|[1-9][0-9]{0,8})$/.test(index))
    return failure(400, "invalid_request");
  const token = operatorToken(request.headers.get("cookie"));
  if (!token) return failure(401, "unauthorized");
  const client = operatorClient(token, visitorOf(request.headers));
  if (!client) return failure(503, "unavailable");
  try {
    return Response.json(await client.payable(mint, Number(index)), { headers: PRIVATE });
  } catch (error) {
    return fromClientError(error);
  }
}
export const POST = unsupported;
export const PUT = unsupported;
export const PATCH = unsupported;
export const DELETE = unsupported;
