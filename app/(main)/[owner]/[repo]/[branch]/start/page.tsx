"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChartColumn, ExternalLink, FolderOpen, Inbox, Search, type LucideIcon } from "lucide-react";
import { useConfig } from "@/contexts/config-context";
import { useUser } from "@/contexts/user-context";
import { useRepoHeader } from "@/components/repo/repo-header-context";
import { useMessagesSummary, useStatsAllowed } from "@/components/repo/repo-sidebar";
import { DocumentTitle, formatRepoBranchTitle } from "@/components/document-title";
import { contentIcon } from "@/lib/content-icons";
import { getSiteUrl } from "@/lib/deploy-watch";
import { siteDeclaresForms } from "@/lib/forms-shared";
import { siteDeclaresSeo } from "@/lib/seo-shared";
import { t } from "@/lib/i18n";
import { getMobileTasks } from "@/lib/mobile-tasks";
import { MobileStart } from "@/components/mobile-start";

// Webstudio: the first screen a client sees. Big tiles for every part of the
// website they can change, plus messages and visitor numbers. On a phone it
// shows only the few everyday tasks (components/mobile-start.tsx).

type Tile = { href: string; title: string; text: string; Icon: LucideIcon; badge?: string };

const greeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return t("Good morning");
  if (hour < 18) return t("Good afternoon");
  return t("Good evening");
};

export default function Page() {
  const { config } = useConfig();
  const { user } = useUser();
  if (!config) throw new Error("Configuration not found.");

  const messageSummary = useMessagesSummary(config.owner, config.repo, config.branch);
  const statsAllowed = useStatsAllowed(config.owner, config.repo, config.branch);

  const headerNode = useMemo(() => <h1 className="font-semibold text-lg">{t("Start")}</h1>, []);
  useRepoHeader({ header: headerNode });

  const base = `/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}`;
  const object = config.object as any;

  const tiles: Tile[] = [
    ...(object.content ?? []).map((item: any) => ({
      href: `${base}/${item.type}/${encodeURIComponent(item.name)}`,
      title: item.label || item.name,
      text: item.description
        || (item.type === "collection" ? t("Add, change or remove") : item.preview ? t("Change texts and photos") : t("Open and change")),
      Icon: contentIcon(item),
    })),
    ...(object.media ?? []).map((item: any) => ({
      href: `${base}/media/${encodeURIComponent(item.name || "default")}`,
      title: item.label || t("Photos"),
      text: t("Add new photos"),
      Icon: FolderOpen,
    })),
  ];
  if (messageSummary && (siteDeclaresForms(object) || messageSummary.total > 0)) {
    tiles.push({
      href: `${base}/berichten`,
      title: t("Messages"),
      text: t("What visitors send you"),
      Icon: Inbox,
      badge: messageSummary.unread > 0 ? t("{count} new", { count: messageSummary.unread }) : undefined,
    });
  }
  if (statsAllowed) {
    tiles.push({ href: `${base}/bezoekers`, title: t("Visitors"), text: t("How many people visit your website"), Icon: ChartColumn });
  }
  if (siteDeclaresSeo(object)) {
    tiles.push({ href: `${base}/google`, title: t("Google"), text: t("How your pages show up in Google"), Icon: Search });
  }

  const siteUrl = getSiteUrl(object);
  const firstName = (user?.name || "").trim().split(/\s+/)[0];
  const hello = firstName ? `${greeting()}, ${firstName}` : greeting();

  // Visitors of the last 7 days, shown on the phone's Visitors button.
  const [weekVisitors, setWeekVisitors] = useState<number | null>(null);
  useEffect(() => {
    if (!statsAllowed) return;
    let cancelled = false;
    fetch(`/api/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/stats?days=7`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        const count = payload?.data?.visitors;
        if (!cancelled && typeof count === "number") setWeekVisitors(count);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [statsAllowed, config.owner, config.repo, config.branch]);

  const mobileTasks = useMemo(() => getMobileTasks(object, base), [object, base]);
  const showMessages = Boolean(messageSummary && (siteDeclaresForms(object) || messageSummary.total > 0));

  return (
    <>
    <div className="md:hidden">
      <MobileStart
        greeting={hello}
        tasks={mobileTasks}
        messages={showMessages ? { href: `${base}/berichten`, unread: messageSummary?.unread ?? 0 } : null}
        visitors={statsAllowed ? { href: `${base}/bezoekers`, count: weekVisitors } : null}
        siteUrl={siteUrl}
        allTiles={tiles}
      />
    </div>
    <div className="mx-auto hidden w-full max-w-5xl space-y-8 py-2 md:block md:py-6">
      <DocumentTitle title={formatRepoBranchTitle(t("Start"), config.owner, config.repo, config.branch)} />
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1.5">
          <p className="text-muted-foreground">{hello}</p>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">{t("What would you like to change today?")}</h2>
        </div>
        {siteUrl && (
          <a
            href={siteUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-2 self-start rounded-full border bg-card px-4 py-2 text-sm font-medium hover:bg-accent md:self-auto"
          >
            {t("View website")} <ExternalLink className="size-4" />
          </a>
        )}
      </div>
      <div data-tour="tegels" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map(({ href, title, text, Icon, badge }) => (
          <Link
            key={href}
            href={href}
            className="group flex items-center gap-4 rounded-xl border bg-card p-5 shadow-xs transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
          >
            <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <Icon className="size-6" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2 text-base font-semibold">
                {title}
                {badge && (
                  <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">{badge}</span>
                )}
              </span>
              <span className="line-clamp-2 text-sm text-muted-foreground">{text}</span>
            </span>
            <ArrowRight className="size-5 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
          </Link>
        ))}
      </div>
      {object.content?.some((item: any) => item.preview) && (
        <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{t("Tip:")}</span>{" "}
          {t("click a text or photo in the preview of your website to jump straight to where you change it.")}
        </p>
      )}
    </div>
    </>
  );
}
