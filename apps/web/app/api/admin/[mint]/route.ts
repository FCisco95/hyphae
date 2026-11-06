import { adminProxy, unsupportedAdminMethod } from "../../../../lib/admin-proxy.js";
export const dynamic = "force-dynamic";
export const GET = (request: Request, context: { params: Promise<{ mint: string }> }) =>
  adminProxy(request, context, "GET");
export const POST = unsupportedAdminMethod;
export const PUT = unsupportedAdminMethod;
export const PATCH = unsupportedAdminMethod;
export const DELETE = unsupportedAdminMethod;
export const OPTIONS = unsupportedAdminMethod;
export const HEAD = unsupportedAdminMethod;
