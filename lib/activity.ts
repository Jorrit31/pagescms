import "server-only";

/**
 * Webstudio: writes and reads the "Logboek" (activity_log).
 *
 * The save, delete, rename and publish routes call logActivity() after the
 * change is on GitHub. Logging never breaks a save: errors are only printed.
 */

import { and, desc, gte, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { activityLogTable } from "@/db/schema";
import type { ActivityAction, ActivityEntry } from "@/lib/activity-shared";
import type { User } from "@/types/user";

export { ACTIVITY_PERMISSION } from "@/lib/activity-shared";

const KEEP_DAYS = 400;

const clip = (value: unknown, max = 200) => {
  if (typeof value !== "string") return null;
  const text = value.replace(/\s+/g, " ").trim();
  return text ? text.slice(0, max) : null;
};

/** "content/nieuws/2026-11-14-kerstbrood.json" -> "2026 11 14 kerstbrood" -> readable fallback. */
const fileTitle = (path?: string | null) => {
  if (!path) return null;
  const base = path.split("/").pop() || "";
  const name = base.replace(/\.[^.]+$/, "").replace(/^\d{4}-\d{2}-\d{2}-/, "").replace(/[-_]+/g, " ").trim();
  return name ? name.charAt(0).toUpperCase() + name.slice(1) : null;
};

/** Title of an entry from its content, for collections ("Kerstbrood"). */
export const entryTitle = (content: any, path?: string | null) => {
  if (content && typeof content === "object" && !Array.isArray(content)) {
    for (const key of ["title", "titel", "name", "naam", "heading", "kop"]) {
      const value = clip(content[key], 120);
      if (value) return value;
    }
  }
  return fileTitle(path);
};

type LogInput = {
  owner: string;
  repo: string;
  branch: string;
  user: Pick<User, "id" | "name" | "email">;
  action: ActivityAction;
  label?: string | null;
  title?: string | null;
  path?: string | null;
};

export const logActivity = async (input: LogInput) => {
  // Empty folders are made with a hidden .gitkeep file: not something to report.
  if (input.path?.endsWith(".gitkeep")) return;
  try {
    await db.insert(activityLogTable).values({
      owner: input.owner,
      repo: input.repo,
      branch: input.branch,
      userId: input.user.id ? String(input.user.id) : null,
      userName: clip(input.user.name, 120),
      userEmail: clip(input.user.email, 200),
      action: input.action,
      label: clip(input.label, 120),
      title: clip(input.title, 160),
      path: clip(input.path, 300),
    });
    // Now and then, forget entries older than about a year.
    if (Math.random() < 0.02) {
      await db.delete(activityLogTable).where(lt(activityLogTable.createdAt, new Date(Date.now() - KEEP_DAYS * 86_400_000)));
    }
  } catch (error) {
    console.error("Could not write to the activity log:", error);
  }
};

/** Label of a content or media type from the site's config ("Openingstijden"). */
export const schemaLabel = (schema: any, fallback?: string | null) => {
  const label = clip(schema?.label, 120);
  return label || clip(fallback, 120);
};

const forSite = (owner: string, repo: string) => and(
  sql`lower(${activityLogTable.owner}) = lower(${owner})`,
  sql`lower(${activityLogTable.repo}) = lower(${repo})`,
);

const toEntry = (row: typeof activityLogTable.$inferSelect): ActivityEntry => ({
  id: row.id,
  branch: row.branch,
  userName: row.userName,
  userEmail: row.userEmail,
  action: row.action,
  label: row.label,
  title: row.title,
  path: row.path,
  createdAt: row.createdAt.toISOString(),
});

/** Newest first. `before` is an id, for "Show more". */
export const getActivity = async (owner: string, repo: string, options: { limit?: number; before?: number; since?: Date; until?: Date } = {}) => {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 500);
  const rows = await db
    .select()
    .from(activityLogTable)
    .where(and(
      forSite(owner, repo),
      options.before ? lt(activityLogTable.id, options.before) : undefined,
      options.since ? gte(activityLogTable.createdAt, options.since) : undefined,
      options.until ? lt(activityLogTable.createdAt, options.until) : undefined,
    ))
    .orderBy(desc(activityLogTable.createdAt), desc(activityLogTable.id))
    .limit(limit);
  return rows.map(toEntry);
};

/** Latest entry of every site, for the agency dashboard. Keyed "owner/repo" in lower case. */
export const getLatestActivityPerSite = async () => {
  const rows = await db.execute(sql`
    select distinct on (lower(owner), lower(repo)) *
    from activity_log
    order by lower(owner), lower(repo), created_at desc
  `);
  const result = new Map<string, ActivityEntry>();
  for (const row of (rows as any).rows ?? rows as any[]) {
    result.set(`${String(row.owner).toLowerCase()}/${String(row.repo).toLowerCase()}`, {
      id: row.id,
      branch: row.branch,
      userName: row.user_name,
      userEmail: row.user_email,
      action: row.action,
      label: row.label,
      title: row.title,
      path: row.path,
      createdAt: new Date(row.created_at).toISOString(),
    });
  }
  return result;
};
