"use client";

import { toast } from "sonner";
import { t } from "@/lib/i18n";

const POLL_MS = 5000;
const GIVE_UP_MS = 6 * 60 * 1000;
// No build reports at all after this long: the hosting doesn't report back.
const NO_REPORTS_MS = 90 * 1000;

const watching = new Set<string>();

/**
 * Shows one toast that follows the website build for a commit:
 * "Je website wordt bijgewerkt" until the hosting reports it is done.
 */
export const watchDeploy = ({
  owner,
  repo,
  branch,
  sha,
  siteUrl,
}: {
  owner: string;
  repo: string;
  branch: string;
  sha: string;
  siteUrl?: string | null;
}) => {
  if (!sha || watching.has(sha)) return;
  watching.add(sha);

  const id = `deploy-${sha}`;
  const startedAt = Date.now();
  const viewAction = siteUrl
    ? { label: t("View website"), onClick: () => window.open(siteUrl, "_blank", "noopener") }
    : undefined;

  toast.loading(t("Your website is being updated. This takes about a minute."), { id, duration: Infinity });

  const finish = (kind: "success" | "failure" | "unknown") => {
    watching.delete(sha);
    if (kind === "success") {
      toast.success(t("Your change is now on your website."), { id, duration: 10000, action: viewAction });
    } else if (kind === "failure") {
      toast.error(t("Your website could not be updated. Your change is saved. Ask for help via \"Need help?\"."), { id, duration: 15000 });
    } else {
      toast.success(t("Saved. Your website shows the change within a few minutes."), { id, duration: 8000, action: viewAction });
    }
  };

  const poll = async () => {
    const elapsed = Date.now() - startedAt;
    try {
      const response = await fetch(
        `/api/${owner}/${repo}/${encodeURIComponent(branch)}/deploy-status?sha=${encodeURIComponent(sha)}`,
      );
      const json = await response.json().catch(() => null);
      const state = json?.data?.state;
      if (state === "success") return finish("success");
      if (state === "failure") return finish("failure");
      if (state === "none" && elapsed > NO_REPORTS_MS) return finish("unknown");
      if (!response.ok && elapsed > NO_REPORTS_MS) return finish("unknown");
    } catch {
      if (elapsed > NO_REPORTS_MS) return finish("unknown");
    }
    if (elapsed > GIVE_UP_MS) return finish("unknown");
    window.setTimeout(poll, POLL_MS);
  };

  window.setTimeout(poll, POLL_MS);
};

/** The live website's address, taken from the first preview page in the settings. */
export const getSiteUrl = (configObject: any): string | null => {
  const find = (items: any[]): string | null => {
    for (const item of items ?? []) {
      const preview = item?.preview;
      const url = typeof preview === "string" ? preview : preview?.url;
      if (url) {
        try {
          return new URL(url).origin;
        } catch {
          // ignore
        }
      }
    }
    return null;
  };
  return find(configObject?.content ?? []);
};
