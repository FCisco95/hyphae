import { readPrivateMember } from "../../../../lib/member-api.js";
import { memberLoginConfig } from "../../../../lib/member-login-config.js";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };

export async function GET(
  request: Request,
  context: { params: Promise<{ mint: string }> },
): Promise<Response> {
  try {
    const config = memberLoginConfig(
      {
        appId: process.env.PRIVY_APP_ID,
        enabled: process.env.PRIVY_LOGIN_ENABLED,
        cookieDomain: process.env.PRIVY_LOGIN_HOST,
      },
      request.headers.get("host") ?? new URL(request.url).host,
    );
    if (!config) return Response.json({ error: "not_found" }, { status: 404, headers });
    const { mint } = await context.params;
    if (!/^[A-Za-z0-9]{1,64}$/.test(mint) || new URL(request.url).search !== "")
      return Response.json({ error: "invalid_request" }, { status: 400, headers });
    // Read the raw cookie list so duplicate credentials cannot be silently collapsed by a Map.
    const cookie = request.headers.get("cookie");
    const values =
      cookie
        ?.split(";")
        .map((part) => part.trim())
        .filter((part) => part.startsWith("privy-token="))
        .map((part) => part.slice("privy-token=".length)) ?? [];
    const token = values[0];
    if (
      values.length !== 1 ||
      !token ||
      token.length > 4096 ||
      !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)
    )
      return Response.json({ error: "unauthorized" }, { status: 401, headers });
    const apiUrl = process.env.HYPHAE_API_URL;
    if (!apiUrl) return Response.json({ error: "unavailable" }, { status: 503, headers });
    const webToken = process.env.HYPHAE_API_TOKEN;
    const visitor = process.env.VERCEL === "1" ? request.headers.get("x-real-ip") : null;
    const result = await readPrivateMember({
      mint,
      token,
      apiUrl,
      signal: request.signal,
      ...(webToken && visitor ? { webToken, visitor } : {}),
    });
    return Response.json(result.body, { status: result.status, headers });
  } catch {
    return Response.json({ error: "unavailable" }, { status: 503, headers });
  }
}

const unsupported = () => Response.json({ error: "invalid_request" }, { status: 405, headers });
export const POST = unsupported;
export const PUT = unsupported;
export const PATCH = unsupported;
export const DELETE = unsupported;
export const OPTIONS = unsupported;
