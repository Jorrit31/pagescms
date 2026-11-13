import { NextResponse } from "next/server";
import { getGithubAppConfig } from "@/lib/github-app-config";

export const GET = async () => {
  const appName = (await getGithubAppConfig())?.appName;

  if (!appName) {
    return NextResponse.json(
      { status: "error", message: "Missing GITHUB_APP_NAME." },
      { status: 500 },
    );
  }

  return NextResponse.redirect(
    `https://github.com/apps/${appName}/installations/new`,
  );
};
