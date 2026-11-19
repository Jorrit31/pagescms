"use client";

/**
 * "Are you sure?" before "Put online": every change that goes to the website,
 * page by page and field by field (now struck through, then what it becomes).
 */

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
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
import { ChangeTable } from "@/components/entry/edit-history-ui";
import { diffContent, type ContentChange } from "@/lib/content-diff";
import { getPrimaryField, initializeState, safeAccess, sanitizeObject } from "@/lib/schema";
import { t } from "@/lib/i18n";
import type { Field } from "@/types/field";

type Config = { owner: string; repo: string; branch: string; object?: Record<string, any> };

const findSchema = (config: Config, file: string) => {
  const content: any[] = Array.isArray(config.object?.content) ? config.object!.content : [];
  const exact = content.find((item) => item?.type === "file" && item.path === file);
  if (exact) return exact;
  return content.find((item) => item?.type === "collection" && typeof item.path === "string" && file.startsWith(`${item.path.replace(/\/$/, "")}/`));
};

const isMedia = (config: Config, file: string) => {
  const media: any[] = Array.isArray(config.object?.media) ? config.object!.media : [];
  return media.some((item) => typeof item?.input === "string" && file.startsWith(`${item.input.replace(/\/$/, "")}/`));
};

const loadEntry = async (config: Config, branch: string, file: string, name: string) => {
  const response = await fetch(`/api/${config.owner}/${config.repo}/${encodeURIComponent(branch)}/entries/${encodeURIComponent(file)}?name=${encodeURIComponent(name)}`);
  if (response.status === 404) return null;
  const json = await response.json().catch(() => null);
  if (!response.ok) throw new Error(json?.message || "Failed");
  return json?.data?.contentObject as Record<string, unknown> | undefined;
};

const toForm = (fields: Field[], schema: any, content: unknown) =>
  initializeState(fields, sanitizeObject(schema?.list === true ? { listWrapper: content } : content ?? {})) as Record<string, unknown>;

/** All changes between the live website and the concept, readable. */
export const collectPublishChanges = async (config: Config, defaultBranch: string, files: string[]): Promise<ContentChange[]> => {
  const all: ContentChange[] = [];
  const photos: string[] = [];
  await Promise.all(files.map(async (file) => {
    const schema = findSchema(config, file);
    if (!schema || !Array.isArray(schema.fields) || schema.fields.length === 0) {
      if (isMedia(config, file)) photos.push(file.split("/").pop() || file);
      return;
    }
    const fields: Field[] = schema.list === true
      ? [{ name: "listWrapper", label: false, type: "object", list: true, fields: schema.fields }]
      : schema.fields;
    const [live, concept] = await Promise.all([
      loadEntry(config, defaultBranch, file, schema.name).catch(() => undefined),
      loadEntry(config, config.branch, file, schema.name).catch(() => undefined),
    ]);
    if (live === undefined || concept === undefined) {
      all.push({ path: file, label: schema.label || schema.name, beforeValue: null, afterValue: null, before: "", after: t("Changed") });
      return;
    }
    let page = schema.label || schema.name;
    if (schema.type === "collection") {
      const primary = getPrimaryField(schema);
      const value: unknown = primary ? safeAccess((concept ?? live ?? {}) as Record<string, unknown>, primary) : undefined;
      const title = typeof value === "string" && value.trim() ? (value as string).trim() : file.split("/").pop();
      page = `${page} · ${title}`;
    }
    if (concept === null) {
      all.push({ path: file, label: page, beforeValue: null, afterValue: null, before: page, after: t("Removed") });
      return;
    }
    const changes = diffContent(fields, live ? toForm(fields, schema, live) : {}, toForm(fields, schema, concept));
    for (const change of changes) all.push({ ...change, path: `${file}:${change.path}`, label: `${page} · ${change.label}` });
  }));
  all.sort((a, b) => a.label.localeCompare(b.label));
  for (const photo of photos) all.push({ path: `photo:${photo}`, label: t("Photo"), beforeValue: null, afterValue: null, before: "", after: photo });
  return all;
};

export function PublishConfirmDialog({
  open,
  config,
  defaultBranch,
  files,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  config: Config;
  defaultBranch: string;
  files: string[];
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [changes, setChanges] = useState<ContentChange[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setChanges(null);
    setFailed(false);
    collectPublishChanges(config, defaultBranch, files)
      .then((list) => { if (!cancelled) setChanges(list); })
      .catch(() => { if (!cancelled) { setFailed(true); setChanges([]); } });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const count = changes?.length ?? 0;
  return (
    <AlertDialog open={open} onOpenChange={(next) => { if (!next) onCancel(); }}>
      <AlertDialogContent className="max-h-[90svh] gap-5 overflow-y-auto sm:max-w-2xl max-sm:top-auto max-sm:bottom-0 max-sm:max-w-full max-sm:translate-y-0 max-sm:rounded-b-none max-sm:rounded-t-2xl max-sm:border-x-0 max-sm:border-b-0 max-sm:pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <AlertDialogHeader>
          <AlertDialogTitle>{t("Are you sure?")}</AlertDialogTitle>
          <AlertDialogDescription>
            {changes === null
              ? t("Checking what changed")
              : failed || count === 0
                ? t("Your changes will be on your website within a few minutes.")
                : count === 1
                  ? t("This change will be on your website within a few minutes.")
                  : t("These {count} changes will be on your website within a few minutes.", { count })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {changes === null ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />{t("Loading")}</div>
        ) : count > 0 ? (
          <ChangeTable changes={changes} />
        ) : null}
        <AlertDialogFooter className="max-sm:gap-2">
          <AlertDialogCancel className="max-sm:h-12">{t("Cancel")}</AlertDialogCancel>
          <AlertDialogAction className="max-sm:h-12" disabled={changes === null} onClick={onConfirm}>
            {t("Yes, put it live")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
