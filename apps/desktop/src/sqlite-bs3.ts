import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { SentenceClassification } from "@prosodeus/core";
import type {
  ClassificationCache,
  SqlExecutor,
  StoredSuggestion,
  SuggestionCache,
} from "@prosodeus/core/node";
import Database from "better-sqlite3";

/**
 * better-sqlite3 SqlExecutor adapter (Node/Electron).
 *
 * Mirrors the Bun adapter in `@prosodeus/core/node` but uses the standard
 * `better-sqlite3` package which compiles native bindings against Node/
 * Electron's ABI. Run `electron-rebuild` after install so the bindings
 * match Electron's Node version.
 */
export function createBetterSqlite3Adapter(path: string): SqlExecutor {
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  const runMulti = db.exec.bind(db);

  return {
    query<T = Record<string, unknown>>(sql: string, ...params: unknown[]): T[] {
      return db.prepare(sql).all(...(params as never[])) as T[];
    },
    run(sql: string, ...params: unknown[]) {
      const result = db.prepare(sql).run(...(params as never[]));
      return { lastInsertRowid: result.lastInsertRowid };
    },
    runScript(sql: string) {
      runMulti(sql);
    },
  };
}

/**
 * Node-side classification cache, mirrors the Bun-only `LocalCache` shape.
 * Implements `ClassificationCache` so it's a drop-in replacement.
 */
export class BetterSqlite3LocalCache implements ClassificationCache, SuggestionCache {
  private getStmt: Database.Statement;
  private setStmt: Database.Statement;
  private getGateStmt: Database.Statement;
  private setGateStmt: Database.Statement;
  private getSugStmt: Database.Statement;
  private setSugStmt: Database.Statement;
  private db: Database.Database;

  constructor(path: string) {
    const dir = dirname(path);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    this.db = new Database(path);
    this.db.pragma("journal_mode = WAL");
    const runMulti = this.db.exec.bind(this.db);
    runMulti(
      "CREATE TABLE IF NOT EXISTS classifications (hash TEXT PRIMARY KEY, data TEXT NOT NULL)",
    );
    runMulti("CREATE TABLE IF NOT EXISTS suggestions (key TEXT PRIMARY KEY, data TEXT NOT NULL)");
    runMulti(
      "CREATE TABLE IF NOT EXISTS gate_classifications (hash TEXT PRIMARY KEY, data TEXT NOT NULL)",
    );

    this.getStmt = this.db.prepare("SELECT hash, data FROM classifications WHERE hash = ?");
    this.setStmt = this.db.prepare(
      "INSERT OR REPLACE INTO classifications (hash, data) VALUES (?, ?)",
    );
    this.getGateStmt = this.db.prepare(
      "SELECT hash, data FROM gate_classifications WHERE hash = ?",
    );
    this.setGateStmt = this.db.prepare(
      "INSERT OR REPLACE INTO gate_classifications (hash, data) VALUES (?, ?)",
    );
    this.getSugStmt = this.db.prepare("SELECT key, data FROM suggestions WHERE key = ?");
    this.setSugStmt = this.db.prepare(
      "INSERT OR REPLACE INTO suggestions (key, data) VALUES (?, ?)",
    );
  }

  async getMany(hashes: string[]): Promise<Map<string, SentenceClassification>> {
    const result = new Map<string, SentenceClassification>();
    for (const hash of hashes) {
      const row = this.getStmt.get(hash) as { hash: string; data: string } | undefined;
      if (row) result.set(hash, JSON.parse(row.data) as SentenceClassification);
    }
    return result;
  }

  async setMany(
    entries: Array<{ hash: string; classification: SentenceClassification }>,
  ): Promise<void> {
    const tx = this.db.transaction(() => {
      for (const { hash, classification } of entries) {
        this.setStmt.run(hash, JSON.stringify(classification));
      }
    });
    tx();
  }

  async getGateMany(hashes: string[]): Promise<Map<string, SentenceClassification>> {
    const result = new Map<string, SentenceClassification>();
    for (const hash of hashes) {
      const row = this.getGateStmt.get(hash) as { hash: string; data: string } | undefined;
      if (row) result.set(hash, JSON.parse(row.data) as SentenceClassification);
    }
    return result;
  }

  async setGateMany(
    entries: Array<{ hash: string; classification: SentenceClassification }>,
  ): Promise<void> {
    const tx = this.db.transaction(() => {
      for (const { hash, classification } of entries) {
        this.setGateStmt.run(hash, JSON.stringify(classification));
      }
    });
    tx();
  }

  async getSuggestions(keys: string[]): Promise<Map<string, StoredSuggestion[]>> {
    const result = new Map<string, StoredSuggestion[]>();
    for (const key of keys) {
      const row = this.getSugStmt.get(key) as { key: string; data: string } | undefined;
      if (row) result.set(key, JSON.parse(row.data) as StoredSuggestion[]);
    }
    return result;
  }

  async setSuggestions(
    entries: Array<{ key: string; suggestions: StoredSuggestion[] }>,
  ): Promise<void> {
    const tx = this.db.transaction(() => {
      for (const { key, suggestions } of entries) {
        this.setSugStmt.run(key, JSON.stringify(suggestions));
      }
    });
    tx();
  }
}
