import { type AdminIntakeUpdate, AdminIntakeUpdateSchema } from "@hyphae/core";
import { requestPrivateAdmin } from "./admin-api.js";
import { boundedJson } from "./bounded-json.js";
import { memberLoginConfig } from "./member-login-config.js";

const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
const error = (status: number, code: string) => Response.json({ error: code }, { status, headers });
export const unsupportedAdminMethod = () => error(405, "invalid_request");

export async function adminProxy(
  request: Request,
  context: { params: Promise<{ mint: string }> },
  method: "GET" | "PUT",
) {
  try {
    const url = new URL(request.url);
    const config = memberLoginConfig(
      {
        appId: process.env.PRIVY_APP_ID,
        enabled: process.env.PRIVY_LOGIN_ENABLED,
        cookieDomain: process.env.PRIVY_LOGIN_HOST,
      },
      request.headers.get("host") ?? url.host,
    );
    if (process.env.HYPHAE_ADMIN_ENABLED !== "on" || !config) return error(404, "not_found");
    const { mint } = await context.params;
    if (!/^[A-Za-z0-9]{1,64}$/.test(mint) || url.search !== "")
      return error(400, "invalid_request");
    if (method === "PUT") {
      if (request.headers.get("origin") !== url.origin) return error(403, "forbidden");
      if (
        !/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(
          request.headers.get("content-type") ?? "",
        )
      )
        return error(400, "invalid_request");
    }
    const values =
      request.headers
        .get("cookie")
        ?.split(";")
        .map((part) => part.trim())
        .filter((part) => part.startsWith("privy-token="))
        .map((part) => part.slice(12)) ?? [];
    const token = values[0];
    if (
      values.length !== 1 ||
      !token ||
      token.length > 4096 ||
      !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)
    )
      return error(401, "unauthorized");
    let update: AdminIntakeUpdate | undefined;
    if (method === "PUT") {
      const abort = new AbortController();
      const cancel = () => abort.abort();
      request.signal.addEventListener("abort", cancel, { once: true });
      if (request.signal.aborted) cancel();
      const timer = setTimeout(cancel, 2000);
      try {
        const parsed = AdminIntakeUpdateSchema.safeParse(
          await boundedJson(request.body, 1024, abort.signal),
        );
        if (!parsed.success) return error(400, "invalid_request");
        update = parsed.data;
      } catch {
        return error(400, "invalid_request");
      } finally {
        clearTimeout(timer);
        request.signal.removeEventListener("abort", cancel);
        cancel();
      }
    }
    const apiUrl = process.env.HYPHAE_API_URL;
    if (!apiUrl) return error(503, "unavailable");
    const webToken = process.env.HYPHAE_API_TOKEN;
    const visitor = process.env.VERCEL === "1" ? request.headers.get("x-real-ip") : null;
    const result = await requestPrivateAdmin({
      mint,
      token,
      apiUrl,
      signal: request.signal,
      ...(update === undefined ? {} : { update }),
      ...(webToken && visitor ? { webToken, visitor } : {}),
    });
    return Response.json(result.body, {
      status: result.status,
      headers: { ...headers, ...(result.retryAfter ? { "Retry-After": result.retryAfter } : {}) },
    });
  } catch {
    return error(503, "unavailable");
  }
}
