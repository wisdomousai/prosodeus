/**
 * SQLite schema for the desktop document store.
 *
 * Differs from the Worker DO schema (`apps/worker/src/migrations.ts`) in one
 * key way: every per-document table has a `document_id` column, because the
 * desktop manages many documents in one SQLite file. The Worker DO is one
 * instance per document, so its tables don't need scoping.
 */

export const SCHEMA_VERSION = 1;

export const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS documents (
    id              TEXT PRIMARY KEY,
    title           TEXT NOT NULL DEFAULT 'Untitled',
    content         TEXT,
    content_format  TEXT DEFAULT 'plaintext',
    workspace_id    TEXT,
    folder_id       TEXT,
    created_at      TEXT DEFAULT (datetime('now')),
    updated_at      TEXT DEFAULT (datetime('now')),
    last_synced_at  TEXT,
    sync_token      TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_documents_updated ON documents(updated_at DESC);
  CREATE INDEX IF NOT EXISTS idx_documents_workspace ON documents(workspace_id);
  CREATE INDEX IF NOT EXISTS idx_documents_folder ON documents(folder_id);

  CREATE TABLE IF NOT EXISTS sentences (
    document_id     TEXT NOT NULL,
    id              INTEGER NOT NULL,
    text            TEXT NOT NULL,
    hash            TEXT NOT NULL,
    paragraph_id    INTEGER,
    classification  TEXT,
    heat            REAL,
    iteration_id    INTEGER DEFAULT 0,
    PRIMARY KEY (document_id, id, iteration_id),
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_sentences_doc_iter ON sentences(document_id, iteration_id);
  CREATE INDEX IF NOT EXISTS idx_sentences_hash ON sentences(hash);

  CREATE TABLE IF NOT EXISTS iterations (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id     TEXT NOT NULL,
    created_at      TEXT DEFAULT (datetime('now')),
    source          TEXT,
    profile         TEXT,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_iterations_doc_created ON iterations(document_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS versions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id     TEXT NOT NULL,
    content         TEXT NOT NULL,
    content_format  TEXT DEFAULT 'plaintext',
    plain_text      TEXT,
    name            TEXT,
    source          TEXT NOT NULL DEFAULT 'auto',
    created_at      TEXT DEFAULT (datetime('now')),
    word_count      INTEGER,
    profile         TEXT,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_versions_doc_created ON versions(document_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS schema_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`;

/** Run schema migrations. Idempotent — safe to call on every DB open. */
export function migrate(sql: {
  runScript(sql: string): void;
  query<T = Record<string, unknown>>(sql: string, ...params: unknown[]): T[];
  run(sql: string, ...params: unknown[]): { lastInsertRowid: number | bigint };
}) {
  sql.runScript(SCHEMA_SQL);
  // Record schema version so future migrations can branch
  sql.run(
    "INSERT OR REPLACE INTO schema_meta (key, value) VALUES (?, ?)",
    "schema_version",
    String(SCHEMA_VERSION),
  );
}
