"use client";

import { useMemo, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { Check, CircleAlert } from "lucide-react";
import { useConfig } from "@/contexts/config-context";
import { Thumbnail } from "@/components/thumbnail";
import { AiSeoButton } from "@/components/ai-help";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Webstudio: under an object field with `options: { seo: true }` (sub-fields
 * titel, omschrijving, foto), show how the page looks in Google and when it is
 * shared on WhatsApp, with a few plain tips.
 */

const cut = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

const siteHost = (configObject: any): string | null => {
  const items: any[] = Array.isArray(configObject?.content) ? configObject.content : [];
  for (const item of items) {
    if (typeof item?.preview === "string") {
      try {
        return new URL(item.preview).host;
      } catch {
        // ignore
      }
    }
  }
  return null;
};

type Tip = { ok: boolean; text: string };

export function SeoPreview({ fieldName, field }: { fieldName: string; field: any }) {
  const { control } = useFormContext();
  const value = useWatch({ control, name: fieldName }) ?? {};
  const { config } = useConfig();
  const configObject: any = config?.object ?? {};
  const siteName: string = configObject?.settings?.name || config?.repo || "";
  const host = siteHost(configObject) || "jouwwebsite.nl";

  const photoField = (field.fields ?? []).find((sub: any) => sub?.name === "foto");
  const mediaName: string | undefined = photoField?.options?.media
    || (Array.isArray(configObject.media) ? configObject.media[0]?.name : undefined);

  // Bilingual sites store { nl, de }: show one language at a time.
  const languages = useMemo(() => {
    const keys = new Set<string>();
    for (const part of [value?.titel, value?.omschrijving]) {
      if (part && typeof part === "object" && !Array.isArray(part)) Object.keys(part).forEach((key) => keys.add(key));
    }
    return [...keys];
  }, [value?.titel, value?.omschrijving]);
  const [language, setLanguage] = useState<string | null>(null);
  const shownLanguage = language && languages.includes(language) ? language : languages[0];
  const pick = (part: any) => (part && typeof part === "object" ? part[shownLanguage ?? ""] ?? "" : part ?? "");
  const title = String(pick(value?.titel)).trim();
  const description = String(pick(value?.omschrijving)).trim();
  const photo = typeof value?.foto === "string" && value.foto ? value.foto : null;

  const shownTitle = title || siteName;
  const tips = useMemo<Tip[]>(() => {
    const list: Tip[] = [];
    if (!title) list.push({ ok: false, text: t("Fill in a title: what someone would search for, e.g. \"Wedding flowers in Venlo\".") });
    else if (title.length < 25) list.push({ ok: false, text: t("The title is short. Add where you are or what you do.") });
    else if (title.length > 60) list.push({ ok: false, text: t("The title is long; Google cuts it off after about 60 letters.") });
    else list.push({ ok: true, text: t("Good title length.") });

    if (!description) list.push({ ok: false, text: t("Fill in a description: one or two sentences that make people click.") });
    else if (description.length < 70) list.push({ ok: false, text: t("The description is short. Tell a bit more.") });
    else if (description.length > 160) list.push({ ok: false, text: t("The description is long; Google shows about 155 letters.") });
    else list.push({ ok: true, text: t("Good description length.") });

    list.push(photo
      ? { ok: true, text: t("There is a share photo for WhatsApp and Facebook.") }
      : { ok: false, text: t("Pick a share photo: it shows when someone shares this page on WhatsApp or Facebook.") });
    return list;
  }, [title, description, photo]);

  return (
    <div className="mt-3 space-y-4 rounded-md border bg-muted/30 p-3">
      {languages.length > 1 && (
        <div className="flex gap-1" role="group" aria-label={t("Language")}>
          {languages.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => setLanguage(code)}
              aria-pressed={code === shownLanguage}
              className={cn("rounded-md border px-2.5 py-1 text-xs font-medium uppercase", code === shownLanguage ? "bg-foreground text-background" : "bg-background")}
            >
              {code}
            </button>
          ))}
        </div>
      )}
      <div>
        <div className="mb-1.5 text-xs font-medium text-muted-foreground">{t("This is how it looks in Google")}</div>
        <div className="rounded-md bg-white p-3 text-left font-[Arial,sans-serif] dark:bg-neutral-900">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-200 text-xs font-semibold text-neutral-700">
              {(siteName || host).charAt(0).toUpperCase()}
            </span>
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-sm text-neutral-900 dark:text-neutral-100">{siteName || host}</span>
              <span className="block truncate text-xs text-neutral-600 dark:text-neutral-400">https://{host}</span>
            </span>
          </div>
          <div className="mt-1.5 text-lg leading-snug text-[#1a0dab] dark:text-[#8ab4f8]">{cut(shownTitle, 60)}</div>
          <div className="text-sm leading-snug text-neutral-700 dark:text-neutral-300">
            {description ? cut(description, 158) : <span className="italic text-neutral-400">{t("No description yet: Google then picks some text from the page itself.")}</span>}
          </div>
        </div>
      </div>

      <div>
        <div className="mb-1.5 text-xs font-medium text-muted-foreground">{t("This is how it looks when shared on WhatsApp")}</div>
        <div className="max-w-xs rounded-lg bg-[#d9fdd3] p-1 dark:bg-[#005c4b]">
          <div className="overflow-hidden rounded-md bg-[#f0f2f5] dark:bg-[#1f2c33]">
            {photo && mediaName ? (
              <Thumbnail name={mediaName} path={photo} className="h-36 w-full rounded-none" />
            ) : (
              <div className="flex h-20 items-center justify-center text-xs text-neutral-500">{t("No share photo")}</div>
            )}
            <div className="px-2.5 py-2">
              <div className="truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100">{shownTitle}</div>
              {description && <div className="line-clamp-2 text-xs text-neutral-600 dark:text-neutral-300">{description}</div>}
              <div className="mt-0.5 text-xs text-neutral-500">{host}</div>
            </div>
          </div>
        </div>
      </div>

      <ul className="space-y-1 text-sm">
        {tips.map((tip) => (
          <li key={tip.text} className="flex items-start gap-2">
            {tip.ok
              ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
              : <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />}
            <span className={cn(!tip.ok && "text-foreground")}>{tip.text}</span>
          </li>
        ))}
      </ul>
      <AiSeoButton fieldName={fieldName} field={field} />
    </div>
  );
}
