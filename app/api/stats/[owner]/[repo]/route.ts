import { type NextRequest } from "next/server";
import { getPublicSiteConfig } from "@/lib/forms";
import { cleanPath, cleanSource, deviceOf, isBot, recordPageView, visitorHash } from "@/lib/stats";

/**
 * A client's website counts a page view here (public, no login, no cookies).
 *
 * POST /api/stats/<owner>/<repo>   body: {"p": "/pad/", "r": "https://www.google.com/"}
 *
 * Sent with navigator.sendBeacon (text/plain), so there is no CORS preflight.
 * Always answers 204: the website never waits for or shows anything from this.
 */

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
  "Cache-Control": "no-store",
};
const done = () => new Response(null, { status: 204, headers });

export async function OPTIONS() {
  return done();
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ owner: string; repo: string }> },
) {
  try {
    const userAgent = request.headers.get("user-agent") || "";
    if (isBot(userAgent)) return done();
    // Visitors who ask not to be tracked aren't counted at all.
    if (request.headers.get("sec-gpc") === "1") return done();

    const text = (await request.text()).slice(0, 2000);
    let body: any = null;
    try {
      body = JSON.parse(text);
    } catch {
      return done();
    }
    const path = cleanPath(body?.p);
    if (!path) return done();

    const params = await context.params;
    const site = await getPublicSiteConfig(params.owner, params.repo);
    if (!site) return done();

    const origin = request.headers.get("origin") || request.headers.get("referer") || "";
    let siteHost: string | null = null;
    try {
      siteHost = origin ? new URL(origin).hostname : null;
    } catch {
      siteHost = null;
    }
    // Local tests and the CMS itself don't count.
    if (siteHost && /^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(siteHost)) return done();

    const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
    await recordPageView({
      owner: site.owner,
      repo: site.repo,
      path,
      source: cleanSource(body?.r, siteHost),
      device: deviceOf(userAgent),
      visitor: await visitorHash(site.owner, site.repo, ip, userAgent),
    });
  } catch (error) {
    console.error("Page view failed", error);
  }
  return done();
}
