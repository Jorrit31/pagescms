"use client";

import { useCallback, useEffect, useState } from "react";
import { FilePen, FilePlus, ImagePlus, PenLine, Rocket, Settings, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireApiSuccess } from "@/lib/api-client";
import { t } from "@/lib/i18n";
import {
  activityDayHeading,
  activityDayKey,
  describeActivity,
  formatActivityTime,
  personName,
  type ActivityEntry,
} from "@/lib/activity-shared";
import { cn } from "@/lib/utils";

/** Webstudio: the "Logboek" page. Who changed what, when, in plain words. */

const actionIcon: Record<string, React.ComponentType<{ className?: string }>> = {
  create: FilePlus,
  update: PenLine,
  delete: Trash2,
  rename: FilePen,
  upload: ImagePlus,
  publish: Rocket,
  settings: Settings,
};

const actionTone: Record<string, string> = {
  delete: "text-destructive",
  publish: "text-primary",
};

export function ActivityLog({ owner, repo, branch }: { owner: string; repo: string; branch: string }) {
  const [entries, setEntries] = useState<ActivityEntry[] | null>(null);
  const [more, setMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (before?: number) => {
    const query = before ? `?before=${before}` : "";
    const response = await fetch(`/api/${owner}/${repo}/${encodeURIComponent(branch)}/activity${query}`, { cache: "no-store" });
    const payload = await requireApiSuccess<any>(response, "Failed to load the log");
    return payload.data as { entries: ActivityEntry[]; more: boolean };
  }, [owner, repo, branch]);

  useEffect(() => {
    let cancelled = false;
    load()
      .then((data) => {
        if (cancelled) return;
        setEntries(data.entries);
        setMore(data.more);
      })
      .catch((reason) => { if (!cancelled) setError(reason?.message || t("Failed to load the log")); });
    return () => { cancelled = true; };
  }, [load]);

  const loadMore = async () => {
    if (!entries?.length) return;
    setLoadingMore(true);
    try {
      const data = await load(entries[entries.length - 1].id);
      setEntries([...entries, ...data.entries]);
      setMore(data.more);
    } catch (reason: any) {
      setError(reason?.message || t("Failed to load the log"));
    } finally {
      setLoadingMore(false);
    }
  };

  if (error) {
    return <p className="text-sm text-muted-foreground p-4">{error}</p>;
  }

  if (!entries) {
    return (
      <div className="space-y-3 p-4">
        {Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-12 w-full" />)}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 m-4 text-center text-sm text-muted-foreground">
        {t("Nothing has been changed yet. Every change made here shows up in this list.")}
      </div>
    );
  }

  const now = new Date();
  const groups: { key: string; heading: string; items: ActivityEntry[] }[] = [];
  for (const entry of entries) {
    const key = activityDayKey(entry.createdAt);
    const last = groups[groups.length - 1];
    if (last?.key === key) last.items.push(entry);
    else groups.push({ key, heading: activityDayHeading(entry.createdAt, now), items: [entry] });
  }

  return (
    <div className="space-y-6 p-4">
      <p className="text-sm text-muted-foreground">
        {t("Everything that was changed on the website, newest first.")}
      </p>
      {groups.map((group) => (
        <section key={group.key}>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground first-letter:uppercase">{group.heading}</h2>
          <ol className="divide-y rounded-lg border bg-card">
            {group.items.map((entry) => {
              const Icon = actionIcon[entry.action] ?? PenLine;
              return (
                <li key={entry.id} className="flex items-start gap-3 p-3">
                  <span
                    className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted", actionTone[entry.action])}
                    title={personName(entry)}
                  >
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm leading-snug break-words">{describeActivity(entry)}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                      {formatActivityTime(entry.createdAt, now)}
                      {entry.userEmail && <span className="hidden sm:inline"> · {entry.userEmail}</span>}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
      {more && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? t("Loading...") : t("Show more")}
          </Button>
        </div>
      )}
    </div>
  );
}
