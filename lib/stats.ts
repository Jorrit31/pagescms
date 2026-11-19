/**
 * Webstudio: visitor statistics for clients' websites, without cookies.
 *
 * The website sends one small beacon per page view to
 * POST /api/stats/<owner>/<repo> with { p: path, r: referrer }.
 * We store the path, where someone came from (only the host), the kind of
 * device and a visitor hash. The hash is made from a secret, the date, the IP
 * and the browser, so it changes every day: we can count unique visitors per
 * day, but can't follow anyone. No cookies, no IP stored, so no cookie banner.
 *
 * Every visit is one row in page_view, but only for about a week. After that
 * the visits of each day are added up into a handful of rows in page_view_day
 * (totals, per page, per source, per device) and the single visits are
 * deleted. The "Bezoekers" page reads both, so the numbers stay the same while
 * the database stays small.
 */

import { and, gte, lt, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { pageViewDayTable, pageViewTable } from "@/db/schema";
import { STATS_PERMISSION, type SiteStats, type StatsRow } from "@/lib/stats-shared";

export { STATS_PERMISSION };

const TIME_ZONE = "Europe/Amsterdam";
const KEEP_DAYS = 400;
// Single visits are kept for this many whole days (plus today), then summed.
const RAW_DAYS = 7;

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

/**
 * Adds up the visits of every day that is more than a week old into
 * page_view_day and deletes those visits, in one statement: a visit is either
 * still a single row or already counted, never both or neither. Whole Dutch
 * days at a time, so unique visitors per day stay exact. Also forgets summed
 * days older than about 13 months.
 */
export const summarizeOldPageViews = async () => {
  const zone = sql.raw(`'${TIME_ZONE}'`);
  await db.execute(sql`
    with gone as (
      delete from page_view
      where created_at < (((date_trunc('day', now() at time zone ${zone}) - make_interval(days => ${RAW_DAYS})) at time zone ${zone}) at time zone 'UTC')
      returning lower(owner) as owner, lower(repo) as repo, path, coalesce(source, '') as source, device, visitor,
        to_char((created_at at time zone 'UTC') at time zone ${zone}, 'YYYY-MM-DD') as day
    )
    insert into page_view_day (owner, repo, day, kind, label, views, visitors)
    select owner, repo, day, 'total', '', count(*)::int, count(distinct visitor)::int from gone group by owner, repo, day
    union all
    select owner, repo, day, 'page', path, count(*)::int, 0 from gone group by owner, repo, day, path
    union all
    select owner, repo, day, 'source', source, count(*)::int, count(distinct visitor)::int from gone group by owner, repo, day, source
    union all
    select owner, repo, day, 'device', device, count(*)::int, count(distinct visitor)::int from gone group by owner, repo, day, device
    on conflict (owner, repo, day, kind, label) do update
      set views = page_view_day.views + excluded.views, visitors = page_view_day.visitors + excluded.visitors
  `);
  await db.delete(pageViewDayTable).where(lt(pageViewDayTable.day, dayIn(new Date(Date.now() - KEEP_DAYS * 86_400_000))));
};

export const recordPageView = async (row: { owner: string; repo: string; path: string; source: string | null; device: string; visitor: string }) => {
  await db.insert(pageViewTable).values(row);
  // Now and then: sum up visits older than a week (for all sites at once).
  if (Math.random() < 0.02) {
    await summarizeOldPageViews().catch((error) => console.error("Summing page views failed", error));
  }
};

/** Minutes that count as "on the website now". */
export const LIVE_MINUTES = 5;

/** Different visitors with a page view in the last few minutes. */
export const getLiveVisitors = async (owner: string, repo: string) => {
  const [row] = await db
    .select({ count: sql<number>`count(distinct ${pageViewTable.visitor})::int` })
    .from(pageViewTable)
    .where(and(forSite(owner, repo), gte(pageViewTable.createdAt, new Date(Date.now() - LIVE_MINUTES * 60_000))));
  return Number(row?.count ?? 0);
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

/**
 * Numbers for the "Bezoekers" page: the last `days` days including today.
 * With `end`, the `days` days up to and including that day (monthly report).
 */
export const getSiteStats = async (owner: string, repo: string, days: number, end?: Date): Promise<SiteStats> => {
  const nowMs = end ? end.getTime() : Date.now();
  const today = dayIn(new Date(nowMs));
  const dayList: string[] = [];
  for (let index = days - 1; index >= 0; index--) {
    dayList.push(dayIn(new Date(nowMs - index * 86_400_000)));
  }
  // Rough window (a day extra on each side); exact days come from the local date below.
  const since = new Date(nowMs - (2 * days + 1) * 86_400_000);
  const localDay = sql<string>`to_char((${pageViewTable.createdAt} at time zone 'UTC') at time zone ${sql.raw(`'${TIME_ZONE}'`)}, 'YYYY-MM-DD')`;
  const where = and(forSite(owner, repo), gte(pageViewTable.createdAt, since));

  const firstDay = dayList[0];
  const previousDays = new Set<string>();
  for (let index = 2 * days - 1; index >= days; index--) {
    previousDays.add(dayIn(new Date(nowMs - index * 86_400_000)));
  }
  const earliestDay = dayIn(new Date(nowMs - (2 * days - 1) * 86_400_000));

  // Days older than a week are summed up in page_view_day (see summarizeOldPageViews).
  const summed = and(
    sql`lower(${pageViewDayTable.owner}) = lower(${owner})`,
    sql`lower(${pageViewDayTable.repo}) = lower(${repo})`,
  );
  const [rawDaily, summedDaily] = await Promise.all([
    db
      .select({
        day: localDay,
        views: sql<number>`count(*)::int`,
        visitors: sql<number>`count(distinct ${pageViewTable.visitor})::int`,
      })
      .from(pageViewTable)
      .where(where)
      .groupBy(localDay),
    db
      .select({
        day: pageViewDayTable.day,
        views: sql<number>`sum(${pageViewDayTable.views})::int`,
        visitors: sql<number>`sum(${pageViewDayTable.visitors})::int`,
      })
      .from(pageViewDayTable)
      .where(and(summed, sql`${pageViewDayTable.kind} = 'total'`, gte(pageViewDayTable.day, earliestDay), lte(pageViewDayTable.day, today)))
      .groupBy(pageViewDayTable.day),
  ]);

  const byDay = new Map<string, { day: string; views: number; visitors: number }>();
  for (const row of [...rawDaily, ...summedDaily]) {
    const known = byDay.get(row.day) ?? { day: row.day, views: 0, visitors: 0 };
    known.views += Number(row.views);
    known.visitors += Number(row.visitors);
    byDay.set(row.day, known);
  }
  const daily = [...byDay.values()];

  const perDay = dayList.map((day) => ({ day, visitors: byDay.get(day)?.visitors ?? 0, views: byDay.get(day)?.views ?? 0 }));
  const previous = daily.filter((row) => previousDays.has(row.day));

  const inRange = and(where, sql`${localDay} >= ${firstDay}`, sql`${localDay} <= ${today}`);
  // Pages count views; sources and devices count visitors (once per day).
  const summedCount = sql<number>`sum(case when ${pageViewDayTable.kind} = 'page' then ${pageViewDayTable.views} else ${pageViewDayTable.visitors} end)::int`;
  const [rawPages, rawSources, rawDevices, summedLabels] = await Promise.all([
    db.select({ label: pageViewTable.path, count: sql<number>`count(*)::int` }).from(pageViewTable).where(inRange).groupBy(pageViewTable.path),
    db.select({ label: pageViewTable.source, count: sql<number>`count(distinct ${pageViewTable.visitor} || ${localDay})::int` }).from(pageViewTable).where(inRange).groupBy(pageViewTable.source),
    db.select({ label: pageViewTable.device, count: sql<number>`count(distinct ${pageViewTable.visitor} || ${localDay})::int` }).from(pageViewTable).where(inRange).groupBy(pageViewTable.device),
    db
      .select({ kind: pageViewDayTable.kind, label: pageViewDayTable.label, count: summedCount })
      .from(pageViewDayTable)
      .where(and(summed, sql`${pageViewDayTable.kind} in ('page', 'source', 'device')`, gte(pageViewDayTable.day, firstDay), lte(pageViewDayTable.day, today)))
      .groupBy(pageViewDayTable.kind, pageViewDayTable.label),
  ]);
  const summedOf = (kind: string) => summedLabels
    .filter((row) => row.kind === kind)
    .map((row) => ({ label: row.label || null, count: row.count }));
  const pages = [...rawPages, ...summedOf("page")];
  const sources = [...rawSources, ...summedOf("source")];
  const devices = [...rawDevices, ...summedOf("device")];

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
