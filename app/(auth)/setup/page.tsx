import Link from "next/link";
import { getGithubAppConfig } from "@/lib/github-app-config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const errors: Record<string, string> = {
  secret: "That secret key is not right. Copy BETTER_AUTH_SECRET exactly as you entered it in your hosting settings.",
  name: "Fill in a name.",
  organization: "That organization name is not right. Use the part after github.com/, or leave it empty.",
  expired: "This took too long. Start again.",
  github: "GitHub did not finish creating the app. Start again.",
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const githubApp = await getGithubAppConfig();
  const suggestedName = `${t("Website editor")} ${crypto.randomUUID().slice(0, 4)}`;

  return (
    <div className="min-h-screen p-4 md:p-6 flex justify-center items-center">
      <div className="w-full sm:max-w-[420px] space-y-6">
        {githubApp ? (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">{t("GitHub is connected")}</h1>
            <p className="text-muted-foreground">
              {t("Choose which websites this editor may change, then sign in.")}
            </p>
            <div className="grid gap-3">
              <Button asChild size="lg" className="w-full">
                <a href={`https://github.com/apps/${githubApp.appName}/installations/new`}>
                  {t("Choose websites on GitHub")}
                </a>
              </Button>
              <Button asChild size="lg" variant="outline" className="w-full">
                <Link href="/sign-in">{t("Sign in")}</Link>
              </Button>
            </div>
          </>
        ) : (
          <form method="post" action="/api/setup/github-app" className="space-y-6">
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight">{t("Set up your editor")}</h1>
              <p className="text-muted-foreground">
                {t("One last step: connect GitHub. GitHub creates the connection for you, you don't need to copy any keys.")}
              </p>
            </div>
            {error && errors[error] && (
              <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                {t(errors[error])}
              </p>
            )}
            <div className="space-y-2">
              <label htmlFor="secret" className="text-sm font-medium">{t("Secret key")}</label>
              <Input id="secret" name="secret" type="password" required autoComplete="off" />
              <p className="text-sm text-muted-foreground">
                {t("The value of BETTER_AUTH_SECRET. This proves you are the one who installed this editor.")}
              </p>
            </div>
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">{t("Name of the connection")}</label>
              <Input id="name" name="name" required maxLength={34} defaultValue={suggestedName} />
              <p className="text-sm text-muted-foreground">
                {t("Must be unique on GitHub. Your clients don't see it.")}
              </p>
            </div>
            <div className="space-y-2">
              <label htmlFor="organization" className="text-sm font-medium">{t("GitHub organization (optional)")}</label>
              <Input id="organization" name="organization" autoComplete="off" />
              <p className="text-sm text-muted-foreground">
                {t("Leave empty if the websites are on your own GitHub account.")}
              </p>
            </div>
            <Button type="submit" size="lg" className="w-full bg-green-600 font-semibold text-white hover:bg-green-700">
              {t("Connect GitHub")}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
