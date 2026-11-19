// Webstudio: the Cloudflare Worker of the CMS. Everything goes to the Next.js
// app that OpenNext builds (.open-next/worker.js); this file only adds the
// Crons (wrangler.jsonc "triggers"):
// - every 5 minutes: put planned content online/offline ("Inplannen")
// - 1st to 5th of the month, 08:00 UTC: the monthly report mail to clients
//   (lib/monthly-report.ts; days 2-5 only retry sites whose mail failed)
// @ts-nocheck
import handler from "./.open-next/worker.js";

const MONTHLY_REPORT_CRON = "0 8 1-5 * *";

/** Same key as cronKey() in lib/monthly-report.ts: HMAC of a fixed text with the auth secret. */
const monthlyReportKey = async (secret) => {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode("webstudio-cron-v1"));
  return Array.from(new Uint8Array(signature)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

const monthlyReport = async (secret, env, ctx) => {
  const base = String(env.BASE_URL || "https://beheerscherm.cron").replace(/\/$/, "");
  const request = new Request(`${base}/api/cron/monthly-report`, {
    headers: { "x-cron-key": await monthlyReportKey(secret), "user-agent": "Webstudio Cron" },
  });
  const response = await handler.fetch(request, env, ctx);
  console.log("Maandrapport:", response.status, await response.text());
};

const worker = {
  fetch: handler.fetch,

  async scheduled(controller, env, ctx) {
    const secret = env.BETTER_AUTH_SECRET || env.AUTH_SECRET;
    if (!secret) return console.warn("Cron: AUTH_SECRET ontbreekt, overgeslagen.");

    if (controller.cron === MONTHLY_REPORT_CRON) {
      ctx.waitUntil(monthlyReport(secret, env, ctx).catch((error) => console.error("Maandrapport: cron mislukt", error)));
      return;
    }

    const request = new Request("https://beheerscherm.cron/api/cron/planning", {
      method: "POST",
      headers: { "x-webstudio-cron": env.AUTH_SECRET || env.BETTER_AUTH_SECRET },
    });
    ctx.waitUntil(
      handler.fetch(request, env, ctx)
        .then(async (response) => {
          const text = await response.text();
          if (!response.ok || text.includes('"rebuilt":["')) console.log("Inplannen:", response.status, text);
        })
        .catch((error) => console.error("Inplannen: cron mislukt", error)),
    );
  },
};

export default worker;
