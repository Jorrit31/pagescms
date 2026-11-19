import { createHttpError, toErrorResponse } from "@/lib/api-error";
import { requireAdminSession } from "@/lib/admin";
import { normalizeSiteUrl, updateSiteSettings } from "@/lib/site-settings";

/**
 * Webstudio: settings of one site from the "Klanten" dashboard.
 * POST { owner, repo, siteUrl?: string, monthlyReport?: boolean }. Only for ADMIN_EMAILS.
 */
export async function POST(request: Request) {
  try {
    await requireAdminSession();
    const body: any = await request.json().catch(() => null);
    const owner = typeof body?.owner === "string" ? body.owner : "";
    const repo = typeof body?.repo === "string" ? body.repo : "";
    if (!/^[\w.-]+$/.test(owner) || !/^[\w.-]+$/.test(repo)) throw createHttpError("\"owner\" and \"repo\" are required.", 400);

    const changes: Record<string, unknown> = {};
    if ("siteUrl" in (body ?? {})) {
      if (body.siteUrl === null || body.siteUrl === "") {
        changes.siteUrl = undefined;
      } else {
        const siteUrl = normalizeSiteUrl(body.siteUrl);
        if (!siteUrl) throw createHttpError("Dat is geen webadres.", 400);
        changes.siteUrl = siteUrl;
      }
    }
    if (typeof body?.monthlyReport === "boolean") changes.monthlyReport = body.monthlyReport;

    const data = await updateSiteSettings(owner, repo, changes);
    return Response.json({ status: "success", data: { siteUrl: data.siteUrl ?? null, monthlyReport: data.monthlyReport !== false } });
  } catch (error) {
    return toErrorResponse(error);
  }
}
