import "server-only";

// Tiger Data prize: one small postgres.js client per server instance. The free service has no
// connection pooler and every request can land on a fresh function, so each keeps at most 2
// connections and lets them go after about 20 s idle.

import postgres from "postgres";
import { DATABASE } from "@/lib/shared/params";
import { env } from "../env";

let client: postgres.Sql | null = null;
let readClient: postgres.Sql | null = null;

function connect(url: string, readOnly: boolean): postgres.Sql {
  const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
  return postgres(url, {
    ssl: local ? false : "require",
    max: DATABASE.clientMaxConnections,
    idle_timeout: DATABASE.clientIdleTimeoutS,
    connect_timeout: DATABASE.clientConnectTimeoutS,
    onnotice: () => {},
    // Every transaction read-only, so nothing sent on this connection can write.
    ...(readOnly ? { connection: { default_transaction_read_only: true } } : {}),
  });
}

export function db(): postgres.Sql {
  client ??= connect(env("DATABASE_URL").DATABASE_URL, false);
  return client;
}

// For Ask the data's lookups (Phase 7 stretch): the read-only role in DATABASE_URL_READONLY when
// it is set, the main URL otherwise, and read-only transactions either way.
export function readOnlyDb(): postgres.Sql {
  readClient ??= connect(process.env.DATABASE_URL_READONLY || env("DATABASE_URL").DATABASE_URL, true);
  return readClient;
}

// Rejects when a query takes longer than `ms`, so a slow or unreachable database costs a route at
// most that long. The query keeps going; its failure is handled here so it never goes unhandled.
export function inTime<T>(query: Promise<T>, ms: number): Promise<T> {
  query.catch(() => {});
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("database too slow")), ms);
  });
  return Promise.race([query, late]).finally(() => clearTimeout(timer));
}
