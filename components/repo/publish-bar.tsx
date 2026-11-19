"use client";

import { useCallback, useEffect, useState } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useConfig } from "@/contexts/config-context";
import { Button } from "@/components/ui/button";
import { isConceptBranch } from "@/lib/concept";
import { getSiteUrl, watchDeploy } from "@/lib/deploy-watch";
import { t } from "@/lib/i18n";
import { Rocket } from "lucide-react";
import { PublishConfirmDialog } from "./publish-confirm";

export const SAVED_EVENT = "pages:saved";

/** Tell the publish bar that something was saved, so it counts again. */
export const announceSaved = () => {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(SAVED_EVENT));
};

type PublishStatus = { defaultBranch: string; pending: number; files: string[]; updated?: boolean };

export function PublishBar() {
  const { config } = useConfig();
  const router = useRouter();
  const active = Boolean(config && isConceptBranch(config.branch));
  const url = active && config
    ? `/api/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/publish`
    : null;

  const { data, mutate } = useSWR<PublishStatus>(url, async (apiUrl: string) => {
    const response = await fetch(apiUrl);
    const json = await response.json();
    if (!response.ok) throw new Error(json?.message || "Failed");
    return json.data as PublishStatus;
  }, { revalidateOnFocus: true });

  const [isPublishing, setIsPublishing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  // The concept just took over the live site's newest version (for example new
  // fields in the settings): load the page again so the editor shows them.
  const updated = Boolean(data?.updated);
  useEffect(() => {
    if (updated) router.refresh();
  }, [updated, router]);

  useEffect(() => {
    if (!active) return;
    const onSaved = () => { void mutate(); };
    window.addEventListener(SAVED_EVENT, onSaved);
    return () => window.removeEventListener(SAVED_EVENT, onSaved);
  }, [active, mutate]);

  const publish = useCallback(async () => {
    if (!url || !config) return;
    setIsPublishing(true);
    try {
      const response = await fetch(url, { method: "POST" });
      const json = await response.json().catch(() => null);
      if (!response.ok) throw new Error(json?.message || t("Could not put your changes online."));
      const sha = json?.data?.sha as string | null;
      const defaultBranch = json?.data?.defaultBranch as string;
      await mutate({ defaultBranch, pending: 0, files: [] }, { revalidate: true });
      if (sha) {
        watchDeploy({
          owner: config.owner,
          repo: config.repo,
          branch: defaultBranch,
          sha,
          siteUrl: getSiteUrl(config.object),
        });
      } else {
        toast.success(t("Everything is already on your website."));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Could not put your changes online."));
    } finally {
      setIsPublishing(false);
    }
  }, [config, mutate, url]);

  if (!active || !data) return null;

  const pending = data.pending;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b bg-accent px-4 py-2 text-sm md:px-6">
      <span className="min-w-0 flex-1 max-sm:hidden">
        {pending > 0
          ? t("You have changes that are not on your website yet. Visitors see them after \"Put online\".")
          : t("Everything is on your website. New changes stay here until you click \"Put online\".")}
      </span>
      {/* Phones get the short version, so the notice stays one line. */}
      <span className="min-w-0 flex-1 leading-snug sm:hidden">
        {pending > 0 ? t("Not on your website yet.") : t("Everything is on your website.")}
      </span>
      <Button size="sm" onClick={() => setIsConfirming(true)} disabled={pending === 0 || isPublishing}>
        <Rocket className="size-4" />
        {isPublishing ? t("Putting online...") : t("Put online")}
      </Button>
      {config && (
        <PublishConfirmDialog
          open={isConfirming}
          config={config}
          defaultBranch={data.defaultBranch}
          files={data.files}
          onCancel={() => setIsConfirming(false)}
          onConfirm={() => {
            setIsConfirming(false);
            void publish();
          }}
        />
      )}
    </div>
  );
}
