import type {
  ClassificationCache,
  SentenceClassification,
  StoredSuggestion,
  SuggestionCache,
} from "@prosodeus/core";

/**
 * Two-tier classification cache:
 * Tier 1: DO SQLite (per-document, synchronous, ~0.01ms)
 * Tier 2: KV (global, edge-replicated, ~5-10ms)
 *
 * Note: Uses Durable Object sql.exec() for SQLite queries — not child_process.
 */
export class DOCache implements ClassificationCache, SuggestionCache {
  private sql: DurableObjectStorage["sql"];
  private kv: KVNamespace;

  constructor(sql: DurableObjectStorage["sql"], kv: KVNamespace) {
    this.sql = sql;
    this.kv = kv;
  }

  async getMany(hashes: string[]): Promise<Map<string, SentenceClassification>> {
    const results = new Map<string, SentenceClassification>();
    const kvMisses: string[] = [];

    // Tier 1: DO SQLite
    for (const hash of hashes) {
      const rows = this.sql.exec("SELECT classification FROM hash_cache WHERE hash = ?", hash);
      const row = [...rows][0] as { classification: string } | undefined;
      if (row) {
        results.set(hash, JSON.parse(row.classification));
      } else {
        kvMisses.push(hash);
      }
    }

    // Tier 2: KV for misses
    if (kvMisses.length > 0) {
      const kvResults = await Promise.all(
        kvMisses.map(async (hash) => {
          const value = await this.kv.get(`v1:${hash}`);
          return { hash, value };
        }),
      );

      for (const { hash, value } of kvResults) {
        if (value) {
          const classification = JSON.parse(value) as SentenceClassification;
          results.set(hash, classification);
          // Backfill to DO SQLite
          this.sql.exec(
            "INSERT OR REPLACE INTO hash_cache (hash, classification) VALUES (?, ?)",
            hash,
            value,
          );
        }
      }
    }

    return results;
  }

  async setMany(
    entries: Array<{ hash: string; classification: SentenceClassification }>,
  ): Promise<void> {
    // Write to both tiers
    for (const { hash, classification } of entries) {
      const json = JSON.stringify(classification);

      // Tier 1: DO SQLite
      this.sql.exec(
        "INSERT OR REPLACE INTO hash_cache (hash, classification) VALUES (?, ?)",
        hash,
        json,
      );

      // Tier 2: KV (fire and forget, 30 day TTL)
      this.kv.put(`v1:${hash}`, json, { expirationTtl: 30 * 24 * 60 * 60 });
    }
  }

  async getGateMany(hashes: string[]): Promise<Map<string, SentenceClassification>> {
    const results = new Map<string, SentenceClassification>();
    for (const hash of hashes) {
      const rows = this.sql.exec("SELECT classification FROM gate_cache WHERE hash = ?", hash);
      const row = [...rows][0] as { classification: string } | undefined;
      if (row) results.set(hash, JSON.parse(row.classification));
    }
    return results;
  }

  async setGateMany(
    entries: Array<{ hash: string; classification: SentenceClassification }>,
  ): Promise<void> {
    for (const { hash, classification } of entries) {
      const json = JSON.stringify(classification);
      this.sql.exec(
        "INSERT OR REPLACE INTO gate_cache (hash, classification) VALUES (?, ?)",
        hash,
        json,
      );
    }
  }

  async getSuggestions(keys: string[]): Promise<Map<string, StoredSuggestion[]>> {
    const results = new Map<string, StoredSuggestion[]>();
    const kvMisses: string[] = [];

    // Tier 1: DO SQLite
    for (const key of keys) {
      const rows = this.sql.exec("SELECT data FROM suggestion_cache WHERE key = ?", key);
      const row = [...rows][0] as { data: string } | undefined;
      if (row) {
        results.set(key, JSON.parse(row.data));
      } else {
        kvMisses.push(key);
      }
    }

    // Tier 2: KV for misses
    if (kvMisses.length > 0) {
      const kvResults = await Promise.all(
        kvMisses.map(async (key) => {
          const value = await this.kv.get(`sug:${key}`);
          return { key, value };
        }),
      );

      for (const { key, value } of kvResults) {
        if (value) {
          results.set(key, JSON.parse(value) as StoredSuggestion[]);
          // Backfill to DO SQLite
          this.sql.exec(
            "INSERT OR REPLACE INTO suggestion_cache (key, data) VALUES (?, ?)",
            key,
            value,
          );
        }
      }
    }

    return results;
  }

  async setSuggestions(
    entries: Array<{ key: string; suggestions: StoredSuggestion[] }>,
  ): Promise<void> {
    for (const { key, suggestions } of entries) {
      const json = JSON.stringify(suggestions);
      this.sql.exec("INSERT OR REPLACE INTO suggestion_cache (key, data) VALUES (?, ?)", key, json);
      this.kv.put(`sug:${key}`, json, { expirationTtl: 30 * 24 * 60 * 60 });
    }
  }
}
