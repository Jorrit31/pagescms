"use client";

import { useEffect, useState } from "react";
import { Monitor, Smartphone, Tablet, TrendingDown, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireApiSuccess } from "@/lib/api-client";
import { t, uiLanguage } from "@/lib/i18n";
import type { SiteStats, StatsRow } from "@/lib/stats-shared";
import { cn } from "@/lib/utils";

/** Webstudio: the "Bezoekers" page. Plain numbers for the client, no jargon. */

const RANGES = [7, 30, 90, 365];
const locale = () => (uiLanguage === "nl" ? "nl-NL" : "en-GB");
const number = (value: number) => value.toLocaleString(locale());

const rangeLabel = (days: number) => (days === 365 ? t("Year") : t("{days} days", { days }));

const dayLabel = (day: string, long = false) => new Date(`${day}T12:00:00`).toLocaleDateString(locale(), long
  ? { weekday: "long", day: "numeric", month: "long" }
  : { day: "numeric", month: "short" });

/** "/over-ons/" -> "Over ons"; "/nieuws/opening/" -> "Nieuws › Opening". */
const pageLabel = (path: string) => {
  if (path === "/") return t("Homepage");
  let text = path;
  try { text = decodeURIComponent(path); } catch { /* keep as is */ }
  const parts = text.split("/").filter(Boolean).map((part) => part.replace(/[-_]+/g, " ").trim());
  return parts.map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" › ") || path;
};

const deviceLabel: Record<string, string> = { mobiel: "Phone", tablet: "Tablet", computer: "Computer" };
const deviceIcon: Record<string, React.ReactNode> = {
  mobiel: <Smartphone className="h-4 w-4" />,
  tablet: <Tablet className="h-4 w-4" />,
  computer: <Monitor className="h-4 w-4" />,
};

function Change({ now, before }: { now: number; before: number }) {
  if (before === 0) return null;
  const change = Math.round(((now - before) / before) * 100);
  if (change === 0) return <span className="text-xs text-muted-foreground">{t("same as before")}</span>;
  const up = change > 0;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs", up ? "text-green-700 dark:text-green-400" : "text-muted-foreground")}>
      {up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
      {t(up ? "{n}% more than the period before" : "{n}% less than the period before", { n: Math.abs(change) })}
    </span>
  );
}

function Tile({ label, value, before, hint }: { label: string; value: number; before: number; hint: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold tabular-nums">{number(value)}</div>
      <Change now={value} before={before} />
      <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
    </div>
  );
}

function Bars({ perDay }: { perDay: SiteStats["perDay"] }) {
  // A year is too many bars for a phone: group per week.
  const groups = perDay.length > 90
    ? Array.from({ length: Math.ceil(perDay.length / 7) }, (_, index) => {
      const week = perDay.slice(index * 7, index * 7 + 7);
      return { day: week[0].day, visitors: week.reduce((sum, row) => sum + row.visitors, 0), week: true };
    })
    : perDay.map((row) => ({ day: row.day, visitors: row.visitors, week: false }));
  const max = Math.max(1, ...groups.map((row) => row.visitors));
  return (
    <div>
      <div className="flex h-32 items-end gap-px" role="img" aria-label={t("Visitors per day")}>
        {groups.map((row) => (
          <div
            key={row.day}
            className="group relative flex h-full flex-1 items-end"
            title={`${row.week ? t("Week of {day}", { day: dayLabel(row.day) }) : dayLabel(row.day, true)}: ${number(row.visitors)} ${t("visitors")}`}
          >
            <div
              className="w-full rounded-t-sm bg-primary/80 group-hover:bg-primary"
              style={{ height: `${Math.max(row.visitors > 0 ? 3 : 1, (row.visitors / max) * 100)}%`, opacity: row.visitors > 0 ? 1 : 0.25 }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-xs text-muted-foreground">
        <span>{dayLabel(groups[0].day)}</span>
        <span>{t("today")}</span>
      </div>
    </div>
  );
}

function List({ title, rows, label, icon, unit }: {
  title: string;
  rows: StatsRow[];
  label?: (value: string) => string;
  icon?: (value: string) => React.ReactNode;
  unit: string;
}) {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const max = Math.max(1, ...rows.map((row) => row.count));
  return (
    <div className="rounded-lg border p-3">
      <div className="mb-2 flex items-baseline justify-between text-sm">
        <span className="font-medium">{title}</span>
        <span className="text-xs text-muted-foreground">{unit}</span>
      </div>
      {rows.length === 0 ? (
        <div className="text-sm text-muted-foreground">{t("Nothing yet.")}</div>
      ) : (
        <ul className="space-y-1">
          {rows.map((row) => (
            <li key={row.label} className="relative overflow-hidden rounded px-2 py-1 text-sm">
              <div className="absolute inset-y-0 left-0 bg-muted" style={{ width: `${(row.count / max) * 100}%` }} />
              <div className="relative flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2">
                  {icon?.(row.label)}
                  <span className="truncate">{label ? label(row.label) : row.label}</span>
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {number(row.count)}
                  {total > 0 && rows.length > 1 && <span className="ml-1 text-xs">({Math.round((row.count / total) * 100)}%)</span>}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function SiteStatsView({ owner, repo, branch, builderView }: { owner: string; repo: string; branch: string; builderView?: boolean }) {
  const [days, setDays] = useState(30);
  const [stats, setStats] = useState<SiteStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    fetch(`/api/${owner}/${repo}/${encodeURIComponent(branch)}/stats?days=${days}`, { cache: "no-store" })
      .then((response) => requireApiSuccess<any>(response, "Failed to load visitors"))
      .then((payload) => { if (!cancelled) setStats(payload.data); })
      .catch((err) => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [owner, repo, branch, days]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1" role="group" aria-label={t("Period")}>
        {RANGES.map((range) => (
          <Button key={range} size="sm" variant={range === days ? "default" : "outline"} onClick={() => setDays(range)} aria-pressed={range === days}>
            {rangeLabel(range)}
          </Button>
        ))}
      </div>

      {error ? (
        <div className="rounded-lg border p-4 text-sm text-muted-foreground">{error}</div>
      ) : !stats || stats.days !== days ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3"><Skeleton className="h-28" /><Skeleton className="h-28" /></div>
          <Skeleton className="h-40" />
          <Skeleton className="h-48" />
        </div>
      ) : (
        <>
          {stats.views === 0 && stats.previousViews === 0 && (
            <div className="rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
              {builderView
                ? t("No visits counted yet. The website needs the visitor counter (in the starter template it is built in; it needs CMS_URL in Cloudflare Pages).")
                : t("No visits counted yet. As soon as people visit your website, you see it here.")}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Tile label={t("Visitors")} value={stats.visitors} before={stats.previousVisitors} hint={t("Different people per day, added up.")} />
            <Tile label={t("Pages viewed")} value={stats.views} before={stats.previousViews} hint={t("Every page someone opened.")} />
          </div>
          <div className="rounded-lg border p-3">
            <div className="mb-2 text-sm font-medium">{t(stats.perDay.length > 90 ? "Visitors per week" : "Visitors per day")}</div>
            <Bars perDay={stats.perDay} />
          </div>
          <List title={t("Most viewed pages")} rows={stats.pages} label={pageLabel} unit={t("views")} />
          <List
            title={t("Where visitors come from")}
            rows={stats.sources}
            label={(value) => (value === "Direct" ? t("Typed the address or used a bookmark") : value)}
            unit={t("visitors")}
          />
          <List
            title={t("Device")}
            rows={stats.devices}
            label={(value) => t(deviceLabel[value] ?? value)}
            icon={(value) => deviceIcon[value]}
            unit={t("visitors")}
          />
          <p className="text-xs text-muted-foreground">
            {t("Counted without cookies and without storing who someone is, so your website needs no cookie banner for this.")}
          </p>
        </>
      )}
    </div>
  );
}
