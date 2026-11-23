import { AwsClient } from "aws4fetch";
import { sql } from "drizzle-orm";
import { db } from "@/db";

/**
 * Webstudio: nightly backup of the CMS database to Cloudflare R2.
 *
 * Everything that only lives in the database goes in: who the clients are and
 * what they may edit, invites, form messages, newsletter addresses, visitor
 * numbers, the log, site settings and the (encrypted) GitHub App link. Texts
 * and photos of the websites are not here: they live in GitHub, with history.
 *
 * Left out: sign-in sessions and codes (short-lived, and secret) and caches
 * (rebuilt from GitHub by themselves).
 *
 * Off until these are set on the Worker (see docs/back-ups.md):
 *   BACKUP_R2_ACCOUNT_ID, BACKUP_R2_BUCKET, BACKUP_R2_ACCESS_KEY_ID, BACKUP_R2_SECRET_ACCESS_KEY
 * Optional: BACKUP_KEEP_DAYS (default 30).
 *
 * One file per night: backups/cms-YYYY-MM-DD.json.gz, a JSON object
 * { version, createdAt, tables: { name: rows[] } }. scripts/restore-backup.mjs
 * puts one back.
 */

const SKIP_TABLES = new Set([
  "session",
  "verification",
  "cache_file",
  "cache_file_meta",
  "cache_permission",
  "config",
  "github_installation_token",
]);

const clean = (value: string | undefined) => String(value || "").trim().replace(/^["']|["']$/g, "");

export const backupSettings = () => {
  const accountId = clean(process.env.BACKUP_R2_ACCOUNT_ID);
  const bucket = clean(process.env.BACKUP_R2_BUCKET);
  const accessKeyId = clean(process.env.BACKUP_R2_ACCESS_KEY_ID);
  const secretAccessKey = clean(process.env.BACKUP_R2_SECRET_ACCESS_KEY);
  const keepDays = Math.max(1, Math.min(365, Number(process.env.BACKUP_KEEP_DAYS) || 30));
  if (!accountId || !bucket || !accessKeyId || !secretAccessKey) return null;
  return { accountId, bucket, accessKeyId, secretAccessKey, keepDays };
};

type Settings = NonNullable<ReturnType<typeof backupSettings>>;

const client = (settings: Settings) => new AwsClient({
  accessKeyId: settings.accessKeyId,
  secretAccessKey: settings.secretAccessKey,
  service: "s3",
  region: "auto",
});

const bucketUrl = (settings: Settings) => `https://${settings.accountId}.r2.cloudflarestorage.com/${encodeURIComponent(settings.bucket)}`;

const rowsOf = (result: unknown): any[] => (Array.isArray(result) ? result : (result as { rows?: any[] })?.rows ?? []);

/** All tables of the CMS with their rows, as one JSON text. */
export const dumpDatabase = async () => {
  const tables = rowsOf(await db.execute(sql`select tablename from pg_tables where schemaname = 'public' order by tablename`))
    .map((row) => String(row.tablename))
    .filter((name) => !SKIP_TABLES.has(name));

  const data: Record<string, unknown[]> = {};
  const counts: Record<string, number> = {};
  for (const table of tables) {
    const identifier = `"${table.replace(/"/g, '""')}"`;
    const [row] = rowsOf(await db.execute(sql.raw(`select coalesce(json_agg(t), '[]'::json) as rows from public.${identifier} t`)));
    const rows = typeof row?.rows === "string" ? JSON.parse(row.rows) : (row?.rows ?? []);
    data[table] = rows;
    counts[table] = rows.length;
  }
  const json = JSON.stringify({ version: 1, createdAt: new Date().toISOString(), tables: data });
  return { json, counts };
};

const gzip = async (text: string) => {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
};

const dayKey = (date: Date) => date.toISOString().slice(0, 10);

/** Removes backups older than keepDays. Returns the names removed. */
const removeOld = async (settings: Settings, aws: AwsClient, now: Date) => {
  const response = await aws.fetch(`${bucketUrl(settings)}?list-type=2&prefix=backups%2F`);
  if (!response.ok) throw new Error(`R2 list: ${response.status} ${await response.text()}`);
  const xml = await response.text();
  const keys = [...xml.matchAll(/<Key>([^<]+)<\/Key>/g)].map((match) => match[1]);
  const oldest = dayKey(new Date(now.getTime() - settings.keepDays * 86_400_000));
  const removed: string[] = [];
  for (const key of keys) {
    const day = /cms-(\d{4}-\d{2}-\d{2})\.json\.gz$/.exec(key)?.[1];
    if (!day || day >= oldest) continue;
    const deleted = await aws.fetch(`${bucketUrl(settings)}/${key.split("/").map(encodeURIComponent).join("/")}`, { method: "DELETE" });
    if (deleted.ok || deleted.status === 404) removed.push(key);
  }
  return removed;
};

export const runBackup = async (now = new Date()) => {
  const settings = backupSettings();
  if (!settings) return { status: "off" as const, message: "Back-up staat uit: BACKUP_R2_* is niet ingesteld." };

  const { json, counts } = await dumpDatabase();
  const body = await gzip(json);
  const key = `backups/cms-${dayKey(now)}.json.gz`;
  const aws = client(settings);
  const response = await aws.fetch(`${bucketUrl(settings)}/${key}`, {
    method: "PUT",
    body,
    headers: { "content-type": "application/gzip" },
  });
  if (!response.ok) throw new Error(`R2 upload: ${response.status} ${await response.text()}`);
  const removed = await removeOld(settings, aws, now).catch((error) => {
    console.error("Back-up: oude back-ups opruimen mislukt", error);
    return [] as string[];
  });
  return { status: "done" as const, key, bytes: body.length, tables: counts, removed };
};
