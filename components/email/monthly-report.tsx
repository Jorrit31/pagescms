import * as React from "react";
import { Column, Link, Row, Section, Text } from "@react-email/components";
import { EmailButton, EmailLayout, EmailText } from "@/components/email/layout";
import { emailTheme } from "@/components/email/theme";

/** Webstudio: the monthly report mail ("Je website in oktober 2026"). */

export type MonthlyReportData = {
  siteName: string;
  siteUrl: string | null;
  monthLabel: string;
  visitors: number;
  previousVisitors: number;
  views: number;
  topPages: { label: string; count: number }[];
  topSources: { label: string; count: number }[];
  changeCount: number;
  changes: string[];
  people: string[];
  messages: number;
  tip: { title: string; text: string };
  cmsUrl: string;
};

const PRIMARY = "#5B48E8";
const number = (value: number) => value.toLocaleString("nl-NL");

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <Column className="w-1/2 align-top">
      <div style={{ border: `1px solid #e5e5e5`, borderRadius: 12, padding: "12px 14px", margin: 4 }}>
        <Text className="m-0 text-[13px]" style={{ color: emailTheme.mutedForeground }}>{label}</Text>
        <Text className="m-0 text-[26px] font-semibold leading-[34px]" style={{ color: emailTheme.foreground }}>{value}</Text>
        {note && <Text className="m-0 text-[12px]" style={{ color: emailTheme.mutedForeground }}>{note}</Text>}
      </div>
    </Column>
  );
}

function Heading2({ children }: { children: React.ReactNode }) {
  return (
    <Text className="text-[16px] font-semibold mt-[28px] mb-[8px]" style={{ color: emailTheme.foreground }}>
      {children}
    </Text>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <Section>
      {items.map((item, index) => (
        <Text key={index} className="text-[15px] leading-[22px] my-[4px]" style={{ color: emailTheme.foreground }}>
          • {item}
        </Text>
      ))}
    </Section>
  );
}

export const MonthlyReportEmailTemplate = ({ data, email }: { data: MonthlyReportData; email: string }) => {
  const change = data.previousVisitors > 0
    ? Math.round(((data.visitors - data.previousVisitors) / data.previousVisitors) * 100)
    : null;
  const changeNote = change === null
    ? undefined
    : change === 0
      ? "even veel als de maand ervoor"
      : change > 0
        ? `${change}% meer dan de maand ervoor`
        : `${Math.abs(change)}% minder dan de maand ervoor`;

  return (
    <EmailLayout
      preview={`${number(data.visitors)} bezoekers op ${data.siteName} in ${data.monthLabel}`}
      heading={`Je website in ${data.monthLabel}`}
      email={email}
      footer="Je krijgt dit overzicht elke maand. Liever niet? Antwoord dan even op deze mail."
    >
      <EmailText>
        Hier is je maandoverzicht van{" "}
        {data.siteUrl ? <Link href={data.siteUrl} style={{ color: PRIMARY }}>{data.siteName}</Link> : <strong>{data.siteName}</strong>}.
      </EmailText>

      <Section className="mt-[8px]">
        <Row>
          <Stat label="Bezoekers" value={number(data.visitors)} note={changeNote} />
          <Stat label="Bekeken pagina's" value={number(data.views)} note={data.messages ? `${number(data.messages)} ${data.messages === 1 ? "bericht" : "berichten"} via je website` : undefined} />
        </Row>
      </Section>

      {data.topPages.length > 0 && (
        <>
          <Heading2>Meest bekeken</Heading2>
          <List items={data.topPages.map((row) => `${row.label} (${number(row.count)}×)`)} />
        </>
      )}

      {data.topSources.length > 0 && data.visitors > 0 && (
        <>
          <Heading2>Hoe mensen je vonden</Heading2>
          <List items={data.topSources.map((row) => `${row.label} (${number(row.count)})`)} />
        </>
      )}

      <Heading2>Wat er veranderd is</Heading2>
      {data.changeCount === 0 ? (
        <EmailText>Deze maand is er niets gewijzigd.</EmailText>
      ) : (
        <>
          <EmailText>
            {data.changeCount === 1 ? "Er is 1 wijziging gedaan" : `Er zijn ${data.changeCount} wijzigingen gedaan`}
            {data.people.length ? ` door ${data.people.join(" en ")}` : ""}.
          </EmailText>
          <List items={data.changes} />
          {data.changeCount > data.changes.length && (
            <Text className="text-[14px]" style={{ color: emailTheme.mutedForeground }}>
              En nog {data.changeCount - data.changes.length} meer. Alles staat in het Logboek.
            </Text>
          )}
        </>
      )}

      <Section style={{ backgroundColor: "#F3F1FE", borderRadius: 12, padding: "14px 16px", marginTop: 28 }}>
        <Text className="m-0 text-[13px] font-semibold uppercase" style={{ color: PRIMARY, letterSpacing: 0.5 }}>Tip van de maand</Text>
        <Text className="mt-[6px] mb-0 text-[16px] font-semibold" style={{ color: emailTheme.foreground }}>{data.tip.title}</Text>
        <Text className="mt-[4px] mb-0 text-[15px] leading-[22px]" style={{ color: emailTheme.foreground }}>{data.tip.text}</Text>
      </Section>

      <EmailButton href={data.cmsUrl}>Naar mijn website-beheer</EmailButton>
    </EmailLayout>
  );
};
