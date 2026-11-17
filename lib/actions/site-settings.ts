"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { getAuth } from "@/lib/auth";
import { requireGithubRepoWriteAccess } from "@/lib/authz-server";
import { getFormMailSettings, getSiteClientEmails, isEmail, saveFormMailSettings } from "@/lib/forms";
import { t } from "@/lib/i18n";

/** Only the builder (GitHub user with write access) may read or change these. */
const requireBuilder = async (owner: string, repo: string) => {
  const session = await (await getAuth()).api.getSession({ headers: await headers() });
  const user = session?.user;
  if (!user) throw new Error(t("You must be signed in."));
  await requireGithubRepoWriteAccess(user as any, owner, repo, "Only the website builder can change this.");
};

const handleGetFormSettings = async (owner: string, repo: string) => {
  try {
    await requireBuilder(owner, repo);
    const [settings, clients] = await Promise.all([
      getFormMailSettings(owner, repo),
      getSiteClientEmails(owner, repo),
    ]);
    return { settings, clients };
  } catch (error: any) {
    return { error: error?.message ?? "Error" };
  }
};

const SaveSchema = z.record(
  z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,39}$/),
  z.object({ to: z.string().max(1000), subject: z.string().max(200) }),
);

const handleSaveFormSettings = async (owner: string, repo: string, input: Record<string, { to: string; subject: string }>) => {
  try {
    await requireBuilder(owner, repo);
    const parsed = SaveSchema.safeParse(input);
    if (!parsed.success) throw new Error(t("Invalid choice."));
    const forms: Record<string, { to: string[]; subject?: string }> = {};
    for (const [name, value] of Object.entries(parsed.data)) {
      const to = value.to.split(/[,;\s]+/).map((item) => item.trim()).filter(Boolean);
      const wrong = to.find((item) => !isEmail(item));
      if (wrong) throw new Error(t("\"{email}\" is not an e-mail address.", { email: wrong }));
      forms[name] = { to: Array.from(new Set(to.map((item) => item.toLowerCase()))), subject: value.subject.trim() || undefined };
    }
    await saveFormMailSettings(owner, repo, forms);
    return { message: t("Saved.") };
  } catch (error: any) {
    return { error: error?.message ?? "Error" };
  }
};

export { handleGetFormSettings, handleSaveFormSettings };
