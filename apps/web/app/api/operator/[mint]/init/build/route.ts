import {
  BUILD_TIMEOUT_MS,
  feeRecipientOf,
  operatorAction,
  unsupported,
} from "../../../../../../lib/operator-server.js";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// A setup session: initialize_community with the recorded fee recipient, for the wallet to sign.
export async function POST(request: Request, context: { params: Promise<{ mint: string }> }) {
  const { mint } = await context.params;
  return operatorAction(request, mint, (client, body) =>
    client.buildInit(mint, feeRecipientOf(body), { timeoutMs: BUILD_TIMEOUT_MS }),
  );
}
export const GET = unsupported;
export const PUT = unsupported;
export const PATCH = unsupported;
export const DELETE = unsupported;
