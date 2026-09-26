// Tiger Data prize: sets up the database from `db/migrations/*.sql`, in file-name order, once each.
// Applied files are recorded in `schema_migrations`.
//
// TimescaleDB won't create a continuous aggregate inside a transaction, so each statement runs on
// its own. Every migration is written to be safe to run again (`if not exists`), so a file that
// stopped halfway is simply run again from the top.
//
// Run `npm run db:migrate` with DATABASE_URL in `.env.local`.

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { databaseUrl } from "./url";

const DIR = path.join(import.meta.dirname, "migrations");

// Splits on semicolons at the end of a line, but not inside $$ quoted bodies.
export function statements(text: string): string[] {
  const out: string[] = [];
  let current: string[] = [];
  let quoted = false;
  for (const line of text.split("\n")) {
    current.push(line);
    if ((line.match(/\$\$/g) ?? []).length % 2 === 1) quoted = !quoted;
    if (!quoted && /;\s*(--.*)?$/.test(line)) {
      const statement = current.join("\n").trim();
      if (statement.replace(/--.*$/gm, "").trim().length > 1) out.push(statement);
      current = [];
    }
  }
  const rest = current.join("\n").replace(/--.*$/gm, "").trim();
  if (rest) out.push(current.join("\n").trim());
  return out;
}

async function main(): Promise<number> {
  const url = databaseUrl(process.env.DATABASE_URL);
  if (!url) {
    console.error("DATABASE_URL is not set. Put the Tiger Cloud connection string in .env.local.");
    return 1;
  }
  const local = /localhost|127\.0\.0\.1/.test(url);
  const sql = postgres(url, { ssl: local ? false : "require", max: 1, onnotice: () => {} });
  try {
    await sql`create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())`;
    const done = new Set((await sql<{ name: string }[]>`select name from schema_migrations`).map((r) => r.name));
    const files = readdirSync(DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();
    for (const file of files) {
      if (done.has(file)) continue;
      const started = Date.now();
      const parts = statements(readFileSync(path.join(DIR, file), "utf8"));
      for (const [i, statement] of parts.entries()) {
        try {
          await sql.unsafe(statement);
        } catch (err) {
          console.error(`FAIL  ${file}, statement ${i + 1} of ${parts.length}: ${err instanceof Error ? err.message : err}`);
          console.error(statement);
          return 1;
        }
      }
      await sql`insert into schema_migrations (name) values (${file})`;
      console.log(`DONE  ${file} (${parts.length} statements, ${Date.now() - started} ms)`);
    }
    console.log(files.every((f) => done.has(f)) ? "Nothing to do." : "Migrations applied.");
    return 0;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  main().then(
    (code) => (process.exitCode = code),
    (err: unknown) => {
      console.error(err instanceof Error ? err.message : err);
      process.exitCode = 1;
    },
  );
}
