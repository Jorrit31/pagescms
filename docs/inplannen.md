# Inplannen (online vanaf / offline na)

Clients can let a block, news item or page go online and offline by itself.

- `.pages.yml`: `- { name: planning, label: Inplannen, type: planning }` (field type in `fields/core/planning`). Value: `{ vanaf, tot }`, ISO times with the offset of the client's clock; times without an offset count as Europe/Amsterdam.
- The website's `build.js` leaves out what is not online at build time (`src/inplannen.js` in the starter template).
- Every push to the default branch is scanned (`lib/planning.ts`, called from the GitHub webhook). Future times per file go to `site_setting.data.planning`.
- A Cloudflare Cron (`wrangler.jsonc` `triggers`, handled in `custom-worker.js`) calls `POST /api/cron/planning` every 5 minutes with header `x-webstudio-cron: <AUTH_SECRET>`. Each site with a time that has passed gets an empty commit ("Ingepland: website bijgewerkt") on its default branch, so Cloudflare Pages builds it again.
- No new environment variables: the cron uses AUTH_SECRET / BETTER_AUTH_SECRET.
