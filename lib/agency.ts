import "server-only";

/**
 * Webstudio: the agency dashboard ("Klanten"), only for Jorrit (ADMIN_EMAILS).
 *
 * listSites() is fast (database only). checkSite() does the slow checks for
 * one site: GitHub (last change, did the last build work), the website itself
 * (online, https) and DNS (domain, mail records), so the page can show the
 * list right away and fill in each site's checks as they come back.
 */

import { inArray, max, sql } from "drizzle-orm";
import { db } from "@/db";
import { collaboratorTable, configTable, sessionTable, userTable } from "@/db/schema";
import { getLatestActivityPerSite } from "@/lib/activity";
import type { ActivityEntry } from "@/lib/activity-shared";
import { getSiteUrl } from "@/lib/deploy-watch";
import { getAllSiteSettings, getSiteSettings, normalizeSiteUrl } from "@/lib/site-settings";
import { getSiteStats } from "@/lib/stats";
import { getInstallationToken } from "@/lib/token";
import { createOctokitInstance } from "@/lib/utils/octokit";

export type AgencyClient = { email: string; name: string | null; lastSeen: string | null };

export type AgencySite = {
  owner: string;
  repo: string;
  clients: AgencyClient[];
  lastActivity: ActivityEntry | null;
  siteUrl: string | null;
  monthlyReport: boolean;
  /** Latest monthly report mail (filled in by the Klanten page). */
  lastReport?: { month: string; sentAt: string; recipients: string | null; error: string | null } | null;
};

export type BuildState = "success" | "failure" | "pending" | "none" | "unknown";

export type SiteCheck = {
  siteUrl: string | null;
  siteUrlSource: "setting" | "github" | "preview" | null;
  defaultBranch: string | null;
  lastCommit: { date: string; message: string; author: string | null } | null;
  build: BuildState;
  online: { ok: boolean; status: number | null; ms: number | null; error?: string } | null;
  https: { ok: boolean; httpRedirects: boolean | null } | null;
  domain: { host: string; own: boolean; resolves: boolean } | null;
  mail: { mx: string[]; spf: boolean; dmarc: boolean } | null;
  visitors30: number | null;
  errors: string[];
};

const key = (owner: string, repo: string) => `${owner.toLowerCase()}/${repo.toLowerCase()}`;

/** Every site the CMS knows (opened once, or with a client), with its clients. */
export const listSites = async (): Promise<AgencySite[]> => {
  const [configs, collaborators, settings, latest] = await Promise.all([
    db.selectDistinct({ owner: configTable.owner, repo: configTable.repo }).from(configTable),
    db.select({
      owner: collaboratorTable.owner,
      repo: collaboratorTable.repo,
      email: collaboratorTable.email,
      userId: collaboratorTable.userId,
    }).from(collaboratorTable),
    getAllSiteSettings(),
    getLatestActivityPerSite(),
  ]);

  const userIds = Array.from(new Set(collaborators.map((row) => row.userId).filter((id): id is string => Boolean(id))));
  const [users, sessions] = userIds.length
    ? await Promise.all([
      db.select({ id: userTable.id, name: userTable.name }).from(userTable).where(inArray(userTable.id, userIds)),
      db.select({ userId: sessionTable.userId, lastSeen: max(sessionTable.updatedAt) })
        .from(sessionTable).where(inArray(sessionTable.userId, userIds)).groupBy(sessionTable.userId),
    ])
    : [[], []];
  const lastSeenById = new Map(sessions.map((row) => [row.userId, row.lastSeen]));
  const userById = new Map(users.map((user) => [user.id, user]));

  const sites = new Map<string, AgencySite>();
  const ensure = (owner: string, repo: string) => {
    const id = key(owner, repo);
    let site = sites.get(id);
    if (!site) {
      const setting = settings.get(id) ?? {};
      site = {
        owner,
        repo,
        clients: [],
        lastActivity: latest.get(id) ?? null,
        siteUrl: normalizeSiteUrl(setting.siteUrl),
        monthlyReport: setting.monthlyReport !== false,
      };
      sites.set(id, site);
    }
    return site;
  };

  for (const row of configs) ensure(row.owner, row.repo);
  for (const row of collaborators) {
    const site = ensure(row.owner, row.repo);
    if (site.clients.some((client) => client.email.toLowerCase() === row.email.toLowerCase())) continue;
    const user = row.userId ? userById.get(row.userId) : undefined;
    const seen = row.userId ? lastSeenById.get(row.userId) : null;
    const lastSeen = seen ? new Date(seen) : null;
    site.clients.push({
      email: row.email,
      name: user?.name && !user.name.includes("@") ? user.name : null,
      lastSeen: lastSeen && !Number.isNaN(lastSeen.getTime()) ? lastSeen.toISOString() : null,
    });
  }

  return Array.from(sites.values()).sort((a, b) => {
    // Sites with clients first, then by name.
    if ((a.clients.length > 0) !== (b.clients.length > 0)) return a.clients.length > 0 ? -1 : 1;
    return a.repo.localeCompare(b.repo);
  });
};

const withTimeout = async <T,>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => { timer = setTimeout(() => reject(new Error(`${label} took too long`)), ms); }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

/** Answers of a DNS lookup through Cloudflare's public DNS-over-HTTPS. */
const dns = async (name: string, type: "A" | "AAAA" | "CNAME" | "MX" | "TXT"): Promise<string[]> => {
  const response = await withTimeout(fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`, {
    headers: { accept: "application/dns-json" },
    cache: "no-store",
  }), 5000, "DNS");
  if (!response.ok) throw new Error(`DNS ${response.status}`);
  const payload: any = await response.json();
  return (payload?.Answer ?? [])
    .filter((answer: any) => typeof answer?.data === "string")
    .map((answer: any) => String(answer.data).replace(/^"|"$/g, "").replace(/" "/g, ""));
};

/** Hosts that are not the client's own domain (no own mail to check there). */
const SHARED_HOSTS = /\.(pages\.dev|workers\.dev|netlify\.app|vercel\.app|github\.io)$/i;

/** "www.kreativmitblumen.de" -> "kreativmitblumen.de" (good enough for the domains we host). */
const mailDomain = (host: string) => host.replace(/^www\./i, "");

const buildState = async (octokit: ReturnType<typeof createOctokitInstance>, owner: string, repo: string, sha: string): Promise<BuildState> => {
  const states: string[] = [];
  try {
    const { data } = await octokit.rest.checks.listForRef({ owner, repo, ref: sha, per_page: 50 });
    for (const run of data.check_runs) {
      if (run.status !== "completed") states.push("pending");
      else if (["success", "neutral", "skipped"].includes(run.conclusion ?? "")) states.push("success");
      else states.push("failure");
    }
  } catch (error: any) {
    if (error?.status !== 403 && error?.status !== 404) throw error;
  }
  try {
    const { data } = await octokit.rest.repos.getCombinedStatusForRef({ owner, repo, ref: sha });
    for (const status of data.statuses) {
      if (status.state === "pending") states.push("pending");
      else if (status.state === "success") states.push("success");
      else states.push("failure");
    }
  } catch (error: any) {
    if (error?.status !== 403 && error?.status !== 404) throw error;
  }
  if (states.length === 0) return "none";
  if (states.includes("pending")) return "pending";
  return states.includes("failure") ? "failure" : "success";
};

const checkWebsite = async (siteUrl: string) => {
  const started = Date.now();
  try {
    const response = await withTimeout(fetch(siteUrl, {
      redirect: "follow",
      cache: "no-store",
      headers: { "user-agent": "Mozilla/5.0 (compatible; WebstudioCheck/1.0)" },
    }), 10_000, "Website");
    return { ok: response.ok, status: response.status, ms: Date.now() - started, finalUrl: response.url || siteUrl };
  } catch (error: any) {
    return { ok: false, status: null, ms: null, error: String(error?.message || error), finalUrl: siteUrl };
  }
};

const checkHttpRedirect = async (host: string) => {
  try {
    const response = await withTimeout(fetch(`http://${host}/`, { redirect: "manual", cache: "no-store" }), 6000, "http");
    const location = response.headers.get("location") || "";
    return response.status >= 300 && response.status < 400 && location.startsWith("https://");
  } catch {
    return null;
  }
};

export const checkSite = async (owner: string, repo: string): Promise<SiteCheck> => {
  const errors: string[] = [];
  const result: SiteCheck = {
    siteUrl: null,
    siteUrlSource: null,
    defaultBranch: null,
    lastCommit: null,
    build: "unknown",
    online: null,
    https: null,
    domain: null,
    mail: null,
    visitors30: null,
    errors,
  };

  const settings = await getSiteSettings(owner, repo);
  const fromSetting = normalizeSiteUrl(settings.siteUrl);
  if (fromSetting) {
    result.siteUrl = fromSetting;
    result.siteUrlSource = "setting";
  }

  // GitHub: default branch, last change and whether its build worked.
  try {
    const token = await getInstallationToken(owner, repo);
    const octokit = createOctokitInstance(token);
    const { data: repoData } = await octokit.rest.repos.get({ owner, repo });
    result.defaultBranch = repoData.default_branch;
    if (!result.siteUrl) {
      const homepage = normalizeSiteUrl(repoData.homepage);
      if (homepage) {
        result.siteUrl = homepage;
        result.siteUrlSource = "github";
      }
    }
    const { data: commits } = await octokit.rest.repos.listCommits({ owner, repo, sha: repoData.default_branch, per_page: 1 });
    const commit = commits[0];
    if (commit) {
      result.lastCommit = {
        date: commit.commit.committer?.date || commit.commit.author?.date || "",
        message: (commit.commit.message || "").split("\n")[0].slice(0, 140),
        author: commit.commit.author?.name || commit.author?.login || null,
      };
      result.build = await buildState(octokit, owner, repo, commit.sha);
    }
  } catch (error: any) {
    errors.push(`GitHub: ${error?.message || error}`);
  }

  // Fall back to the preview address in .pages.yml.
  if (!result.siteUrl) {
    try {
      const row = await db.query.configTable.findFirst({
        where: sql`lower(${configTable.owner}) = lower(${owner}) and lower(${configTable.repo}) = lower(${repo})`,
      });
      const fromPreview = row ? getSiteUrl(JSON.parse(row.object)) : null;
      if (fromPreview) {
        result.siteUrl = fromPreview;
        result.siteUrlSource = "preview";
      }
    } catch {
      // No usable config.
    }
  }

  const tasks: Promise<unknown>[] = [];

  tasks.push(getSiteStats(owner, repo, 30)
    .then((stats) => { result.visitors30 = stats.visitors; })
    .catch((error) => { errors.push(`Bezoekers: ${error?.message || error}`); }));

  if (result.siteUrl) {
    const host = new URL(result.siteUrl).hostname;
    const own = !SHARED_HOSTS.test(host);

    tasks.push(checkWebsite(result.siteUrl).then(async (online) => {
      result.online = { ok: online.ok, status: online.status, ms: online.ms, ...(online.error ? { error: online.error } : {}) };
      const finalHttps = online.finalUrl.startsWith("https://");
      result.https = { ok: online.ok && finalHttps, httpRedirects: await checkHttpRedirect(host) };
    }));

    tasks.push((async () => {
      try {
        const [a, aaaa, cname] = await Promise.all([dns(host, "A"), dns(host, "AAAA"), dns(host, "CNAME")]);
        result.domain = { host, own, resolves: a.length + aaaa.length + cname.length > 0 };
      } catch (error: any) {
        result.domain = { host, own, resolves: false };
        errors.push(`DNS: ${error?.message || error}`);
      }
      if (!own) return;
      try {
        const domain = mailDomain(host);
        const [mx, txt, dmarc] = await Promise.all([dns(domain, "MX"), dns(domain, "TXT"), dns(`_dmarc.${domain}`, "TXT")]);
        result.mail = {
          mx: mx.map((record) => record.split(/\s+/).pop()?.replace(/\.$/, "") || record).filter(Boolean),
          spf: txt.some((record) => record.toLowerCase().startsWith("v=spf1")),
          dmarc: dmarc.some((record) => record.toLowerCase().startsWith("v=dmarc1")),
        };
      } catch (error: any) {
        errors.push(`Mail: ${error?.message || error}`);
      }
    })());
  }

  await Promise.all(tasks);
  return result;
};
