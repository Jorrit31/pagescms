"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, CircleAlert, ImageOff, Pencil, RefreshCw, Search } from "lucide-react";
import { useConfig } from "@/contexts/config-context";
import { Thumbnail } from "@/components/thumbnail";
import { GoogleSnippet } from "@/components/seo-preview";
import { Skeleton } from "@/components/ui/skeleton";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  findSeoField,
  languageName,
  pickLanguage,
  seoLight,
  seoTips,
  siteHostFromConfig,
  type SeoLight,
  type SeoOverviewPage,
} from "@/lib/seo-shared";

/**
 * Webstudio: "Google" in the menu. All pages of the website under each other,
 * each with how it looks in Google, a traffic light for whether it is filled
 * in well, and one tap to change it (opens the page at its Google settings).
 */

const LIGHT_STYLE: Record<SeoLight, { dot: string; chip: string; label: string }> = {
  green: { dot: "bg-green-500", chip: "bg-green-500/15 text-green-700 dark:text-green-300", label: "Good" },
  orange: { dot: "bg-amber-400", chip: "bg-amber-400/15 text-amber-700 dark:text-amber-300", label: "Could be better" },
  red: { dot: "bg-red-500", chip: "bg-red-500/15 text-red-700 dark:text-red-300", label: "Still to fill in" },
};

const Light = ({ light, className }: { light: SeoLight; className?: string }) => (
  <span className={cn("inline-block size-2.5 shrink-0 rounded-full", LIGHT_STYLE[light].dot, className)} aria-hidden />
);

/** The languages the Google texts are written in, from .pages.yml (e.g. ["nl", "de"]). */
const configLanguages = (configObject: any): string[] => {
  const languages: string[] = [];
  for (const item of configObject?.content ?? []) {
    const seo = findSeoField(item?.fields);
    const title = (seo?.fields ?? []).find((sub: any) => sub?.name === "titel");
    if (title?.type === "object" && Array.isArray(title.fields)) {
      for (const sub of title.fields) if (sub?.name && !languages.includes(sub.name)) languages.push(sub.name);
    }
  }
  return languages;
};

type Checked = {
  page: SeoOverviewPage;
  title: string;
  description: string;
  photo: string | null;
  light: SeoLight;
  /** per language, when the site has more than one */
  lights: { language: string; light: SeoLight }[];
  problems: string[];
  /** the field to jump to when changing it, e.g. "seo.omschrijving.de" */
  jumpTo: string;
};

export function GoogleOverview() {
  const { config } = useConfig();
  const configObject: any = config?.object ?? {};
  const siteName: string = configObject?.settings?.name || config?.repo || "";
  const host = siteHostFromConfig(configObject) || "jouwwebsite.nl";
  const defaultMedia: string | undefined = Array.isArray(configObject.media) ? configObject.media[0]?.name : undefined;
  const base = config ? `/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}` : "";

  const [pages, setPages] = useState<SeoOverviewPage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!config) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/google`, { cache: "no-store" });
      const payload = await response.json().catch(() => null);
      if (!response.ok || payload?.status !== "success") throw new Error(payload?.message || "");
      setPages(payload.data.pages ?? []);
    } catch {
      setError(t("Could not load the pages. Try again in a moment."));
    } finally {
      setLoading(false);
    }
  }, [config]);

  useEffect(() => { load(); }, [load]);

  const languages = useMemo(() => configLanguages(config?.object), [config?.object]);
  const [language, setLanguage] = useState<string | null>(null);
  const shownLanguage = language && languages.includes(language) ? language : (languages[0] ?? null);
  const [filter, setFilter] = useState<SeoLight | null>(null);

  const checked = useMemo<Checked[]>(() => (pages ?? []).map((page) => {
    const measure = (code: string | null) => {
      const title = pickLanguage(page.value.titel, code);
      const description = pickLanguage(page.value.omschrijving, code);
      const photo = page.value.foto || null;
      return { title, description, photo, light: seoLight({ title, description, photo }) };
    };
    const shown = measure(shownLanguage);
    const lights = languages.length > 1 ? languages.map((code) => ({ language: code, light: measure(code).light })) : [];
    const problems = seoTips(shown, t).filter((tip) => !tip.ok).map((tip) => tip.text);
    const suffix = languages.length > 0 && shownLanguage ? `.${shownLanguage}` : "";
    // Jump to the first thing that needs work.
    const titleOk = shown.title.length >= 25 && shown.title.length <= 60;
    const jumpTo = !shown.title ? `${page.field}.titel${suffix}`
      : !shown.description ? `${page.field}.omschrijving${suffix}`
      : !titleOk ? `${page.field}.titel${suffix}`
      : shown.light === "orange" && shown.photo ? `${page.field}.omschrijving${suffix}`
      : shown.light === "orange" ? `${page.field}.foto`
      : `${page.field}.titel${suffix}`;
    return { page, ...shown, lights, problems, jumpTo };
  }), [languages, pages, shownLanguage]);

  const counts = useMemo(() => {
    const result: Record<SeoLight, number> = { green: 0, orange: 0, red: 0 };
    for (const item of checked) result[item.light] += 1;
    return result;
  }, [checked]);

  const groups = useMemo(() => {
    const list: { label: string; items: Checked[] }[] = [];
    for (const item of checked) {
      if (filter && item.light !== filter) continue;
      const label = item.page.type === "collection" ? item.page.entryLabel : t("Pages");
      let group = list.find((entry) => entry.label === label);
      if (!group) list.push(group = { label, items: [] });
      group.items.push(item);
    }
    return list;
  }, [checked, filter]);

  const editHref = (item: Checked) => {
    const query = `?field=${encodeURIComponent(item.jumpTo)}`;
    return item.page.type === "file"
      ? `${base}/file/${encodeURIComponent(item.page.entry)}${query}`
      : `${base}/collection/${encodeURIComponent(item.page.entry)}/edit/${encodeURIComponent(item.page.path)}${query}`;
  };

  if (!config) return null;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 py-2 md:py-6">
      <div className="space-y-1.5">
        <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">{t("Your pages in Google")}</h2>
        <p className="text-muted-foreground">
          {t("This is how every page shows up when someone searches. Tap a page to change its title, description or share photo.")}
        </p>
      </div>

      {pages && pages.length > 0 && (
        <div className="space-y-3">
          {languages.length > 1 && (
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t("Language")}>
              <span className="text-sm text-muted-foreground">{t("Language")}:</span>
              {languages.map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLanguage(code)}
                  aria-pressed={code === shownLanguage}
                  className={cn(
                    "h-9 rounded-full border px-4 text-sm font-medium transition",
                    code === shownLanguage ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent",
                  )}
                >
                  {languageName(code, t)}
                </button>
              ))}
            </div>
          )}
          <div className="grid grid-cols-3 gap-2" role="group" aria-label={t("Show")}>
            {(["green", "orange", "red"] as SeoLight[]).map((light) => (
              <button
                key={light}
                type="button"
                onClick={() => setFilter(filter === light ? null : light)}
                aria-pressed={filter === light}
                className={cn(
                  "flex flex-col items-start gap-1 rounded-xl border bg-card p-3 text-left transition hover:bg-accent",
                  filter === light && "border-primary ring-2 ring-primary/30",
                )}
              >
                <span className="flex items-center gap-2 text-2xl font-semibold tabular-nums">
                  <Light light={light} className="size-3" />
                  {counts[light]}
                </span>
                <span className="text-xs leading-tight text-muted-foreground sm:text-sm">{t(LIGHT_STYLE[light].label)}</span>
              </button>
            ))}
          </div>
          {filter && (
            <button type="button" onClick={() => setFilter(null)} className="text-sm font-medium text-primary hover:underline">
              {t("Show all pages")}
            </button>
          )}
        </div>
      )}

      {!pages && !error && (
        <div className="space-y-3">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      )}

      {error && (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed p-5">
          <p className="text-sm">{error}</p>
          <button type="button" onClick={load} disabled={loading} className="inline-flex h-10 items-center gap-2 rounded-full border bg-card px-4 text-sm font-medium hover:bg-accent">
            <RefreshCw className={cn("size-4", loading && "animate-spin")} /> {t("Try again")}
          </button>
        </div>
      )}

      {pages && pages.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center">
          <Search className="size-8 text-muted-foreground" />
          <p className="font-medium">{t("No pages with Google settings yet.")}</p>
          <p className="text-sm text-muted-foreground">{t("Ask your web designer to add them.")}</p>
        </div>
      )}

      {pages && pages.length > 0 && groups.length === 0 && (
        <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">{t("No pages with this colour.")}</p>
      )}

      {groups.map((group) => (
        <section key={group.label} className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{group.label}</h3>
          <ul className="space-y-3">
            {group.items.map((item) => (
              <li key={item.page.path}>
                <Link
                  href={editHref(item)}
                  className="group block rounded-xl border bg-card p-3 shadow-xs transition hover:border-primary/50 hover:shadow-md sm:p-4"
                  aria-label={t("Change Google settings of {name}", { name: item.page.name })}
                >
                  <div className="flex items-center gap-3">
                    <Light light={item.light} className="size-3" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base font-semibold">{item.page.name}</span>
                    </span>
                    <span className={cn("hidden shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium sm:inline", LIGHT_STYLE[item.light].chip)}>
                      {t(LIGHT_STYLE[item.light].label)}
                    </span>
                    <span className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-primary px-3.5 text-sm font-medium text-primary-foreground transition group-hover:bg-primary/90">
                      <Pencil className="size-3.5" />
                      {t("Change")}
                    </span>
                  </div>

                  <div className="mt-3 flex gap-3">
                    <GoogleSnippet
                      className="min-w-0 flex-1 border"
                      siteName={siteName}
                      host={host}
                      title={item.title || (item.page.type === "file" ? siteName : item.page.name)}
                      description={item.description}
                    />
                    <div className="hidden w-28 shrink-0 flex-col gap-1 sm:flex">
                      <span className="text-xs text-muted-foreground">{t("Share photo")}</span>
                      {item.photo && (item.page.media || defaultMedia) ? (
                        <Thumbnail name={(item.page.media || defaultMedia)!} path={item.photo} className="h-20 w-28 rounded-md" />
                      ) : (
                        <span className="flex h-20 w-28 items-center justify-center rounded-md border border-dashed text-muted-foreground">
                          <ImageOff className="size-5" />
                        </span>
                      )}
                    </div>
                  </div>

                  {(item.problems.length > 0 || item.lights.length > 0) && (
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                      <ul className="space-y-1 text-sm">
                        {item.problems.slice(0, 2).map((problem) => (
                          <li key={problem} className="flex items-start gap-2">
                            <CircleAlert className={cn("mt-0.5 size-4 shrink-0", item.light === "red" ? "text-red-500" : "text-amber-500")} />
                            <span>{problem}</span>
                          </li>
                        ))}
                        {item.problems.length > 2 && (
                          <li className="flex items-center gap-1 pl-6 text-muted-foreground">
                            {t("and {count} more", { count: item.problems.length - 2 })} <ChevronRight className="size-3.5" />
                          </li>
                        )}
                      </ul>
                      {item.lights.length > 0 && (
                        <span className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                          {item.lights.map(({ language: code, light }) => (
                            <span key={code} className="inline-flex items-center gap-1.5 uppercase">
                              <Light light={light} /> {code}
                            </span>
                          ))}
                        </span>
                      )}
                    </div>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {pages && pages.length > 0 && (
        <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{t("Tip:")}</span>{" "}
          {t("Google takes a few days to a few weeks to show a change. You can always find these settings on the page itself too, under \"Google and sharing\".")}
        </p>
      )}
    </div>
  );
}
