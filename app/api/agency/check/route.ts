import { type NextRequest } from "next/server";
import { createHttpError, toErrorResponse } from "@/lib/api-error";
import { requireAdminSession } from "@/lib/admin";
import { checkSite } from "@/lib/agency";

/**
 * Webstudio: the slow checks for one site on the "Klanten" dashboard.
 * GET ?owner=...&repo=... -> SiteCheck. Only for ADMIN_EMAILS.
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdminSession();
    const owner = request.nextUrl.searchParams.get("owner") || "";
    const repo = request.nextUrl.searchParams.get("repo") || "";
    if (!/^[\w.-]+$/.test(owner) || !/^[\w.-]+$/.test(repo)) throw createHttpError("\"owner\" and \"repo\" are required.", 400);
    return Response.json({ status: "success", data: await checkSite(owner, repo) });
  } catch (error) {
    return toErrorResponse(error);
  }
}
