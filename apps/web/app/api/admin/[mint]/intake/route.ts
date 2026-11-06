import { adminProxy, unsupportedAdminMethod } from "../../../../../lib/admin-proxy.js";
export const dynamic = "force-dynamic";
export const PUT = (request: Request, context: { params: Promise<{ mint: string }> }) =>
  adminProxy(request, context, "PUT");
export const GET = unsupportedAdminMethod;
export const POST = unsupportedAdminMethod;
export const PATCH = unsupportedAdminMethod;
export const DELETE = unsupportedAdminMethod;
export const OPTIONS = unsupportedAdminMethod;
export const HEAD = unsupportedAdminMethod;
