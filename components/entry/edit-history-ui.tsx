"use client";

/**
 * The parts of the edit screen around changes:
 * - undo / redo buttons in the top bar,
 * - "You still had unsaved changes, put them back?" after a crash,
 * - "Are you sure?" with every change before it goes live,
 * - the history of earlier versions, where each change can be put back.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { History, Loader2, Redo2, RotateCcw, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { t, timeAgo, uiLanguage } from "@/lib/i18n";
import { diffContent, type ContentChange } from "@/lib/content-diff";
import type { Field } from "@/types/field";
import type { EntryHistoryItem } from "@/types/api";
import type { Draft } from "./use-edit-history";

const isMac = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

export function UndoRedoButtons({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}) {
  const key = isMac() ? "⌘" : "Ctrl+";
  return (
    <div className="flex shrink-0 items-center">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="max-sm:size-10"
            disabled={!canUndo}
            onClick={onUndo}
            aria-label={t("Undo")}
          >
            <Undo2 className="size-[18px]" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t("Undo")} <span className="opacity-60">{key}Z</span></TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="max-sm:size-10"
            disabled={!canRedo}
            onClick={onRedo}
            aria-label={t("Redo")}
          >
            <Redo2 className="size-[18px]" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t("Redo")} <span className="opacity-60">{key}{isMac() ? "⇧Z" : "Y"}</span></TooltipContent>
      </Tooltip>
    </div>
  );
}

export function DraftRestoreDialog({
  draft,
  onRestore,
  onDiscard,
}: {
  draft: Draft | null;
  onRestore: () => void;
  onDiscard: () => void;
}) {
  return (
    <AlertDialog open={draft !== null}>
      <AlertDialogContent className="max-sm:top-auto max-sm:bottom-0 max-sm:max-w-full max-sm:translate-y-0 max-sm:rounded-b-none max-sm:rounded-t-2xl max-sm:border-x-0 max-sm:border-b-0 max-sm:pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <AlertDialogHeader>
          <AlertDialogTitle>{t("You still had unsaved changes. Put them back?")}</AlertDialogTitle>
          <AlertDialogDescription>
            {draft
              ? t("They are from {time} and were only kept on this device.", { time: timeAgo(new Date(draft.savedAt)) })
              : null}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="max-sm:gap-2">
          <AlertDialogCancel className="max-sm:h-12" onClick={onDiscard}>{t("Throw away")}</AlertDialogCancel>
          <AlertDialogAction className="max-sm:h-12" onClick={onRestore}>{t("Put back")}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Old (struck through) and new value of one change. */
function ChangeValues({ change, stacked }: { change: ContentChange; stacked?: boolean }) {
  const empty = <span className="italic text-muted-foreground">{t("(empty)")}</span>;
  return (
    <div className={cn("min-w-0 gap-x-2 gap-y-0.5 text-sm", stacked ? "flex flex-col" : "flex flex-wrap items-baseline")}>
      <span className="break-words text-muted-foreground line-through decoration-muted-foreground/70">
        {change.before || empty}
      </span>
      <span aria-hidden className="text-muted-foreground">→</span>
      <span className="break-words font-medium">{change.after || empty}</span>
    </div>
  );
}

export function ConfirmLiveDialog({
  changes,
  isLive,
  onCancel,
  onConfirm,
}: {
  changes: ContentChange[] | null;
  /** Saving puts it on the website right away (no concept version). */
  isLive: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const count = changes?.length ?? 0;
  return (
    <AlertDialog open={changes !== null} onOpenChange={(open) => { if (!open) onCancel(); }}>
      <AlertDialogContent className="max-h-[90svh] gap-5 overflow-y-auto sm:max-w-2xl max-sm:top-auto max-sm:bottom-0 max-sm:max-w-full max-sm:translate-y-0 max-sm:rounded-b-none max-sm:rounded-t-2xl max-sm:border-x-0 max-sm:border-b-0 max-sm:pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <AlertDialogHeader>
          <AlertDialogTitle>{t("Are you sure?")}</AlertDialogTitle>
          <AlertDialogDescription>
            {isLive
              ? count === 1
                ? t("This change will be on your website within a few minutes.")
                : t("These {count} changes will be on your website within a few minutes.", { count })
              : count === 1
                ? t("This change is saved. Visitors see it once you put it online.")
                : t("These {count} changes are saved. Visitors see them once you put them online.", { count })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <ChangeTable changes={changes ?? []} />
        <AlertDialogFooter className="max-sm:gap-2">
          <AlertDialogCancel className="max-sm:h-12">{t("Cancel")}</AlertDialogCancel>
          <AlertDialogAction className="max-sm:h-12" onClick={onConfirm}>
            {isLive ? t("Yes, put it live") : t("Yes, save")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function ChangeTable({ changes }: { changes: ContentChange[] }) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="hidden grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-4 border-b bg-muted/40 px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground sm:grid">
        <div>{t("Part")}</div>
        <div>{t("Now")}</div>
        <div>{t("Becomes")}</div>
      </div>
      <div className="max-h-[45svh] divide-y overflow-y-auto">
        {changes.map((change) => {
          const empty = <span className="italic text-muted-foreground">{t("(empty)")}</span>;
          return (
            <div
              key={change.path}
              className="grid gap-1 px-4 py-3 text-sm sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)] sm:gap-4"
            >
              <div className="break-words font-medium">{change.label}</div>
              <div className="break-words text-muted-foreground">
                <span className="mr-1 text-xs sm:hidden">{t("Now")}:</span>
                <span className="line-through decoration-muted-foreground/70">{change.before || empty}</span>
              </div>
              <div className="break-words">
                <span className="mr-1 text-xs text-muted-foreground sm:hidden">{t("Becomes")}:</span>
                {change.after || empty}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type Version = {
  item: EntryHistoryItem;
  changes: ContentChange[] | null;
  error?: boolean;
  /** The page was made in this version: nothing to compare with. */
  first?: boolean;
};

const MAX_VERSIONS = 8;

const formatDate = (iso?: string | null) => {
  if (!iso) return t("Unknown date");
  const date = new Date(iso);
  return date.toLocaleString(uiLanguage === "nl" ? "nl-NL" : undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/**
 * Earlier versions of this page, newest first, each with what changed in it.
 * Tick the changes to undo and click "Put back": they go back into the form,
 * and are only on the website after saving (with the "Are you sure?" check).
 */
export function HistorySheet({
  open,
  onOpenChange,
  history,
  fields,
  loadVersion,
  getCurrentValues,
  onPutBack,
  isLiveBranch,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  history: EntryHistoryItem[] | undefined;
  fields: Field[];
  /** The page at a commit, in the shape of the form. */
  loadVersion: (sha: string) => Promise<Record<string, unknown>>;
  getCurrentValues: () => Record<string, unknown> | null;
  onPutBack: (changes: ContentChange[]) => void;
  isLiveBranch: boolean;
}) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [selected, setSelected] = useState<Record<string, Set<string>>>({});
  const [current, setCurrent] = useState<Record<string, unknown> | null>(null);
  const items = useMemo(() => (history ?? []).slice(0, MAX_VERSIONS), [history]);
  const historyKey = items.map((item) => item.sha).join(",");

  useEffect(() => {
    if (!open) return;
    setCurrent(getCurrentValues());
    setSelected({});
    let cancelled = false;
    setVersions(items.map((item) => ({ item, changes: null })));
    // The oldest one shown needs the version before it to compare with.
    const all = (history ?? []).slice(0, MAX_VERSIONS + 1);
    const cache = new Map<string, Promise<Record<string, unknown>>>();
    const load = (sha: string) => {
      if (!cache.has(sha)) cache.set(sha, loadVersion(sha));
      return cache.get(sha)!;
    };
    items.forEach((item, index) => {
      const parent = all[index + 1];
      if (!parent) {
        setVersions((list) => list.map((version) => version.item.sha === item.sha ? { ...version, changes: [], first: true } : version));
        return;
      }
      Promise.all([load(parent.sha), load(item.sha)])
        .then(([before, after]) => {
          if (cancelled) return;
          const changes = diffContent(fields, before, after);
          setVersions((list) => list.map((version) => version.item.sha === item.sha ? { ...version, changes } : version));
        })
        .catch(() => {
          if (cancelled) return;
          setVersions((list) => list.map((version) => version.item.sha === item.sha ? { ...version, changes: [], error: true } : version));
        });
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, historyKey]);

  const toggle = useCallback((sha: string, path: string) => {
    setSelected((all) => {
      const set = new Set(all[sha] ?? []);
      if (set.has(path)) set.delete(path);
      else set.add(path);
      return { ...all, [sha]: set };
    });
  }, []);

  const valueAt = (values: Record<string, unknown> | null, path: string) =>
    path.split(".").reduce<unknown>((value, key) => (value && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined), values);
  const changedLater = (change: ContentChange) => {
    if (!current) return false;
    try {
      return JSON.stringify(valueAt(current, change.path) ?? null) !== JSON.stringify(change.afterValue ?? null);
    } catch {
      return false;
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto sm:max-w-xl">
        <SheetHeader className="border-b">
          <SheetTitle className="flex items-center gap-2"><History className="size-4" />{t("History")}</SheetTitle>
          <SheetDescription>
            {t("Tick what you want to undo and click \"Put back\". It is on your website once you save.")}
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-6 p-4 pb-[calc(2rem+env(safe-area-inset-bottom))]">
          {items.length === 0 && (
            <p className="text-sm text-muted-foreground">{t("No earlier versions yet.")}</p>
          )}
          {versions.map((version, index) => {
            const sha = version.item.sha;
            const picked = selected[sha] ?? new Set<string>();
            const author = version.item.commit.author?.name;
            const showAuthor = author && !/\[bot\]|github/i.test(author);
            return (
              <section key={sha} className="grid gap-3">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                  {index === 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                      <span className="size-1.5 rounded-full bg-current" />
                      {isLiveBranch ? t("Live now") : t("Newest")}
                    </span>
                  )}
                  <span className="font-medium">{formatDate(version.item.commit.author?.date)}</span>
                  {showAuthor && <span className="text-muted-foreground">· {author}</span>}
                </div>
                {version.changes === null ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />{t("Loading")}
                  </div>
                ) : version.error ? (
                  <p className="text-sm text-muted-foreground">{t("Could not load this version.")}</p>
                ) : version.first ? (
                  <p className="text-sm text-muted-foreground">{t("The page was made in this version.")}</p>
                ) : version.changes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("No visible changes.")}</p>
                ) : (
                  <>
                    <ul className="grid gap-1">
                      {version.changes.map((change) => {
                        const later = changedLater(change);
                        return (
                          <li key={change.path}>
                            <label className="flex cursor-pointer items-start gap-3 rounded-md px-2 py-2 hover:bg-muted/60">
                              <input
                                type="checkbox"
                                className="mt-0.5 size-5 shrink-0 accent-primary sm:size-4"
                                checked={picked.has(change.path)}
                                onChange={() => toggle(sha, change.path)}
                              />
                              <div className="grid min-w-0 flex-1 gap-0.5">
                                <div className="flex flex-wrap items-center gap-2 text-sm">
                                  <span className="text-muted-foreground">{change.label}</span>
                                  {later && (
                                    <span className="rounded border px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                      {t("Changed again later")}
                                    </span>
                                  )}
                                </div>
                                <ChangeValues change={change} />
                              </div>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                    <div className="flex items-center justify-between gap-3 px-2">
                      <span className="text-xs text-muted-foreground">
                        {picked.size === 0 ? t("Tick what you want to put back") : t("{count} chosen", { count: picked.size })}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="max-sm:h-10"
                        disabled={picked.size === 0}
                        onClick={() => {
                          onPutBack(version.changes!.filter((change) => picked.has(change.path)));
                          onOpenChange(false);
                        }}
                      >
                        <RotateCcw className="size-3.5" />
                        {t("Put back")}
                      </Button>
                    </div>
                  </>
                )}
              </section>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
