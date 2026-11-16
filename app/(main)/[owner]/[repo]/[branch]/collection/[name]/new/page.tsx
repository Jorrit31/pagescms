"use client";

import { use } from "react";
import { useSearchParams } from "next/navigation";
import { DocumentTitle, formatRepoBranchTitle } from "@/components/document-title";
import { Entry } from "@/components/entry/entry";
import { useConfig } from "@/contexts/config-context";
import { getSchemaByName } from "@/lib/schema";
import { t } from "@/lib/i18n";

export default function Page({
  params
}: {
  params: Promise<{
    owner: string;
    repo: string;
    branch: string;
    name: string;
    path: string;
  }>
}) {
  const resolvedParams = use(params);
  const { config } = useConfig();
  if (!config) throw new Error("Configuration not found.");
  const searchParams = useSearchParams();
  const parent = searchParams.get("parent") || undefined;
  const schemaName = decodeURIComponent(resolvedParams.name);
  const schema = getSchemaByName(config.object, schemaName);
  const displayName = schema?.label || schema?.name || schemaName;
  const newTitle = schema?.view?.add || t("New entry");

  return (
    <>
      <DocumentTitle
        title={formatRepoBranchTitle(`${newTitle} | ${displayName}`, config.owner, config.repo, config.branch)}
      />
      <Entry name={schemaName} title={newTitle} parent={parent}/>
    </>
  );
}
