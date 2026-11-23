<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Webstudio rules

- Every new database table gets `ALTER TABLE "..." ENABLE ROW LEVEL SECURITY;` in its migration. The Rooktest workflow fails otherwise (Supabase exposes tables without RLS through its API).
- A new Hyperdrive or other binding in `wrangler.jsonc` needs a local fallback (`localConnectionString`), or `opennextjs-cloudflare deploy` breaks.
- Clients never see "GitHub" or "Pages CMS". UI strings stay English in code and get a Dutch entry in `lib/i18n.ts`.
- Run the smoke test (`tests/smoke/README.md`) for changes to saving, media, the start screen or the phone layout.
