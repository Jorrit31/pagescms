import { getGithubAppConfig, saveGithubAppConfig } from "@/lib/github-app-config";
import { isValidSetupState } from "@/lib/setup";

type ManifestConversion = {
  id: number;
  slug: string;
  client_id: string;
  client_secret: string;
  webhook_secret: string | null;
  pem: string;
};

const backToSetup = (request: Request, error: string) =>
  Response.redirect(new URL(`/setup?error=${error}`, request.url), 303);

// GitHub sends the person back here after they created the app.
export async function GET(request: Request) {
  if (await getGithubAppConfig()) return Response.redirect(new URL("/setup", request.url), 303);

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (!code || !/^[A-Za-z0-9_-]+$/.test(code)) return backToSetup(request, "github");
  if (!(await isValidSetupState(url.searchParams.get("state")))) return backToSetup(request, "expired");

  const response = await fetch(`https://api.github.com/app-manifests/${code}/conversions`, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "pages-cms-setup",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!response.ok) {
    console.error("[setup] GitHub manifest conversion failed", { status: response.status });
    return backToSetup(request, "github");
  }

  const app = (await response.json()) as ManifestConversion;
  await saveGithubAppConfig({
    appId: String(app.id),
    appName: app.slug,
    privateKey: app.pem,
    webhookSecret: app.webhook_secret ?? "",
    clientId: app.client_id,
    clientSecret: app.client_secret,
  });

  // Next: choose which repositories the app may use.
  return Response.redirect(`https://github.com/apps/${app.slug}/installations/new`, 303);
}
