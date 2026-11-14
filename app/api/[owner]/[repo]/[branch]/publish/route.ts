import { createOctokitInstance } from "@/lib/utils/octokit";
import { getToken } from "@/lib/token";
import { createHttpError, toErrorResponse } from "@/lib/api-error";
import { requireApiUserSession } from "@/lib/session-server";
import { hasGithubIdentity } from "@/lib/authz-shared";
import { CONCEPT_BRANCH } from "@/lib/concept";

type Params = { owner: string; repo: string; branch: string };

const getContext = async (params: Params) => {
  const sessionResult = await requireApiUserSession();
  if ("response" in sessionResult) {
    throw createHttpError("Not signed in.", sessionResult.response?.status ?? 401);
  }
  const user = sessionResult.user;
  const { token } = await getToken(user, params.owner, params.repo);
  if (!token) throw createHttpError("Token not found", 401);
  const octokit = createOctokitInstance(token);
  const { data: repoData } = await octokit.rest.repos.get({ owner: params.owner, repo: params.repo });
  return { user, octokit, defaultBranch: repoData.default_branch };
};

/**
 * Concept status: how many saved changes are not on the live site yet.
 *
 * GET /api/[owner]/[repo]/concept/publish
 *
 * When the concept branch is only behind (someone changed the live site
 * directly), it is moved forward so the concept never shows old content.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<Params> }
) {
  try {
    const params = await context.params;
    const branch = decodeURIComponent(params.branch);
    if (branch !== CONCEPT_BRANCH) throw createHttpError("Only the concept branch can be published.", 400);

    const { octokit, defaultBranch } = await getContext(params);
    const { data: compare } = await octokit.rest.repos.compareCommitsWithBasehead({
      owner: params.owner,
      repo: params.repo,
      basehead: `${defaultBranch}...${CONCEPT_BRANCH}`,
      per_page: 1,
    });

    if (compare.ahead_by === 0 && compare.behind_by > 0) {
      const { data: baseRef } = await octokit.rest.git.getRef({
        owner: params.owner,
        repo: params.repo,
        ref: `heads/${defaultBranch}`,
      });
      await octokit.rest.git.updateRef({
        owner: params.owner,
        repo: params.repo,
        ref: `heads/${CONCEPT_BRANCH}`,
        sha: baseRef.object.sha,
        force: false,
      });
    }

    return Response.json({
      status: "success",
      data: {
        defaultBranch,
        pending: compare.ahead_by,
        files: (compare.files ?? []).map((file) => file.filename),
      },
    });
  } catch (error: any) {
    console.error(error);
    return toErrorResponse(error);
  }
}

/**
 * "Zet online": merges the concept branch into the default branch.
 * With ?action=enable (GitHub users only) it creates the concept branch.
 *
 * POST /api/[owner]/[repo]/concept/publish
 */
export async function POST(
  request: Request,
  context: { params: Promise<Params> }
) {
  try {
    const params = await context.params;
    const branch = decodeURIComponent(params.branch);
    const action = new URL(request.url).searchParams.get("action");
    const { user, octokit, defaultBranch } = await getContext(params);

    if (action === "enable") {
      if (!hasGithubIdentity(user)) throw createHttpError("Only GitHub users can turn this on.", 403);
      const { data: baseRef } = await octokit.rest.git.getRef({
        owner: params.owner,
        repo: params.repo,
        ref: `heads/${defaultBranch}`,
      });
      try {
        await octokit.rest.git.createRef({
          owner: params.owner,
          repo: params.repo,
          ref: `refs/heads/${CONCEPT_BRANCH}`,
          sha: baseRef.object.sha,
        });
      } catch (error: any) {
        // 422: the branch already exists, which is what we want.
        if (error?.status !== 422) throw error;
      }
      return Response.json({ status: "success", data: { branch: CONCEPT_BRANCH } });
    }

    if (branch !== CONCEPT_BRANCH) throw createHttpError("Only the concept branch can be published.", 400);

    try {
      const response = await octokit.rest.repos.merge({
        owner: params.owner,
        repo: params.repo,
        base: defaultBranch,
        head: CONCEPT_BRANCH,
        commit_message: `Zet online (door ${user.email})`,
      });
      // 201: merged; 204: nothing to merge.
      const sha = response.status === 201 ? (response.data as any)?.sha ?? null : null;
      return Response.json({ status: "success", data: { sha, defaultBranch } });
    } catch (error: any) {
      if (error?.status === 409) {
        throw createHttpError("De wijzigingen botsen met een andere aanpassing op de website. Vraag je webbouwer om hulp.", 409);
      }
      throw error;
    }
  } catch (error: any) {
    console.error(error);
    return toErrorResponse(error);
  }
}
