import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { statements } from "./migrate";

describe("migration statements", () => {
  it("splits at line-ending semicolons and skips comments", () => {
    expect(statements("-- note\ncreate table a (x int);\n\nselect 1; -- done\n")).toEqual([
      "-- note\ncreate table a (x int);",
      "select 1; -- done",
    ]);
  });

  it("keeps a $$ function body in one piece", () => {
    const parts = statements(readFileSync("db/migrations/010_fix_first.sql", "utf8"));
    expect(parts).toHaveLength(2);
    expect(parts[0]).toMatch(/^-- The fix-first queue[\s\S]*\$\$;$/);
    expect(parts[1]).toMatch(/^create or replace view fix_first/);
  });
});
