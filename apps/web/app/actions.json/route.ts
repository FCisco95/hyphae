import { actionHeaders } from "../../lib/actions.js";

// Tells a blink client that a shared claim page is the epoch's claim Action. The second rule maps
// the Action to itself, so a link straight to it resolves too.
const rules = [
  { pathPattern: "/c/*/e/*/claim", apiPath: "/api/actions/claim/*/*" },
  { pathPattern: "/api/actions/**", apiPath: "/api/actions/**" },
];

export function GET() {
  return Response.json({ rules }, { headers: actionHeaders() });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: actionHeaders() });
}
