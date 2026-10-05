import type { SqlExecutor } from "./sql-executor.ts";

/**
 * SqlExecutor adapter for Bun's `bun:sqlite`.
 *
 * Lazy-loads `bun:sqlite` so that imports of this file don't crash in Node
 * environments — callers should only construct this from Bun.
 */
export function createBunSqliteAdapter(path: string): SqlExecutor {
  let Database: { new (path: string, options?: { create?: boolean }): unknown };
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    ({ Database } = (typeof require !== "undefined" ? require : null)?.("bun:sqlite") ?? {});
    if (!Database) throw new Error("missing");
  } catch {
    throw new Error("bun:sqlite is not available — this adapter requires the Bun runtime");
  }

  const db = new Database(path, { create: true }) as {
    run: (sql: string) => void;
    prepare: (sql: string) => {
      all: (...params: unknown[]) => Record<string, unknown>[];
      run: (...params: unknown[]) => { lastInsertRowid: number | bigint };
    };
    query: (sql: string) => {
      all: (...params: unknown[]) => Record<string, unknown>[];
      run: (...params: unknown[]) => { lastInsertRowid: number | bigint };
    };
  };

  db.run("PRAGMA journal_mode=WAL");
  db.run("PRAGMA foreign_keys=ON");

  return {
    query<T = Record<string, unknown>>(sql: string, ...params: unknown[]): T[] {
      return db.query(sql).all(...params) as T[];
    },
    run(sql: string, ...params: unknown[]) {
      return db.query(sql).run(...params);
    },
    runScript(sql: string) {
      db.run(sql);
    },
  };
}
