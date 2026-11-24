import {
  operatorAction,
  SUBMIT_TIMEOUT_MS,
  submitInput,
  unsupported,
} from "../../../../../../lib/operator-server.js";

export const dynamic = "force-dynamic";
export const maxDuration = 100;

export async function POST(request: Request, context: { params: Promise<{ mint: string }> }) {
  const { mint } = await context.params;
  return operatorAction(request, mint, (client, body) =>
    client.submitInit(mint, submitInput(body), { timeoutMs: SUBMIT_TIMEOUT_MS }),
  );
}
export const GET = unsupported;
export const PUT = unsupported;
export const PATCH = unsupported;
export const DELETE = unsupported;
