"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useRepo } from "@/contexts/repo-context";
import { Button } from "@/components/ui/button";
import { CONCEPT_BRANCH } from "@/lib/concept";
import { t } from "@/lib/i18n";

/** Turn on "eerst bekijken, dan online zetten" for this website. */
export function ConceptModeCard({ owner, repo, branch }: { owner: string; repo: string; branch: string }) {
  const { branches, setBranches } = useRepo();
  const router = useRouter();
  const [isBusy, setIsBusy] = useState(false);
  const isOn = branches?.includes(CONCEPT_BRANCH);

  const enable = async () => {
    setIsBusy(true);
    try {
      const response = await fetch(`/api/${owner}/${repo}/${encodeURIComponent(branch)}/publish?action=enable`, { method: "POST" });
      const json = await response.json().catch(() => null);
      if (!response.ok) throw new Error(json?.message || t("Could not turn this on."));
      setBranches([...(branches ?? []), CONCEPT_BRANCH]);
      toast.success(t("Turned on. Changes now wait until someone clicks \"Put online\"."));
      router.push(`/${owner}/${repo}/${CONCEPT_BRANCH}/collaborators`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Could not turn this on."));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border px-3 py-3 text-sm">
      <div className="min-w-0 flex-1">
        <div className="font-medium">{t("First check, then put online")}</div>
        <div className="text-muted-foreground">
          {isOn
            ? t("On. Saved changes wait until someone clicks \"Put online\".")
            : t("Off. Every save goes straight to the website.")}
        </div>
      </div>
      {!isOn && (
        <Button size="sm" variant="outline" onClick={enable} disabled={isBusy}>
          {t("Turn on")}
        </Button>
      )}
    </div>
  );
}
