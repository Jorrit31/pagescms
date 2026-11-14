import "./envConfig";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

declare global {
  // eslint-disable-next-line no-var
  var __pagesCmsPostgresClient: ReturnType<typeof postgres> | undefined;
}

type Database = ReturnType<typeof drizzle<typeof schema>>;

// Cloudflare Workers do not allow a database connection to be reused by
// another request, so there every request gets its own connection.
const isCloudflareWorker =
  typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";

type CloudflareContext = { env?: { HYPERDRIVE?: { connectionString?: string } } };

const getCloudflareRequest = (): CloudflareContext | undefined => {
  // Set per request by the OpenNext Cloudflare adapter.
  return (globalThis as Record<symbol, CloudflareContext | undefined>)[Symbol.for("__cloudflare-context__")];
};

// Opening a fresh database connection costs several round trips to the
// database, on every request. With a Hyperdrive binding (Cloudflare keeps the
// connections open close to the database) that cost mostly disappears, so use
// it when it is configured and fall back to DATABASE_URL otherwise.
const getConnectionString = (): string =>
  getCloudflareRequest()?.env?.HYPERDRIVE?.connectionString || process.env.DATABASE_URL!;

const createDatabase = (): Database =>
  drizzle(postgres(getConnectionString(), { max: 1, fetch_types: false }), { schema });

const createWorkerDatabase = (): Database => {
  const perRequest = new WeakMap<object, Database>();
  let fallback: Database | undefined;
  const current = (): Database => {
    const request = getCloudflareRequest();
    if (!request) return (fallback ??= createDatabase());
    let database = perRequest.get(request);
    if (!database) {
      database = createDatabase();
      perRequest.set(request, database);
    }
    return database;
  };
  return new Proxy({} as Database, {
    get(_target, property) {
      const database = current();
      const value = Reflect.get(database, property, database);
      return typeof value === "function" ? value.bind(database) : value;
    },
  });
};

const createNodeDatabase = (): Database => {
  const client =
    globalThis.__pagesCmsPostgresClient
    ?? postgres(process.env.DATABASE_URL!, {
      // Keep conservative pool size in dev to avoid local connection spikes.
      max: parseInt(process.env.POSTGRES_MAX_CONNECTIONS || "5", 10),
    });

  if (process.env.NODE_ENV !== "production") {
    globalThis.__pagesCmsPostgresClient = client;
  }

  return drizzle(client, { schema });
};

export const db: Database = isCloudflareWorker ? createWorkerDatabase() : createNodeDatabase();
