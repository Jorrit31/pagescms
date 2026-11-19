// Webstudio: the Cloudflare Worker of the CMS. Everything goes to the Next.js
// app that OpenNext builds (.open-next/worker.js); this file only adds the
// Cron (wrangler.jsonc "triggers") that puts planned content online/offline.
// @ts-nocheck
import handler from "./.open-next/worker.js";

const worker = {
  fetch: handler.fetch,

  async scheduled(_controller, env, ctx) {
    const secret = env.AUTH_SECRET || env.BETTER_AUTH_SECRET;
    if (!secret) return console.warn("Inplannen: AUTH_SECRET ontbreekt, cron overgeslagen.");
    const request = new Request("https://beheerscherm.cron/api/cron/planning", {
      method: "POST",
      headers: { "x-webstudio-cron": secret },
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
