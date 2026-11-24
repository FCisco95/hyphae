import { operatorAction, unsupported } from "../../../../../../lib/operator-server.js";

export const dynamic = "force-dynamic";

// Whether browser publish is on, and this session's latest build (the page polls it).
export async function GET(request: Request, context: { params: Promise<{ mint: string }> }) {
  const { mint } = await context.params;
  return operatorAction(request, mint, (client) => client.publishStatus(mint));
}
export const POST = unsupported;
export const PUT = unsupported;
export const PATCH = unsupported;
export const DELETE = unsupported;
