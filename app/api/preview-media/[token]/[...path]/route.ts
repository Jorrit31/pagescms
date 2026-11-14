import { getInstallationToken } from "@/lib/token";
import { isAllowedMediaPath, verifyPreviewMediaToken } from "@/lib/preview-media-token";

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
  svg: "image/svg+xml",
  heic: "image/heic",
  mp4: "video/mp4",
  webm: "video/webm",
  pdf: "application/pdf",
};

/**
 * Serves a file from a media folder to the live preview, using a signed token
 * instead of a login (see lib/preview-media-token.ts).
 *
 * GET /api/preview-media/[token]/[...path]
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string; path: string[] }> }
) {
  const { token, path: segments } = await context.params;
  const claims = await verifyPreviewMediaToken(token);
  if (!claims) return new Response("Link expired or invalid.", { status: 403 });

  const path = (segments ?? []).map((segment) => decodeURIComponent(segment)).join("/");
  if (!isAllowedMediaPath(path, claims.p)) return new Response("Not allowed.", { status: 403 });

  try {
    const installationToken = await getInstallationToken(claims.o, claims.r);
    const encodedPath = path.split("/").map(encodeURIComponent).join("/");
    const response = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(claims.o)}/${encodeURIComponent(claims.r)}/contents/${encodedPath}?ref=${encodeURIComponent(claims.b)}`,
      {
        headers: {
          Authorization: `Bearer ${installationToken}`,
          Accept: "application/vnd.github.raw",
          "User-Agent": "website-editor",
        },
      },
    );
    if (!response.ok || !response.body) {
      return new Response("Not found.", { status: response.status === 404 ? 404 : 502 });
    }

    const extension = path.split(".").pop()?.toLowerCase() ?? "";
    // The CSP below sandboxes the file, so an SVG opened directly can't run scripts.
    const contentType = CONTENT_TYPES[extension] ?? "application/octet-stream";

    return new Response(response.body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Cross-Origin-Resource-Policy": "cross-origin",
      },
    });
  } catch (error) {
    console.error(error);
    return new Response("Could not load this file.", { status: 502 });
  }
}
