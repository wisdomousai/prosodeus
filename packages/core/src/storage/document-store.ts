import type { ClassifiedSentence, StylometricProfile } from "../types.ts";
import { migrate } from "./db/schema.ts";
import type { SqlExecutor } from "./db/sql-executor.ts";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DocumentRow {
  id: string;
  title: string;
  content: string | null;
  content_format: string;
  workspace_id: string | null;
  folder_id: string | null;
  created_at: string;
  updated_at: string;
  last_synced_at: string | null;
  sync_token: string | null;
}

export interface IterationRow {
  id: number;
  document_id: string;
  created_at: string;
  source: string | null;
  mean_heat: number;
  sentence_count: number;
  word_count: number;
}

export interface VersionRow {
  id: number;
  document_id: string;
  name: string | null;
  source: string;
  created_at: string;
  word_count: number | null;
  mean_heat: number;
}

export interface VersionContentRow {
  id: number;
  document_id: string;
  content: string;
  content_format: string;
  plain_text: string | null;
  profile: StylometricProfile | null;
}

// ─── Document store ──────────────────────────────────────────────────────────

/**
 * Local document persistence layer.
 *
 * Wraps an `SqlExecutor` (Bun sqlite adapter for desktop/CLI; could be wired
 * to DO SQLite for the Worker if/when we consolidate). All operations are
 * scoped by `documentId` so a single store can hold many documents.
 */
export class DocumentStore {
  constructor(private sql: SqlExecutor) {
    migrate(this.sql);
  }

  // ─── Documents ────────────────────────────────────────────────────────────

  createDocument(input: {
    id: string;
    title?: string;
    content?: string;
    contentFormat?: string;
    workspaceId?: string;
    folderId?: string;
  }): void {
    this.sql.run(
      `INSERT INTO documents (id, title, content, content_format, workspace_id, folder_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      input.id,
      input.title ?? "Untitled",
      input.content ?? null,
      input.contentFormat ?? "plaintext",
      input.workspaceId ?? null,
      input.folderId ?? null,
    );
  }

  getDocument(id: string): DocumentRow | null {
    const rows = this.sql.query<DocumentRow>("SELECT * FROM documents WHERE id = ?", id);
    return rows[0] ?? null;
  }

  listDocuments(
    opts: { workspaceId?: string; folderId?: string; limit?: number } = {},
  ): DocumentRow[] {
    const where: string[] = [];
    const params: unknown[] = [];
    if (opts.workspaceId !== undefined) {
      where.push("workspace_id = ?");
      params.push(opts.workspaceId);
    }
    if (opts.folderId !== undefined) {
      where.push("folder_id = ?");
      params.push(opts.folderId);
    }
    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const limit = opts.limit ?? 200;
    return this.sql.query<DocumentRow>(
      `SELECT * FROM documents ${whereClause} ORDER BY updated_at DESC LIMIT ?`,
      ...params,
      limit,
    );
  }

  updateDocumentContent(id: string, content: string, contentFormat = "plaintext"): void {
    this.sql.run(
      `UPDATE documents SET content = ?, content_format = ?, updated_at = datetime('now')
       WHERE id = ?`,
      content,
      contentFormat,
      id,
    );
  }

  renameDocument(id: string, title: string): void {
    this.sql.run(
      `UPDATE documents SET title = ?, updated_at = datetime('now') WHERE id = ?`,
      title,
      id,
    );
  }

  deleteDocument(id: string): void {
    this.sql.run("DELETE FROM documents WHERE id = ?", id);
  }

  // ─── Iterations ───────────────────────────────────────────────────────────

  /**
   * Persist a full analysis result: one iteration row + a sentences row per
   * sentence. Returns the inserted iteration ID.
   */
  persistIteration(
    documentId: string,
    profile: StylometricProfile,
    sentences: ClassifiedSentence[],
    source = "local",
  ): number {
    const result = this.sql.run(
      "INSERT INTO iterations (document_id, source, profile) VALUES (?, ?, ?)",
      documentId,
      source,
      JSON.stringify(profile),
    );
    const iterationId = Number(result.lastInsertRowid);

    for (const s of sentences) {
      this.sql.run(
        `INSERT OR REPLACE INTO sentences
         (document_id, id, text, hash, paragraph_id, classification, heat, iteration_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        documentId,
        s.id,
        s.text,
        s.hash,
        s.paragraph_id,
        JSON.stringify(s.classification),
        s.heat,
        iterationId,
      );
    }

    return iterationId;
  }

  listIterations(documentId: string, limit = 50): IterationRow[] {
    const rows = this.sql.query<{
      id: number;
      document_id: string;
      created_at: string;
      source: string | null;
      profile: string;
    }>(
      `SELECT id, document_id, created_at, source, profile
       FROM iterations
       WHERE document_id = ?
       ORDER BY created_at DESC, id DESC
       LIMIT ?`,
      documentId,
      limit,
    );

    return rows.map((row) => {
      const p =
        safeJSON<{ mean_heat?: number; sentence_count?: number; word_count?: number }>(
          row.profile,
        ) ?? {};
      return {
        id: row.id,
        document_id: row.document_id,
        created_at: row.created_at,
        source: row.source,
        mean_heat: p.mean_heat ?? 0,
        sentence_count: p.sentence_count ?? 0,
        word_count: p.word_count ?? 0,
      };
    });
  }

  // ─── Versions ─────────────────────────────────────────────────────────────

  persistVersion(input: {
    documentId: string;
    content: string;
    contentFormat?: string;
    plainText?: string;
    name?: string;
    source?: string;
    profile?: StylometricProfile;
  }): number {
    const wordCount = (input.plainText ?? input.content).split(/\s+/).filter(Boolean).length;
    const result = this.sql.run(
      `INSERT INTO versions
       (document_id, content, content_format, plain_text, name, source, word_count, profile)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      input.documentId,
      input.content,
      input.contentFormat ?? "plaintext",
      input.plainText ?? null,
      input.name ?? null,
      input.source ?? "manual",
      wordCount,
      input.profile ? JSON.stringify(input.profile) : null,
    );
    return Number(result.lastInsertRowid);
  }

  listVersions(documentId: string, limit = 100): VersionRow[] {
    const rows = this.sql.query<{
      id: number;
      document_id: string;
      name: string | null;
      source: string;
      created_at: string;
      word_count: number | null;
      profile: string | null;
    }>(
      `SELECT id, document_id, name, source, created_at, word_count, profile
       FROM versions
       WHERE document_id = ?
       ORDER BY created_at DESC, id DESC
       LIMIT ?`,
      documentId,
      limit,
    );

    return rows.map((row) => ({
      id: row.id,
      document_id: row.document_id,
      name: row.name,
      source: row.source,
      created_at: row.created_at,
      word_count: row.word_count,
      mean_heat: safeJSON<{ mean_heat?: number }>(row.profile)?.mean_heat ?? 0,
    }));
  }

  getVersion(versionId: number): VersionContentRow | null {
    const rows = this.sql.query<{
      id: number;
      document_id: string;
      content: string;
      content_format: string;
      plain_text: string | null;
      profile: string | null;
    }>(
      "SELECT id, document_id, content, content_format, plain_text, profile FROM versions WHERE id = ?",
      versionId,
    );
    const row = rows[0];
    if (!row) return null;
    return {
      id: row.id,
      document_id: row.document_id,
      content: row.content,
      content_format: row.content_format,
      plain_text: row.plain_text,
      profile: safeJSON<StylometricProfile>(row.profile),
    };
  }

  /** Get the most recent version's content for a document, or null. */
  latestVersionContent(documentId: string): string | null {
    const rows = this.sql.query<{ content: string }>(
      "SELECT content FROM versions WHERE document_id = ? ORDER BY created_at DESC, id DESC LIMIT 1",
      documentId,
    );
    return rows[0]?.content ?? null;
  }
}

function safeJSON<T>(s: string | null | undefined): T | null {
  if (!s) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}
