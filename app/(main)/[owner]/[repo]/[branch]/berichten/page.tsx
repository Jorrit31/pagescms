"use client";

import { useMemo } from "react";
import { DocumentTitle, formatRepoBranchTitle } from "@/components/document-title";
import { Messages } from "@/components/messages";
import { NewsletterList } from "@/components/newsletter-list";
import { useRepoHeader } from "@/components/repo/repo-header-context";
import { useConfig } from "@/contexts/config-context";
import { useIsBuilderView } from "@/lib/client-view";
import { getSiteForms, NEWSLETTER_FORM } from "@/lib/forms-shared";
import { t } from "@/lib/i18n";

export default function Page() {
  const { config } = useConfig();
  const builderView = useIsBuilderView();
  if (!config) throw new Error(`Configuration not found.`);

  const forms = useMemo(() => getSiteForms(config.object), [config.object]);
  const formLabels = useMemo(
    () => Object.fromEntries(forms.map((form) => [form.name, form.label])),
    [forms],
  );

  const headerNode = useMemo(() => (
    <h1 className="font-semibold text-lg">{t("Messages from your website")}</h1>
  ), []);
  useRepoHeader({ header: headerNode });

  return (
    <div className="max-w-screen-sm mx-auto flex-1 flex flex-col h-full w-full">
      <DocumentTitle title={formatRepoBranchTitle(t("Messages"), config.owner, config.repo, config.branch)} />
      {builderView && (
        <div className="mb-4 rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground space-y-1">
          {forms.filter((form) => form.name !== NEWSLETTER_FORM).map((form) => (
            <p key={form.name}>
              <span className="font-medium text-foreground">{form.label}</span>
              {" "}(<code>{form.name}</code>): {t("Messages are sent to")}{" "}
              {form.to.length > 0 ? form.to.join(", ") : t("everyone you invited to this website")}
            </p>
          ))}
        </div>
      )}
      <NewsletterList owner={config.owner} repo={config.repo} branch={config.branch} />
      <Messages
        owner={config.owner}
        repo={config.repo}
        branch={config.branch}
        formLabels={formLabels}
        showMailStatus={builderView}
      />
    </div>
  );
}
