import { type NextRequest } from "next/server";
import { createHttpError, toErrorResponse } from "@/lib/api-error";
import { getRepoReadContext } from "@/lib/api-repo-context";
import { getAllowedContent } from "@/lib/collaborator-permissions";
import { ACTIVITY_PERMISSION, getActivity } from "@/lib/activity";

/**
 * Webstudio: the "Logboek" of a website (who changed what, when).
 *
 * GET ?check=1     -> { allowed: true } (for the sidebar)
 * GET ?before=<id> -> the next 50 entries, newest first
 */

type Params = { params: Promise<{ owner: string; repo: string; branch: string }> };

const PAGE = 50;

export async function GET(request: NextRequest, context: Params) {
  try {
    const params = await context.params;
    const { user } = await getRepoReadContext(params);
    const allowed = await getAllowedContent(user, params.owner, params.repo);
    if (allowed && !allowed.includes(ACTIVITY_PERMISSION)) {
      throw createHttpError("You can't see the log of this website.", 403);
    }
    if (request.nextUrl.searchParams.get("check")) return Response.json({ status: "success", data: { allowed: true } });
    const before = Number(request.nextUrl.searchParams.get("before")) || undefined;
    const entries = await getActivity(params.owner, params.repo, { limit: PAGE + 1, before });
    return Response.json({
      status: "success",
      data: { entries: entries.slice(0, PAGE), more: entries.length > PAGE },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
