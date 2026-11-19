import "server-only";

/**
 * Webstudio: per-site settings Jorrit makes in the CMS (site_setting.data).
 * Other parts keep their own keys in the same row (forms: lib/forms.ts).
 */

import { and, sql } from "drizzle-orm";
import { db } from "@/db";
import { siteSettingTable } from "@/db/schema";

export type SiteSettings = {
  /** Address of the live website, e.g. https://kreativmitblumen.de */
  siteUrl?: string;
  /** Monthly report mail to the client; on unless set to false. */
  monthlyReport?: boolean;
  [key: string]: unknown;
};

const forSite = (owner: string, repo: string) => and(
  sql`lower(${siteSettingTable.owner}) = lower(${owner})`,
  sql`lower(${siteSettingTable.repo}) = lower(${repo})`,
);

export const getSiteSettings = async (owner: string, repo: string): Promise<SiteSettings> => {
  const row = await db.query.siteSettingTable.findFirst({ where: forSite(owner, repo) });
  return ((row?.data as SiteSettings) ?? {});
};

/** All sites' settings, keyed "owner/repo" in lower case. */
export const getAllSiteSettings = async () => {
  const rows = await db.select().from(siteSettingTable);
  return new Map(rows.map((row) => [`${row.owner.toLowerCase()}/${row.repo.toLowerCase()}`, (row.data as SiteSettings) ?? {}]));
};

/** Merges `changes` into the site's settings; other keys stay as they are. */
export const updateSiteSettings = async (owner: string, repo: string, changes: Partial<SiteSettings>) => {
  const existing = await db.query.siteSettingTable.findFirst({ where: forSite(owner, repo) });
  const data = { ...((existing?.data as SiteSettings) ?? {}), ...changes };
  for (const key of Object.keys(data)) if (data[key] === undefined) delete data[key];
  if (existing) {
    await db.update(siteSettingTable).set({ data, updatedAt: new Date() }).where(sql`${siteSettingTable.id} = ${existing.id}`);
  } else {
    await db.insert(siteSettingTable).values({ owner, repo, data });
  }
  return data;
};

/** "kreativmitblumen.de" or "https://kreativmitblumen.de/x" -> "https://kreativmitblumen.de"; null if not a web address. */
export const normalizeSiteUrl = (value: unknown) => {
  if (typeof value !== "string" || !value.trim()) return null;
  const text = value.trim();
  try {
    const url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
    if (!url.hostname.includes(".")) return null;
    return url.origin;
  } catch {
    return null;
  }
};
