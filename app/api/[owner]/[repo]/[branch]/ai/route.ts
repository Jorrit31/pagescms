import { type NextRequest } from "next/server";
import { createHttpError, toErrorResponse } from "@/lib/api-error";
import { getRepoReadContext } from "@/lib/api-repo-context";
import {
  aiDescribePhoto,
  aiRewrite,
  aiRoomLeft,
  aiSeo,
  aiTranslate,
  isAiEnabled,
  type AiFormat,
  type AiRewriteMode,
} from "@/lib/ai";

/**
 * Webstudio writing help ("Schrijfhulp"), see lib/ai.ts.
 *
 * GET  -> { enabled, left } (left = % of today's room for this site)
 * POST { task: "rewrite", text, mode, format }        -> { text }
 * POST { task: "translate", text, language, format }  -> { text }
 * POST { task: "photo", image (data URL), language, context } -> { text }
 * POST { task: "seo", text, languages }               -> { seo: { [lang]: { titel, omschrijving } } }
 */

type Params = { params: Promise<{ owner: string; repo: string; branch: string }> };

const FORMATS: AiFormat[] = ["plain", "markdown", "html"];
const MODES: AiRewriteMode[] = ["improve", "shorter", "longer", "inviting"];

const str = (value: unknown) => (typeof value === "string" ? value : "");

export async function GET(_request: NextRequest, context: Params) {
  try {
    const params = await context.params;
    await getRepoReadContext(params);
    if (!isAiEnabled()) return Response.json({ status: "success", data: { enabled: false, left: 0 } });
    const left = await aiRoomLeft(params.owner, params.repo);
    return Response.json({ status: "success", data: { enabled: true, left } });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: NextRequest, context: Params) {
  try {
    const params = await context.params;
    const { config } = await getRepoReadContext(params);
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") throw createHttpError("Invalid request.", 400);
    const { owner, repo } = params;
    const format = FORMATS.includes(body.format) ? body.format as AiFormat : "plain";

    switch (body.task) {
      case "rewrite": {
        const mode = MODES.includes(body.mode) ? body.mode as AiRewriteMode : "improve";
        const text = await aiRewrite(owner, repo, str(body.text), mode, format);
        return Response.json({ status: "success", data: { text } });
      }
      case "translate": {
        const text = await aiTranslate(owner, repo, str(body.text), str(body.language), format);
        return Response.json({ status: "success", data: { text } });
      }
      case "photo": {
        const text = await aiDescribePhoto(owner, repo, str(body.image), str(body.language), str(body.context));
        return Response.json({ status: "success", data: { text } });
      }
      case "seo": {
        const languages = Array.isArray(body.languages) ? body.languages.filter((code: unknown) => typeof code === "string") : [];
        const siteName = str((config?.object as any)?.settings?.name) || repo;
        const seo = await aiSeo(owner, repo, str(body.text), languages, siteName);
        return Response.json({ status: "success", data: { seo } });
      }
      default:
        throw createHttpError("Invalid request.", 400);
    }
  } catch (error) {
    return toErrorResponse(error);
  }
}
