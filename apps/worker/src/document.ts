import { DurableObject } from "cloudflare:workers";
import type {
  ClassifiedSentence,
  EngineContext,
  RewriteResult,
  StylometricProfile,
} from "@prosodeus/core";
import {
  classifyText,
  engineAnalyze,
  engineEquilibrium,
  engineReverseGuide,
  engineRewrite,
  engineSuggest,
  type LLMClassifier,
  rewriteOppositions,
} from "@prosodeus/core";
import type {
  ClientMessage,
  EquilibriumMessage,
  OppositionMessage,
  RewriteAlternative,
  RewriteConstraints,
} from "@prosodeus/shared";
import type { LanguageModel } from "ai";
import { createDb, type Database } from "./db/index.ts";
import { getPromptsByName } from "./db/queries/prompts.ts";
import { createGuide } from "./db/queries/style-guides.ts";
import { DOCache } from "./do-cache.ts";
import type { Env } from "./index.ts";
import { runDOMigrations } from "./migrations.ts";
import {
  buildCouncilModels as buildCouncilModelsFn,
  createClassifier as createClassifierFn,
  createGateClassifier as createGateClassifierFn,
  createMediumClassifier as createMediumClassifierFn,
  getModelDisplayName,
  resolveModel as resolveModelFn,
} from "./models.ts";

// ─── Local Response Types (not in shared — DO-internal) ─────────────────────

interface ProgressMessage {
  type: "progress";
  total: number;
  cached: number;
  classifying: number;
}

interface RewriteProgressMessage {
  type: "rewrite_progress";
  step: string;
}

interface RewriteResultMessage {
  type: "rewrite_result";
  data: RewriteResult;
}

interface RewriteAlternativesMessage {
  type: "rewrite_alternatives";
  data: {
    original: string;
    constraints: RewriteConstraints | null;
    alternatives: RewriteAlternative[];
  };
}

interface ErrorMessage {
  type: "error";
  message: string;
}

// ─── Reverse Guide Message (client → server) ───────────────────────────────

interface ReverseGuideMessage {
  type: "reverse_guide";
  text: string;
  name: string;
  description: string;
}

interface SuggestRewritesMessage {
  type: "suggest_rewrites";
  sentence_id: number;
  text: string;
  models?: string[];
  mode?: "single" | "council";
  level?: "word" | "sentence" | "paragraph";
  custom_instruction?: string;
  num_alternatives?: number;
}

interface OppositionProgressMessage {
  type: "opposition_progress";
  step: string;
}

interface OppositionResultMessage {
  type: "opposition_result";
  data: {
    original_text: string;
    rewritten_text: string;
    edits: Array<{
      span: {
        sentence_id: number;
        pattern_type: string;
        text: string;
        evidence?: string;
      };
      original_sentence: string;
      rewritten_sentence: string;
      verdict: "vacuous" | "earned" | "uncertain";
      fidelity_score: number;
      fidelity_reason: string;
      accepted: boolean;
    }>;
    metrics: {
      passes: number;
      spans_detected: number;
      vacuous_spans: number;
      earned_spans: number;
      uncertain_spans: number;
      accepted_edits: number;
      rejected_edits: number;
      fidelity_failures: number;
    };
  };
}

type WSMessage = ClientMessage | ReverseGuideMessage | SuggestRewritesMessage;

/**
 * DocumentAnalyzer Durable Object — one per document.
 * Owns SQLite with sentences, hash_cache, iterations tables.
 * Handles WebSocket via hibernation API.
 *
 * All sql.run calls below use the Cloudflare Durable Object
 * SQLite API (DurableObjectStorage.sql), not child_process.
 */
export class DocumentAnalyzer extends DurableObject<Env> {
  private cache: DOCache | null = null;
  private migrated = false;
  private cachedPrompts: { classifier?: string; rewriter?: string } = {};
  private _db: Database | null = null;

  private get db(): Database {
    if (!this._db) this._db = createDb(this.env.HYPERDRIVE.connectionString);
    return this._db;
  }

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // Auto ping/pong for hibernation
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }

  private ensureMigrated() {
    if (!this.migrated) {
      runDOMigrations(this.ctx.storage);
      this.migrated = true;
    }
  }

  private getCache(): DOCache {
    if (!this.cache) {
      this.ensureMigrated();
      this.cache = new DOCache(this.ctx.storage.sql, this.env.CACHE);
    }
    return this.cache;
  }

  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.endsWith("/ws")) {
      const userId = url.searchParams.get("userId") ?? "anonymous";
      const pair = new WebSocketPair();
      this.ctx.acceptWebSocket(pair[1], [`userId:${userId}`]);
      return new Response(null, { status: 101, webSocket: pair[0] });
    }

    return new Response("Not found", { status: 404 });
  }

  /** Extract userId from WebSocket tags set during upgrade */
  private getUserId(ws: WebSocket): string {
    const tags = this.ctx.getTags(ws);
    const tag = tags.find((t) => t.startsWith("userId:"));
    return tag ? tag.slice(7) : "anonymous";
  }

  override async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    if (typeof message !== "string") return;

    // Lazy-load system prompts from Postgres on first message
    await this.loadPrompts();

    try {
      const msg = JSON.parse(message) as WSMessage;
      switch (msg.type) {
        case "analyze":
          await this.handleAnalyze(ws, msg);
          break;
        case "rewrite":
          await this.handleRewrite(ws, msg);
          break;
        case "equilibrium":
          await this.handleEquilibrium(ws, msg);
          break;
        case "reverse_guide":
          await this.handleReverseGuide(ws, msg as ReverseGuideMessage);
          break;
        case "suggest_rewrites":
          await this.handleSuggestRewrites(ws, msg as SuggestRewritesMessage);
          break;
        case "save":
          await this.handleSave(ws, msg);
          break;
        case "load_content":
          await this.handleLoadContent(ws);
          break;
        case "list_iterations":
          await this.handleListIterations(ws);
          break;
        case "list_versions":
          await this.handleListVersions(ws);
          break;
        case "create_version":
          await this.handleCreateVersion(
            ws,
            msg as { type: "create_version"; content: string; name?: string },
          );
          break;
        case "get_version":
          await this.handleGetVersion(ws, msg as { type: "get_version"; version_id: number });
          break;
        case "compare_versions":
          await this.handleCompareVersions(
            ws,
            msg as { type: "compare_versions"; version_a: number; version_b: number },
          );
          break;
        case "opposition_run":
          await this.handleOpposition(ws, msg as OppositionMessage);
          break;
      }
    } catch (err) {
      const error: ErrorMessage = {
        type: "error",
        message: err instanceof Error ? err.message : "Unknown error",
      };
      ws.send(JSON.stringify(error));
    }
  }

  override async webSocketClose(ws: WebSocket, code: number) {
    ws.close(code, "Durable Object is closing WebSocket");
  }

  private static readonly MAX_TEXT_LENGTH = 250_000; // ~50k words

  // ─── Engine context builder ─────────────────────────────────────────────

  private buildCtx(ws?: WebSocket, model?: string): EngineContext {
    const userId = ws ? this.getUserId(ws) : "anonymous";
    const gate = createGateClassifierFn(this.env);
    const medium = createMediumClassifierFn(this.env, model);
    return {
      cache: this.getCache(),
      suggestionCache: this.getCache(),
      classifier: this.createClassifier(model),
      gateClassifier: gate ?? undefined,
      mediumClassifier: medium ?? undefined,
      resolveModel: (spec) => {
        if (spec === "default" || spec === "classifier") {
          // Fast non-reasoning models only — reasoning tokens (qwen3) sit on
          // the critical path of every analysis.
          return (
            this.resolveModel("google", "gemini-2.5-flash") ??
            this.resolveModel("groq", "llama-3.3-70b-versatile") ??
            this.resolveModel("mistral", "mistral-small-latest")
          );
        }
        const [provider = "", ...rest] = spec.split("/");
        return this.resolveModel(provider, rest.join("/"));
      },
      persistIteration: (_, profile, sentences) => this.persistIteration(profile, sentences),
      maybeSnapshot: (_, text, profile) => {
        const latest = this.latestVersionContent();
        if (latest !== text) this.persistVersion(text, profile, "auto");
      },
    };
  }

  // ─── Handlers ─────────────────────────────────────────────────────────────

  private async handleAnalyze(
    ws: WebSocket,
    msg: {
      text: string;
      style?: string;
      model?: string;
      top_suggestions?: number;
      analyze_mode?: "full" | "incremental";
      changed_sentence_ids?: number[];
      scope?: "document" | "viewport";
      suggest_mode?: "batch" | "none";
      ai_slop_mode?: "off" | "fast" | "tiered" | "exhaustive";
    },
  ) {
    const {
      text,
      style,
      model,
      top_suggestions,
      analyze_mode,
      changed_sentence_ids,
      suggest_mode,
      ai_slop_mode,
    } = msg;

    if (!text?.trim()) {
      ws.send(JSON.stringify({ type: "error", message: "Empty text" } satisfies ErrorMessage));
      return;
    }

    if (text.length > DocumentAnalyzer.MAX_TEXT_LENGTH) {
      ws.send(
        JSON.stringify({
          type: "error",
          message: "Text exceeds 50,000 word limit",
        } satisfies ErrorMessage),
      );
      return;
    }

    const ctx = this.buildCtx(ws, model);
    const incremental = analyze_mode === "incremental";
    const suggestMode = suggest_mode ?? (incremental ? "none" : "batch");
    const topSuggestions = top_suggestions ?? (suggestMode === "batch" ? 3 : 0);

    const result = await engineAnalyze(text, ctx, {
      documentId: this.ctx.id.toString(),
      style,
      onProgress: (p) =>
        ws.send(JSON.stringify({ type: "progress", ...p } satisfies ProgressMessage)),
      onPartialProfile: (profile, done) => {
        ws.send(JSON.stringify({ type: "profile_partial", data: profile, done }));
      },
      changedSentenceIds: changed_sentence_ids,
      topSuggestions,
      suggestMode,
      aiSlopMode: ai_slop_mode,
    });

    ws.send(JSON.stringify({ type: "profile", data: result.profile }));

    // Deliver suggestions as a follow-up message so the heat map renders
    // without waiting on the heavier suggestion model. Awaited here (not
    // detached) to keep the work inside the request lifetime of the DO.
    if (result.suggestionsPromise) {
      const suggestions = await result.suggestionsPromise;
      ws.send(JSON.stringify({ type: "suggestions", data: suggestions }));
    }
  }

  private async handleRewrite(
    ws: WebSocket,
    msg: {
      text: string;
      style?: string;
      model?: string;
      passage_start?: number;
      passage_end?: number;
      use_pce?: boolean;
      n?: number;
      constraints?: RewriteConstraints;
      context_hint?: "paragraph" | "section" | "auto";
    },
  ) {
    const {
      text,
      style,
      model,
      passage_start,
      passage_end,
      use_pce,
      n: requestedN,
      constraints,
      context_hint,
    } = msg;

    if (!text?.trim()) {
      ws.send(JSON.stringify({ type: "error", message: "Empty text" } satisfies ErrorMessage));
      return;
    }

    if (text.length > DocumentAnalyzer.MAX_TEXT_LENGTH) {
      ws.send(
        JSON.stringify({
          type: "error",
          message: "Text exceeds 50,000 word limit",
        } satisfies ErrorMessage),
      );
      return;
    }

    // Context expansion is a pre-engine step (paragraph boundary awareness)
    const ctx = this.buildCtx(ws, model);
    let passageStart = passage_start;
    let passageEnd = passage_end;
    let contextPrefix = "";
    let contextSuffix = "";

    const hint = context_hint ?? "auto";
    if (
      passageStart !== undefined &&
      passageEnd !== undefined &&
      (hint === "auto" || hint === "paragraph")
    ) {
      const { profile } = await classifyText(text, ctx, style);
      if (profile.sentences.length > 0) {
        const startSentence = profile.sentences.find((s) => s.id === passageStart);
        const endSentence = profile.sentences.find((s) => s.id === passageEnd);
        if (startSentence && endSentence) {
          const startParaId = startSentence.paragraph_id;
          const endParaId = endSentence.paragraph_id;
          passageStart =
            profile.sentences.find((s) => s.paragraph_id === startParaId)?.id ?? passageStart;
          passageEnd =
            [...profile.sentences].reverse().find((s) => s.paragraph_id === endParaId)?.id ??
            passageEnd;
          if (startParaId > 0) {
            const prev = profile.sentences.filter((s) => s.paragraph_id === startParaId - 1);
            if (prev.length > 0) contextPrefix = prev.map((s) => s.text).join(" ");
          }
          const next = profile.sentences.filter((s) => s.paragraph_id === endParaId + 1);
          if (next.length > 0) contextSuffix = next.map((s) => s.text).join(" ");
        }
      }
    }

    const result = await engineRewrite(text, ctx, {
      style,
      passageStart,
      passageEnd,
      usePCE: use_pce,
      n: requestedN,
      constraints,
      contextPrefix,
      contextSuffix,
      onProgress: (step) =>
        ws.send(
          JSON.stringify({ type: "rewrite_progress", step } satisfies RewriteProgressMessage),
        ),
    });

    if (result.kind === "single") {
      ws.send(
        JSON.stringify({
          type: "rewrite_result",
          data: result.data,
        } satisfies RewriteResultMessage),
      );
    } else {
      ws.send(
        JSON.stringify({
          type: "rewrite_alternatives",
          data: result.data,
        } satisfies RewriteAlternativesMessage),
      );
    }
  }

  private async handleEquilibrium(ws: WebSocket, msg: EquilibriumMessage) {
    const { text, style, model } = msg;

    if (!text?.trim()) {
      ws.send(JSON.stringify({ type: "error", message: "Empty text" } satisfies ErrorMessage));
      return;
    }

    if (text.length > DocumentAnalyzer.MAX_TEXT_LENGTH) {
      ws.send(
        JSON.stringify({
          type: "error",
          message: "Text exceeds 50,000 word limit",
        } satisfies ErrorMessage),
      );
      return;
    }

    const councilModels = this.buildCouncilModels();
    if (councilModels.length === 0) {
      ws.send(
        JSON.stringify({
          type: "error",
          message: "No council models available — configure GROQ_API_KEY or MISTRAL_API_KEY",
        } satisfies ErrorMessage),
      );
      return;
    }

    const ctx = this.buildCtx(ws, model);
    const eqClassifier = this.createClassifier(model);

    const result = await engineEquilibrium(text, ctx, {
      style,
      councilModels,
      classifier: eqClassifier,
      maxRounds: 3,
      onProgress: (round) =>
        ws.send(JSON.stringify({ type: "equilibrium_progress", round: round.round })),
    });

    ws.send(JSON.stringify({ type: "equilibrium_result", data: result }));
  }

  private async handleReverseGuide(ws: WebSocket, msg: ReverseGuideMessage) {
    const { text, name, description } = msg;

    if (!text?.trim()) {
      ws.send(
        JSON.stringify({ type: "error", message: "Empty exemplar text" } satisfies ErrorMessage),
      );
      return;
    }

    if (!name?.trim()) {
      ws.send(
        JSON.stringify({ type: "error", message: "Guide name required" } satisfies ErrorMessage),
      );
      return;
    }

    const ctx = this.buildCtx(ws);
    const guide = await engineReverseGuide(text, ctx, {
      name: name.trim(),
      description: description?.trim() || "",
    });

    // Persist to Postgres
    const userId = this.getUserId(ws);
    if (userId !== "anonymous") {
      try {
        const guideId = crypto.randomUUID();
        await createGuide(this.db, {
          id: guideId,
          name: guide.name,
          description: guide.description ?? "",
          targets: JSON.stringify(guide.targets),
          userId,
        });
      } catch {
        // DB unavailable or table missing — guide still returned to client
      }
    }

    ws.send(JSON.stringify({ type: "reverse_guide_result", data: guide }));
  }

  private async handleSuggestRewrites(ws: WebSocket, msg: SuggestRewritesMessage) {
    const {
      text,
      sentence_id,
      models: modelIds,
      mode,
      level,
      custom_instruction,
      num_alternatives,
    } = msg;

    if (!text?.trim()) {
      ws.send(JSON.stringify({ type: "error", message: "Empty text" } satisfies ErrorMessage));
      return;
    }

    // Resolve models — use requested list, or default to single best available
    const resolvedModels: Array<{ id: string; model: import("ai").LanguageModel }> = [];
    if (modelIds && modelIds.length > 0) {
      for (const id of modelIds) {
        const [provider = "", ...rest] = id.split("/");
        const resolved = this.resolveModel(provider, rest.join("/"));
        if (resolved) resolvedModels.push({ id, model: resolved });
      }
    }
    if (mode !== "council" && resolvedModels.length > 1) resolvedModels.splice(1);
    if (resolvedModels.length === 0) {
      const defaultModel =
        this.resolveModel("google", "gemini-2.5-flash") ??
        this.resolveModel("groq", "llama-3.3-70b-versatile");
      if (defaultModel) resolvedModels.push({ id: "google/gemini-2.5-flash", model: defaultModel });
    }
    if (resolvedModels.length === 0) {
      ws.send(
        JSON.stringify({
          type: "error",
          message: "No models available for suggestions",
        } satisfies ErrorMessage),
      );
      return;
    }
    const primaryModel = resolvedModels[0];
    if (!primaryModel) {
      ws.send(
        JSON.stringify({
          type: "error",
          message: "No models available for suggestions",
        } satisfies ErrorMessage),
      );
      return;
    }

    // For multi-model fan-out, use the first model via engine, then fan out remaining
    const ctx = this.buildCtx(ws);
    const suggestions = await engineSuggest(text, ctx, {
      sentenceId: sentence_id,
      model: primaryModel.model,
      level: level ?? "sentence",
      numAlternatives: num_alternatives,
      customInstruction: custom_instruction,
      modelName: getModelDisplayName(primaryModel.id),
    });

    // If multiple models requested, fan out remaining models in parallel
    if (resolvedModels.length > 1) {
      const { suggestRewrites: suggestRewritesFn } = await import("@prosodeus/core");
      const { profile } = await classifyText(text, ctx);
      const target = profile.sentences.find((s) => s.id === sentence_id);
      if (target) {
        const before =
          sentence_id > 0
            ? (profile.sentences.find((s) => s.id === sentence_id - 1)?.text ?? "")
            : "";
        const after =
          sentence_id < profile.sentences.length - 1
            ? (profile.sentences.find((s) => s.id === sentence_id + 1)?.text ?? "")
            : "";
        let paragraph: string | undefined;
        if (level === "paragraph") {
          paragraph = profile.sentences
            .filter((s) => s.paragraph_id === target.paragraph_id)
            .map((s) => s.text)
            .join(" ");
        }
        const extra = await Promise.allSettled(
          resolvedModels.slice(1).map(({ id, model }) =>
            suggestRewritesFn(target as ClassifiedSentence, { before, after, paragraph }, model, {
              level: level ?? "sentence",
              numAlternatives: num_alternatives,
              customInstruction: custom_instruction,
              modelName: getModelDisplayName(id),
            }),
          ),
        );
        for (const r of extra) {
          if (r.status === "fulfilled") suggestions.push(...r.value);
        }
      }
    }

    ws.send(JSON.stringify({ type: "rewrite_suggestions", data: suggestions }));
  }

  private async handleSave(ws: WebSocket, msg: { content: string }) {
    this.ensureMigrated();
    const sql = this.ctx.storage.sql;

    sql.exec(
      `CREATE TABLE IF NOT EXISTS document_content (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        content TEXT NOT NULL,
        updated_at TEXT DEFAULT (datetime('now'))
      )`,
    );
    sql.exec(
      "INSERT OR REPLACE INTO document_content (id, content, updated_at) VALUES (1, ?, datetime('now'))",
      msg.content,
    );

    ws.send(JSON.stringify({ type: "saved" }));
  }

  private async handleLoadContent(ws: WebSocket) {
    this.ensureMigrated();
    const sql = this.ctx.storage.sql;

    sql.exec(
      `CREATE TABLE IF NOT EXISTS document_content (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        content TEXT NOT NULL,
        updated_at TEXT DEFAULT (datetime('now'))
      )`,
    );

    const rows = [...sql.exec("SELECT content FROM document_content WHERE id = 1")];
    const content = rows.length > 0 ? (rows[0] as { content: string }).content : null;

    ws.send(JSON.stringify({ type: "content", data: content }));
  }

  private async handleListIterations(ws: WebSocket) {
    this.ensureMigrated();
    const sql = this.ctx.storage.sql;

    const rows = [
      ...sql.exec(
        "SELECT id, created_at, source, profile FROM iterations ORDER BY created_at DESC LIMIT 50",
      ),
    ];

    const iterations = rows.map((row: Record<string, unknown>) => {
      let profile: { mean_heat?: number; sentence_count?: number; word_count?: number } = {};
      try {
        profile = JSON.parse(row.profile as string);
      } catch {
        /* ignore */
      }
      return {
        id: row.id,
        created_at: row.created_at,
        source: row.source,
        mean_heat: profile.mean_heat ?? 0,
        sentence_count: profile.sentence_count ?? 0,
        word_count: profile.word_count ?? 0,
      };
    });

    ws.send(JSON.stringify({ type: "iterations", data: iterations }));
  }

  // ─── Persistence ──────────────────────────────────────────────────────────

  private persistIteration(profile: StylometricProfile, sentences: ClassifiedSentence[]) {
    this.ensureMigrated();
    const sql = this.ctx.storage.sql;

    sql.exec(
      "INSERT INTO iterations (source, profile) VALUES (?, ?)",
      "websocket",
      JSON.stringify(profile),
    );

    const iterRows = [...sql.exec("SELECT last_insert_rowid() as id")];
    const iterationId = (iterRows[0] as { id: number }).id;

    for (const s of sentences) {
      sql.exec(
        "INSERT OR REPLACE INTO sentences (id, text, hash, paragraph_id, classification, heat, iteration_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
        s.id,
        s.text,
        s.hash,
        s.paragraph_id,
        JSON.stringify(s.classification),
        s.heat,
        iterationId,
      );
    }
  }

  // ─── Version Handlers ──────────────────────────────────────────────────────

  private latestVersionContent(): string | null {
    this.ensureMigrated();
    const rows = [
      ...this.ctx.storage.sql.exec("SELECT content FROM versions ORDER BY created_at DESC LIMIT 1"),
    ];
    if (rows.length === 0) return null;
    return (rows[0] as { content: string }).content;
  }

  private persistVersion(
    content: string,
    profile: StylometricProfile,
    source: string,
    name?: string,
  ) {
    this.ensureMigrated();
    const wordCount = content.split(/\s+/).filter(Boolean).length;
    this.ctx.storage.sql.exec(
      "INSERT INTO versions (content, name, source, word_count, profile) VALUES (?, ?, ?, ?, ?)",
      content,
      name ?? null,
      source,
      wordCount,
      JSON.stringify(profile),
    );
  }

  private async handleListVersions(ws: WebSocket) {
    this.ensureMigrated();
    const rows = [
      ...this.ctx.storage.sql.exec(
        "SELECT id, name, source, created_at, word_count, profile FROM versions ORDER BY created_at DESC LIMIT 100",
      ),
    ];
    const versions = rows.map((row: Record<string, unknown>) => {
      let meanHeat = 0;
      try {
        meanHeat = JSON.parse(row.profile as string).mean_heat ?? 0;
      } catch {
        /* */
      }
      return {
        id: row.id,
        name: row.name,
        source: row.source,
        created_at: row.created_at,
        word_count: row.word_count,
        mean_heat: meanHeat,
      };
    });
    ws.send(JSON.stringify({ type: "versions", data: versions }));
  }

  private async handleCreateVersion(
    ws: WebSocket,
    msg: { content: string; name?: string; source?: string },
  ) {
    if (!msg.content?.trim()) {
      ws.send(JSON.stringify({ type: "error", message: "Empty content" }));
      return;
    }
    const ctx = this.buildCtx(ws);
    const { profile } = await classifyText(msg.content, ctx);
    this.persistVersion(msg.content, profile, msg.source ?? "manual", msg.name);
    await this.handleListVersions(ws);
  }

  private async handleGetVersion(ws: WebSocket, msg: { version_id: number }) {
    this.ensureMigrated();
    const rows = [
      ...this.ctx.storage.sql.exec(
        "SELECT id, content, profile FROM versions WHERE id = ?",
        msg.version_id,
      ),
    ];
    if (rows.length === 0) {
      ws.send(JSON.stringify({ type: "error", message: "Version not found" }));
      return;
    }
    const row = rows[0] as Record<string, unknown>;
    let profile = null;
    try {
      profile = JSON.parse(row.profile as string);
    } catch {
      /* */
    }
    ws.send(
      JSON.stringify({
        type: "version_content",
        data: { id: row.id, content: row.content, profile },
      }),
    );
  }

  private async handleCompareVersions(
    ws: WebSocket,
    msg: { version_a: number; version_b: number },
  ) {
    this.ensureMigrated();
    const rowsA = [
      ...this.ctx.storage.sql.exec(
        "SELECT id, content, profile FROM versions WHERE id = ?",
        msg.version_a,
      ),
    ];
    const rowsB = [
      ...this.ctx.storage.sql.exec(
        "SELECT id, content, profile FROM versions WHERE id = ?",
        msg.version_b,
      ),
    ];
    if (rowsA.length === 0 || rowsB.length === 0) {
      ws.send(JSON.stringify({ type: "error", message: "Version not found" }));
      return;
    }
    const parse = (r: Record<string, unknown>) => {
      let p = null;
      try {
        p = JSON.parse(r.profile as string);
      } catch {
        /* */
      }
      return { id: r.id, content: r.content, profile: p };
    };
    ws.send(
      JSON.stringify({
        type: "version_compare",
        data: {
          a: parse(rowsA[0] as Record<string, unknown>),
          b: parse(rowsB[0] as Record<string, unknown>),
        },
      }),
    );
  }

  private async handleOpposition(ws: WebSocket, msg: OppositionMessage) {
    const { text, style, model, max_passes } = msg;

    if (!text?.trim()) {
      ws.send(JSON.stringify({ type: "error", message: "Empty text" } satisfies ErrorMessage));
      return;
    }

    if (text.length > DocumentAnalyzer.MAX_TEXT_LENGTH) {
      ws.send(
        JSON.stringify({
          type: "error",
          message: "Text exceeds 50,000 word limit",
        } satisfies ErrorMessage),
      );
      return;
    }

    const ctx = this.buildCtx(ws, model);
    if (!ctx.resolveModel) {
      ws.send(
        JSON.stringify({
          type: "error",
          message: "Opposition rewriter context not configured",
        } satisfies ErrorMessage),
      );
      return;
    }

    const judgeModel = ctx.resolveModel(model ?? "default");
    const rewriteModel = ctx.resolveModel(model ?? "default");
    if (!judgeModel || !rewriteModel) {
      ws.send(
        JSON.stringify({
          type: "error",
          message: "No model available for the opposition rewriter",
        } satisfies ErrorMessage),
      );
      return;
    }

    const result = await rewriteOppositions(text, {
      classifier: ctx.classifier,
      cache: ctx.cache,
      judgeModel,
      rewriteModel,
      maxPasses: max_passes,
      style,
      onProgress: (step) =>
        ws.send(
          JSON.stringify({ type: "opposition_progress", step } satisfies OppositionProgressMessage),
        ),
    });

    const payload: OppositionResultMessage = {
      type: "opposition_result",
      data: {
        original_text: result.originalText,
        rewritten_text: result.rewrittenText,
        edits: result.edits.map((e) => ({
          span: {
            sentence_id: e.span.sentenceId,
            sentence_end_id: e.span.sentenceEndId,
            pattern_type: e.span.patternType,
            text: e.span.text,
            evidence: e.span.evidence,
          },
          original_sentence: e.originalSentence,
          rewritten_sentence: e.rewrittenSentence,
          verdict: e.verdict,
          fidelity_score: e.fidelityScore,
          fidelity_reason: e.fidelityReason,
          accepted: e.accepted,
          alternatives: e.alternatives,
        })),
        metrics: {
          passes: result.metrics.passes,
          spans_detected: result.metrics.spansDetected,
          vacuous_spans: result.metrics.vacuousSpans,
          earned_spans: result.metrics.earnedSpans,
          uncertain_spans: result.metrics.uncertainSpans,
          accepted_edits: result.metrics.acceptedEdits,
          rejected_edits: result.metrics.rejectedEdits,
          fidelity_failures: result.metrics.fidelityFailures,
        },
      },
    };

    ws.send(JSON.stringify(payload));
  }

  // ─── Model Helpers (delegated to pure functions in models.ts) ────────────

  private buildCouncilModels(): LanguageModel[] {
    return buildCouncilModelsFn(this.env);
  }

  private createClassifier(modelSpec?: string): LLMClassifier {
    return createClassifierFn(this.env, modelSpec, this.cachedPrompts.classifier);
  }

  private resolveModel(provider: string, modelId: string) {
    return resolveModelFn(this.env, provider, modelId);
  }

  /** Load system prompts from Postgres, caching for the DO's lifetime */
  private async loadPrompts(): Promise<{ classifier?: string; rewriter?: string }> {
    if (this.cachedPrompts.classifier || this.cachedPrompts.rewriter) return this.cachedPrompts;
    try {
      const rows = await getPromptsByName(this.db, ["classifier", "rewriter"]);
      for (const row of rows) {
        if (row.name === "classifier") this.cachedPrompts.classifier = row.content;
        if (row.name === "rewriter") this.cachedPrompts.rewriter = row.content;
      }
    } catch {
      // Table may not exist yet — use defaults
    }
    return this.cachedPrompts;
  }
}
