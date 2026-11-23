// Webstudio smoke tests: puts a signed-in client in the local test database.
// Prints the session cookie value for Playwright (see smoke.spec.ts).
import crypto from "node:crypto";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const secret = process.env.BETTER_AUTH_SECRET;
const owner = process.env.SMOKE_OWNER || "webstudio";
const repo = process.env.SMOKE_REPO || "testsite";
const email = process.env.SMOKE_EMAIL || "klant@example.com";

const userId = "smoke-user";
const token = crypto.randomBytes(24).toString("hex");

await sql`delete from session where user_id = ${userId}`;
await sql`delete from collaborator where user_id = ${userId}`;
await sql`insert into "user" (id, name, email, email_verified) values (${userId}, 'Klant Test', ${email}, true)
  on conflict (id) do update set email = excluded.email`;
await sql`insert into session (id, expires_at, token, user_id) values (${crypto.randomUUID()}, now() + interval '1 day', ${token}, ${userId})`;
await sql`insert into collaborator (type, installation_id, owner_id, repo_id, owner, repo, email, user_id)
  values ('user', 42, 1, 1, ${owner}, ${repo}, ${email}, ${userId})`;
// The tests rely on a fresh view of the fake repository.
await sql`delete from config`;
await sql`delete from cache_file`;
await sql`delete from cache_file_meta`.catch(() => {});

const signature = crypto.createHmac("sha256", secret).update(token).digest("base64");
process.stdout.write(`${token}.${signature}`);
await sql.end();
