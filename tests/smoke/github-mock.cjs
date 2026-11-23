/* Webstudio smoke tests: a fake GitHub for the CMS.
 *
 * Loaded with NODE_OPTIONS="--require ./tests/smoke/github-mock.cjs" before
 * `next start`. Every fetch to api.github.com is answered from a local folder
 * (SMOKE_SITE_DIR, a copy of tests/smoke/site) instead of the real GitHub, so the
 * whole CMS (sign-in, open, edit, save, photos) can be tested without accounts.
 * Saves are written into that folder, so a test can check the file afterwards.
 * Everything else (the local database, the preview) goes through untouched.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const SITE = process.env.SMOKE_SITE_DIR;
const OWNER = process.env.SMOKE_OWNER || "webstudio";
const REPO = process.env.SMOKE_REPO || "testsite";
const BRANCH = "main";
const LOG = process.env.SMOKE_GITHUB_LOG === "1";
if (!SITE) throw new Error("SMOKE_SITE_DIR is not set");

const blobSha = (buffer) => crypto.createHash("sha1").update(`blob ${buffer.length}\0`).update(buffer).digest("hex");
const abs = (p) => path.join(SITE, String(p || "").replace(/^\/+/, ""));
const exists = (p) => { try { fs.statSync(abs(p)); return true; } catch { return false; } };
const isDir = (p) => { try { return fs.statSync(abs(p)).isDirectory(); } catch { return false; } };
let head = crypto.randomBytes(20).toString("hex");
const bump = () => { head = crypto.randomBytes(20).toString("hex"); return head; };

const json = (body, status = 200) => new Response(status === 204 ? null : JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "x-ratelimit-remaining": "5000" },
});
const repoData = () => ({
  id: 1, node_id: "R_1", name: REPO, full_name: `${OWNER}/${REPO}`, private: true,
  owner: { login: OWNER, id: 1, type: "User", avatar_url: "" },
  default_branch: BRANCH, permissions: { admin: true, push: true, pull: true }, homepage: null,
});
const contentItem = (p) => {
  const buffer = fs.readFileSync(abs(p));
  return {
    type: "file", name: path.basename(p), path: p, sha: blobSha(buffer), size: buffer.length,
    encoding: "base64", content: buffer.toString("base64"),
    download_url: `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${p}`,
  };
};
const dirItems = (p) => fs.readdirSync(abs(p), { withFileTypes: true }).map((d) => {
  const child = p ? `${p}/${d.name}` : d.name;
  if (d.isDirectory()) return { type: "dir", name: d.name, path: child, sha: blobSha(Buffer.from(child)), size: 0 };
  const buffer = fs.readFileSync(abs(child));
  return { type: "file", name: d.name, path: child, sha: blobSha(buffer), size: buffer.length, download_url: `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${child}` };
});
const gqlObject = (expression) => {
  const p = String(expression).replace(/^[^:]*:/, "").replace(/^\/+|\/+$/g, "");
  if (!exists(p)) return null;
  if (isDir(p)) {
    return {
      entries: fs.readdirSync(abs(p), { withFileTypes: true }).map((d) => {
        const child = p ? `${p}/${d.name}` : d.name;
        if (d.isDirectory()) return { name: d.name, path: child, type: "tree", object: {} };
        const buffer = fs.readFileSync(abs(child));
        return { name: d.name, path: child, type: "blob", object: { text: buffer.toString("utf8"), oid: blobSha(buffer), byteSize: buffer.length } };
      }),
    };
  }
  const buffer = fs.readFileSync(abs(p));
  return { text: buffer.toString("utf8"), oid: blobSha(buffer), byteSize: buffer.length };
};

const graphql = (body) => {
  const { query = "", variables = {} } = body || {};
  const repository = {};
  const re = /(\w+)\s*:\s*object\s*\(\s*expression\s*:\s*\$(\w+)\s*\)/g;
  let m;
  while ((m = re.exec(query))) repository[m[1]] = gqlObject(variables[m[2]]);
  const plain = /[{\s]object\s*\(\s*expression\s*:\s*\$(\w+)\s*\)/.exec(query);
  if (plain && !/\w+\s*:\s*object/.test(query.slice(Math.max(0, plain.index - 40), plain.index + 8))) repository.object = gqlObject(variables[plain[1]]);
  if (/\bref\s*\(/.test(query)) repository.ref = { target: { oid: head, committedDate: new Date().toISOString() } };
  if (/defaultBranchRef/.test(query)) repository.defaultBranchRef = { name: BRANCH, target: { oid: head } };
  return json({ data: { repository } });
};

const route = async (method, url, body, accept = "") => {
  const p = decodeURIComponent(url.pathname);
  const repoBase = `/repos/${OWNER}/${REPO}`.toLowerCase();
  const lower = p.toLowerCase();

  if (p === "/graphql") return graphql(body);
  if (/^\/app\/installations\/\d+\/access_tokens$/.test(p)) return json({ token: "ghs_smoketest", expires_at: new Date(Date.now() + 3600_000).toISOString() }, 201);
  if (p === "/app") return json({ id: 1, slug: "webstudio-smoke", name: "Webstudio smoke" });
  if (lower === `${repoBase}/installation`) return json({ id: 42, account: { login: OWNER } });
  if (lower === repoBase) return json(repoData());
  if (lower === `${repoBase}/branches`) return json([{ name: BRANCH, commit: { sha: head }, protected: false }]);
  if (lower.startsWith(`${repoBase}/branches/`)) {
    const name = p.split("/branches/")[1];
    if (name !== BRANCH) return json({ message: "Branch not found" }, 404);
    return json({ name: BRANCH, commit: { sha: head, commit: { committer: { date: new Date().toISOString() } } } });
  }
  if (lower.startsWith(`${repoBase}/git/ref/heads/`) || lower.startsWith(`${repoBase}/git/refs/heads/`)) {
    const name = p.split("/heads/")[1];
    if (name !== BRANCH) return json({ message: "Not Found" }, 404);
    return json({ ref: `refs/heads/${BRANCH}`, object: { sha: head, type: "commit" } });
  }
  if (lower.startsWith(`${repoBase}/contents`)) {
    const file = p.slice(`${repoBase}/contents`.length).replace(/^\/+/, "");
    if (method === "GET") {
      if (!exists(file)) return json({ message: "Not Found" }, 404);
      if (!isDir(file) && /raw/.test(accept)) return new Response(fs.readFileSync(abs(file)), { status: 200, headers: { "content-type": "application/vnd.github.raw" } });
      return json(isDir(file) ? dirItems(file) : contentItem(file));
    }
    if (method === "PUT") {
      const buffer = Buffer.from(body.content || "", "base64");
      if (exists(file) && !isDir(file) && body.sha && body.sha !== blobSha(fs.readFileSync(abs(file)))) return json({ message: "is at x but expected y" }, 409);
      fs.mkdirSync(path.dirname(abs(file)), { recursive: true });
      fs.writeFileSync(abs(file), buffer);
      const sha = bump();
      return json({ content: { ...contentItem(file), content: undefined }, commit: { sha, message: body.message, author: { date: new Date().toISOString() } } }, 201);
    }
    if (method === "DELETE") {
      if (!exists(file)) return json({ message: "Not Found" }, 404);
      fs.rmSync(abs(file));
      return json({ content: null, commit: { sha: bump(), message: body?.message } });
    }
  }
  if (lower === `${repoBase}/commits`) return json([{ sha: head, commit: { message: "Smoke", author: { name: "Test", date: new Date().toISOString() }, committer: { date: new Date().toISOString() } }, author: null }]);
  if (lower.startsWith(`${repoBase}/commits/`) && lower.endsWith("/check-runs")) return json({ total_count: 0, check_runs: [] });
  if (lower.startsWith(`${repoBase}/commits/`) && lower.endsWith("/status")) return json({ state: "success", statuses: [], total_count: 0 });
  if (lower.startsWith(`${repoBase}/actions/runs`)) return json({ total_count: 0, workflow_runs: [] });
  return null;
};

const realFetch = globalThis.fetch;
globalThis.fetch = async function mockedFetch(input, init) {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  if (url.hostname !== "api.github.com") return realFetch(input, init);
  const method = String(init?.method || (typeof input === "object" && input.method) || "GET").toUpperCase();
  let body = init?.body ?? null;
  if (body == null && typeof input === "object" && typeof input.text === "function" && method !== "GET") body = await input.clone().text();
  try { body = body ? JSON.parse(typeof body === "string" ? body : Buffer.from(body).toString()) : null; } catch { body = null; }
  const headers = new Headers(init?.headers || (typeof input === "object" && input.headers) || {});
  const response = await route(method, url, body, headers.get("accept") || "");
  if (LOG || !response) console.log(`[github-mock] ${method} ${url.pathname}${url.search} -> ${response ? response.status : "NOT MOCKED (404)"}`);
  return response || json({ message: "Not mocked" }, 404);
};
