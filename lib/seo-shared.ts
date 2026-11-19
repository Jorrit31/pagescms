/**
 * Webstudio: the checks behind the "Google en delen" card on a page and the
 * "Google" overview of all pages. Shared by the browser and the server.
 *
 * A page has Google settings when one of its top-level fields is an object
 * with `options: { seo: true }` and sub-fields `titel`, `omschrijving`, `foto`.
 * Titles and descriptions can be plain text or one text per language
 * (`{ nl: "...", de: "..." }`).
 */

export type SeoTip = { ok: boolean; text: string };

/** green: all good, orange: could be better, red: something important is empty. */
export type SeoLight = "green" | "orange" | "red";

/** The `seo: true` object field of a content entry, if it has one. */
export const findSeoField = (fields: any[] | undefined): any | null =>
  (Array.isArray(fields) ? fields : []).find(
    (field: any) => field?.type === "object" && !field?.list && field?.options?.seo,
  ) ?? null;

export const siteDeclaresSeo = (configObject: any): boolean =>
  (Array.isArray(configObject?.content) ? configObject.content : []).some((item: any) => findSeoField(item?.fields));

/** The languages a value is written in, e.g. ["nl", "de"]; [] for plain text. */
export const textLanguages = (...parts: any[]): string[] => {
  const keys: string[] = [];
  for (const part of parts) {
    if (part && typeof part === "object" && !Array.isArray(part)) {
      for (const key of Object.keys(part)) if (!keys.includes(key)) keys.push(key);
    }
  }
  return keys;
};

/** One language of a text that may be plain or per language. */
export const pickLanguage = (part: any, language?: string | null): string => {
  if (part && typeof part === "object" && !Array.isArray(part)) {
    const value = language ? part[language] : Object.values(part)[0];
    return typeof value === "string" ? value.trim() : "";
  }
  return typeof part === "string" ? part.trim() : "";
};

/** Same limits Google uses (roughly). */
export const SEO_TITLE_MAX = 60;
export const SEO_DESCRIPTION_MAX = 160;

/**
 * The checks, in plain words. `translate` is the interface's t(); kept as a
 * parameter so this file has no browser-only imports.
 */
export const seoTips = (
  { title, description, photo }: { title: string; description: string; photo: string | null },
  translate: (text: string) => string,
): SeoTip[] => {
  const list: SeoTip[] = [];
  if (!title) list.push({ ok: false, text: translate("Fill in a title: what someone would search for, e.g. \"Wedding flowers in Venlo\".") });
  else if (title.length < 25) list.push({ ok: false, text: translate("The title is short. Add where you are or what you do.") });
  else if (title.length > SEO_TITLE_MAX) list.push({ ok: false, text: translate("The title is long; Google cuts it off after about 60 letters.") });
  else list.push({ ok: true, text: translate("Good title length.") });

  if (!description) list.push({ ok: false, text: translate("Fill in a description: one or two sentences that make people click.") });
  else if (description.length < 70) list.push({ ok: false, text: translate("The description is short. Tell a bit more.") });
  else if (description.length > SEO_DESCRIPTION_MAX) list.push({ ok: false, text: translate("The description is long; Google shows about 155 letters.") });
  else list.push({ ok: true, text: translate("Good description length.") });

  list.push(photo
    ? { ok: true, text: translate("There is a share photo for WhatsApp and Facebook.") }
    : { ok: false, text: translate("Pick a share photo: it shows when someone shares this page on WhatsApp or Facebook.") });
  return list;
};

export const seoLight = ({ title, description, photo }: { title: string; description: string; photo: string | null }): SeoLight => {
  if (!title || !description) return "red";
  const titleOk = title.length >= 25 && title.length <= SEO_TITLE_MAX;
  const descriptionOk = description.length >= 70 && description.length <= SEO_DESCRIPTION_MAX;
  return titleOk && descriptionOk && photo ? "green" : "orange";
};

/** The website's address, taken from a `preview:` URL in .pages.yml. */
export const siteHostFromConfig = (configObject: any): string | null => {
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

/** One page as the "Google" overview gets it from the server. */
export type SeoOverviewPage = {
  /** content entry name in .pages.yml, e.g. "home" or "paginas" */
  entry: string;
  /** label of that entry, e.g. "Pagina's" */
  entryLabel: string;
  type: "file" | "collection";
  /** file path, e.g. content/paginas/over-ons.json */
  path: string;
  /** the page's own name, e.g. "Homepage" or "Over ons" */
  name: string;
  /** name of the seo field, usually "seo" */
  field: string;
  /** media folder for the share photo */
  media?: string;
  value: { titel?: any; omschrijving?: any; foto?: string | null };
};

export const languageName = (language: string, translate: (text: string) => string): string => {
  const names: Record<string, string> = {
    nl: "Dutch", de: "German", en: "English", fr: "French", es: "Spanish", it: "Italian", pl: "Polish", tr: "Turkish",
  };
  return names[language] ? translate(names[language]) : language.toUpperCase();
};
