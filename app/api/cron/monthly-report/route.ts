import { toErrorResponse } from "@/lib/api-error";
import { isCronRequest, sendAllMonthlyReports } from "@/lib/monthly-report";

/**
 * Webstudio: the monthly report run. Called by the Cloudflare Cron in
 * custom-worker.js on the 1st of the month, with a key only the worker
 * knows (derived from BETTER_AUTH_SECRET). Anyone else gets "not found".
 */
export async function GET(request: Request) {
  if (!isCronRequest(request)) return new Response("Not found", { status: 404 });
  try {
    const summary = await sendAllMonthlyReports();
    console.log("Monthly reports", JSON.stringify(summary));
    return Response.json({ status: "success", data: summary });
  } catch (error) {
    console.error(error);
    return toErrorResponse(error);
  }
}
