import type { PatternType, SentenceClassification } from "../types.ts";

// ─── Interface ──────────────────────────────────────────────────────────────

export interface ClassificationCache {
  getMany(hashes: string[]): Promise<Map<string, SentenceClassification>>;
  setMany(entries: Array<{ hash: string; classification: SentenceClassification }>): Promise<void>;
  /** Optional gate-layer cache (patterns-only partial classifications). */
  getGateMany?(hashes: string[]): Promise<Map<string, SentenceClassification>>;
  setGateMany?(
    entries: Array<{ hash: string; classification: SentenceClassification }>,
  ): Promise<void>;
}

// ─── Suggestion cache ────────────────────────────────────────────────────────

/**
 * Cached rewrite suggestions for one sentence. sentence_id and original text
 * are rehydrated at read time from the live sentence — IDs shift as the
 * document is edited, but the hash-keyed content does not.
 */
export interface StoredSuggestion {
  pattern_type: PatternType;
  alternatives: Array<{ text: string; rationale: string }>;
  model_name?: string;
}

export interface SuggestionCache {
  getSuggestions(keys: string[]): Promise<Map<string, StoredSuggestion[]>>;
  setSuggestions(entries: Array<{ key: string; suggestions: StoredSuggestion[] }>): Promise<void>;
}

// ─── Local SQLite Cache (bun:sqlite) ────────────────────────────────────────

export class LocalCache implements ClassificationCache, SuggestionCache {
  private db: any;
  private getStmt: any;
  private setStmt: any;
  private getGateStmt: any;
  private setGateStmt: any;
  private getSugStmt: any;
  private setSugStmt: any;

  constructor(path?: string) {
    let Database: any, mkdirSync: any, existsSync: any, unlinkSync: any, homedir: any;
    try {
      // @ts-expect-error — require exists in Bun/Node but not in Workers types
      const _require: NodeRequire = typeof require !== "undefined" ? require : null;
      if (!_require) throw new Error("no require");
      ({ Database } = _require("bun:sqlite"));
      ({ mkdirSync, existsSync, unlinkSync } = _require("node:fs"));
      ({ homedir } = _require("node:os"));
    } catch {
      throw new Error("LocalCache requires Bun runtime (bun:sqlite)");
    }

    const dbPath = path ?? `${homedir()}/.prosodeus/cache.sqlite`;
    const dir = dbPath.substring(0, dbPath.lastIndexOf("/"));
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    const createSchema =
      "CREATE TABLE IF NOT EXISTS classifications (hash TEXT PRIMARY KEY, data TEXT NOT NULL)";
    const createSugSchema =
      "CREATE TABLE IF NOT EXISTS suggestions (key TEXT PRIMARY KEY, data TEXT NOT NULL)";
    const openDb = () => {
      const nextDb = new Database(dbPath, { create: true });
      try {
        nextDb.run("PRAGMA busy_timeout=5000");
        nextDb.run("PRAGMA journal_mode=WAL");
        nextDb.run(createSchema);
        nextDb.run(createSugSchema);
        return nextDb;
      } catch (err) {
        try {
          nextDb.close();
        } catch {
          /* already closed */
        }
        throw err;
      }
    };

    try {
      this.db = openDb();
    } catch (err) {
      const code = String((err as { code?: unknown })?.code ?? "");
      const recoverable =
        code.startsWith("SQLITE_IOERR") || code === "SQLITE_CORRUPT" || code === "SQLITE_NOTADB";
      if (!recoverable) throw err;

      for (const file of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]) {
        try {
          if (existsSync(file)) unlinkSync(file);
        } catch {
          /* best effort cache recovery */
        }
      }
      this.db = openDb();
    }

    this.getStmt = this.db.prepare("SELECT hash, data FROM classifications WHERE hash = ?");
    this.setStmt = this.db.prepare(
      "INSERT OR REPLACE INTO classifications (hash, data) VALUES (?, ?)",
    );
    this.db.run(
      "CREATE TABLE IF NOT EXISTS gate_classifications (hash TEXT PRIMARY KEY, data TEXT NOT NULL)",
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
    const results = new Map<string, SentenceClassification>();
    for (const hash of hashes) {
      const row = this.getStmt.get(hash) as { hash: string; data: string } | null;
      if (row) {
        results.set(hash, JSON.parse(row.data));
      }
    }
    return results;
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
    const results = new Map<string, SentenceClassification>();
    for (const hash of hashes) {
      const row = this.getGateStmt.get(hash) as { hash: string; data: string } | null;
      if (row) results.set(hash, JSON.parse(row.data));
    }
    return results;
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
    const results = new Map<string, StoredSuggestion[]>();
    for (const key of keys) {
      const row = this.getSugStmt.get(key) as { key: string; data: string } | null;
      if (row) results.set(key, JSON.parse(row.data));
    }
    return results;
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

  /** Release the underlying SQLite file handles. Safe to call multiple times. */
  close(): void {
    try {
      this.db?.close?.();
    } catch {
      /* already closed */
    }
    this.db = null;
    this.getStmt = null;
    this.setStmt = null;
    this.getSugStmt = null;
    this.setSugStmt = null;
  }
}

// ─── Null Cache (no caching) ────────────────────────────────────────────────

export class NullCache implements ClassificationCache, SuggestionCache {
  async getMany(_hashes: string[]): Promise<Map<string, SentenceClassification>> {
    return new Map();
  }
  async setMany(
    _entries: Array<{ hash: string; classification: SentenceClassification }>,
  ): Promise<void> {}
  async getGateMany(_hashes: string[]): Promise<Map<string, SentenceClassification>> {
    return new Map();
  }
  async setGateMany(
    _entries: Array<{ hash: string; classification: SentenceClassification }>,
  ): Promise<void> {}
  async getSuggestions(_keys: string[]): Promise<Map<string, StoredSuggestion[]>> {
    return new Map();
  }
  async setSuggestions(
    _entries: Array<{ key: string; suggestions: StoredSuggestion[] }>,
  ): Promise<void> {}
}
