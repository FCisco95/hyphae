import {
  BUILD_TIMEOUT_MS,
  operatorAction,
  unsupported,
} from "../../../../../../lib/operator-server.js";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Plans the next decided epoch and returns the unsigned transaction for the admin's wallet.
export async function POST(request: Request, context: { params: Promise<{ mint: string }> }) {
  const { mint } = await context.params;
  return operatorAction(request, mint, (client) =>
    client.buildPublish(mint, { timeoutMs: BUILD_TIMEOUT_MS }),
  );
}
export const GET = unsupported;
export const PUT = unsupported;
export const PATCH = unsupported;
export const DELETE = unsupported;
