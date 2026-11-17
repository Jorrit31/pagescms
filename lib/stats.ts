/**
 * Webstudio: visitor statistics for clients' websites, without cookies.
 *
 * The website sends one small beacon per page view to
 * POST /api/stats/<owner>/<repo> with { p: path, r: referrer }.
 * We store the path, where someone came from (only the host), the kind of
 * device and a visitor hash. The hash is made from a secret, the date, the IP
 * and the browser, so it changes every day: we can count unique visitors per
 * day, but can't follow anyone. No cookies, no IP stored, so no cookie banner.
 */

import { and, gte, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { pageViewTable } from "@/db/schema";
import { STATS_PERMISSION, type SiteStats, type StatsRow } from "@/lib/stats-shared";

export { STATS_PERMISSION };

const TIME_ZONE = "Europe/Amsterdam";
const KEEP_DAYS = 400;

const BOT = /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|telegram|preview|headless|lighthouse|pingdom|uptime|curl|wget|python|java\/|go-http|axios|node-fetch/i;

export const isBot = (userAgent: string) => !userAgent || BOT.test(userAgent);

export const deviceOf = (userAgent: string) => {
  if (/ipad|tablet|kindle|playbook|silk/i.test(userAgent) || (/android/i.test(userAgent) && !/mobile/i.test(userAgent))) return "tablet";
  if (/mobi|iphone|ipod|android|windows phone/i.test(userAgent)) return "mobiel";
  return "computer";
};

const dayIn = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);

export const visitorHash = async (owner: string, repo: string, ip: string, userAgent: string, now = new Date()) => {
  const secret = process.env.AUTH_SECRET || process.env.BETTER_AUTH_SECRET || "";
  const data = new TextEncoder().encode(`${secret}|${dayIn(now)}|${owner.toLowerCase()}/${repo.toLowerCase()}|${ip}|${userAgent}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).slice(0, 12).map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

/** "/over-ons/?x=1#top" -> "/over-ons/"; null when it isn't a path. */
export const cleanPath = (value: unknown) => {
  if (typeof value !== "string") return null;
  const path = value.split(/[?#]/)[0].trim().slice(0, 300);
  if (!path.startsWith("/")) return null;
  const clean = path.replace(/\/index\.html$/, "/").replace(/\.html$/, "").replace(/\/{2,}/g, "/");
  return clean || "/";
};

/** Host someone came from, without www.; null for direct visits and the site itself. */
export const cleanSource = (referrer: unknown, siteHost: string | null) => {
  if (typeof referrer !== "string" || !referrer) return null;
  try {
    const url = new URL(referrer);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    if (siteHost && host === siteHost.replace(/^www\./, "").toLowerCase()) return null;
    return host.slice(0, 120);
  } catch {
    return null;
  }
};

const forSite = (owner: string, repo: string) => and(
  sql`lower(${pageViewTable.owner}) = lower(${owner})`,
  sql`lower(${pageViewTable.repo}) = lower(${repo})`,
);

export const recordPageView = async (row: { owner: string; repo: string; path: string; source: string | null; device: string; visitor: string }) => {
  await db.insert(pageViewTable).values(row);
  // Now and then: forget visits older than about 13 months.
  if (Math.random() < 0.01) {
    await db.delete(pageViewTable).where(lt(pageViewTable.createdAt, new Date(Date.now() - KEEP_DAYS * 86_400_000)));
  }
};

/** Names people know instead of hosts. */
const SOURCE_NAMES: [RegExp, string][] = [
  [/(^|\.)google\./, "Google"],
  [/(^|\.)bing\.com$/, "Bing"],
  [/(^|\.)duckduckgo\.com$/, "DuckDuckGo"],
  [/(^|\.)ecosia\.org$/, "Ecosia"],
  [/(^|\.)(facebook\.com|fb\.com|fb\.me)$/, "Facebook"],
  [/(^|\.)instagram\.com$/, "Instagram"],
  [/(^|\.)(whatsapp\.com|wa\.me)$/, "WhatsApp"],
  [/(^|\.)linkedin\.com$|^lnkd\.in$/, "LinkedIn"],
  [/(^|\.)pinterest\./, "Pinterest"],
  [/(^|\.)tiktok\.com$/, "TikTok"],
  [/(^|\.)(t\.co|twitter\.com|x\.com)$/, "X (Twitter)"],
  [/(^|\.)youtube\.com$/, "YouTube"],
];
const sourceName = (host: string | null) => {
  if (!host) return null;
  return SOURCE_NAMES.find(([pattern]) => pattern.test(host))?.[1] ?? host;
};

const top = (rows: { label: string | null; count: number }[], limit: number, fallback: string): StatsRow[] => {
  const merged = new Map<string, number>();
  for (const row of rows) {
    const label = row.label || fallback;
    merged.set(label, (merged.get(label) ?? 0) + Number(row.count));
  }
  return [...merged.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count).slice(0, limit);
};

/** Numbers for the "Bezoekers" page: the last `days` days including today. */
export const getSiteStats = async (owner: string, repo: string, days: number): Promise<SiteStats> => {
  const today = dayIn(new Date());
  const dayList: string[] = [];
  for (let index = days - 1; index >= 0; index--) {
    dayList.push(dayIn(new Date(Date.now() - index * 86_400_000)));
  }
  // Rough window (a day extra on each side); exact days come from the local date below.
  const since = new Date(Date.now() - (2 * days + 1) * 86_400_000);
  const localDay = sql<string>`to_char((${pageViewTable.createdAt} at time zone 'UTC') at time zone ${sql.raw(`'${TIME_ZONE}'`)}, 'YYYY-MM-DD')`;
  const where = and(forSite(owner, repo), gte(pageViewTable.createdAt, since));

  const daily = await db
    .select({
      day: localDay,
      views: sql<number>`count(*)::int`,
      visitors: sql<number>`count(distinct ${pageViewTable.visitor})::int`,
    })
    .from(pageViewTable)
    .where(where)
    .groupBy(localDay);

  const byDay = new Map(daily.map((row) => [row.day, row]));
  const firstDay = dayList[0];
  const previousDays = new Set<string>();
  for (let index = 2 * days - 1; index >= days; index--) {
    previousDays.add(dayIn(new Date(Date.now() - index * 86_400_000)));
  }

  const perDay = dayList.map((day) => ({ day, visitors: byDay.get(day)?.visitors ?? 0, views: byDay.get(day)?.views ?? 0 }));
  const previous = daily.filter((row) => previousDays.has(row.day));

  const inRange = and(where, sql`${localDay} >= ${firstDay}`, sql`${localDay} <= ${today}`);
  const [pages, sources, devices] = await Promise.all([
    db.select({ label: pageViewTable.path, count: sql<number>`count(*)::int` }).from(pageViewTable).where(inRange).groupBy(pageViewTable.path),
    db.select({ label: pageViewTable.source, count: sql<number>`count(distinct ${pageViewTable.visitor} || ${localDay})::int` }).from(pageViewTable).where(inRange).groupBy(pageViewTable.source),
    db.select({ label: pageViewTable.device, count: sql<number>`count(distinct ${pageViewTable.visitor} || ${localDay})::int` }).from(pageViewTable).where(inRange).groupBy(pageViewTable.device),
  ]);

  return {
    days,
    visitors: perDay.reduce((sum, row) => sum + row.visitors, 0),
    views: perDay.reduce((sum, row) => sum + row.views, 0),
    previousVisitors: previous.reduce((sum, row) => sum + row.visitors, 0),
    previousViews: previous.reduce((sum, row) => sum + row.views, 0),
    perDay,
    pages: top(pages, 10, "/"),
    sources: top(sources.map((row) => ({ label: sourceName(row.label), count: row.count })), 8, "Direct"),
    devices: top(devices, 3, "computer"),
  };
};
