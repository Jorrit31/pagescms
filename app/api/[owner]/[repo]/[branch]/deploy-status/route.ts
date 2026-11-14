import { type NextRequest } from "next/server";
import { createOctokitInstance } from "@/lib/utils/octokit";
import { getToken } from "@/lib/token";
import { createHttpError, toErrorResponse } from "@/lib/api-error";
import { requireApiUserSession } from "@/lib/session-server";

/**
 * Has the website been rebuilt for this commit? Reads the checks and commit
 * statuses that the hosting (e.g. Cloudflare) reports back to GitHub.
 *
 * GET /api/[owner]/[repo]/[branch]/deploy-status?sha=...
 *
 * state: "pending" (building), "success", "failure", or "none" (no reports yet).
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ owner: string; repo: string; branch: string }> }
) {
  try {
    const params = await context.params;
    const sha = request.nextUrl.searchParams.get("sha");
    if (!sha || !/^[0-9a-f]{7,40}$/i.test(sha)) throw createHttpError("\"sha\" is required.", 400);

    const sessionResult = await requireApiUserSession();
    if ("response" in sessionResult) return sessionResult.response;
    const { token } = await getToken(sessionResult.user, params.owner, params.repo);
    if (!token) throw createHttpError("Token not found", 401);

    const octokit = createOctokitInstance(token);
    const states: string[] = [];

    try {
      const { data } = await octokit.rest.checks.listForRef({
        owner: params.owner,
        repo: params.repo,
        ref: sha,
        per_page: 50,
      });
      for (const run of data.check_runs) {
        if (run.status !== "completed") states.push("pending");
        else if (["success", "neutral", "skipped"].includes(run.conclusion ?? "")) states.push("success");
        else states.push("failure");
      }
    } catch (error: any) {
      // No "checks" permission: fall back to commit statuses only.
      if (error?.status !== 403 && error?.status !== 404) throw error;
    }

    try {
      const { data } = await octokit.rest.repos.getCombinedStatusForRef({
        owner: params.owner,
        repo: params.repo,
        ref: sha,
      });
      for (const status of data.statuses) {
        if (status.state === "pending") states.push("pending");
        else if (status.state === "success") states.push("success");
        else states.push("failure");
      }
    } catch (error: any) {
      if (error?.status !== 403 && error?.status !== 404) throw error;
    }

    const state = states.length === 0
      ? "none"
      : states.includes("pending")
        ? "pending"
        : states.includes("failure")
          ? "failure"
          : "success";

    return Response.json({ status: "success", data: { state } });
  } catch (error: any) {
    console.error(error);
    return toErrorResponse(error);
  }
}
