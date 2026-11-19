import { logActivity } from "@/lib/activity";
import { createOctokitInstance } from "@/lib/utils/octokit";
import { getToken } from "@/lib/token";
import { createHttpError, toErrorResponse } from "@/lib/api-error";
import { requireApiUserSession } from "@/lib/session-server";
import { hasGithubIdentity } from "@/lib/authz-shared";
import { CONCEPT_BRANCH } from "@/lib/concept";
import { getConfig } from "@/lib/config-store";

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
  return { user, token, octokit, defaultBranch: repoData.default_branch };
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

    const { token, octokit, defaultBranch } = await getContext(params);
    let updated = false;
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
      updated = true;
    } else if (compare.ahead_by > 0 && compare.behind_by > 0) {
      // The concept has saved changes, and the live site moved on too (for
      // example a new version of the site's code or of its live preview).
      // Bring those in, so the concept does not keep running old code until
      // the next "Put online". If both changed the same thing, leave it.
      try {
        await octokit.rest.repos.merge({
          owner: params.owner,
          repo: params.repo,
          base: CONCEPT_BRANCH,
          head: defaultBranch,
          commit_message: `Bijgewerkt met de live website (${defaultBranch})`,
        });
        updated = true;
      } catch (error: any) {
        if (error?.status !== 409) throw error;
      }
    }

    // The concept now has the live site's newest settings (new fields, for
    // example): read them right away, so the editor shows them on the next
    // load instead of the old saved copy.
    if (updated) {
      try {
        await getConfig(params.owner, params.repo, CONCEPT_BRANCH, {
          sync: true,
          ttlMs: 0,
          getToken: async () => token,
        });
      } catch (error) {
        console.error(error);
      }
    }

    return Response.json({
      status: "success",
      data: {
        defaultBranch,
        updated,
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
      if (response.status === 201) {
        await logActivity({ owner: params.owner, repo: params.repo, branch: defaultBranch, user, action: "publish" });
      }
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
