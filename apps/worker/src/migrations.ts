/**
 * DO SQLite schema — run inside each DocumentAnalyzer Durable Object.
 */
export function runDOMigrations(storage: DurableObjectStorage) {
  storage.sql.exec(`
    CREATE TABLE IF NOT EXISTS sentences (
      id              INTEGER PRIMARY KEY,
      text            TEXT NOT NULL,
      hash            TEXT NOT NULL,
      paragraph_id    INTEGER,
      classification  TEXT,
      heat            REAL,
      iteration_id    INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS hash_cache (
      hash            TEXT PRIMARY KEY,
      classification  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS gate_cache (
      hash            TEXT PRIMARY KEY,
      classification  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS suggestion_cache (
      key             TEXT PRIMARY KEY,
      data            TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS iterations (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at      TEXT DEFAULT (datetime('now')),
      source          TEXT,
      profile         TEXT
    );
  `);

  storage.sql.exec("CREATE INDEX IF NOT EXISTS idx_sentences_hash ON sentences(hash)");

  storage.sql.exec("CREATE INDEX IF NOT EXISTS idx_sentences_iteration ON sentences(iteration_id)");

  // Versions table — stores full text snapshots with analysis profiles
  storage.sql.exec(
    `CREATE TABLE IF NOT EXISTS versions (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      content         TEXT NOT NULL,
      name            TEXT,
      source          TEXT NOT NULL DEFAULT 'auto',
      created_at      TEXT DEFAULT (datetime('now')),
      word_count      INTEGER,
      profile         TEXT
    )`,
  );

  storage.sql.exec("CREATE INDEX IF NOT EXISTS idx_versions_created ON versions(created_at DESC)");

  // Content format tracking for ProseMirror migration
  storage.sql.exec(`
    CREATE TABLE IF NOT EXISTS document_content (
      id              INTEGER PRIMARY KEY DEFAULT 1,
      content         TEXT,
      content_format  TEXT DEFAULT 'plaintext',
      updated_at      TEXT DEFAULT (datetime('now'))
    )
  `);

  // Add content_format and plain_text to versions (safe if already exists)
  try {
    storage.sql.exec("ALTER TABLE versions ADD COLUMN content_format TEXT DEFAULT 'plaintext'");
  } catch {
    /* column already exists */
  }
  try {
    storage.sql.exec("ALTER TABLE versions ADD COLUMN plain_text TEXT");
  } catch {
    /* column already exists */
  }
}
