import { getRepoReadContext } from "@/lib/api-repo-context";
import { toErrorResponse } from "@/lib/api-error";
import { createPreviewMediaToken } from "@/lib/preview-media-token";

/**
 * A signed token so the live preview can show images that are not on the
 * website yet (new uploads), also for private repositories.
 *
 * GET /api/[owner]/[repo]/[branch]/preview-media-token
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ owner: string; repo: string; branch: string }> }
) {
  try {
    const params = await context.params;
    const branch = decodeURIComponent(params.branch);
    const { config } = await getRepoReadContext({ owner: params.owner, repo: params.repo, branch });
    const media = Array.isArray((config.object as any)?.media) ? (config.object as any).media : [];
    const folders = media
      .map((item: any) => (typeof item?.input === "string" ? item.input : null))
      .filter((input: string | null): input is string => input !== null);

    const token = folders.length > 0
      ? await createPreviewMediaToken({ o: params.owner, r: params.repo, b: branch, p: folders })
      : null;

    return Response.json({ status: "success", data: { token } });
  } catch (error: any) {
    console.error(error);
    return toErrorResponse(error);
  }
}
