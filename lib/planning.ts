/**
 * Webstudio: rebuild a client's website when something planned goes online or
 * offline (see lib/planning-shared.ts for the field itself).
 *
 * 1. Every push to the default branch (CMS saves too) is scanned: the future
 *    "Online vanaf" / "Offline na" times per file land in site_setting.data.planning.
 * 2. Every few minutes a Cloudflare Cron (custom-worker.js) calls
 *    /api/cron/planning, which rebuilds each site with a time that has passed.
 *    Rebuild = an empty commit on the default branch, so Cloudflare Pages
 *    builds again; build.js then leaves out what is no longer (or not yet) online.
 */

import { and, sql } from "drizzle-orm";
import { db } from "@/db";
import { siteSettingTable } from "@/db/schema";
import { parse } from "@/lib/serialization";
import { getInstallationToken } from "@/lib/token";
import { createOctokitInstance } from "@/lib/utils/octokit";
import { upcomingPlanningTimes } from "@/lib/planning-shared";

/** path -> ISO times (future, sorted). */
type PlanningIndex = Record<string, string[]>;

const CONTENT_FILE = /\.(json|ya?ml|md|markdown|mdx)$/i;
const MAX_FILES_PER_PUSH = 40;
const MAX_TIMES_PER_FILE = 20;

const siteWhere = (owner: string, repo: string) => and(
  sql`lower(${siteSettingTable.owner}) = lower(${owner})`,
  sql`lower(${siteSettingTable.repo}) = lower(${repo})`,
);

const readIndex = (data: unknown): PlanningIndex => {
  const value = (data as any)?.planning;
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const index: PlanningIndex = {};
  for (const [path, times] of Object.entries(value as Record<string, unknown>)) {
    if (Array.isArray(times)) index[path] = times.filter((time): time is string => typeof time === "string");
  }
  return index;
};

/** Writes only the "planning" key, so other settings in the row stay as they are. */
const writeIndex = async (owner: string, repo: string, index: PlanningIndex) => {
  const existing = await db.query.siteSettingTable.findFirst({ where: siteWhere(owner, repo) });
  if (!existing) {
    if (!Object.keys(index).length) return;
    await db.insert(siteSettingTable).values({ owner, repo, data: { planning: index } });
    return;
  }
  const value = JSON.stringify(index);
  await db.update(siteSettingTable)
    .set({
      data: Object.keys(index).length
        ? sql`jsonb_set(coalesce(${siteSettingTable.data}, '{}'::jsonb), '{planning}', ${value}::jsonb)`
        : sql`coalesce(${siteSettingTable.data}, '{}'::jsonb) - 'planning'`,
      updatedAt: new Date(),
    })
    .where(sql`${siteSettingTable.id} = ${existing.id}`);
};

const formatFor = (path: string) => {
  if (/\.json$/i.test(path)) return { format: "json" as const };
  if (/\.ya?ml$/i.test(path)) return { format: "yaml" as const };
  return { format: "yaml-frontmatter" as const };
};

/** Called for every push (lib/github-webhook-push.ts). Never throws. */
export const trackPlanningFromPush = async (data: any) => {
  try {
    const owner = data?.repository?.owner?.login;
    const repo = data?.repository?.name;
    const branch = String(data?.ref || "").replace("refs/heads/", "");
    const defaultBranch = data?.repository?.default_branch;
    // Only the live website counts. A concept branch is scanned when it is put online (merged).
    if (!owner || !repo || !branch || data?.deleted || (defaultBranch && branch !== defaultBranch)) return;

    const changed = new Set<string>();
    const removed = new Set<string>();
    for (const commit of Array.isArray(data.commits) ? data.commits : []) {
      for (const path of [...(commit.added || []), ...(commit.modified || [])]) { changed.add(path); removed.delete(path); }
      for (const path of commit.removed || []) { removed.add(path); changed.delete(path); }
    }
    const files = [...changed].filter((path) => CONTENT_FILE.test(path) && path !== ".pages.yml");
    const gone = [...removed].filter((path) => CONTENT_FILE.test(path));
    if (!files.length && !gone.length) return;

    const existing = await db.query.siteSettingTable.findFirst({ where: siteWhere(owner, repo) });
    const index = readIndex(existing?.data);
    const before = JSON.stringify(index);
    for (const path of gone) delete index[path];

    if (files.length) {
      const octokit = createOctokitInstance(await getInstallationToken(owner, repo));
      for (const path of files.slice(0, MAX_FILES_PER_PUSH)) {
        try {
          const response = await octokit.rest.repos.getContent({ owner, repo, path, ref: data.after || branch });
          if (Array.isArray(response.data) || response.data.type !== "file") continue;
          const text = Buffer.from((response.data as any).content || "", "base64").toString("utf8");
          // Cheap check first: most files have no planning at all.
          if (!/"?vanaf"?\s*:|"?tot"?\s*:/.test(text)) { delete index[path]; continue; }
          const times = upcomingPlanningTimes(parse(text, formatFor(path)));
          if (times.length) index[path] = times.slice(0, MAX_TIMES_PER_FILE).map((time) => time.toISOString());
          else delete index[path];
        } catch (error) {
          console.warn("Inplannen: kon bestand niet lezen", { owner, repo, path, error: (error as Error)?.message });
        }
      }
    }

    if (JSON.stringify(index) !== before) await writeIndex(owner, repo, index);
  } catch (error) {
    console.error("Inplannen: push niet verwerkt", error);
  }
};

/** Makes Cloudflare Pages build the live website again, without changing any file. */
const rebuildSite = async (owner: string, repo: string) => {
  const octokit = createOctokitInstance(await getInstallationToken(owner, repo));
  const { data: repository } = await octokit.rest.repos.get({ owner, repo });
  const branch = repository.default_branch;
  const { data: ref } = await octokit.rest.git.getRef({ owner, repo, ref: `heads/${branch}` });
  const { data: parent } = await octokit.rest.git.getCommit({ owner, repo, commit_sha: ref.object.sha });
  const { data: commit } = await octokit.rest.git.createCommit({
    owner,
    repo,
    message: "Ingepland: website bijgewerkt",
    tree: parent.tree.sha,
    parents: [parent.sha],
  });
  await octokit.rest.git.updateRef({ owner, repo, ref: `heads/${branch}`, sha: commit.sha });
};

/** Run by the cron. Rebuilds each site that has a planned time in the past. */
export const runPlanning = async (now = new Date()) => {
  const rows = await db.select().from(siteSettingTable).where(sql`${siteSettingTable.data} ? 'planning'`);
  const rebuilt: string[] = [];
  const failed: string[] = [];
  for (const row of rows) {
    const index = readIndex(row.data);
    const due = Object.values(index).some((times) => times.some((time) => Date.parse(time) <= now.getTime()));
    if (!due) continue;
    const site = `${row.owner}/${row.repo}`;
    try {
      await rebuildSite(row.owner, row.repo);
      rebuilt.push(site);
    } catch (error) {
      failed.push(site);
      console.error("Inplannen: herbouwen mislukt", { site, error: (error as Error)?.message });
      // Try again next time, but give up on times older than a day (repository gone, no access).
      const dayAgo = now.getTime() - 24 * 60 * 60 * 1000;
      const stale = Object.values(index).every((times) => times.every((time) => Date.parse(time) > now.getTime() || Date.parse(time) < dayAgo));
      if (!stale) continue;
    }
    const next: PlanningIndex = {};
    for (const [path, times] of Object.entries(index)) {
      const future = times.filter((time) => Date.parse(time) > now.getTime());
      if (future.length) next[path] = future;
    }
    await writeIndex(row.owner, row.repo, next);
  }
  return { rebuilt, failed };
};

