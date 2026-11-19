"use client";

import { useMemo } from "react";
import { DocumentTitle, formatRepoBranchTitle } from "@/components/document-title";
import { ActivityLog } from "@/components/activity-log";
import { useRepoHeader } from "@/components/repo/repo-header-context";
import { useConfig } from "@/contexts/config-context";
import { t } from "@/lib/i18n";

export default function Page() {
  const { config } = useConfig();
  if (!config) throw new Error(`Configuration not found.`);

  const headerNode = useMemo(() => (
    <h1 className="font-semibold text-lg">{t("Log")}</h1>
  ), []);
  useRepoHeader({ header: headerNode });

  return (
    <div className="max-w-screen-sm mx-auto flex-1 flex flex-col h-full w-full">
      <DocumentTitle title={formatRepoBranchTitle(t("Log"), config.owner, config.repo, config.branch)} />
      <ActivityLog owner={config.owner} repo={config.repo} branch={config.branch} />
    </div>
  );
}
