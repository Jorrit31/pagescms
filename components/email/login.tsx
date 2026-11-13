import * as React from "react";
import { Section } from "@react-email/components";
import { emailTheme } from "@/components/email/theme";
import { EmailLayout, EmailText } from "@/components/email/layout";
import { brand } from "@/lib/brand";
import { t } from "@/lib/i18n";

export const LoginEmailTemplate = ({
  email,
  otp,
  preview,
}: {
  email: string;
  otp: string;
  preview?: string;
}) => (
  <EmailLayout
    preview={preview ?? t("Sign in to {name}", { name: brand.name })}
    heading={t("Sign in to {name}", { name: brand.name })}
    email={email}
    footer={t("Didn't try to sign in? Then you can ignore this email.")}
  >
    <EmailText>{t("Type this code on the sign-in page:")}</EmailText>
    <Section className="text-center mt-[24px] mb-[24px]">
      <pre
        className="inline-block rounded-lg border-0 text-[32px] font-semibold"
        style={{
          backgroundColor: emailTheme.muted,
          color: emailTheme.foreground,
          fontFamily:
            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
          letterSpacing: "8px",
          lineHeight: 1,
          marginBottom: 0,
          marginTop: 0,
          padding: "14px 6px 14px 14px",
        }}
      >
        {otp}
      </pre>
    </Section>
    <EmailText>{t("The code works for 5 minutes.")}</EmailText>
  </EmailLayout>
);
