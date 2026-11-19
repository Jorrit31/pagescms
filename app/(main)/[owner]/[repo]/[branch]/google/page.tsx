"use client";

import { useMemo } from "react";
import { DocumentTitle, formatRepoBranchTitle } from "@/components/document-title";
import { GoogleOverview } from "@/components/google-overview";
import { useRepoHeader } from "@/components/repo/repo-header-context";
import { useConfig } from "@/contexts/config-context";
import { t } from "@/lib/i18n";

export default function Page() {
  const { config } = useConfig();
  if (!config) throw new Error(`Configuration not found.`);

  const headerNode = useMemo(() => <h1 className="font-semibold text-lg">{t("Google")}</h1>, []);
  useRepoHeader({ header: headerNode });

  return (
    <>
      <DocumentTitle title={formatRepoBranchTitle(t("Google"), config.owner, config.repo, config.branch)} />
      <GoogleOverview />
    </>
  );
}
