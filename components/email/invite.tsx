import * as React from "react";
import { Link } from "@react-email/components";
import { emailTheme } from "@/components/email/theme";
import { EmailButton, EmailLayout, EmailText, getSiteName } from "@/components/email/layout";
import { t } from "@/lib/i18n";

export const InviteEmailTemplate = ({
  email,
  repoName,
  inviteUrl,
  invitedByName,
}: {
  email: string;
  repoName: string;
  inviteUrl: string;
  invitedByName: string;
  invitedByUrl?: string;
}) => {
  const site = getSiteName(repoName);
  return (
    <EmailLayout
      preview={t("{person} invited you to edit your website.", { person: invitedByName })}
      heading={t("You can now edit your website")}
      email={email}
      footer={t("Not expecting this? Then you can ignore this email.")}
    >
      <EmailText>
        {t("{person} invited you to edit the website \"{site}\". You don't need an account or a password.", {
          person: invitedByName,
          site,
        })}
      </EmailText>
      <EmailButton href={inviteUrl}>{t("Start editing")}</EmailButton>
      <EmailText>{t("Button not working? Copy this link into your browser:")}</EmailText>
      <EmailText>
        <Link href={inviteUrl} className="underline" style={{ color: emailTheme.link }}>
          {inviteUrl}
        </Link>
      </EmailText>
    </EmailLayout>
  );
};
