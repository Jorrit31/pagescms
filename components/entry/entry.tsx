"use client";

import { Fragment, useEffect, useState, useMemo, useCallback, useRef } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useConfig } from "@/contexts/config-context";
import { parseAndValidateConfig } from "@/lib/config";
import { resolveContentOperations } from "@/lib/operations";
import { requireApiSuccess } from "@/lib/api-client";
import { getSchemaActions } from "@/lib/actions";
import {
  deepMap,
  generateFilename,
  getPrimaryField,
  getSchemaByName,
  initializeState,
  safeAccess,
  sanitizeObject,
} from "@/lib/schema";
import {
  getFileExtension,
  getFileName,
  getParentPath,
  getRelativePath,
  joinPathSegments,
  normalizePath
} from "@/lib/utils/file";
import type { ApiSuccess, EntryData, EntryHistoryItem } from "@/types/api";
import { EntryForm, type EntryFormApi } from "./entry-form";
import { EntryPreview, getPreviewUrl, type PreviewMedia } from "./entry-preview";
import { selectInForm, type PreviewSelection } from "@/lib/preview-select";
import {
  buildEditMap,
  findFieldAtPath,
  newListItem,
  parsePreviewBlockAction,
  parsePreviewEdit,
  patchRichLeaf,
} from "@/lib/preview-edit";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Field } from "@/types/field";
import { writeFns } from "@/fields/registry";
import { useEditHistory } from "./use-edit-history";
import { ConfirmLiveDialog, DraftRestoreDialog, HistorySheet, UndoRedoButtons } from "./edit-history-ui";
import { diffContent, type ContentChange } from "@/lib/content-diff";
import { MobileEditBar } from "./mobile-edit-bar";
import { EmptyCreate } from "@/components/empty-create";
import { FileOptions } from "@/components/file/file-options";
import { RepoActionButtons } from "@/components/repo/repo-action-buttons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { useRepoHeader } from "@/components/repo/repo-header-context";
import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner";
import { EllipsisVertical, History, Lock, LockOpen, Save } from "lucide-react";
import useSWR, { useSWRConfig } from "swr";
import { t, uiLanguage } from "@/lib/i18n";
import { useRepo } from "@/contexts/repo-context";
import { isConceptBranch } from "@/lib/concept";
import { getSiteUrl, watchDeploy } from "@/lib/deploy-watch";
import { announceSaved } from "@/components/repo/publish-bar";

type LintView = {
  state: {
    doc: {
      toString(): string;
    };
  };
};

type GroupTrailItem = {
  name: string;
  label?: string | null;
};

export function Entry({
  name = "",
  path: initialPath,
  parent,
  title,
  headerMeta,
  onSave,
}: {
  name?: string;
  path?: string;
  parent?: string;
  title?: string;
  headerMeta?: ReactNode;
  onSave?: (data: Record<string, unknown>) => void;
}) {
  const [path, setPath] = useState<string | undefined>(initialPath);
  const [entry, setEntry] = useState<EntryData | null>();
  const [sha, setSha] = useState<string | undefined>();
  const [displayTitle, setDisplayTitle] = useState<string>(() => {
    if (title) return title;
    if (initialPath && initialPath !== ".pages.yml") {
      return t("Editing \"{name}\"", { name: getFileName(normalizePath(initialPath)) });
    }
    return t("Edit");
  });
  const [isLoading, setIsLoading] = useState(path ? true : false);
  const [isSaving, setIsSaving] = useState(false);
  const [isFormDirty, setIsFormDirty] = useState(false);
  const [hasRegisteredChanges, setHasRegisteredChanges] = useState(false);
  const [error, setError] = useState<string | undefined | null>(null);
  const changeVersionRef = useRef(0);
  const { mutate } = useSWRConfig();

  const router = useRouter();
  
  const { config } = useConfig();
  if (!config) throw new Error(`Configuration not found.`);
  const { defaultBranch } = useRepo();
  
  const schema = useMemo(() => {
    if (!name) return;
    return getSchemaByName(config?.object, name)
  }, [config, name]);
  const schemaType = schema?.type;
  const operations = useMemo(
    () =>
      resolveContentOperations({
        schema,
        scope:
          path === ".pages.yml" || initialPath === ".pages.yml"
            ? "settings"
            : undefined,
      }),
    [initialPath, path, schema],
  );
  const canCreate = operations.create;
  const canRename = operations.rename;
  const canDelete = operations.delete;
  const isFileEditorMode = !schema?.fields || schema.fields.length === 0;
  const filenameFieldMode = useMemo(() => {
    if (!schema || schema.type !== "collection") return "hidden";
    if (schema.filenameField === true) return "enabled";
    if (schema.filenameField === "create") return "create";
    if (schema.filenameField === false) return "hidden";
    return isFileEditorMode ? "enabled" : "hidden";
  }, [isFileEditorMode, schema]);
  const showFilenameField = useMemo(() => {
    if (schemaType !== "collection") return false;
    if (filenameFieldMode === "enabled") return true;
    if (filenameFieldMode === "create") return !path;
    return false;
  }, [filenameFieldMode, path, schemaType]);
  const [filenameValue, setFilenameValue] = useState("");
  const [isFilenameUnlocked, setIsFilenameUnlocked] = useState(false);
  
  const entryFields = useMemo(() => {
    return !schema?.fields || schema.fields.length === 0
      ? [{
          name: "body",
          type: "code",
          label: showFilenameField ? t("Content") : false,
          options: {
            format: schema?.extension || (entry?.name && getFileExtension(entry.name)) || "markdown",
            lintFn: path === ".pages.yml"
              ? (view: LintView) => {
                  const {parseErrors, validationErrors} = parseAndValidateConfig(view.state.doc.toString());
                  return [...parseErrors, ...validationErrors];
                }
              : undefined
          }
        }]
      : schema?.list === true
        ? [{
            name: "listWrapper",
            label: false,
            type: "object",
            list: true,
            fields: schema.fields
          }]
        : schema.fields;
  }, [schema, entry, path, showFilenameField]);

  const entryContentObject = useMemo(() => {
    return path
      ? schema?.list === true
        ? { listWrapper: entry?.contentObject }
        : entry?.contentObject
      : schema?.list === true
        ? { listWrapper: [] }
        : {};
  }, [schema, entry, path]);

  // Live preview
  const previewUrl = useMemo(() => {
    if (!schema || isFileEditorMode || path === ".pages.yml") return null;
    return getPreviewUrl(schema.preview);
  }, [isFileEditorMode, path, schema]);
  const [previewValues, setPreviewValues] = useState<Record<string, unknown> | null>(null);
  const [isPreviewOpenMobile, setIsPreviewOpenMobile] = useState(false);
  // On phones the preview fills the screen right under the top bar. Above
  // that bar there can be the "Put online" notice, so measure where the bar
  // really ends instead of assuming it sits at the very top.
  const [previewTop, setPreviewTop] = useState<number | null>(null);
  useEffect(() => {
    if (!isPreviewOpenMobile) return;
    const measure = () => {
      const header = document.getElementById("repo-header");
      setPreviewTop(header ? Math.max(0, Math.round(header.getBoundingClientRect().bottom)) : null);
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, { passive: true });
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure);
    };
  }, [isPreviewOpenMobile]);
  // Undo / redo, and a copy of unsaved work on this device (after a crash).
  const formApiRef = useRef<EntryFormApi | null>(null);
  const editHistory = useEditHistory({
    formApiRef,
    resetKey: entryContentObject,
    storageKey: `${config.owner}/${config.repo}/${config.branch}/${name}/${path ?? "new"}`,
    sha,
    enabled: !isFileEditorMode && path !== ".pages.yml",
  });
  const { onValues: onHistoryValues, canUndo, canRedo, undo, redo } = editHistory;
  const handleValuesChange = useCallback((values: Record<string, unknown>) => {
    if (previewUrl) setPreviewValues(values);
    onHistoryValues(values);
  }, [onHistoryValues, previewUrl]);
  // Click-to-edit: something was clicked in the preview.
  const handlePreviewSelect = useCallback(async (selection: PreviewSelection) => {
    const currentEntry = schema?.name ?? name;
    if (selection.entry && selection.entry !== currentEntry) {
      const content = Array.isArray(config.object?.content) ? config.object.content : [];
      const other = content.find((item: { name?: string }) => item?.name === selection.entry);
      if (!other) return;
      toast.info(t("You change this under \"{label}\".", { label: other.label || other.name }), {
        action: {
          label: t("Go there"),
          onClick: () =>
            router.push(
              `/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/${other.type}/${encodeURIComponent(other.name)}`,
            ),
        },
      });
      return;
    }
    // Typing straight in the preview: on a wide screen the field beside it
    // lights up too (without taking the cursor away). On a phone or tablet the
    // form is hidden behind the preview, so nothing happens.
    if (selection.inline) {
      if (!isWideScreen()) return;
      const form = document.getElementById("entry-form");
      if (form) await selectInForm(form, selection, { focus: false });
      return;
    }
    setIsPreviewOpenMobile(false);
    await new Promise((resolve) => setTimeout(resolve, 50));
    const form = document.getElementById("entry-form");
    if (!form) return;
    const found = await selectInForm(form, selection);
    if (!found) toast.info(t("This part can't be changed here."));
  }, [config.branch, config.object, config.owner, config.repo, name, router, schema?.name]);

  // Editing straight in the preview: typing in a text, and adding, moving,
  // copying or removing blocks. The preview only says what changed; the form
  // stays the one place that holds the values, so Save works as always.
  const editMap = useMemo(() => {
    if (!previewUrl || schema?.list === true || !previewValues) return null;
    return buildEditMap(entryFields as Field[], previewValues);
  }, [entryFields, previewUrl, previewValues, schema?.list]);
  const editMapRef = useRef(editMap);
  editMapRef.current = editMap;
  const registerChange = useCallback(() => {
    changeVersionRef.current += 1;
    setHasRegisteredChanges(true);
  }, []);
  const handlePreviewEdit = useCallback((data: unknown) => {
    const api = formApiRef.current;
    const map = editMapRef.current;
    if (!api || !map) return;
    const edit = parsePreviewEdit(data, map);
    if (!edit) return;
    if ("leaf" in edit) {
      const current = api.getValues(edit.field);
      if (typeof current !== "string") return;
      const next = patchRichLeaf(current, edit.leaf, edit.texts);
      if (next === null || next === current) return;
      api.setValue(edit.field, next);
    } else {
      if (api.getValues(edit.field) === edit.value) return;
      api.setValue(edit.field, edit.value);
    }
    registerChange();
  }, [registerChange]);

  const [addBlock, setAddBlock] = useState<{ list: string; index: number; label: string; blocks: { name: string; label: string }[] } | null>(null);
  const openNewItem = useCallback(async (path: string) => {
    // Show the new block in the form, so it can be filled in. On a phone the
    // preview closes for that; an empty block has nothing to show yet.
    await new Promise((resolve) => setTimeout(resolve, 120));
    if (!isWideScreen()) {
      setIsPreviewOpenMobile(false);
      toast.success(t("Fill it in here. Then tap Preview to see it on your website."), { duration: 5000 });
    }
    await new Promise((resolve) => setTimeout(resolve, 60));
    const form = document.getElementById("entry-form");
    if (form) await selectInForm(form, { path });
  }, []);
  const insertItem = useCallback(async (list: string, index: number, blockName?: string) => {
    const api = formApiRef.current;
    if (!api) return;
    await api.syncEditors();
    const values = api.getValues(list);
    const field = findFieldAtPath(entryFields as Field[], (api.getValues() as Record<string, unknown>) || {}, list);
    if (!Array.isArray(values) || !field) return;
    const item = newListItem(field, blockName, initializeState);
    if (!item) return;
    const next = [...values];
    next.splice(index, 0, item);
    api.setValue(list, next);
    registerChange();
    void openNewItem(`${list}.${index}`);
  }, [entryFields, openNewItem, registerChange]);

  const handlePreviewBlock = useCallback(async (data: unknown) => {
    const api = formApiRef.current;
    const map = editMapRef.current;
    if (!api || !map) return;
    const action = parsePreviewBlockAction(data, map);
    if (!action) return;
    const item = map.items[action.path];
    const list = map.lists[item.list];
    if (!list) return;
    await api.syncEditors();
    const values = api.getValues(item.list);
    if (!Array.isArray(values) || values.length !== list.count) return;
    if (action.action === "add") {
      if (!list.canAdd) return;
      if (list.blocks && list.blocks.length === 0) return;
      if (list.blocks && list.blocks.length > 1) {
        setAddBlock({ list: item.list, index: item.index + 1, label: list.label, blocks: list.blocks });
      } else {
        await insertItem(item.list, item.index + 1, list.blocks?.[0]?.name);
      }
      return;
    }
    if (action.action === "copy") {
      if (!list.canAdd || item.once) return;
      const next = [...values];
      next.splice(item.index + 1, 0, JSON.parse(JSON.stringify(values[item.index])));
      api.setValue(item.list, next);
      registerChange();
      return;
    }
    if (action.action === "remove") {
      if (!list.canRemove) return;
      const before = values;
      api.setValue(item.list, values.filter((_, index) => index !== item.index));
      registerChange();
      toast.success(t("\"{label}\" removed.", { label: item.label }), {
        action: {
          label: t("Undo"),
          onClick: () => {
            formApiRef.current?.setValue(item.list, before);
            registerChange();
          },
        },
        duration: 8000,
      });
      return;
    }
    if (action.action === "move" && action.to) {
      const to = map.items[action.to].index;
      const next = [...values];
      const [moved] = next.splice(item.index, 1);
      next.splice(to, 0, moved);
      api.setValue(item.list, next);
      registerChange();
    }
  }, [insertItem, registerChange]);
  const previewData = useMemo(() => {
    if (!previewUrl || !previewValues) return null;
    try {
      const mapped = deepMap(
        JSON.parse(JSON.stringify(previewValues)),
        entryFields as any,
        (value, field) => {
          const fieldType = field.type as string;
          return writeFns[fieldType] ? writeFns[fieldType](value, field, config || {}) : value;
        },
      );
      return (schema?.list === true ? { list: mapped.listWrapper } : mapped) as Record<string, unknown>;
    } catch (error) {
      console.warn("Live preview: could not prepare the values.", error);
      return null;
    }
  }, [config, entryFields, previewUrl, previewValues, schema?.list]);
  // Images that are not on the website yet (new uploads) are loaded by the
  // preview from this editor with a signed link, which also works for private
  // repositories (raw.githubusercontent.com does not).
  const { data: previewMediaToken } = useSWR<string | null>(
    previewUrl ? `/api/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/preview-media-token` : null,
    async (apiUrl: string) => {
      const response = await fetch(apiUrl);
      const json = await response.json().catch(() => null);
      return response.ok ? (json?.data?.token ?? null) : null;
    },
    { revalidateOnFocus: false, dedupingInterval: 60 * 60 * 1000 },
  );
  const previewMedia = useMemo<PreviewMedia[]>(() => {
    const media = Array.isArray(config.object?.media) ? config.object.media : [];
    const rawBase = previewMediaToken && typeof window !== "undefined"
      ? `${window.location.origin}/api/preview-media/${previewMediaToken}/`
      : `https://raw.githubusercontent.com/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/`;
    return media.map((item: Record<string, any>) => ({
      name: item.name,
      input: item.input,
      output: item.output,
      rawBase,
    }));
  }, [config.branch, config.object, config.owner, config.repo, previewMediaToken]);

  useEffect(() => {
    if (!showFilenameField || schemaType !== "collection" || !schema) return;

    if (path) {
      setFilenameValue(getFileName(normalizePath(path)));
      setIsFilenameUnlocked(false);
      return;
    }

    const generated = generateFilename(schema.filename, schema, entryContentObject as Record<string, unknown>);
    setFilenameValue(generated || "untitled");
    setIsFilenameUnlocked(true);
  }, [entryContentObject, path, schema, schemaType, showFilenameField]);

  const entryApiUrl = useMemo(() => (
    path
      ? `/api/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/entries/${encodeURIComponent(path)}?name=${encodeURIComponent(name)}`
      : null
  ), [config.branch, config.owner, config.repo, name, path]);

  const fetchEntryByUrl = useCallback(async (apiUrl: string): Promise<EntryData> => {
    const response = await fetch(apiUrl);
    const data = await requireApiSuccess<any>(
      response,
      "Failed to fetch entry",
    );
    return data.data as EntryData;
  }, []);

  const {
    data: swrEntryData,
    error: swrEntryError,
    isLoading: swrEntryLoading,
    mutate: mutateEntry,
  } = useSWR<EntryData>(
    entryApiUrl,
    fetchEntryByUrl,
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 2000,
    },
  );

  useEffect(() => {
    if (!path) return;
    setIsLoading(swrEntryLoading);
  }, [path, swrEntryLoading]);

  useEffect(() => {
    if (!swrEntryData || !path) return;
    setEntry(swrEntryData);
    setSha(swrEntryData.sha);
    setHasRegisteredChanges(false);
    setIsLoading(false);
    setError(null);

    if (initialPath && schema && schema.type === "collection") {
      const primaryField = getPrimaryField(schema);
      const primaryValue = primaryField
        ? safeAccess(swrEntryData.contentObject ?? {}, primaryField)
        : undefined;
      const hasPrimaryValue = typeof primaryValue === "string"
        ? primaryValue !== ""
        : primaryValue != null;
      const titleValue = hasPrimaryValue
        ? String(primaryValue)
        : getFileName(normalizePath(path));
      setDisplayTitle(t("Editing \"{name}\"", { name: titleValue }));
    } else if (!title && path && path !== ".pages.yml") {
      setDisplayTitle(t("Editing \"{name}\"", { name: getFileName(normalizePath(path)) }));
    }
  }, [initialPath, path, schema, swrEntryData, title]);

  useEffect(() => {
    if (!swrEntryError) return;
    const message = swrEntryError instanceof Error ? swrEntryError.message : "Failed to fetch entry.";
    setError(message);
    setIsLoading(false);
  }, [swrEntryError]);

  const historyApiUrl = useMemo(() => (
    path
      ? `/api/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/entries/${encodeURIComponent(path)}/history?name=${encodeURIComponent(name)}`
      : null
  ), [config.branch, config.owner, config.repo, name, path]);

  const historyKey = useMemo(
    () => historyApiUrl ? [historyApiUrl, sha ?? ""] as const : null,
    [historyApiUrl, sha],
  );

  const fetchEntryHistory = useCallback(async ([apiUrl]: readonly [string, string]): Promise<EntryHistoryItem[]> => {
    const response = await fetch(apiUrl);
    const data = await requireApiSuccess<any>(
      response,
      "Failed to fetch entry's history",
    );
    return data.data as EntryHistoryItem[];
  }, []);

  const { data: historyData } = useSWR<EntryHistoryItem[]>(
    historyKey,
    fetchEntryHistory,
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 2000,
    },
  );

  const currentFilename = useMemo(
    () => path ? getFileName(normalizePath(path)) : "",
    [path],
  );
  const filenameChanged = showFilenameField
    && filenameValue.trim().length > 0
    && filenameValue.trim() !== currentFilename;

  const onSubmit = async (contentObject: Record<string, unknown>) => {
    setIsSaving(true);
    const submitStartChangeVersion = changeVersionRef.current;
    const draftKeyAtSave = `${config.owner}/${config.repo}/${config.branch}/${name}/${path ?? "new"}`;

    const savePromise = new Promise<ApiSuccess<EntryData>>(async (resolve, reject) => {
      try {
        let savePath = path;
        const trimmedFilename = filenameValue.trim();
        const normalizedFilename = normalizePath(trimmedFilename).split("/").pop() || "";

        if (showFilenameField && !normalizedFilename) {
          throw new Error("Filename is required.");
        }

        if (!savePath) {
          if (!schema) throw new Error("Cannot create entry without schema.");
          if (!canCreate) throw new Error("Creating entries in this content item isn't allowed.");
          const basePath = parent ?? schema.path;
          if (basePath == null) throw new Error("Cannot create entry without a target path.");
          const generatedFilename = showFilenameField
            ? normalizedFilename
            : generateFilename(schema.filename, schema, contentObject);
          savePath = joinPathSegments([basePath, generatedFilename]);
        } else if (filenameChanged && !canRename && schemaType === "collection") {
          throw new Error("Renaming this entry isn't allowed.");
        } else if (
          showFilenameField
          && filenameFieldMode === "enabled"
          && isFilenameUnlocked
          && filenameChanged
          && schemaType === "collection"
        ) {
          const newPath = joinPathSegments([getParentPath(savePath), normalizedFilename]);
          const renameResponse = await fetch(
            `/api/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/files/${encodeURIComponent(savePath)}/rename`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                type: "content",
                name,
                newPath,
              }),
            },
          );
          await requireApiSuccess<any>(renameResponse, "Failed to rename file");
          savePath = newPath;
          setPath(newPath);
          setIsFilenameUnlocked(false);
          router.replace(`/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/collection/${encodeURIComponent(name)}/edit/${encodeURIComponent(newPath)}`);

          const collectionKeyPrefix = `/api/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/collections/${encodeURIComponent(name)}?`;
          void mutate((key) => typeof key === "string" && key.startsWith(collectionKeyPrefix));
        }

        const response = await fetch(`/api/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/files/${encodeURIComponent(savePath)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: path === ".pages.yml" ? "settings" : "content",
            name,
            content: schema?.list === true
              ? contentObject.listWrapper
              : contentObject,
            sha: sha
          }),
        });
        const data = await requireApiSuccess<any>(
          response,
          "Failed to save file",
        );
        
        if (data.data.sha !== sha) setSha(data.data.sha);
        if (submitStartChangeVersion === changeVersionRef.current) {
          setHasRegisteredChanges(false);
        }

        if (!path && schemaType === "collection") router.push(`/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/collection/${encodeURIComponent(name)}/edit/${encodeURIComponent(data.data.path)}`);
        if (schemaType === "collection") {
          const collectionKeyPrefix = `/api/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/collections/${encodeURIComponent(name)}?`;
          void mutate((key) => typeof key === "string" && key.startsWith(collectionKeyPrefix));
        }

        resolve(data);
      } catch (error) {
        reject(error);
      }
    });

    toast.promise(savePromise, {
      loading: t("Saving your file"),
      success: (response: ApiSuccess<EntryData>) => {
        if (onSave) onSave(response.data);
        const commit = (response.data as { commit?: string } | undefined)?.commit;
        if (isConceptBranch(config.branch)) {
          announceSaved();
          return t("Saved. Click \"Put online\" when you want visitors to see it.");
        }
        if (commit && config.branch === defaultBranch && path !== ".pages.yml") {
          watchDeploy({
            owner: config.owner,
            repo: config.repo,
            branch: config.branch,
            sha: commit,
            siteUrl: getSiteUrl(config.object),
          });
          return t("Saved.");
        }
        return uiLanguage === "en" ? response.message : t("Saved. Your website updates in about a minute.");
      },
      error: (error: unknown) => error instanceof Error ? error.message : t("Failed to save file."),
    });

    try {
      await savePromise;
      editHistory.markSaved(contentObject, draftKeyAtSave);
      if (submitStartChangeVersion === changeVersionRef.current) {
        setHasRegisteredChanges(false);
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error(error.message);
      } else {
        console.error(error);
      }
    } finally {
      setIsSaving(false);
    }
  };

  // "Are you sure?": every change in a table before it goes on the website.
  // On a concept version saving is not live yet; that check comes with "Put online".
  const isLiveBranch = config.branch === defaultBranch && !isConceptBranch(config.branch);
  const [pendingSave, setPendingSave] = useState<{ values: Record<string, unknown>; changes: ContentChange[] } | null>(null);
  const requestSave = (values: Record<string, unknown>) => {
    const saved = editHistory.getSaved();
    if (!isLiveBranch || !saved || path === ".pages.yml") return onSubmit(values);
    const changes = diffContent(entryFields as Field[], saved, values);
    if (changes.length === 0) return onSubmit(values);
    setPendingSave({ values, changes });
  };

  // History: earlier versions of this page with what changed in each.
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const loadVersion = useCallback(async (commitSha: string) => {
    if (!entryApiUrl) return {};
    const response = await fetch(`${entryApiUrl}&ref=${encodeURIComponent(commitSha)}`);
    const data = await requireApiSuccess<any>(response, "Failed to load this version");
    const content = data.data.contentObject;
    return initializeState(entryFields as Field[], sanitizeObject(schema?.list === true ? { listWrapper: content } : content)) as Record<string, unknown>;
  }, [entryApiUrl, entryFields, schema?.list]);
  const putBackChanges = useCallback(async (changes: ContentChange[]) => {
    const api = formApiRef.current;
    if (!api || changes.length === 0) return;
    await api.syncEditors();
    for (const change of changes) api.setValue(change.path, change.beforeValue);
    registerChange();
    toast.success(t("Put back in the form. Check the preview and click \"Save\" to keep it."), { duration: 6000 });
  }, [registerChange]);

  const isBusy = isLoading || isSaving;
  // Something to save: a changed field, a restored version or a new filename.
  // A new entry can always be saved (once it has a filename, if asked).
  const hasChanges =
    !(showFilenameField && filenameValue.trim().length === 0) &&
    (
      !path ||
      isFormDirty ||
      hasRegisteredChanges ||
      (showFilenameField && filenameFieldMode === "enabled" && isFilenameUnlocked && filenameChanged)
    );

  // Don't lose unsaved work when the tab is closed or the page reloaded
  // (a phone may also drop the page when switching apps).
  useEffect(() => {
    if (!path || !hasChanges) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasChanges, path]);

  useEffect(() => {
    const handleSaveShortcut = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "s") return;
      if (!event.metaKey && !event.ctrlKey) return;
      if (event.altKey) return;

      event.preventDefault();
      if (isBusy) return;

      const form = document.getElementById("entry-form");
      if (form instanceof HTMLFormElement) {
        form.requestSubmit();
      }
    };

    window.addEventListener("keydown", handleSaveShortcut);
    return () => window.removeEventListener("keydown", handleSaveShortcut);
  }, [isBusy]);

  const handleDelete = useCallback((path: string) => {
    // TODO: disable save button or freeze form while deleting?
    if (schemaType === "collection") {
      const collectionKeyPrefix = `/api/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/collections/${encodeURIComponent(name)}?`;
      void mutate((key) => typeof key === "string" && key.startsWith(collectionKeyPrefix));
    }
    if (schemaType === "collection") {
      router.push(`/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/collection/${encodeURIComponent(name)}`);
    } else {
      if (entryApiUrl) {
        void mutate(entryApiUrl, undefined, { revalidate: true });
      }
      void mutateEntry();
    }
  }, [config.branch, config.owner, config.repo, entryApiUrl, mutate, mutateEntry, name, router, schemaType]);

  const handleRename = useCallback((oldPath: string, newPath: string) => {
    if (schemaType === "collection") {
      const collectionKeyPrefix = `/api/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/collections/${encodeURIComponent(name)}?`;
      void mutate((key) => typeof key === "string" && key.startsWith(collectionKeyPrefix));
    }
    if (entryApiUrl) {
      void mutate(entryApiUrl, undefined, { revalidate: false });
    }
    setPath(newPath);
    router.replace(`/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/collection/${encodeURIComponent(name)}/edit/${encodeURIComponent(newPath)}`);
  }, [config.branch, config.owner, config.repo, entryApiUrl, mutate, name, router, schemaType]);

  const breadcrumbNode = useMemo(() => {
    if (!schema) {
      return <BreadcrumbPage className="font-semibold truncate">{displayTitle}</BreadcrumbPage>;
    }

    const groupTrail: GroupTrailItem[] = Array.isArray(schema.groupTrail)
      ? schema.groupTrail
      : [];

    if (schemaType !== "collection") {
      return (
        <>
          {groupTrail.map((group) => (
            <Fragment key={`group-${group.name}`}>
              <BreadcrumbItem>
                <span>{group.label || group.name}</span>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
            </Fragment>
          ))}
          <BreadcrumbItem className="truncate">
            <BreadcrumbPage className="font-semibold truncate">{displayTitle}</BreadcrumbPage>
          </BreadcrumbItem>
        </>
      );
    }

    const rootLabel = schema.label || schema.name || name;

    if (!path) {
      return (
        <>
          {groupTrail.map((group) => (
            <Fragment key={`group-${group.name}`}>
              <BreadcrumbItem>
                <span>{group.label || group.name}</span>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
            </Fragment>
          ))}
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={`/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/collection/${encodeURIComponent(name)}`}>
                {rootLabel}
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem className="truncate">
            <BreadcrumbPage className="font-semibold truncate">{displayTitle}</BreadcrumbPage>
          </BreadcrumbItem>
        </>
      );
    }

    const rootPath = normalizePath(schema.path);
    const parentPath = normalizePath(getParentPath(path));
    const relativePath = getRelativePath(parentPath, rootPath);
    const segments = relativePath ? relativePath.split("/").filter(Boolean) : [];

    const parentEntries = segments.map((segment, index) => ({
      name: segment,
      path: joinPathSegments([rootPath, segments.slice(0, index + 1).join("/")]),
    }));

    const immediateParent = parentEntries.length > 0 ? parentEntries[parentEntries.length - 1] : null;
    const middleEntries = parentEntries.length > 1 ? parentEntries.slice(0, -1) : [];

    return (
      <>
        {groupTrail.map((group) => (
          <Fragment key={`group-${group.name}`}>
            <BreadcrumbItem>
              <span>{group.label || group.name}</span>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
          </Fragment>
        ))}
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href={`/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/collection/${encodeURIComponent(name)}`}>
              {rootLabel}
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />

        {middleEntries.length > 0 && (
          <>
            <BreadcrumbItem>
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center">
                  <BreadcrumbEllipsis className="h-4 w-4" />
                  <span className="sr-only">Show hidden segments</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {middleEntries.map((entry) => (
                    <DropdownMenuItem key={entry.path} asChild>
                      <Link href={`/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/collection/${encodeURIComponent(name)}?path=${encodeURIComponent(entry.path)}`}>
                        {entry.name}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
          </>
        )}

        {immediateParent && (
          <>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href={`/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/collection/${encodeURIComponent(name)}?path=${encodeURIComponent(immediateParent.path)}`}>
                  {immediateParent.name}
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
          </>
        )}

        <BreadcrumbItem className="truncate">
          <BreadcrumbPage className="font-semibold truncate">{displayTitle}</BreadcrumbPage>
        </BreadcrumbItem>
      </>
    );
  }, [config.branch, config.owner, config.repo, displayTitle, name, path, schema, schemaType]);
  const isCreationBlocked = !path && schemaType === "collection" && !canCreate;
  const showHeaderActions = error !== "Not found" && !isCreationBlocked;
  const headerActionsNode = useMemo(() => {
    if (!schema || !path) return null;

    if (schemaType === "file") {
      const fileActions = getSchemaActions(schema);
      if (fileActions.length === 0) return null;

      return (
        <RepoActionButtons
          actions={fileActions}
          owner={config.owner}
          repo={config.repo}
          refName={config.branch}
          contextType="file"
          contextName={schema.name}
          contextPath={path}
          contextData={{
            label: schema.label || schema.name,
            sha: sha ?? null,
            content: entry?.contentObject ?? null,
          }}
        />
      );
    }

    if (schemaType === "collection" && entry) {
      const entryActions = getSchemaActions(schema, "entry");
      if (entryActions.length === 0) return null;

      return (
        <RepoActionButtons
          actions={entryActions}
          owner={config.owner}
          repo={config.repo}
          refName={config.branch}
          contextType="entry"
          contextName={schema.name}
          contextPath={path}
          contextData={{
            label: schema.label || schema.name,
            entryName: entry.name ?? null,
            sha: sha ?? null,
            content: entry.contentObject ?? null,
          }}
        />
      );
    }

    return null;
  }, [config.branch, config.owner, config.repo, entry, path, schema, schemaType, sha]);

  const headerNode = useMemo(() => (
    <div className="flex min-w-0 items-center gap-2">
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
        <Breadcrumb className="min-w-0 overflow-hidden">
          <BreadcrumbList className="min-w-0 flex-nowrap font-semibold text-lg">
            {breadcrumbNode}
          </BreadcrumbList>
        </Breadcrumb>
        {headerMeta}
      </div>
      {showHeaderActions && (
        <div className="flex shrink-0 items-center gap-x-2">
          {headerActionsNode}
          {!isFileEditorMode && path !== ".pages.yml" && !isLoading && (
            <UndoRedoButtons
              canUndo={canUndo}
              canRedo={canRedo}
              onUndo={() => void undo()}
              onRedo={() => void redo()}
            />
          )}
          {path && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="shrink-0"
              disabled={!historyData || historyData.length === 0 || isLoading}
              onClick={() => setIsHistoryOpen(true)}
              aria-label={t("History")}
            >
              <History />
            </Button>
          )}
          <Button
            type="submit"
            form="entry-form"
            disabled={isBusy || !hasChanges}
            aria-label={t("Save")}
            className="bg-primary font-semibold text-primary-foreground hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground max-xl:hidden"
          >
            <Save className="size-4" />
            <span>{t("Save")}</span>
          </Button>
          {path && (
            <ButtonGroup>
              {sha
                ? (
                  <FileOptions
                    path={path}
                    sha={sha}
                    type={path === ".pages.yml" ? "settings" : (schemaType ?? "content")}
                    name={name}
                    canDelete={canDelete}
                    canRename={canRename}
                    onDelete={handleDelete}
                    onRename={handleRename}
                  >
                    <Button variant="outline" size="icon" disabled={isBusy}>
                      <EllipsisVertical />
                    </Button>
                  </FileOptions>
                )
                : <Button variant="outline" size="icon" disabled><EllipsisVertical /></Button>
              }
            </ButtonGroup>
          )}
        </div>
      )}
    </div>
  ), [canUndo, canRedo, undo, redo, isFileEditorMode, breadcrumbNode, canDelete, canRename, filenameChanged, filenameFieldMode, filenameValue, handleDelete, handleRename, hasChanges, hasRegisteredChanges, headerActionsNode, headerMeta, historyData, isBusy, isFilenameUnlocked, isFormDirty, isLoading, name, path, schemaType, sha, showFilenameField, showHeaderActions]);

  useRepoHeader({ header: headerNode });

  const loadingSkeleton = useMemo(() => (
    <div className="w-full max-w-screen-md mx-auto grid items-start gap-6">
      {path !== ".pages.yml"
        ? 
          <>
            <div className="space-y-2">
              <Skeleton className="w-24 h-5 rounded" />
              <Skeleton className="w-full h-10 rounded-md" />
            </div>
            <div className="space-y-2">
              <Skeleton className="w-24 h-5 rounded" />
              <Skeleton className="w-full h-10 rounded-md" />
            </div>
            <div className="space-y-2">
              <Skeleton className="w-24 h-5 rounded" />
              <div className="grid grid-flow-col auto-cols-max gap-4">
                <Skeleton className="w-28 h-28 rounded-md" />
                <Skeleton className="w-28 h-28 rounded-md" />
                <Skeleton className="w-28 h-28 rounded-md" />
              </div>
            </div>
            <div className="space-y-2">
              <Skeleton className="w-24 h-5 rounded" />
              <Skeleton className="w-full h-60 rounded-md" />
            </div>
          </>
        : <Skeleton className="w-full h-96 rounded-md" />
      }
    </div>
  ), [path]);

  
  if (error) {
    // TODO: should we use a custom error class with code?
    // TODO: errors show no header (unlike collection and media). Consider standardizing templates.
    if (error === "Not found") {
      const isSettingsPage = path === ".pages.yml";
      return (
        <div className="absolute inset-0 p-4 md:p-6 flex items-center justify-center">
          <Empty className="max-w-[420px] flex-none">
            <EmptyHeader>
              <EmptyTitle>{isSettingsPage ? t("Configuration not found") : t("File not found")}</EmptyTitle>
              <EmptyDescription>
                {isSettingsPage
                  ? "The configuration file \".pages.yml\" does not exist yet."
                  : `The file "${path ?? schema?.path ?? "unknown"}" does not exist yet.`}
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              {isSettingsPage ? (
                <EmptyCreate type="settings">{t("Create configuration file")}</EmptyCreate>
              ) : canCreate ? (
                <EmptyCreate type="content" name={schema?.name ?? name}>{t("Create file")}</EmptyCreate>
              ) : null}
            </EmptyContent>
          </Empty>
        </div>
      );
    } else {
      return (
        <div className="absolute inset-0 p-4 md:p-6 flex items-center justify-center">
          <Empty className="max-w-[420px] flex-none">
            <EmptyHeader>
              <EmptyTitle>{t("Something went wrong")}</EmptyTitle>
              <EmptyDescription>{error}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Link
                className="inline-flex items-center justify-center rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-xs hover:bg-primary/90"
                href={`/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/configuration`}
              >
                {t("Go to configuration")}
              </Link>
            </EmptyContent>
          </Empty>
        </div>
      );
    }
  }

  if (!path && schemaType === "collection" && !canCreate) {
    return (
      <div className="absolute inset-0 p-4 md:p-6 flex items-center justify-center">
        <Empty className="max-w-[420px] flex-none">
          <EmptyHeader>
            <EmptyTitle>{t("Creating entries is disabled")}</EmptyTitle>
            <EmptyDescription>
              {t("New entries are not allowed for this collection.")}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Link
              className="inline-flex items-center justify-center rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-xs hover:bg-primary/90"
              href={`/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/collection/${encodeURIComponent(name)}`}
            >
              {t("Back to collection")}
            </Link>
          </EmptyContent>
        </Empty>
      </div>
    );
  }
  
  const entryForm = (
    isLoading
      ? loadingSkeleton
      : <EntryForm
        fields={entryFields}
        contentObject={entryContentObject}
        onSubmit={requestSave}
        filePath={
          showFilenameField
            ? <InputGroup data-disabled={path ? !isFilenameUnlocked : false}>
                <InputGroupInput
                  value={filenameValue}
                  onChange={(event) => setFilenameValue(event.target.value)}
                  placeholder={t("Filename")}
                  disabled={path ? !isFilenameUnlocked : false}
                  aria-label={t("Filename")}
                />
                {path && filenameFieldMode === "enabled" && canRename && (
                  <InputGroupAddon align="inline-end">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <InputGroupButton
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => setIsFilenameUnlocked((prev) => !prev)}
                          aria-label={isFilenameUnlocked ? t("Lock filename") : t("Unlock filename")}
                        >
                          {isFilenameUnlocked
                            ? <LockOpen className="size-3.5" />
                            : <Lock className="size-3.5" />}
                        </InputGroupButton>
                      </TooltipTrigger>
                      <TooltipContent>
                        {isFilenameUnlocked ? t("Lock filename") : t("Unlock to edit")}
                      </TooltipContent>
                    </Tooltip>
                  </InputGroupAddon>
                )}
              </InputGroup>
            : undefined
        }
        onDirtyChange={setIsFormDirty}
        onChangeRegistered={() => {
          changeVersionRef.current += 1;
          setHasRegisteredChanges(true);
        }}
        onValuesChange={handleValuesChange}
        formApiRef={formApiRef}
      />
  );

  const mobileBar = (
    <>
      <MobileEditBar
        hasPreview={Boolean(previewUrl)}
        isPreviewOpen={isPreviewOpenMobile}
        onPreviewChange={setIsPreviewOpenMobile}
        canSave={!isBusy && hasChanges}
        isSaving={isSaving}
      />
      <DraftRestoreDialog
        draft={isLoading ? null : editHistory.draft}
        onRestore={() => {
          editHistory.restoreDraft();
          registerChange();
        }}
        onDiscard={editHistory.discardDraft}
      />
      <ConfirmLiveDialog
        changes={pendingSave?.changes ?? null}
        isLive={isLiveBranch}
        onCancel={() => setPendingSave(null)}
        onConfirm={() => {
          const values = pendingSave?.values;
          setPendingSave(null);
          if (values) void onSubmit(values);
        }}
      />
      {path && (
        <HistorySheet
          open={isHistoryOpen}
          onOpenChange={setIsHistoryOpen}
          history={historyData}
          fields={entryFields as Field[]}
          loadVersion={loadVersion}
          getCurrentValues={() => (formApiRef.current?.getValues() as Record<string, unknown> | undefined) ?? null}
          onPutBack={(changes) => void putBackChanges(changes)}
          isLiveBranch={isLiveBranch}
        />
      )}
    </>
  );

  if (!previewUrl) {
    return (
      <>
        {entryForm}
        {mobileBar}
      </>
    );
  }

  const preview = (
    <EntryPreview
      url={previewUrl}
      entry={{ name: schema?.name ?? name, path }}
      data={previewData}
      media={previewMedia}
      edit={editMap}
      onSelect={handlePreviewSelect}
      onEdit={handlePreviewEdit}
      onBlock={handlePreviewBlock}
      className="max-xl:rounded-none max-xl:border-0"
    />
  );

  return (
    <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
      <div className="min-w-0">{entryForm}</div>
      {/* One preview: beside the form on wide screens; on phones and tablets
          it fills the screen between the top bar and the bottom bar. */}
      <div
        className={cn(
          "min-w-0 xl:sticky xl:top-20 xl:block xl:h-[calc(100svh-6.5rem)] xl:p-0",
          isPreviewOpenMobile
            ? "fixed inset-x-0 top-[var(--preview-top,3.5rem)] bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-20 block bg-background xl:inset-auto xl:top-20 xl:bottom-auto xl:z-auto xl:bg-transparent"
            // Closed on phones: laid out at full size but invisible, not
            // display:none. A preview that loads at zero size never picks its
            // photos in Safari, so it stayed blank until the size changed.
            : "invisible pointer-events-none fixed inset-x-0 top-14 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] -z-10 xl:visible xl:pointer-events-auto xl:inset-auto xl:top-20 xl:bottom-auto xl:z-auto",
        )}
        style={previewTop !== null ? ({ "--preview-top": `${previewTop}px` } as React.CSSProperties) : undefined}
      >
        {preview}
      </div>
      {mobileBar}
      <Dialog open={addBlock !== null} onOpenChange={(open) => { if (!open) setAddBlock(null); }}>
        <DialogContent
          // On a phone: a panel that slides up from the bottom, easy to reach with a thumb.
          className="max-h-[85svh] overflow-y-auto max-sm:top-auto max-sm:bottom-0 max-sm:max-w-full max-sm:translate-y-0 max-sm:rounded-b-none max-sm:rounded-t-2xl max-sm:border-x-0 max-sm:border-b-0 max-sm:pb-[calc(1.5rem+env(safe-area-inset-bottom))] max-sm:data-[state=open]:zoom-in-100 max-sm:data-[state=open]:slide-in-from-bottom-10"
        >
          <DialogHeader>
            <DialogTitle>{t("Which block do you want to add?")}</DialogTitle>
            <DialogDescription>{t("It comes right below the block you chose, in the style of your website.")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            {addBlock?.blocks.map((block) => (
              <Button
                key={block.name}
                type="button"
                variant="outline"
                className="h-auto min-h-12 justify-start whitespace-normal py-3 text-left text-base sm:min-h-10 sm:text-sm"
                onClick={() => {
                  const choice = addBlock;
                  setAddBlock(null);
                  if (choice) void insertItem(choice.list, choice.index, block.name);
                }}
              >
                {block.label}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Wide enough for the form and the preview side by side (Tailwind's xl).
const isWideScreen = () => typeof window !== "undefined" && window.matchMedia("(min-width: 1280px)").matches;
