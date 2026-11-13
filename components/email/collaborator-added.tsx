import * as React from "react";
import { EmailButton, EmailLayout, EmailText, getSiteName } from "@/components/email/layout";
import { t } from "@/lib/i18n";

export const CollaboratorAddedEmailTemplate = ({
  email,
  repoName,
  repoUrl,
  invitedByName,
}: {
  email: string;
  repoName: string;
  repoUrl: string;
  invitedByName: string;
  invitedByUrl?: string;
}) => {
  const site = getSiteName(repoName);
  return (
    <EmailLayout
      preview={t("You can now edit \"{site}\".", { site })}
      heading={t("You can now edit \"{site}\"", { site })}
      email={email}
    >
      <EmailText>
        {t("{person} gave you access to the website \"{site}\". You don't need to do anything else.", {
          person: invitedByName,
          site,
        })}
      </EmailText>
      <EmailButton href={repoUrl}>{t("Open my website")}</EmailButton>
    </EmailLayout>
  );
};
