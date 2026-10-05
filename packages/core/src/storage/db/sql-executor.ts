/**
 * Minimal SQL executor interface.
 *
 * Implemented by adapters for:
 *   - Bun's `bun:sqlite` (desktop, CLI)
 *   - better-sqlite3 (Node fallback if Bun unavailable)
 *   - Cloudflare Durable Object SQLite (`ctx.storage.sql`)
 *
 * Keeping the interface tiny means the same `DocumentStore` can run anywhere
 * SQLite runs, without leaking adapter details.
 */
export interface SqlExecutor {
  /** Run a query that returns rows (SELECT). */
  query<T = Record<string, unknown>>(sql: string, ...params: unknown[]): T[];
  /** Run a query that doesn't return rows. Returns last insert rowid for AUTOINCREMENT tables. */
  run(sql: string, ...params: unknown[]): { lastInsertRowid: number | bigint };
  /** Run a multi-statement DDL block (used for migrations only). */
  runScript(sql: string): void;
}
