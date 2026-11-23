import { type NextRequest } from "next/server";
import { getRepoReadContext } from "@/lib/api-repo-context";
import { getConfig } from "@/lib/config-store";
import { getCollectionCache } from "@/lib/github-cache-file";
import { createOctokitInstance } from "@/lib/utils/octokit";
import { getSchemaByName } from "@/lib/schema";
import { normalizePath } from "@/lib/utils/file";
import { toErrorResponse } from "@/lib/api-error";

/**
 * Webstudio: where is this photo still used? Asked before a photo is deleted,
 * so a client sees "Deze foto staat nog op Home" instead of finding an empty
 * spot on the website later.
 *
 * GET /api/<owner>/<repo>/<branch>/media-usage?path=public/img/x.jpg&name=images
 * -> { status: "success", data: { usedIn: ["Home", "Over ons"] } }
 *
 * Looks through all content of the site (not only what this person may edit),
 * because a photo on a page they can't see is still on the website.
 */

export const runtime = "nodejs";

const textOf = (value: unknown): string => {
  if (typeof value === "string") return value;
  // GitHub's raw answer can arrive as bytes, depending on its content type.
  if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) return new TextDecoder().decode(value as ArrayBuffer);
  // Some answers come as JSON with the file base64-encoded instead of raw.
  const item = value as { content?: string; encoding?: string } | null;
  if (item?.content && item.encoding === "base64") return Buffer.from(item.content, "base64").toString("utf8");
  return "";
};

/** The ways a photo can be written in content: "/img/x.jpg", "img/x.jpg", "x.jpg" with its folder. */
const needlesFor = (path: string, media: { input?: string; output?: string } | null) => {
  const clean = normalizePath(path);
  const input = normalizePath(media?.input || "");
  const relative = input && clean.startsWith(`${input}/`) ? clean.slice(input.length + 1) : clean;
  const output = normalizePath(media?.output || "");
  const full = output ? `${output}/${relative}` : relative;
  const variants = new Set([clean, full, `/${full}`]);
  for (const v of [...variants]) variants.add(encodeURI(v));
  return [...variants].filter(Boolean);
};

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ owner: string; repo: string; branch: string }> },
) {
  try {
    const params = await context.params;
    const { token } = await getRepoReadContext(params);
    const path = request.nextUrl.searchParams.get("path") || "";
    const name = request.nextUrl.searchParams.get("name") || "";
    if (!path) return Response.json({ status: "success", data: { usedIn: [] } });

    const config = await getConfig(params.owner, params.repo, params.branch, { getToken: async () => token });
    const object: any = config?.object || {};
    const media = (name ? getSchemaByName(object, name, "media") : null) || (Array.isArray(object.media) ? object.media[0] : null);
    const needles = needlesFor(path, media);
    const contains = (text: string) => needles.some((needle) => text.includes(needle));

    const octokit = createOctokitInstance(token);
    const usedIn: string[] = [];
    for (const item of Array.isArray(object.content) ? object.content : []) {
      const label = String(item?.label || item?.name || "");
      try {
        if (item?.type === "file" && item.path) {
          const response = await octokit.rest.repos.getContent({
            owner: params.owner, repo: params.repo, ref: params.branch, path: normalizePath(item.path),
            mediaType: { format: "raw" },
          });
          if (contains(textOf(response.data as unknown))) usedIn.push(label);
        } else if (item?.type === "collection" && item.path) {
          const entries = await getCollectionCache(params.owner, params.repo, params.branch, normalizePath(item.path), token, item.view?.node?.filename);
          const hits = (entries as any[]).filter((entry) => entry?.type === "file" && contains(textOf(entry.content)));
          if (hits.length) usedIn.push(hits.length === 1 ? `${label}: ${hits[0].name.replace(/\.[^.]+$/, "")}` : `${label} (${hits.length}x)`);
        }
      } catch {
        // A missing file or folder just doesn't use the photo.
      }
    }
    return Response.json({ status: "success", data: { usedIn } });
  } catch (error) {
    return toErrorResponse(error);
  }
}
