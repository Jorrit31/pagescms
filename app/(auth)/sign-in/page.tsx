import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";
import { SignIn } from "@/components/sign-in";
import { getSafeRedirect } from "@/lib/auth-redirect";
import { getGithubAppConfig } from "@/lib/github-app-config";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {  
  const requestHeaders = await headers();
  const resolvedSearchParams = await searchParams;
  const session = await (await getAuth()).api.getSession({
    headers: requestHeaders,
  });
  const safeRedirect = getSafeRedirect(resolvedSearchParams.redirect);
  if (session?.user) return redirect(safeRedirect === "/sign-in" ? "/" : safeRedirect);

	return (
    <SignIn githubConnected={Boolean(await getGithubAppConfig())}/>
  );
}
