#!/usr/bin/env node
// Webstudio: puts a nightly database backup back (see docs/back-ups.md).
//
//   DATABASE_URL=postgres://... node scripts/restore-backup.mjs cms-2026-11-24.json.gz
//   DATABASE_URL=postgres://... node scripts/restore-backup.mjs cms-2026-11-24.json.gz --only form_submission
//
// The database must already have the tables (run `npx drizzle-kit migrate` first on a
// new one). Every table in the backup is emptied and filled with the backup's rows, in
// one transaction: if anything fails, nothing changes. Sign-in sessions are not in a
// backup, so everyone signs in again afterwards.
import fs from "node:fs";
import zlib from "node:zlib";
import postgres from "postgres";

const file = process.argv[2];
const onlyIndex = process.argv.indexOf("--only");
const only = onlyIndex > -1 ? new Set(String(process.argv[onlyIndex + 1] || "").split(",").filter(Boolean)) : null;
if (!file || !process.env.DATABASE_URL) {
  console.error("Gebruik: DATABASE_URL=... node scripts/restore-backup.mjs <back-up.json.gz> [--only tabel1,tabel2]");
  process.exit(1);
}

const raw = fs.readFileSync(file);
const backup = JSON.parse((file.endsWith(".gz") ? zlib.gunzipSync(raw) : raw).toString("utf8"));
if (backup?.version !== 1 || !backup.tables) throw new Error("Dit is geen back-up van het beheerscherm.");

// Tables other tables point to go in first and are emptied last.
const FIRST = ["user"];
const names = Object.keys(backup.tables)
  .filter((name) => !only || only.has(name))
  .sort((a, b) => (FIRST.includes(b) ? 1 : 0) - (FIRST.includes(a) ? 1 : 0) || a.localeCompare(b));

const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const existing = new Set((await sql`select tablename from pg_tables where schemaname = 'public'`).map((row) => row.tablename));
const missing = names.filter((name) => !existing.has(name));
if (missing.length) {
  console.error(`Deze tabellen bestaan nog niet: ${missing.join(", ")}. Draai eerst: npx drizzle-kit migrate`);
  process.exit(1);
}

console.log(`Back-up van ${backup.createdAt}. Terugzetten: ${names.join(", ")}`);
await sql.begin(async (tx) => {
  for (const name of [...names].reverse()) await tx.unsafe(`delete from public."${name}"`);
  for (const name of names) {
    const rows = backup.tables[name];
    if (rows.length) {
      await tx.unsafe(`insert into public."${name}" select * from json_populate_recordset(null::public."${name}", $1::text::json)`, [JSON.stringify(rows)]);
    }
    // Let new rows continue after the highest id that came back.
    const serials = await tx`select column_name from information_schema.columns
      where table_schema = 'public' and table_name = ${name} and column_default like 'nextval(%'`;
    for (const { column_name } of serials) {
      await tx.unsafe(`select setval(pg_get_serial_sequence('public."${name}"', '${column_name}'), greatest(coalesce((select max("${column_name}") from public."${name}"), 0), 1), (select count(*) > 0 from public."${name}"))`);
    }
    console.log(`  ${name}: ${rows.length}`);
  }
});
await sql.end();
console.log("Klaar. Iedereen logt opnieuw in.");
