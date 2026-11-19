import "server-only";

/**
 * Webstudio: the monthly report mail to every client ("Maandrapport").
 *
 * On the 1st to 5th of every month a Cloudflare Cron (cloudflare-worker.ts)
 * calls GET /api/cron/monthly-report. For each site with clients, and with
 * the report not turned off on the Klanten dashboard, we mail the visitors,
 * what was changed and a tip. report_sent makes sure a site gets a month
 * once; when no mail at all could be sent, the next day tries again (until
 * the 5th, then the error stays visible on the dashboard).
 */

import { createHmac, timingSafeEqual } from "crypto";
import { render } from "@react-email/render";
import { and, count, gte, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { formSubmissionTable, reportSentTable } from "@/db/schema";
import { MonthlyReportEmailTemplate, type MonthlyReportData } from "@/components/email/monthly-report";
import { getActivity } from "@/lib/activity";
import { describeActivity, formatActivityTime, personName } from "@/lib/activity-shared";
import { listSites, type AgencySite } from "@/lib/agency";
import { getBaseUrl } from "@/lib/base-url";
import { getSiteClientEmails } from "@/lib/forms";
import { sendEmail } from "@/lib/mailer";
import { getSiteStats } from "@/lib/stats";

const TIME_ZONE = "Europe/Amsterdam";
/** The Cron runs on day 1 to LAST_TRY_DAY; a failed site is tried again the next day. */
const LAST_TRY_DAY = 5;

const dayOfMonth = (date: Date) => Number(new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, day: "2-digit" }).format(date));

const TIPS: { title: string; text: string }[] = [
  { title: "Zet je openingstijden goed", text: "Klopt alles rond de feestdagen of je vakantie? Een bezoeker die voor een dichte deur staat, komt minder snel terug." },
  { title: "Een nieuwe foto doet wonderen", text: "Vervang eens een foto op je homepage door een recente. Een site die leeft, voelt betrouwbaarder." },
  { title: "Vertel wat er nieuw is", text: "Een kort nieuwsbericht over een actie, een nieuw product of een mooi project laat zien dat je bedrijf actief is. Google ziet dat ook." },
  { title: "Schrijf zoals je praat", text: "Korte zinnen lezen het prettigst, zeker op een telefoon. Lees je tekst hardop: struikel je ergens, maak de zin dan korter." },
  { title: "Vraag om een review", text: "Tevreden klant? Vraag of ze een Google-review willen schrijven. Dat helpt nieuwe klanten meer dan welke tekst dan ook." },
  { title: "Beschrijf je foto's", text: "Vul bij foto's een korte beschrijving in. Dat helpt mensen die slecht zien, en Google begrijpt dan beter wat erop staat." },
  { title: "Deel je pagina's", text: "Plaats een link naar je website op Instagram, Facebook of in je WhatsApp-status. Zo vinden mensen de weg naar je site." },
  { title: "Kijk naar je populairste pagina", text: "De pagina die het meest bekeken wordt, verdient extra aandacht. Staat daar alles op wat een bezoeker wil weten?" },
  { title: "Maak contact makkelijk", text: "Staat je telefoonnummer of het contactformulier op elke pagina goed in zicht? Hoe makkelijker, hoe meer aanvragen." },
  { title: "Bekijk je site op je telefoon", text: "De meeste bezoekers komen met hun telefoon. Loop je site er eens doorheen, alsof je een nieuwe klant bent." },
  { title: "Houd je prijzen actueel", text: "Oude prijzen geven discussie aan de balie. Even nalopen kost twee minuten." },
  { title: "Plan je volgende maand", text: "Komt er een drukke periode aan? Zet een aankondiging of actie alvast klaar, dan sta je er op tijd mee." },
];

const NO_CHANGES_TIP = {
  title: "Even iets kleins aanpassen?",
  text: "Deze maand is er niets gewijzigd op je website. Een nieuwe foto of een kort bericht is zo gedaan, en laat bezoekers en Google zien dat je actief bent.",
};

/** Key that proves a request comes from our own Cron (derived from the auth secret, so nothing new to set up). */
export const cronKey = () => {
  const secret = process.env.BETTER_AUTH_SECRET || process.env.AUTH_SECRET || "";
  if (!secret) return null;
  return createHmac("sha256", secret).update("webstudio-cron-v1").digest("hex");
};

export const isCronRequest = (request: Request) => {
  const expected = cronKey();
  const given = request.headers.get("x-cron-key") || "";
  if (!expected || given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(expected));
};

const parts = (date: Date) => {
  const [year, month] = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit" }).format(date).split("-").map(Number);
  return { year, month };
};

/** The calendar month before `now`, in Dutch time: { key: "2026-10", start, end, days, label: "oktober 2026" }. */
export const previousMonth = (now = new Date()) => {
  const current = parts(now);
  const year = current.month === 1 ? current.year - 1 : current.year;
  const month = current.month === 1 ? 12 : current.month - 1;
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  // Midday on the first and last day: safely inside the month in any time zone.
  const firstNoon = new Date(Date.UTC(year, month - 1, 1, 11));
  const lastNoon = new Date(Date.UTC(year, month - 1, days, 11));
  // Rough bounds for database queries (a day extra each side is filtered by day below).
  const start = new Date(Date.UTC(year, month - 1, 1) - 2 * 3_600_000);
  const end = new Date(Date.UTC(year, month, 1) - 2 * 3_600_000);
  const label = firstNoon.toLocaleDateString("nl-NL", { timeZone: TIME_ZONE, month: "long", year: "numeric" });
  return { key: `${year}-${String(month).padStart(2, "0")}`, start, end, days, firstNoon, lastNoon, label, monthIndex: month - 1 };
};

const pageLabel = (path: string) => {
  if (path === "/") return "Homepage";
  let text = path;
  try { text = decodeURIComponent(path); } catch { /* keep */ }
  const words = text.split("/").filter(Boolean).map((part) => part.replace(/[-_]+/g, " ").trim());
  return words.map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" › ") || path;
};

const sourceLabel = (label: string) => (label === "Direct" ? "Direct (adres getypt of bladwijzer)" : label);

const siteName = (site: Pick<AgencySite, "repo" | "siteUrl">, siteUrl: string | null) => {
  if (siteUrl) {
    const host = new URL(siteUrl).hostname.replace(/^www\./, "");
    if (!/\.(pages|workers)\.dev$/.test(host)) return host;
  }
  return site.repo;
};

/** Everything that goes into one site's mail for `month`. */
export const buildMonthlyReport = async (site: AgencySite, month = previousMonth()): Promise<MonthlyReportData> => {
  const sameMonth = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit" }).format(new Date(iso)) === month.key;

  const [stats, activity, messages] = await Promise.all([
    getSiteStats(site.owner, site.repo, month.days, month.lastNoon),
    getActivity(site.owner, site.repo, { since: month.start, until: month.end, limit: 500 }),
    db.select({ count: count() }).from(formSubmissionTable).where(and(
      sql`lower(${formSubmissionTable.owner}) = lower(${site.owner})`,
      sql`lower(${formSubmissionTable.repo}) = lower(${site.repo})`,
      gte(formSubmissionTable.createdAt, month.start),
      lt(formSubmissionTable.createdAt, month.end),
    )),
  ]);

  const changes = activity.filter((entry) => sameMonth(entry.createdAt));
  const people = Array.from(new Set(changes.map((entry) => personName(entry))));
  const siteUrl = site.siteUrl;
  const baseUrl = getBaseUrl().replace(/\/$/, "");

  return {
    siteName: siteName(site, siteUrl),
    siteUrl,
    monthLabel: month.label,
    visitors: stats.visitors,
    previousVisitors: stats.previousVisitors,
    views: stats.views,
    topPages: stats.pages.slice(0, 3).map((row) => ({ label: pageLabel(row.label), count: row.count })),
    topSources: stats.sources.slice(0, 3).map((row) => ({ label: sourceLabel(row.label), count: row.count })),
    changeCount: changes.length,
    changes: changes.slice(0, 8).map((entry) => `${describeActivity(entry)} (${formatActivityTime(entry.createdAt, month.lastNoon)})`),
    people,
    messages: Number(messages[0]?.count ?? 0),
    tip: changes.length === 0 ? NO_CHANGES_TIP : TIPS[month.monthIndex % TIPS.length],
    cmsUrl: `${baseUrl}/${site.owner}/${site.repo}`,
  };
};

export const renderMonthlyReport = async (data: MonthlyReportData, email: string) => {
  const html = await render(MonthlyReportEmailTemplate({ data, email }));
  const change = data.previousVisitors > 0 ? Math.round(((data.visitors - data.previousVisitors) / data.previousVisitors) * 100) : null;
  const text = [
    `Je website in ${data.monthLabel}: ${data.siteName}`,
    "",
    `Bezoekers: ${data.visitors}${change !== null ? ` (${change >= 0 ? "+" : ""}${change}% vergeleken met de maand ervoor)` : ""}`,
    `Bekeken pagina's: ${data.views}`,
    data.topPages.length ? `Meest bekeken: ${data.topPages.map((row) => row.label).join(", ")}` : "",
    data.messages ? `Berichten via je website: ${data.messages}` : "",
    "",
    data.changeCount ? `Wijzigingen (${data.changeCount}):` : "Er is deze maand niets gewijzigd.",
    ...data.changes.map((line) => `- ${line}`),
    "",
    `Tip: ${data.tip.title}. ${data.tip.text}`,
    "",
    `Naar je website-beheer: ${data.cmsUrl}`,
  ].filter((line, index, all) => line || all[index - 1]).join("\n");
  return { html, text, subject: `Je website in ${data.monthLabel}` };
};

/** Sends `site`'s report for `month` once. Returns what happened, for the log. */
export const sendMonthlyReport = async (site: AgencySite, month = previousMonth(), now = new Date()) => {
  const recipients = await getSiteClientEmails(site.owner, site.repo);
  if (recipients.length === 0) return { site: `${site.owner}/${site.repo}`, result: "no clients" };
  if (!site.monthlyReport) return { site: `${site.owner}/${site.repo}`, result: "turned off" };

  // Claim the month first, so two runs at once can't both send.
  const claimed = await db.insert(reportSentTable)
    .values({ owner: site.owner, repo: site.repo, month: month.key, recipients: recipients.join(", ") })
    .onConflictDoNothing()
    .returning({ id: reportSentTable.id });
  if (claimed.length === 0) return { site: `${site.owner}/${site.repo}`, result: "already sent" };

  const errors: string[] = [];
  let sent = 0;
  try {
    const data = await buildMonthlyReport(site, month);
    // One mail per person, so nobody sees the other addresses.
    for (const email of recipients) {
      try {
        const { html, text, subject } = await renderMonthlyReport(data, email);
        await sendEmail({ to: email, subject, html, text });
        sent += 1;
      } catch (error: any) {
        errors.push(`${email}: ${error?.message || error}`);
      }
    }
  } catch (error: any) {
    errors.push(String(error?.message || error));
  }

  if (sent === 0 && dayOfMonth(now) < LAST_TRY_DAY) {
    // Nothing went out: forget the claim, so tomorrow's run tries again.
    await db.delete(reportSentTable).where(sql`${reportSentTable.id} = ${claimed[0].id}`);
    return { site: `${site.owner}/${site.repo}`, result: `failed, retry tomorrow: ${errors.join("; ")}` };
  }
  if (errors.length) {
    await db.update(reportSentTable).set({ error: errors.join("; ").slice(0, 1000) }).where(sql`${reportSentTable.id} = ${claimed[0].id}`);
  }
  return { site: `${site.owner}/${site.repo}`, result: errors.length ? `errors: ${errors.join("; ")}` : `sent to ${recipients.length}` };
};

/** The monthly run: every site, one after the other. */
export const sendAllMonthlyReports = async (now = new Date()) => {
  const month = previousMonth(now);
  const sites = await listSites();
  const results = [];
  for (const site of sites) {
    try {
      results.push(await sendMonthlyReport(site, month, now));
    } catch (error: any) {
      results.push({ site: `${site.owner}/${site.repo}`, result: `error: ${error?.message || error}` });
    }
  }
  return { month: month.key, results };
};

/** A test mail of a site's report to Jorrit, without marking the month as sent. */
export const sendMonthlyReportPreview = async (site: AgencySite, to: string, month = previousMonth()) => {
  const data = await buildMonthlyReport(site, month);
  const { html, text, subject } = await renderMonthlyReport(data, to);
  await sendEmail({ to, subject: `[Voorbeeld] ${subject}`, html, text });
  return data;
};

export type ReportStatus = { month: string; sentAt: string; recipients: string | null; error: string | null };

/** Latest monthly report per site, for the dashboard. Keyed "owner/repo" in lower case. */
export const getLatestReports = async () => {
  const rows = await db.execute(sql`
    select distinct on (lower(owner), lower(repo)) owner, repo, month, sent_at, recipients, error
    from report_sent
    order by lower(owner), lower(repo), month desc
  `);
  const result = new Map<string, ReportStatus>();
  for (const row of (rows as any).rows ?? rows as any[]) {
    result.set(`${String(row.owner).toLowerCase()}/${String(row.repo).toLowerCase()}`, {
      month: row.month,
      sentAt: new Date(row.sent_at).toISOString(),
      recipients: row.recipients,
      error: row.error,
    });
  }
  return result;
};
