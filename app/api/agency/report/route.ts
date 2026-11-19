import { createHttpError, toErrorResponse } from "@/lib/api-error";
import { requireAdminSession } from "@/lib/admin";
import { listSites } from "@/lib/agency";
import { sendMonthlyReportPreview } from "@/lib/monthly-report";

/**
 * Webstudio: mails Jorrit an example of a site's monthly report (last month),
 * from the "Klanten" dashboard. Doesn't count as sent. Only for ADMIN_EMAILS.
 * POST { owner, repo }
 */
export async function POST(request: Request) {
  try {
    const { user } = await requireAdminSession();
    const body: any = await request.json().catch(() => null);
    const site = (await listSites()).find((item) =>
      item.owner.toLowerCase() === String(body?.owner ?? "").toLowerCase()
      && item.repo.toLowerCase() === String(body?.repo ?? "").toLowerCase());
    if (!site) throw createHttpError("Website niet gevonden.", 404);
    await sendMonthlyReportPreview(site, user.email);
    return Response.json({ status: "success", data: { to: user.email } });
  } catch (error) {
    return toErrorResponse(error);
  }
}
