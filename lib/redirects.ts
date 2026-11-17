/**
 * Webstudio: automatic redirects on clients' websites.
 *
 * When someone renames or deletes a page in the CMS, the old web address would
 * give a "page not found" (also for Google and links people shared). If the
 * site declares a redirects file in .pages.yml:
 *
 *   redirects: content/doorverwijzingen.json
 *
 * we note the move in that file, under "automatisch":
 *
 *   { "lijst": [ { "van": "/oud/", "naar": "/nieuw/" } ],          <- made by hand in the CMS
 *     "automatisch": [ { "van": "content/paginas/oud.json", "naar": "content/paginas/nieuw.json" } ] }
 *
 * "naar" is empty for a deleted page. The site's build.js turns the file paths
 * into web addresses (only the site knows its addresses) and writes _redirects.
 */

import { createOctokitInstance } from "@/lib/utils/octokit";

type Entry = { van: string; naar: string; datum?: string };

export const getRedirectsFile = (configObject: any): string | null => {
  const value = configObject?.redirects;
  if (typeof value !== "string") return null;
  const path = value.trim().replace(/^\/+/, "");
  return /^[\w./-]+\.json$/.test(path) && !path.includes("..") ? path : null;
};

/** Adds one move to the list, folding chains (a -> b, b -> c becomes a -> c). */
export const addMove = (list: Entry[], from: string, to: string | null, date: string): Entry[] => {
  const naar = to ?? "";
  const next = list
    // Renamed back to an old name: that old name is a page again.
    .filter((entry) => entry.van !== naar || !naar)
    .filter((entry) => entry.van !== from)
    .map((entry) => (entry.naar === from ? { ...entry, naar } : entry));
  next.push({ van: from, naar, datum: date });
  return next;
};

/**
 * Best effort: never fails the rename or delete itself. Makes a small extra
 * commit on the same branch.
 */
export const recordMove = async ({
  token,
  owner,
  repo,
  branch,
  configObject,
  from,
  to,
  committer,
}: {
  token: string;
  owner: string;
  repo: string;
  branch: string;
  configObject: any;
  from: string;
  to: string | null;
  committer?: { name: string; email: string };
}) => {
  const file = getRedirectsFile(configObject);
  if (!file || from === file || to === file) return;
  const octokit = createOctokitInstance(token);

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      let sha: string | undefined;
      let data: any = {};
      try {
        const { data: existing } = await octokit.rest.repos.getContent({ owner, repo, path: file, ref: branch });
        if (!Array.isArray(existing) && existing.type === "file") {
          sha = existing.sha;
          data = JSON.parse(Buffer.from(existing.content, "base64").toString("utf8") || "{}");
        }
      } catch (error: any) {
        if (error?.status !== 404) throw error;
      }
      if (!data || typeof data !== "object" || Array.isArray(data)) data = {};
      const list: Entry[] = Array.isArray(data.automatisch)
        ? data.automatisch.filter((entry: any) => entry && typeof entry.van === "string")
        : [];
      data.automatisch = addMove(list, from, to, new Date().toISOString().slice(0, 10));
      if (!Array.isArray(data.lijst)) data.lijst = [];

      await octokit.rest.repos.createOrUpdateFileContents({
        owner,
        repo,
        branch,
        path: file,
        sha,
        message: to ? `Doorverwijzing: ${from} -> ${to}` : `Doorverwijzing: ${from} verwijderd`,
        content: Buffer.from(`${JSON.stringify(data, null, 2)}\n`, "utf8").toString("base64"),
        committer,
      });
      return;
    } catch (error: any) {
      // 409/422: the branch moved on between reading and writing; try again.
      if (attempt < 2 && (error?.status === 409 || error?.status === 422)) continue;
      console.error("Recording redirect failed", error);
      return;
    }
  }
};
