"use client";

/**
 * Webstudio writing help ("Schrijfhulp"): a small button next to a text field
 * that rewrites, translates or describes a photo. The suggestion is shown
 * first; only "Use this" changes the field, and a toast offers to undo it.
 * The server side (and the free daily cap) is in lib/ai.ts.
 */

import { useCallback, useEffect, useState } from "react";
import { useFormContext } from "react-hook-form";
import { Loader2, RotateCcw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useConfig } from "@/contexts/config-context";
import { useRepo } from "@/contexts/repo-context";
import { getRawUrl } from "@/lib/github-image";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type AiFormat = "plain" | "markdown" | "html";

const LANGUAGE_NAMES: Record<string, string> = {
  nl: "Dutch",
  de: "German",
  en: "English",
  fr: "French",
};
const MENU_LANGUAGES = ["nl", "de", "en"];

// ---------------------------------------------------------------------------
// Is the help switched on (and how much room is left today)?

type AiStatus = { enabled: boolean; left: number };
const statusCache = new Map<string, Promise<AiStatus>>();
const listeners = new Set<() => void>();

const loadStatus = (key: string, fresh = false) => {
  if (fresh || !statusCache.has(key)) {
    statusCache.set(key, fetch(`/api/${key}/ai`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => ({ enabled: Boolean(payload?.data?.enabled), left: Number(payload?.data?.left ?? 0) }))
      .catch(() => ({ enabled: false, left: 0 })));
  }
  return statusCache.get(key)!;
};

const useAiKey = () => {
  const { owner, repo } = useRepo();
  const { config } = useConfig();
  const branch = config?.branch;
  return owner && repo && branch ? `${owner}/${repo}/${encodeURIComponent(branch)}` : null;
};

export const useAiStatus = () => {
  const key = useAiKey();
  const [status, setStatus] = useState<AiStatus>({ enabled: false, left: 0 });
  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    const update = () => {
      void loadStatus(key).then((next) => { if (!cancelled) setStatus(next); });
    };
    update();
    listeners.add(update);
    return () => {
      cancelled = true;
      listeners.delete(update);
    };
  }, [key]);
  return status;
};

const refreshStatus = (key: string) => {
  void loadStatus(key, true).then(() => listeners.forEach((listener) => listener()));
};

export const useAiRequest = () => {
  const key = useAiKey();
  return useCallback(async (body: Record<string, unknown>) => {
    if (!key) throw new Error(t("The writing help isn't working right now. Try again in a moment."));
    let response: Response;
    try {
      response = await fetch(`/api/${key}/ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      throw new Error(t("The writing help isn't working right now. Try again in a moment."));
    } finally {
      refreshStatus(key);
    }
    const payload = await response.json().catch(() => null);
    if (!response.ok || payload?.status !== "success") {
      throw new Error(t(payload?.message || "The writing help isn't working right now. Try again in a moment."));
    }
    return payload.data;
  }, [key]);
};

// ---------------------------------------------------------------------------
// Helpers

const lastPart = (name: string) => name.split(".").pop() ?? "";
const parentPath = (name: string) => name.split(".").slice(0, -1).join(".");
const siblingPath = (name: string, sibling: string) => [parentPath(name), sibling].filter(Boolean).join(".");

const NO_HELP = /(telefoon|phone|^tel$|e-?mail|prijs|price|bedrag|url|link|href|adres|address|postcode|plaats|kvk|btw|iban|slug|^id$|datum|date|tijd|time|uren|kleur|colou?r|icon|code|nummer|number|whatsapp|instagram|facebook|website|domein)/i;
const IMAGE = /\.(jpe?g|png|webp|gif|avif)$/i;
const firstImage = (value: unknown): string | null => {
  if (typeof value === "string" && IMAGE.test(value)) return value;
  if (Array.isArray(value) && typeof value[0] === "string" && IMAGE.test(value[0])) return value[0];
  return null;
};

/** For display only: the words of a Markdown/HTML text. */
export const plainText = (text: string) => text
  .replace(/<(br|\/p|\/h\d|\/li|\/div)\s*\/?>/gi, "\n")
  .replace(/<[^>]+>/g, "")
  .replace(/&nbsp;/g, " ")
  .replace(/&amp;/g, "&")
  .replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">")
  .replace(/&quot;/g, "\"")
  .replace(/&#39;/g, "'")
  .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
  .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
  .replace(/^#+\s*/gm, "")
  .replace(/\n{3,}/g, "\n\n")
  .trim();

/** A photo made small (max 512 px) as a JPEG data URL, so the request stays small. */
const smallPhoto = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error("photo");
  const bitmap = await createImageBitmap(await response.blob());
  const scale = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("photo");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.8);
};

// ---------------------------------------------------------------------------
// The button with its menu and the suggestion dialog

type Job = { title: string; body: Record<string, unknown> | (() => Promise<Record<string, unknown>>) };

export function AiHelpButton({
  name,
  field,
  format,
  getText,
  apply,
  disabled,
  className,
}: {
  /** Form path of the field, e.g. "secties.2.tekst.de". */
  name: string;
  field: any;
  format: AiFormat;
  getText: () => string | Promise<string>;
  apply: (text: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const status = useAiStatus();
  const request = useAiRequest();
  const form = useFormContext();
  const { owner, repo, isPrivate } = useRepo();
  const { config } = useConfig();

  const [open, setOpen] = useState(false);
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [original, setOriginal] = useState("");

  const own = lastPart(name);
  const ownLanguage = LANGUAGE_NAMES[own] ? own : null;
  const options = (field?.options ?? {}) as { ai?: boolean | string; image?: string; media?: string };
  const isPhotoText = options.ai === "photo" || own === "alt" || (ownLanguage !== null && lastPart(parentPath(name)) === "alt");

  const run = useCallback(async (next: Job) => {
    setJob(next);
    setOpen(true);
    setLoading(true);
    setError("");
    setResult("");
    try {
      const body = typeof next.body === "function" ? await next.body() : next.body;
      const data = await request(body);
      setResult(String(data?.text ?? ""));
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : t("The writing help isn't working right now. Try again in a moment."));
    } finally {
      setLoading(false);
    }
  }, [request]);

  if (!status.enabled || field?.readonly || options.ai === false) return null;
  // Phone numbers, prices, addresses and the like don't need writing help.
  const subject = ownLanguage ? lastPart(parentPath(name)) : own;
  if (options.ai !== true && !isPhotoText && NO_HELP.test(subject)) return null;

  const withText = (title: string, body: (text: string) => Record<string, unknown>): Job => ({
    title,
    body: async () => {
      const text = String(await getText() ?? "");
      setOriginal(text);
      if (!plainText(text)) throw new Error(t("There is no text yet. Write something first, then the writing help can improve it."));
      return body(text);
    },
  });

  // Bilingual fields ({ nl, de }): translate from the other language.
  const otherLanguages = ownLanguage
    ? Object.keys(LANGUAGE_NAMES).filter((code) => code !== ownLanguage && typeof form.getValues(siblingPath(name, code)) === "string")
    : [];

  const describePhoto = (): Job => ({
    title: t("Describe the photo"),
    body: async () => {
      setOriginal(String(await getText() ?? ""));
      // The photo is next to this field, or next to the { nl, de } object.
      const base = ownLanguage && lastPart(parentPath(name)) === "alt" ? parentPath(name) : name;
      const parent = form.getValues(parentPath(base) || undefined as any) ?? {};
      const named = options.image ? form.getValues(siblingPath(base, options.image)) : undefined;
      let photo = firstImage(named);
      if (!photo && parent && typeof parent === "object") {
        for (const key of ["foto", "image", "afbeelding", "src", "photo"]) {
          photo = firstImage((parent as any)[key]);
          if (photo) break;
        }
        if (!photo) photo = Object.values(parent).map(firstImage).find(Boolean) ?? null;
      }
      if (!photo) throw new Error(t("Pick a photo first, then the writing help can describe it."));
      const mediaName = options.media || (config?.object as any)?.media?.[0]?.name;
      const url = config?.branch && mediaName ? await getRawUrl(owner, repo, config.branch, mediaName, photo, isPrivate) : null;
      if (!url) throw new Error(t("The photo could not be loaded."));
      let image: string;
      try {
        image = await smallPhoto(url);
      } catch {
        throw new Error(t("The photo could not be loaded."));
      }
      const context = parent && typeof parent === "object"
        ? Object.entries(parent)
          .filter(([key, value]) => key !== "alt" && typeof value === "string" && !IMAGE.test(value) && !/^(https?:|\/|#|pagina:)/.test(value))
          .map(([, value]) => plainText(String(value)))
          .join(" ")
          .slice(0, 400)
        : "";
      return { task: "photo", image, language: ownLanguage ?? "nl", context };
    },
  });

  const use = () => {
    const before = original;
    apply(result);
    setOpen(false);
    toast.success(t("Text replaced"), {
      action: { label: t("Undo"), onClick: () => apply(before) },
    });
  };

  const shown = format === "plain" ? result : plainText(result);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            className={cn("h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground", className)}
            title={t("Writing help")}
          >
            <Sparkles className="size-3.5" />
            <span className="hidden sm:inline">{t("Writing help")}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          {status.left <= 0 ? (
            <div className="px-2 py-2 text-sm text-muted-foreground">
              {t("The writing help has done enough for today. Tomorrow it works again.")}
            </div>
          ) : (
            <>
              {isPhotoText && (
                <>
                  <DropdownMenuItem onSelect={() => void run(describePhoto())}>{t("Describe the photo")}</DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onSelect={() => void run(withText(t("Improve the text"), (text) => ({ task: "rewrite", mode: "improve", text, format })))}>
                {t("Improve the text")}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void run(withText(t("Make shorter"), (text) => ({ task: "rewrite", mode: "shorter", text, format })))}>
                {t("Make shorter")}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void run(withText(t("Make longer"), (text) => ({ task: "rewrite", mode: "longer", text, format })))}>
                {t("Make longer")}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void run(withText(t("Make more inviting"), (text) => ({ task: "rewrite", mode: "inviting", text, format })))}>
                {t("Make more inviting")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">{t("Translate")}</DropdownMenuLabel>
              {otherLanguages.map((code) => (
                <DropdownMenuItem
                  key={`from-${code}`}
                  onSelect={() => void run({
                    title: t("Translate from {language}", { language: t(LANGUAGE_NAMES[code]) }),
                    body: async () => {
                      setOriginal(String(await getText() ?? ""));
                      const source = String(form.getValues(siblingPath(name, code)) ?? "");
                      if (!plainText(source)) throw new Error(t("There is no {language} text yet.", { language: t(LANGUAGE_NAMES[code]) }));
                      return { task: "translate", text: source, language: ownLanguage, format };
                    },
                  })}
                >
                  {t("Translate from {language}", { language: t(LANGUAGE_NAMES[code]) })}
                </DropdownMenuItem>
              ))}
              {!ownLanguage && MENU_LANGUAGES.map((code) => (
                <DropdownMenuItem
                  key={`to-${code}`}
                  onSelect={() => void run(withText(
                    t("Translate into {language}", { language: t(LANGUAGE_NAMES[code]) }),
                    (text) => ({ task: "translate", text, language: code, format }),
                  ))}
                >
                  {t("Translate into {language}", { language: t(LANGUAGE_NAMES[code]) })}
                </DropdownMenuItem>
              ))}
              {ownLanguage && otherLanguages.length === 0 && (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">{t("Nothing to translate from here.")}</div>
              )}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={open} onOpenChange={(next) => { if (!loading || !next) setOpen(next); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="size-4" />
              {job?.title ?? t("Writing help")}
            </DialogTitle>
            <DialogDescription>
              {t("Check the suggestion. Your text only changes when you click \"Use this\".")}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[50vh] min-h-24 overflow-y-auto rounded-md border bg-muted/30 p-3 text-sm whitespace-pre-wrap">
            {loading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                {t("Writing...")}
              </div>
            ) : error ? (
              <p className="text-muted-foreground">{error}</p>
            ) : (
              shown
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>{t("Cancel")}</Button>
            {job && !loading && (
              <Button type="button" variant="outline" onClick={() => void run(job)}>
                <RotateCcw className="size-4" />
                {t("Try again")}
              </Button>
            )}
            <Button type="button" onClick={use} disabled={loading || !result}>{t("Use this")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// Google title and description (under the "Google en delen" preview)

const SKIP_KEYS = /^(id|slug|link|href|url|knop_link|icon|focus|kleur|type|_.*)$/i;

/** The readable texts of the page, for the Google suggestion. */
const pageTexts = (value: unknown, skipPath: string, path = "", out: string[] = []) => {
  if (out.join(" ").length > 6_000 || path === skipPath) return out;
  if (typeof value === "string") {
    if (!IMAGE.test(value) && !/^(https?:|\/|#|pagina:|mailto:|tel:)/.test(value.trim()) && !/^\d+% \d+%$/.test(value)) {
      const text = plainText(value);
      if (text) out.push(text);
    }
  } else if (Array.isArray(value)) {
    value.forEach((item, index) => pageTexts(item, skipPath, path ? `${path}.${index}` : String(index), out));
  } else if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      if (!SKIP_KEYS.test(key)) pageTexts(item, skipPath, path ? `${path}.${key}` : key, out);
    }
  }
  return out;
};

type SeoSuggestion = Record<string, { titel: string; omschrijving: string }>;

export function AiSeoButton({ fieldName, field }: { fieldName: string; field: any }) {
  const status = useAiStatus();
  const request = useAiRequest();
  const form = useFormContext();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<SeoSuggestion | null>(null);

  if (!status.enabled || field?.readonly || (field?.options as any)?.ai === false) return null;

  // { nl, de } sub-fields mean a bilingual site.
  const titleField = (field.fields ?? []).find((sub: any) => sub?.name === "titel");
  const languages: string[] = titleField?.type === "object"
    ? (titleField.fields ?? []).map((sub: any) => sub?.name).filter((code: string) => LANGUAGE_NAMES[code])
    : [];

  const suggest = async () => {
    setOpen(true);
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const text = pageTexts(form.getValues(), fieldName).join("\n").slice(0, 6_000);
      if (!text.trim()) throw new Error(t("There is no text on this page yet."));
      const data = await request({ task: "seo", text, languages });
      setResult(data?.seo ?? null);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : t("The writing help isn't working right now. Try again in a moment."));
    } finally {
      setLoading(false);
    }
  };

  const use = () => {
    if (!result) return;
    const before = form.getValues(fieldName);
    const options = { shouldDirty: true, shouldTouch: true, shouldValidate: false };
    if (languages.length) {
      for (const code of languages) {
        const part = result[code];
        if (!part) continue;
        if (part.titel) form.setValue(`${fieldName}.titel.${code}`, part.titel, options);
        if (part.omschrijving) form.setValue(`${fieldName}.omschrijving.${code}`, part.omschrijving, options);
      }
    } else {
      const part = result[""];
      if (part?.titel) form.setValue(`${fieldName}.titel`, part.titel, options);
      if (part?.omschrijving) form.setValue(`${fieldName}.omschrijving`, part.omschrijving, options);
    }
    setOpen(false);
    toast.success(t("Text replaced"), {
      action: { label: t("Undo"), onClick: () => form.setValue(fieldName, before, options) },
    });
  };

  const entries = result ? Object.entries(result) : [];

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => void suggest()} disabled={status.left <= 0}>
        <Sparkles className="size-4" />
        {status.left <= 0 ? t("The writing help has done enough for today. Tomorrow it works again.") : t("Write a suggestion for Google")}
      </Button>
      <Dialog open={open} onOpenChange={(next) => { if (!loading || !next) setOpen(next); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="size-4" />
              {t("Suggestion for Google")}
            </DialogTitle>
            <DialogDescription>
              {t("Made from the texts on this page. Your text only changes when you click \"Use this\".")}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[50vh] min-h-24 space-y-3 overflow-y-auto rounded-md border bg-muted/30 p-3 text-sm">
            {loading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                {t("Writing...")}
              </div>
            ) : error ? (
              <p className="text-muted-foreground">{error}</p>
            ) : (
              entries.map(([code, part]) => (
                <div key={code} className="space-y-1">
                  {code && <div className="text-xs font-medium uppercase text-muted-foreground">{code}</div>}
                  <div className="text-base leading-snug text-[#1a0dab] dark:text-[#8ab4f8]">{part.titel}</div>
                  <div className="text-neutral-700 dark:text-neutral-300">{part.omschrijving}</div>
                </div>
              ))
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>{t("Cancel")}</Button>
            {!loading && (
              <Button type="button" variant="outline" onClick={() => void suggest()}>
                <RotateCcw className="size-4" />
                {t("Try again")}
              </Button>
            )}
            <Button type="button" onClick={use} disabled={loading || !entries.length}>{t("Use this")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
