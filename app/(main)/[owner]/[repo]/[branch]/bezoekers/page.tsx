"use client";

import { useMemo } from "react";
import { DocumentTitle, formatRepoBranchTitle } from "@/components/document-title";
import { SiteStatsView } from "@/components/site-stats";
import { useRepoHeader } from "@/components/repo/repo-header-context";
import { useConfig } from "@/contexts/config-context";
import { useIsBuilderView } from "@/lib/client-view";
import { t } from "@/lib/i18n";

export default function Page() {
  const { config } = useConfig();
  const builderView = useIsBuilderView();
  if (!config) throw new Error(`Configuration not found.`);

  const headerNode = useMemo(() => (
    <h1 className="font-semibold text-lg">{t("Visitors of your website")}</h1>
  ), []);
  useRepoHeader({ header: headerNode });

  return (
    <div className="max-w-screen-sm mx-auto flex-1 flex flex-col h-full w-full">
      <DocumentTitle title={formatRepoBranchTitle(t("Visitors"), config.owner, config.repo, config.branch)} />
      <SiteStatsView owner={config.owner} repo={config.repo} branch={config.branch} builderView={builderView} />
    </div>
  );
}
