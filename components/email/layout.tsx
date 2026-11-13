import * as React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Section,
  Text,
  Tailwind,
} from "@react-email/components";
import { emailTheme } from "@/components/email/theme";
import { brand } from "@/lib/brand";
import { t } from "@/lib/i18n";

const getBaseUrl = () =>
  process.env.BASE_URL
    ? process.env.BASE_URL
    : process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "";

// Shared look for all emails: logo, heading, body and a footer line.
export function EmailLayout({
  preview,
  heading,
  email,
  footer,
  children,
}: {
  preview: string;
  heading: string;
  email: string;
  footer?: string;
  children: React.ReactNode;
}) {
  return (
    <Html lang="nl">
      <Head />
      <Preview>{preview}</Preview>
      <Tailwind>
        <Body
          className="my-auto mx-auto font-sans px-2 antialiased"
          style={{ backgroundColor: emailTheme.background, color: emailTheme.foreground }}
        >
          <Container className="my-[40px] mx-auto p-[20px] max-w-[465px]">
            <Section className="mt-[24px]">
              <Img
                src={`${getBaseUrl()}/images/email-logo.png`}
                width="42"
                height="42"
                alt={brand.name}
                className="my-0 mx-auto"
              />
            </Section>
            <Heading
              className="text-[24px] font-semibold p-0 my-[30px] mx-0 text-center tracking-tight"
              style={{ color: emailTheme.foreground }}
            >
              {heading}
            </Heading>
            {children}
            <Text className="text-[14px] leading-[24px] mt-[36px]" style={{ color: emailTheme.mutedForeground }}>
              {t("This email was sent to {email}.", { email })} {footer}
            </Text>
            <Text className="text-[14px] leading-[24px]" style={{ color: emailTheme.mutedForeground }}>
              {brand.name}
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

export function EmailText({ children }: { children: React.ReactNode }) {
  return (
    <Text className="text-[16px] leading-[24px]" style={{ color: emailTheme.foreground }}>
      {children}
    </Text>
  );
}

export function EmailButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Section className="text-center mt-[24px] mb-[24px]">
      <Button
        className="rounded-lg text-[16px] font-semibold no-underline text-center px-6 py-4"
        href={href}
        style={{
          backgroundColor: "#16a34a",
          border: "1px solid #16a34a",
          color: "#ffffff",
        }}
      >
        {children}
      </Button>
    </Section>
  );
}

// "owner/repo" becomes "repo": clients know their website, not the repository.
export const getSiteName = (repoName: string) => repoName.split("/").pop() || repoName;
