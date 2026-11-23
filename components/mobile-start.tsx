"use client";

/**
 * Webstudio: the start screen on a phone. Only the few things people really
 * do on the go, as big buttons for a thumb: change a text or price, replace
 * a photo, post something new, read messages, see visitors. Everything else
 * is folded away under "Everything else".
 */

import { useState } from "react";
import Link from "next/link";
import {
  Camera,
  ChartColumn,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Inbox,
  Monitor,
  PencilLine,
  Plus,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";
import type { MobileTask } from "@/lib/mobile-tasks";

export type StartTile = { href: string; title: string; text: string; Icon: LucideIcon; badge?: string };

type Big = {
  key: string;
  href: string;
  title: string;
  text: string;
  Icon: LucideIcon;
  badge?: string;
  tone: "primary" | "plain";
  dataTour?: string;
};

const toBig = (task: MobileTask): Big => {
  if (task.kind === "tap" && task.mode === "tekst") {
    return { key: task.href, href: task.href, title: t("Change a text or price"), text: t("Tap it on your website and type"), Icon: PencilLine, tone: "primary" };
  }
  if (task.kind === "tap") {
    return { key: task.href, href: task.href, title: t("Replace a photo"), text: t("Tap a photo and take or pick a new one"), Icon: Camera, tone: "primary" };
  }
  if (task.kind === "new") {
    return {
      key: task.href,
      href: task.href,
      title: task.title || t("Post something new"),
      text: task.title ? task.label : t("In {label}", { label: task.label }),
      Icon: Plus,
      tone: "primary",
    };
  }
  return { key: task.href, href: task.href, title: task.title || task.label, text: t("Open and change"), Icon: PencilLine, tone: "primary" };
};

export function MobileStart({
  greeting,
  tasks,
  messages,
  visitors,
  siteUrl,
  allTiles,
}: {
  greeting: string;
  tasks: MobileTask[];
  messages: { href: string; unread: number } | null;
  visitors: { href: string; count: number | null } | null;
  siteUrl: string | null;
  allTiles: StartTile[];
}) {
  const [showAll, setShowAll] = useState(false);

  const big: Big[] = tasks.map(toBig);
  if (messages) {
    big.push({
      key: messages.href,
      href: messages.href,
      title: t("Read messages"),
      text: messages.unread > 0
        ? (messages.unread === 1 ? t("1 new message is waiting") : t("{count} new messages are waiting", { count: messages.unread }))
        : t("No new messages"),
      Icon: Inbox,
      badge: messages.unread > 0 ? String(messages.unread) : undefined,
      tone: messages.unread > 0 ? "primary" : "plain",
    });
  }
  if (visitors) {
    big.push({
      key: visitors.href,
      href: visitors.href,
      title: t("Visitors"),
      text: visitors.count === null
        ? t("How many people visit your website")
        : visitors.count === 1
          ? t("1 visitor in the last 7 days")
          : t("{count} visitors in the last 7 days", { count: visitors.count.toLocaleString("nl-NL") }),
      Icon: ChartColumn,
      tone: "plain",
    });
  }
  // Tiles already offered as a big button don't need repeating below.
  const bigHrefs = new Set(big.map((item) => item.href.split("?")[0].replace(/\/new$/, "")));
  const rest = allTiles.filter((tile) => !bigHrefs.has(tile.href));

  return (
    <div className="space-y-6 pb-4">
      <div className="space-y-1">
        <p className="text-muted-foreground">{greeting}</p>
        <h2 className="text-[1.75rem] leading-tight font-semibold tracking-tight">{t("What do you want to do?")}</h2>
      </div>

      <div data-tour="tegels" className="grid gap-3">
        {big.map(({ key, href, title, text, Icon, badge, tone }) => (
          <Link
            key={key}
            href={href}
            className={cn(
              "flex min-h-[5.5rem] items-center gap-4 rounded-2xl border p-4 shadow-xs transition active:scale-[0.98]",
              "bg-card",
            )}
          >
            <span
              className={cn(
                "relative flex size-14 shrink-0 items-center justify-center rounded-xl",
                tone === "primary" ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground",
              )}
            >
              <Icon className="size-7" strokeWidth={2.2} />
              {badge && (
                <span className="absolute -top-1.5 -right-1.5 flex min-w-6 h-6 items-center justify-center rounded-full bg-[var(--brand-dot)] px-1.5 text-xs font-bold text-black ring-2 ring-background">
                  {badge}
                </span>
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-lg font-semibold leading-snug">{title}</span>
              <span className="block text-[0.95rem] leading-snug text-muted-foreground">{text}</span>
            </span>
            <ChevronRight className="size-6 shrink-0 text-muted-foreground" />
          </Link>
        ))}
      </div>

      {siteUrl && (
        <a
          href={siteUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="flex h-14 items-center justify-center gap-2 rounded-2xl border bg-background text-base font-medium active:bg-accent"
        >
          {t("View your website")} <ExternalLink className="size-5" />
        </a>
      )}

      {rest.length > 0 && (
        <div className="rounded-2xl border">
          <button
            type="button"
            onClick={() => setShowAll((value) => !value)}
            aria-expanded={showAll}
            className="flex w-full items-center gap-3 px-4 py-4 text-left"
          >
            <span className="flex-1">
              <span className="block text-base font-semibold">{t("Everything else")}</span>
              <span className="block text-sm text-muted-foreground">{t("Bigger changes are easiest on a computer.")}</span>
            </span>
            <ChevronDown className={cn("size-5 text-muted-foreground transition", showAll && "rotate-180")} />
          </button>
          {showAll && (
            <ul className="border-t">
              {rest.map(({ href, title, Icon, badge }) => (
                <li key={href} className="border-b last:border-b-0">
                  <Link href={href} className="flex min-h-14 items-center gap-3 px-4 py-3 active:bg-accent">
                    <Icon className="size-5 shrink-0 text-muted-foreground" />
                    <span className="flex-1 text-base">{title}</span>
                    {badge && <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">{badge}</span>}
                    <ChevronRight className="size-5 text-muted-foreground" />
                  </Link>
                </li>
              ))}
              <li className="flex items-center gap-2 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                <Monitor className="size-4 shrink-0" />
                {t("On a computer you see everything side by side.")}
              </li>
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
