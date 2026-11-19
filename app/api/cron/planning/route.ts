import { timingSafeEqual } from "crypto";
import { runPlanning } from "@/lib/planning";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Webstudio "Inplannen": rebuilds websites whose planned content goes online
 * or offline now. Called every few minutes by the Cloudflare Cron in
 * custom-worker.js (or any other scheduler) with the header
 * "x-webstudio-cron: <AUTH_SECRET>".
 *
 * POST /api/cron/planning
 */
const allowed = (header: string | null) => {
  const secret = process.env.AUTH_SECRET || process.env.BETTER_AUTH_SECRET || "";
  if (!secret || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
};

export async function POST(request: Request) {
  if (!allowed(request.headers.get("x-webstudio-cron"))) return new Response(null, { status: 401 });
  try {
    const result = await runPlanning();
    return Response.json(result);
  } catch (error) {
    console.error("Inplannen: cron mislukt", error);
    return Response.json({ error: "failed" }, { status: 500 });
  }
}
