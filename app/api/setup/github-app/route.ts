import { getGithubAppConfig } from "@/lib/github-app-config";
import { buildManifest, createSetupState, getManifestFormUrl, isSetupSecret } from "@/lib/setup";
import { t } from "@/lib/i18n";

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const backToSetup = (request: Request, error: string) =>
  Response.redirect(new URL(`/setup?error=${error}`, request.url), 303);

// Receives the setup form and forwards a GitHub App manifest to GitHub.
export async function POST(request: Request) {
  if (await getGithubAppConfig()) return Response.redirect(new URL("/setup", request.url), 303);

  const form = await request.formData();
  const secret = String(form.get("secret") ?? "");
  const name = String(form.get("name") ?? "").trim().slice(0, 34);
  const organization = String(form.get("organization") ?? "").trim() || null;

  if (!isSetupSecret(secret)) return backToSetup(request, "secret");
  if (!name) return backToSetup(request, "name");
  if (organization && !/^[A-Za-z0-9-]+$/.test(organization)) return backToSetup(request, "organization");

  const manifest = JSON.stringify(buildManifest(name));
  const action = getManifestFormUrl(organization, await createSetupState());

  const html = `<!doctype html>
<html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(t("Connecting to GitHub..."))}</title></head>
<body style="font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0">
<form id="manifest" method="post" action="${escapeHtml(action)}">
<input type="hidden" name="manifest" value="${escapeHtml(manifest)}">
<p>${escapeHtml(t("Connecting to GitHub..."))}</p>
<noscript><button type="submit">${escapeHtml(t("Continue"))}</button></noscript>
</form>
<script>document.getElementById("manifest").submit();</script>
</body></html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}
