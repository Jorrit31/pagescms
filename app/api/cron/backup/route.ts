import { toErrorResponse } from "@/lib/api-error";
import { isCronRequest } from "@/lib/monthly-report";
import { runBackup } from "@/lib/backup";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Webstudio: nightly database backup to Cloudflare R2 (lib/backup.ts).
 * Called by the Cloudflare Cron in custom-worker.js with the same secret key
 * as the monthly report. Anyone else gets "not found".
 */
export async function GET(request: Request) {
  if (!isCronRequest(request)) return new Response("Not found", { status: 404 });
  try {
    const result = await runBackup();
    console.log("Back-up", JSON.stringify(result));
    return Response.json({ status: "success", data: result });
  } catch (error) {
    console.error("Back-up mislukt", error);
    return toErrorResponse(error);
  }
}
