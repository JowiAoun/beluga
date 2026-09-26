import "server-only";

// Tiger Data prize: one small postgres.js client per server instance. The free service has no
// connection pooler and every request can land on a fresh function, so each keeps at most 2
// connections and lets them go after about 20 s idle.

import postgres from "postgres";
import { DATABASE } from "@/lib/shared/params";
import { env } from "../env";

let client: postgres.Sql | null = null;

export function db(): postgres.Sql {
  if (!client) {
    const { DATABASE_URL } = env("DATABASE_URL");
    const local = /@(localhost|127\.0\.0\.1)[:/]/.test(DATABASE_URL);
    client = postgres(DATABASE_URL, {
      ssl: local ? false : "require",
      max: DATABASE.clientMaxConnections,
      connect_timeout: DATABASE.clientConnectTimeoutS,
      idle_timeout: DATABASE.clientIdleTimeoutS,
      onnotice: () => {},
    });
  }
  return client;
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
