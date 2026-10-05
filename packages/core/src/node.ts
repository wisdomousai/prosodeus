/**
 * Node/Bun entry for `@prosodeus/core`.
 *
 * Contains everything needed by the desktop app and CLI that depends on
 * Node-only modules (sqlite, fs, etc.). The browser entry (`./browser`) and
 * default entry (`./`) deliberately exclude these so web bundles stay clean.
 */

// Re-export everything from the default entry — the desktop wants the full
// classifier/analyzer pipeline plus the SQLite-backed store on top.
export * from "./index.ts";
// Agent SDK model adapter (wraps query() as LanguageModel)
export { createAgentSDKModel } from "./models/agent-sdk-model.ts";
export type { CodexExecOutput } from "./models/codex-model.ts";
// Codex CLI model adapter (wraps `codex exec` as LanguageModel).
// Node-only: spawns a child process, so it must never enter the workerd bundle.
export { codexModelId, createCodexModel, parseCodexExecOutput } from "./models/codex-model.ts";
export { createBunSqliteAdapter } from "./storage/db/bun-sqlite-adapter.ts";
export { migrate, SCHEMA_SQL, SCHEMA_VERSION } from "./storage/db/schema.ts";
export type { SqlExecutor } from "./storage/db/sql-executor.ts";
export type {
  DocumentRow,
  IterationRow,
  VersionContentRow,
  VersionRow,
} from "./storage/document-store.ts";
// SQLite-backed document store
export { DocumentStore } from "./storage/document-store.ts";
