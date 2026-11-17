import { type NextRequest } from "next/server";
import { createHttpError, toErrorResponse } from "@/lib/api-error";
import { getRepoReadContext } from "@/lib/api-repo-context";
import { getAllowedContent } from "@/lib/collaborator-permissions";
import { getSiteStats, STATS_PERMISSION } from "@/lib/stats";

/**
 * Visitor numbers of the website ("Bezoekers").
 *
 * GET ?days=7|30|90|365  -> SiteStats
 * GET ?check=1           -> { allowed: true } (for the sidebar)
 */

type Params = { params: Promise<{ owner: string; repo: string; branch: string }> };

export async function GET(request: NextRequest, context: Params) {
  try {
    const params = await context.params;
    const { user } = await getRepoReadContext(params);
    const allowed = await getAllowedContent(user, params.owner, params.repo);
    if (allowed && !allowed.includes(STATS_PERMISSION)) {
      throw createHttpError("You can't see the visitors of this website.", 403);
    }
    if (request.nextUrl.searchParams.get("check")) return Response.json({ status: "success", data: { allowed: true } });
    const asked = Number(request.nextUrl.searchParams.get("days"));
    const days = [7, 30, 90, 365].includes(asked) ? asked : 30;
    const stats = await getSiteStats(params.owner, params.repo, days);
    return Response.json({ status: "success", data: stats });
  } catch (error) {
    return toErrorResponse(error);
  }
}
