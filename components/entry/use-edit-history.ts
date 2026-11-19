"use client";

/**
 * Undo / redo for the edit screen, and a copy of unsaved work on this device.
 *
 * - Every change in the form or in the live preview becomes an undo step.
 *   Typing is grouped: a pause of a moment ends a step, so undo takes back a
 *   word or a sentence, not a single letter.
 * - Unsaved work is also kept in this browser (localStorage). After a crash,
 *   a reload or a tab closed by mistake, the editor asks to put it back.
 *
 * The form stays the one place that holds the values: undo and "put back"
 * simply load other values into it (see EntryFormApi.restore).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { EntryFormApi } from "./entry-form";

const STEP_PAUSE_MS = 600;
const MAX_STEPS = 100;
const DRAFT_PREFIX = "webstudio-draft:";
const DRAFT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export type Draft = { savedAt: number; sha?: string; values: Record<string, unknown> };

const stringify = (values: unknown) => {
  try {
    return JSON.stringify(values ?? {});
  } catch {
    return null;
  }
};

const readDraft = (key: string): Draft | null => {
  try {
    const raw = window.localStorage.getItem(DRAFT_PREFIX + key);
    if (!raw) return null;
    const draft = JSON.parse(raw) as Draft;
    if (!draft || typeof draft !== "object" || !draft.values || typeof draft.savedAt !== "number") return null;
    if (Date.now() - draft.savedAt > DRAFT_MAX_AGE_MS) {
      window.localStorage.removeItem(DRAFT_PREFIX + key);
      return null;
    }
    return draft;
  } catch {
    return null;
  }
};

const writeDraft = (key: string, json: string, sha?: string) => {
  try {
    window.localStorage.setItem(
      DRAFT_PREFIX + key,
      `{"savedAt":${Date.now()},"sha":${JSON.stringify(sha ?? null)},"values":${json}}`,
    );
  } catch {
    // Full or blocked storage: undo keeps working, only the crash copy is skipped.
  }
};

const removeDraft = (key: string) => {
  try {
    window.localStorage.removeItem(DRAFT_PREFIX + key);
  } catch {
    // ignore
  }
};

/** Forget the copy on this device, for example after it was put online elsewhere. */
export const clearDraft = removeDraft;

export function useEditHistory({
  formApiRef,
  resetKey,
  storageKey,
  sha,
  enabled = true,
}: {
  formApiRef: React.MutableRefObject<EntryFormApi | null>;
  /** Changes when the form is loaded with new content: history starts over. */
  resetKey: unknown;
  /** Where on this device the unsaved copy lives (site, branch and file). */
  storageKey: string | null;
  sha?: string;
  enabled?: boolean;
}) {
  const pastRef = useRef<string[]>([]);
  const futureRef = useRef<string[]>([]);
  const presentRef = useRef<string | null>(null);
  // What is on the website (or what was last saved): no copy needed for that.
  const savedRef = useRef<string | null>(null);
  const pendingRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const storageKeyRef = useRef(storageKey);
  storageKeyRef.current = storageKey;
  const shaRef = useRef(sha);
  shaRef.current = sha;

  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);

  const refresh = useCallback(() => {
    setCanUndo(pastRef.current.length > 0);
    setCanRedo(futureRef.current.length > 0);
  }, []);

  const keepCopy = useCallback(() => {
    const key = storageKeyRef.current;
    const present = presentRef.current;
    if (!key || present === null) return;
    if (present === savedRef.current) removeDraft(key);
    else writeDraft(key, present, shaRef.current);
  }, []);

  /** Turn the changes of the last moment into one undo step. */
  const commit = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (pending === null || presentRef.current === null || pending === presentRef.current) return;
    pastRef.current.push(presentRef.current);
    if (pastRef.current.length > MAX_STEPS) pastRef.current.shift();
    futureRef.current = [];
    presentRef.current = pending;
    keepCopy();
    refresh();
  }, [keepCopy, refresh]);

  // New content in the form (page opened, other version loaded): start over.
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    pendingRef.current = null;
    pastRef.current = [];
    futureRef.current = [];
    const api = formApiRef.current;
    const current = api ? stringify(api.getValues()) : null;
    presentRef.current = current;
    savedRef.current = current;
    refresh();
    // Unsaved work from an earlier visit on this device?
    const key = storageKeyRef.current;
    if (!enabled || !key || current === null) {
      setDraft(null);
      return;
    }
    const found = readDraft(key);
    if (found && stringify(found.values) !== current) setDraft(found);
    else {
      if (found) removeDraft(key);
      setDraft(null);
    }
  }, [enabled, formApiRef, refresh, resetKey]);

  /** Called with the form's values after every change. */
  const onValues = useCallback((values: Record<string, unknown>) => {
    if (!enabled) return;
    const json = stringify(values);
    if (json === null) return;
    if (presentRef.current === null) {
      presentRef.current = json;
      savedRef.current = json;
      return;
    }
    if (json === presentRef.current) {
      pendingRef.current = null;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      return;
    }
    pendingRef.current = json;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(commit, STEP_PAUSE_MS);
    // Show the undo button right away, before the step is finished.
    setCanUndo(true);
  }, [commit, enabled]);

  const apply = useCallback((json: string) => {
    const api = formApiRef.current;
    if (!api) return;
    presentRef.current = json;
    api.restore(JSON.parse(json));
    keepCopy();
    refresh();
  }, [formApiRef, keepCopy, refresh]);

  const undo = useCallback(async () => {
    const api = formApiRef.current;
    if (!api) return;
    // Text still in an editor counts as the newest step.
    await api.syncEditors();
    const latest = stringify(api.getValues());
    if (latest !== null && latest !== presentRef.current) pendingRef.current = latest;
    commit();
    const previous = pastRef.current.pop();
    if (previous === undefined || presentRef.current === null) return refresh();
    futureRef.current.push(presentRef.current);
    apply(previous);
  }, [apply, commit, formApiRef, refresh]);

  const redo = useCallback(async () => {
    const api = formApiRef.current;
    if (!api) return;
    await api.syncEditors();
    const latest = stringify(api.getValues());
    // Changed something after undo: there is nothing to redo any more.
    if (latest !== null && latest !== presentRef.current) {
      pendingRef.current = latest;
      commit();
      return;
    }
    const next = futureRef.current.pop();
    if (next === undefined || presentRef.current === null) return refresh();
    pastRef.current.push(presentRef.current);
    apply(next);
  }, [apply, commit, formApiRef, refresh]);

  /** After a successful save: these values are now on the website. */
  const markSaved = useCallback((values: Record<string, unknown>, keyAtSave?: string | null) => {
    const json = stringify(values);
    savedRef.current = json;
    const key = keyAtSave ?? storageKeyRef.current;
    if (!key) return;
    const present = pendingRef.current ?? presentRef.current;
    if (present === json || key !== storageKeyRef.current) removeDraft(key);
    else keepCopy();
  }, [keepCopy]);

  /** Put the unsaved work from last time back in the form (undo takes it out again). */
  const restoreDraft = useCallback(() => {
    if (!draft) return;
    const json = stringify(draft.values);
    setDraft(null);
    if (json === null || presentRef.current === null) return;
    pastRef.current.push(presentRef.current);
    futureRef.current = [];
    apply(json);
  }, [apply, draft]);

  const discardDraft = useCallback(() => {
    setDraft(null);
    if (storageKeyRef.current) removeDraft(storageKeyRef.current);
  }, []);

  // Closing the tab or switching apps on a phone: write the copy right now.
  useEffect(() => {
    if (!enabled) return;
    const flush = () => {
      if (pendingRef.current !== null) commit();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [commit, enabled]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  // Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z (or Ctrl+Y). Inside a text field the
  // browser's own undo for that field keeps working.
  useEffect(() => {
    if (!enabled) return;
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key !== "z" && key !== "y") return;
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
      event.preventDefault();
      if (key === "y" || event.shiftKey) void redo();
      else void undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, redo, undo]);

  /** The values as they were last loaded or saved (what is on the website). */
  const getSaved = useCallback((): Record<string, unknown> | null => {
    try {
      return savedRef.current === null ? null : JSON.parse(savedRef.current);
    } catch {
      return null;
    }
  }, []);

  return { canUndo, canRedo, undo, redo, onValues, markSaved, getSaved, draft, restoreDraft, discardDraft };
}
