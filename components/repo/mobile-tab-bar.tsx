"use client";

/**
 * Webstudio: on a phone, a bar at the bottom with the everyday places: Start,
 * Messages, Visitors and the website itself. Like the apps people know. It
 * is not shown while editing; there the bar with Edit / Preview / Save sits
 * in that spot.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChartColumn, ExternalLink, House, Inbox } from "lucide-react";
import { useConfig } from "@/contexts/config-context";
import { useMessagesSummary, useStatsAllowed } from "@/components/repo/repo-sidebar";
import { getSiteUrl } from "@/lib/deploy-watch";
import { siteDeclaresForms } from "@/lib/forms-shared";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";

// Screens that get the bar. Editing screens (edit, new, file) have their own.
const WITH_BAR = /\/(start|berichten|bezoekers|logboek|google)\/?$|\/collection\/[^/]+\/?$|\/media\//;

export function MobileTabBar() {
  const { config } = useConfig();
  const pathname = usePathname();
  const messages = useMessagesSummary(config?.owner, config?.repo, config?.branch);
  const statsAllowed = useStatsAllowed(config?.owner, config?.repo, config?.branch);

  if (!config || !WITH_BAR.test(pathname)) return null;
  const object = config.object as any;
  const base = `/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}`;
  const showMessages = Boolean(messages && (siteDeclaresForms(object) || messages.total > 0));
  const siteUrl = getSiteUrl(object);

  const tabs = [
    { href: `${base}/start`, label: t("Start"), Icon: House, badge: 0 },
    ...(showMessages ? [{ href: `${base}/berichten`, label: t("Messages"), Icon: Inbox, badge: messages?.unread ?? 0 }] : []),
    ...(statsAllowed ? [{ href: `${base}/bezoekers`, label: t("Visitors"), Icon: ChartColumn, badge: 0 }] : []),
  ];
  if (tabs.length < 2 && !siteUrl) return null;

  const item = "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 py-2 text-xs font-medium";

  return (
    <>
      <div aria-hidden className="h-20 md:hidden" />
      <nav
        aria-label={t("Menu")}
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-background/85 md:hidden"
      >
        <div className="mx-auto flex max-w-screen-sm items-stretch px-2">
          {tabs.map(({ href, label, Icon, badge }) => {
            // Owner/repo can differ in capitals between the address and the config.
            const here = pathname.toLowerCase();
            const target = href.toLowerCase();
            const active = here === target || here.startsWith(`${target}/`);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(item, active ? "text-primary" : "text-muted-foreground")}
              >
                <span className={cn("relative flex h-8 w-14 items-center justify-center rounded-full", active && "bg-primary/10")}>
                  <Icon className="size-6" strokeWidth={active ? 2.4 : 2} />
                  {badge > 0 && (
                    <span className="absolute -top-1 right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[0.7rem] font-bold text-primary-foreground ring-2 ring-background">
                      {badge}
                    </span>
                  )}
                </span>
                <span className="truncate">{label}</span>
              </Link>
            );
          })}
          {siteUrl && (
            <a href={siteUrl} target="_blank" rel="noreferrer noopener" className={cn(item, "text-muted-foreground")}>
              <span className="flex h-8 w-14 items-center justify-center">
                <ExternalLink className="size-6" />
              </span>
              <span className="truncate">{t("Website")}</span>
            </a>
          )}
        </div>
      </nav>
    </>
  );
}
