/**
 * GitHub App credentials.
 *
 * Read from the GITHUB_APP_* environment variables when they are set.
 * Otherwise read from the database, where the setup page (/setup) stores
 * them encrypted after creating the GitHub App from a manifest.
 */

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { appSettingTable } from "@/db/schema";
import { decrypt, encrypt } from "@/lib/crypto";

export type GithubAppConfig = {
  appId: string;
  appName: string;
  privateKey: string;
  webhookSecret: string;
  clientId: string;
  clientSecret: string;
};

const SETTING_KEY = "github_app";

let cached: GithubAppConfig | null = null;

const fromEnv = (): GithubAppConfig | null => {
  const env = process.env;
  if (!env.GITHUB_APP_ID || !env.GITHUB_APP_PRIVATE_KEY || !env.GITHUB_APP_CLIENT_ID) return null;
  return {
    appId: env.GITHUB_APP_ID,
    appName: env.GITHUB_APP_NAME?.trim() || "",
    privateKey: env.GITHUB_APP_PRIVATE_KEY,
    webhookSecret: env.GITHUB_APP_WEBHOOK_SECRET || "",
    clientId: env.GITHUB_APP_CLIENT_ID,
    clientSecret: env.GITHUB_APP_CLIENT_SECRET || "",
  };
};

const getGithubAppConfig = async (): Promise<GithubAppConfig | null> => {
  if (cached) return cached;
  const envConfig = fromEnv();
  if (envConfig) return (cached = envConfig);

  let row: typeof appSettingTable.$inferSelect | undefined;
  try {
    row = await db.query.appSettingTable.findFirst({
      where: eq(appSettingTable.key, SETTING_KEY),
    });
  } catch (error) {
    // No database during the build, or a temporary outage: treat as not connected.
    console.warn("[github-app-config] could not read settings", error instanceof Error ? error.message : error);
    return null;
  }
  if (!row) return null;
  try {
    cached = JSON.parse(await decrypt(row.ciphertext, row.iv)) as GithubAppConfig;
  } catch (error) {
    // Happens during the build when CRYPTO_KEY there differs from the one
    // the editor runs with. Treat as not connected instead of failing.
    console.warn("[github-app-config] could not decrypt settings", error instanceof Error ? error.message : error);
    return null;
  }
  return cached;
};

const requireGithubAppConfig = async (): Promise<GithubAppConfig> => {
  const config = await getGithubAppConfig();
  if (!config) throw new Error("GitHub is not connected yet. Open /setup to connect it.");
  return config;
};

const saveGithubAppConfig = async (config: GithubAppConfig) => {
  const { ciphertext, iv } = await encrypt(JSON.stringify(config));
  await db
    .insert(appSettingTable)
    .values({ key: SETTING_KEY, ciphertext, iv })
    .onConflictDoUpdate({
      target: appSettingTable.key,
      set: { ciphertext, iv, updatedAt: new Date() },
    });
  cached = config;
};

export { getGithubAppConfig, requireGithubAppConfig, saveGithubAppConfig };
