import type {
  AgentSDKClassifier as AgentSDKClassifierType,
  AnalyzeOptions,
  ClassificationCache,
  ClassifiedSentence,
  DocumentStore,
  EngineContext,
  LLMClassifier as LLMClassifierType,
  RewriteSuggestion,
  StylometricProfile,
  SuggestionCache,
} from "@prosodeus/core/node";
import {
  type CodexTaskDepth,
  type CodexTaskModelSelection,
  codexRawModelId,
  createAgentSDKModel,
  createCodexModel,
  engineAnalyze,
  engineEquilibrium,
  engineReverseGuide,
  engineRewrite,
  engineSuggest,
  GateClassifier,
  isRetryableProviderError,
  listMoonshotModelOptions,
  listStyleGuides,
  MediumClassifier,
  moonshotKeyKind,
  type OppositionResult,
  providerFromModelSpec,
  resolveSpeedProfile,
  resolveSuggestCapableSpec,
  rewriteOppositions,
  SUGGEST_CAPABLE_SPECS,
} from "@prosodeus/core/node";
import type { OppositionResultEvent, RewriteConstraints } from "@prosodeus/shared";
import type { LanguageModel } from "ai";
import type { BrowserWindow, IpcMain } from "electron";
import type { ByokStore, Provider } from "./byok-store.ts";
import type { CfCredentialStore } from "./cf-credential-store.ts";
import { hasClaudeCredentials, loginViaRenderer } from "./claude-auth.ts";
import { codexLoginViaRenderer, hasCodexCredentials, hasCodexHost } from "./codex-auth.ts";
import {
  listCodexModelConfigs,
  primeCodexCatalog,
  selectCachedCodexTaskModel,
} from "./codex-catalog.ts";
import { devVarsStatus } from "./dev-vars.ts";
import { buildCfModel, CF_DEFAULT_GATE_MODEL } from "./model-builder.ts";
import { getAllProviderUsage, getUsagePct, incrementProviderUsage } from "./usage-tracker.ts";

type AnalyzeFn = (text: string, opts: AnalyzeOptions) => Promise<StylometricProfile>;

type SplitAndHashFn = (
  text: string,
) => Array<{ id: number; text: string; hash: string; paragraph_id: number }>;

interface AgentSDKClassifierCtor {
  new (opts?: { model?: string; systemPrompt?: string }): AgentSDKClassifierType;
}

interface LLMClassifierCtor {
  new (
    model: LanguageModel,
    systemPrompt?: string,
    options?: import("@prosodeus/core/node").ClassifierOptions,
  ): LLMClassifierType;
}

function speedForProvider(provider: string): ReturnType<typeof resolveSpeedProfile> {
  return resolveSpeedProfile(provider, undefined, getUsagePct(provider));
}

function fallbackCodexSelection(spec: string, task: CodexTaskDepth): CodexTaskModelSelection {
  const model = codexRawModelId(spec);
  return {
    spec,
    model,
    name: model,
    reasoningEffort: task === "rewrite" ? "high" : "low",
  };
}

function selectCodexModelForTask(
  task: CodexTaskDepth,
  preferredSpec?: string,
): CodexTaskModelSelection | null {
  return (
    selectCachedCodexTaskModel(task, preferredSpec) ??
    (preferredSpec && providerFromSpec(preferredSpec) === "codex"
      ? fallbackCodexSelection(preferredSpec, task)
      : null)
  );
}

function createCodexTaskModel(task: CodexTaskDepth, preferredSpec?: string): LanguageModel | null {
  const selection = selectCodexModelForTask(task, preferredSpec);
  if (!selection) return null;
  return createCodexModelFromSelection(selection);
}

function createCodexModelFromSelection(selection: CodexTaskModelSelection): LanguageModel {
  return createCodexModel(selection.spec, { reasoningEffort: selection.reasoningEffort });
}

function buildGateClassifier(deps: IpcDeps, selectedSpec?: string): GateClassifier | undefined {
  if (selectedSpec && providerFromSpec(selectedSpec) === "codex") {
    const model = createCodexTaskModel("classifier", selectedSpec);
    if (!model) return undefined;
    const speed = speedForProvider("codex");
    return new GateClassifier(model, undefined, speed.gate);
  }

  let provider = "groq";
  let model: LanguageModel | null = null;

  if (deps.cfStore.isConfigured()) {
    const creds = deps.cfStore.get();
    if (creds) {
      provider = "cloudflare";
      model = buildCfModel(CF_DEFAULT_GATE_MODEL, creds.accountId, creds.apiToken);
    }
  } else {
    const groqKey = deps.byokStore.get("groq");
    if (groqKey) {
      model = deps.buildModel("groq", "qwen/qwen3-32b", groqKey);
    } else {
      const googleKey = deps.byokStore.get("google");
      if (googleKey) {
        provider = "google";
        model = deps.buildModel("google", "gemini-2.5-flash", googleKey);
      }
    }
  }

  if (!model) return undefined;
  const speed = speedForProvider(provider);
  return new GateClassifier(model, undefined, speed.gate);
}

function buildMediumClassifier(deps: IpcDeps, spec: string): MediumClassifier | undefined {
  const provider = providerFromModelSpec(spec);
  if (provider === "codex") {
    const model = createCodexTaskModel("classifier", spec);
    if (!model) return undefined;
    const speed = speedForProvider("codex");
    return new MediumClassifier(model, undefined, speed.medium);
  }
  if (provider === "claude") return undefined;
  const model = resolveLanguageModel(deps, spec);
  if (!model) return undefined;
  const speed = speedForProvider(provider);
  return new MediumClassifier(model, undefined, speed.medium);
}

/** Build a `LanguageModel` for a given provider using the user's BYOK key. */
export type ModelBuilder = (provider: Provider, modelId: string, apiKey: string) => LanguageModel;

export interface IpcDeps {
  documentStore: DocumentStore;
  classificationCache: ClassificationCache & SuggestionCache;
  byokStore: ByokStore;
  cfStore: CfCredentialStore;
  analyzePipeline: AnalyzeFn;
  splitAndHash: SplitAndHashFn;
  AgentSDKClassifier: AgentSDKClassifierCtor;
  LLMClassifier: LLMClassifierCtor;
  buildModel: ModelBuilder;
  /** Returns the active main window, used to stream Claude login progress to the renderer. */
  getMainWindow: () => BrowserWindow | null;
}

// ─── Model Resolution ─────────────────────────────────────────────────────

function providerFromSpec(spec: string): string {
  if (spec.startsWith("claude")) return "claude";
  if (spec.startsWith("codex")) return "codex";
  if (spec.startsWith("cloudflare/")) return "cloudflare";
  const slashIdx = spec.indexOf("/");
  return slashIdx > 0 ? spec.slice(0, slashIdx) : spec;
}

/** Default classifier model when the user hasn't picked one explicitly. */
function resolveDefaultClassifierSpec(deps: IpcDeps): string {
  if (hasCodexHost()) return "codex-gpt-5.5";
  if (deps.cfStore.isConfigured()) {
    return `cloudflare/${CF_DEFAULT_GATE_MODEL}`;
  }
  if (deps.byokStore.get("groq")) return "groq/qwen/qwen3-32b";
  if (deps.byokStore.get("moonshot")) {
    const kind = moonshotKindForDeps(deps);
    return kind === "coding" ? "moonshot/kimi-for-coding" : "moonshot/kimi-k2.6";
  }
  if (deps.byokStore.get("google")) return "google/gemini-2.5-flash";
  if (deps.byokStore.listConfigured().includes("mistral")) {
    return "mistral/mistral-small-2506";
  }
  return "claude-haiku-4-5";
}

function buildClassifierFromSpec(
  deps: IpcDeps,
  spec: string,
): {
  classifier: {
    classify(
      sentences: Array<{ id: number; text: string; hash: string; paragraph_id: number }>,
    ): Promise<ClassifiedSentence[]>;
  };
  provider: string;
} {
  if (spec.startsWith("claude")) {
    const native = spec.replace("claude/", "").replace("haiku-4.5", "claude-haiku-4-5");
    return { classifier: new deps.AgentSDKClassifier({ model: native }), provider: "claude" };
  }

  if (spec.startsWith("codex")) {
    const speed = speedForProvider("codex");
    const model = createCodexTaskModel("classifier", spec) ?? createCodexModel(spec);
    return {
      classifier: new deps.LLMClassifier(model, undefined, speed.full),
      provider: "codex",
    };
  }

  if (spec.startsWith("cloudflare/")) {
    const creds = deps.cfStore.get();
    if (creds) {
      const modelId = spec.slice("cloudflare/".length) || CF_DEFAULT_GATE_MODEL;
      const speed = speedForProvider("cloudflare");
      return {
        classifier: new deps.LLMClassifier(
          buildCfModel(modelId, creds.accountId, creds.apiToken),
          undefined,
          speed.full,
        ),
        provider: "cloudflare",
      };
    }
    console.warn("[buildClassifierFromSpec] cloudflare credentials missing, using Claude fallback");
    return {
      classifier: new deps.AgentSDKClassifier({ model: "claude-haiku-4-5" }),
      provider: "claude",
    };
  }

  const slashIdx = spec.indexOf("/");
  const provider = (slashIdx > 0 ? spec.slice(0, slashIdx) : spec) as Provider;
  const modelId = slashIdx > 0 ? spec.slice(slashIdx + 1) : spec;
  const apiKey = deps.byokStore.get(provider);

  if (apiKey) {
    const speed = speedForProvider(provider);
    return {
      classifier: new deps.LLMClassifier(
        deps.buildModel(provider, modelId, apiKey),
        undefined,
        speed.full,
      ),
      provider,
    };
  }

  if (
    provider === "mistral" ||
    provider === "groq" ||
    provider === "google" ||
    provider === "openai"
  ) {
    console.warn(`[buildClassifierFromSpec] ${provider} key missing, using Claude fallback`);
    return {
      classifier: new deps.AgentSDKClassifier({ model: "claude-haiku-4-5" }),
      provider: "claude",
    };
  }

  return {
    classifier: new deps.AgentSDKClassifier({ model: "claude-haiku-4-5" }),
    provider: "claude",
  };
}

/**
 * Resolve a model spec ("claude-haiku-4-5", "groq/qwen/qwen3-32b", etc.)
 * to a Vercel AI SDK `LanguageModel`.
 *
 * Three-way routing:
 *  1. Claude → Agent SDK model adapter (uses Claude Code credentials)
 *  2. Other provider with BYOK key → direct LanguageModel from user's key
 *  3. No key available → throws (caller should handle or fall back to Worker)
 */
function resolveLanguageModel(
  deps: IpcDeps,
  spec: string,
  opts: { fallback?: boolean; codexTask?: CodexTaskDepth } = {},
): LanguageModel | null {
  const fallback = opts.fallback ?? true;

  if (spec.startsWith("claude")) {
    const native = spec.replace("claude/", "").replace("haiku-4.5", "claude-haiku-4-5");
    return createAgentSDKModel(native);
  }

  if (spec.startsWith("codex")) {
    return opts.codexTask ? createCodexTaskModel(opts.codexTask, spec) : createCodexModel(spec);
  }

  if (spec.startsWith("cloudflare/")) {
    const creds = deps.cfStore.get();
    if (creds) {
      const modelId = spec.slice("cloudflare/".length) || CF_DEFAULT_GATE_MODEL;
      return buildCfModel(modelId, creds.accountId, creds.apiToken);
    }
    if (!fallback) return null;
    console.warn("[resolveLanguageModel] cloudflare credentials missing, falling back to Claude");
    return createAgentSDKModel("claude-haiku-4-5");
  }

  const slashIdx = spec.indexOf("/");
  const provider = (slashIdx > 0 ? spec.slice(0, slashIdx) : spec) as Provider;
  const modelId = slashIdx > 0 ? spec.slice(slashIdx + 1) : spec;

  const apiKey = deps.byokStore.get(provider);
  if (apiKey) {
    return deps.buildModel(provider, modelId, apiKey);
  }

  // Never throw. If the user somehow selected a BYOK model without a key,
  // fall back to Claude so the operation still succeeds.
  if (!fallback) return null;
  console.warn(`[resolveLanguageModel] no key for "${provider}", falling back to Claude`);
  return createAgentSDKModel("claude-haiku-4-5");
}

/**
 * Build an EngineContext for the given model spec.
 * Handles Claude (Agent SDK), BYOK, and Worker fallback routing.
 */
function buildEngineCtx(deps: IpcDeps, model?: string): EngineContext {
  const spec = model ?? resolveDefaultClassifierSpec(deps);
  const { classifier } = buildClassifierFromSpec(deps, spec);
  const gateClassifier = buildGateClassifier(deps, spec);
  const mediumClassifier = buildMediumClassifier(deps, spec);
  const selectedProvider = providerFromSpec(spec);

  return {
    cache: deps.classificationCache,
    suggestionCache: deps.classificationCache,
    classifier,
    gateClassifier,
    mediumClassifier,
    resolveModel: (resolveSpec) => {
      const isDefaultAlias = resolveSpec === "default";
      const isClassifierAlias = resolveSpec === "classifier";
      const isAlias = isDefaultAlias || isClassifierAlias;
      if (selectedProvider === "codex" && isClassifierAlias) {
        return createCodexTaskModel("classifier", spec);
      }
      if (selectedProvider === "codex" && isDefaultAlias) {
        return createCodexTaskModel("rewrite", spec);
      }
      const s = isAlias ? spec : resolveSpec;
      return resolveLanguageModel(deps, s, { fallback: isAlias });
    },
  };
}

function oppositionResultToWire(result: OppositionResult): OppositionResultEvent["data"] {
  return {
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
  };
}

/** Classify with the same provider as the selected suggest model when possible. */
function resolveSuggestClassifySpec(deps: IpcDeps, preferredSpec?: string): string {
  if (preferredSpec) {
    const provider = providerFromSpec(preferredSpec);
    if (provider === "codex") return preferredSpec;
    if (provider !== "claude" && provider !== "codex" && provider !== "cloudflare") {
      if (deps.byokStore.get(provider as Provider)) return preferredSpec;
    }
  }
  if (deps.byokStore.get("groq")) return "groq/qwen/qwen3-32b";
  if (deps.byokStore.get("moonshot")) {
    const kind = moonshotKindForDeps(deps);
    return kind === "coding" ? "moonshot/kimi-for-coding" : "moonshot/kimi-k2.6";
  }
  if (deps.byokStore.get("mistral")) return "mistral/mistral-small-2506";
  if (deps.byokStore.get("google")) return "google/gemini-2.5-flash";
  if (deps.cfStore.isConfigured()) return `cloudflare/${CF_DEFAULT_GATE_MODEL}`;
  return resolveDefaultClassifierSpec(deps);
}

function moonshotKindForDeps(deps: IpcDeps) {
  const key = deps.byokStore.get("moonshot");
  return key ? moonshotKeyKind(key) : undefined;
}

function isByokModelAvailable(deps: IpcDeps, spec: string): boolean {
  const provider = providerFromSpec(spec);
  if (provider === "cloudflare") return deps.cfStore.isConfigured();
  if (provider === "claude" || provider === "codex") return false;
  return Boolean(deps.byokStore.get(provider as Provider));
}

function isSuggestSpecAvailable(deps: IpcDeps, spec: string): boolean {
  return isByokModelAvailable(deps, spec);
}

export interface SuggestRunResult {
  suggestions: RewriteSuggestion[];
}

function modelLabel(model: LanguageModel, fallback: string): string {
  return (model as { modelId?: string }).modelId ?? fallback;
}

interface SuggestModelEntry {
  spec: string;
  model: LanguageModel;
}

function buildCouncilModels(deps: IpcDeps, specs: string[]): SuggestModelEntry[] {
  const entries: SuggestModelEntry[] = [];
  const seenSpecs = new Set<string>();

  const add = (spec: string, model: LanguageModel | null) => {
    if (!model || seenSpecs.has(spec)) return;
    seenSpecs.add(spec);
    const label = modelLabel(model, spec);
    if (seenSpecs.has(label)) return;
    seenSpecs.add(label);
    entries.push({ spec, model });
  };

  for (const spec of specs) {
    const provider = providerFromSpec(spec);
    if (provider === "codex") {
      const selection = selectCodexModelForTask("council", spec);
      add(spec, selection ? createCodexModelFromSelection(selection) : null);
      continue;
    }
    if (provider === "claude") {
      add(spec, resolveLanguageModel(deps, spec, { fallback: false }));
      continue;
    }
    if (provider === "cloudflare") {
      add(
        spec,
        deps.cfStore.isConfigured() ? resolveLanguageModel(deps, spec, { fallback: false }) : null,
      );
      continue;
    }
    add(
      spec,
      deps.byokStore.get(provider as Provider)
        ? resolveLanguageModel(deps, spec, { fallback: false })
        : null,
    );
  }

  return entries;
}

function buildFallbackProviderCouncilModels(
  deps: IpcDeps,
  preferredSpec?: string,
): SuggestModelEntry[] {
  const entries: SuggestModelEntry[] = [];
  const seenFamilies = new Set<string>();

  const addFamily = (family: string, spec: string, model: LanguageModel | null) => {
    if (!model || seenFamilies.has(family)) return;
    seenFamilies.add(family);
    entries.push({ spec, model });
  };

  const moonshotKey = deps.byokStore.get("moonshot");
  if (moonshotKey) {
    const spec =
      moonshotKindForDeps(deps) === "coding" ? "moonshot/kimi-for-coding" : "moonshot/kimi-k2.6";
    const model = resolveLanguageModel(deps, spec, { fallback: false });
    addFamily("kimi", spec, model);
  }

  const googleKey = deps.byokStore.get("google");
  if (googleKey) {
    const preferredGoogle =
      preferredSpec && providerFromSpec(preferredSpec) === "google"
        ? preferredSpec
        : "google/gemini-2.5-flash";
    const model = resolveLanguageModel(deps, preferredGoogle, { fallback: false });
    addFamily("gemini", preferredGoogle, model);
  }

  if (hasCodexHost()) {
    const preferredCodex =
      preferredSpec && providerFromSpec(preferredSpec) === "codex" ? preferredSpec : undefined;
    const selection = selectCodexModelForTask("suggest", preferredCodex);
    if (selection) {
      addFamily("gpt", selection.spec, createCodexModelFromSelection(selection));
    }
  } else if (deps.byokStore.get("openai")) {
    const preferredOpenAI =
      preferredSpec && providerFromSpec(preferredSpec) === "openai"
        ? preferredSpec
        : "openai/gpt-4o-mini";
    const model = resolveLanguageModel(deps, preferredOpenAI, { fallback: false });
    addFamily("gpt", preferredOpenAI, model);
  }

  if (entries.length > 0) return entries;

  if (preferredSpec) {
    const model = resolveLanguageModel(deps, preferredSpec, { fallback: false });
    addFamily("other", preferredSpec, model);
  }

  return entries;
}

/** Structured suggest — uses toolbar model when set; no silent reroute to Google. */
async function engineSuggestWithFallback(
  deps: IpcDeps,
  args: {
    text: string;
    sentenceId: number;
    model?: string;
    models?: string[];
    mode?: "single" | "council";
    level?: "word" | "sentence" | "paragraph";
    numAlternatives?: number;
    customInstruction?: string;
    profileSentence?: {
      text: string;
      classification: import("@prosodeus/core/node").SentenceClassification;
    };
  },
): Promise<SuggestRunResult> {
  const requestedModels = (args.models?.length ? args.models : args.model ? [args.model] : [])
    .map((m) => m.trim())
    .filter(Boolean);
  const preferred = requestedModels[0];
  const useCouncil = args.mode === "council";

  // Toolbar selection is authoritative — never substitute Gemini/Groq for Kimi.
  if (preferred) {
    const provider = providerFromSpec(preferred);
    if (provider !== "claude" && provider !== "codex" && !isByokModelAvailable(deps, preferred)) {
      throw new Error(`No API key configured for ${preferred}`);
    }
    const classifyCtx = buildEngineCtx(deps, resolveSuggestClassifySpec(deps, preferred));

    const requestedCouncilModels = useCouncil ? buildCouncilModels(deps, requestedModels) : [];
    const models = useCouncil
      ? requestedCouncilModels.length > 0
        ? requestedCouncilModels
        : buildFallbackProviderCouncilModels(deps, preferred)
      : provider === "codex"
        ? (
            [selectCodexModelForTask("suggest", preferred)].filter(
              Boolean,
            ) as CodexTaskModelSelection[]
          ).map((selection) => ({
            spec: selection.spec,
            model: createCodexModelFromSelection(selection),
          }))
        : [preferred]
            .map((spec): SuggestModelEntry | null => {
              const model = resolveLanguageModel(deps, spec, { fallback: false });
              return model ? { spec, model } : null;
            })
            .filter((entry): entry is SuggestModelEntry => Boolean(entry));

    if (models.length === 0) throw new Error(`No model configured for ${preferred}`);

    const settled = await Promise.allSettled(
      models.map(({ spec, model }) =>
        engineSuggest(args.text, classifyCtx, {
          sentenceId: args.sentenceId,
          model,
          level: args.level,
          numAlternatives: args.numAlternatives,
          customInstruction: args.customInstruction,
          modelName: modelLabel(model, spec),
          moonshotKind: moonshotKindForDeps(deps),
          profileSentence: args.profileSentence,
        }),
      ),
    );

    const suggestions: RewriteSuggestion[] = [];
    for (const result of settled) {
      if (result.status === "fulfilled") suggestions.push(...result.value);
    }
    if (suggestions.length === 0) {
      const firstError = settled.find((r): r is PromiseRejectedResult => r.status === "rejected");
      if (firstError?.reason instanceof Error) throw firstError.reason;
    }
    return { suggestions };
  }

  const fallback = resolveSuggestCapableSpec(
    undefined,
    (spec) => isSuggestSpecAvailable(deps, spec),
    moonshotKindForDeps(deps),
  );
  if (!fallback) {
    throw new Error(
      "No model available for suggestions — configure a BYOK key or pick a model in the toolbar",
    );
  }

  const trySpecs = [
    fallback.spec,
    ...SUGGEST_CAPABLE_SPECS.filter((s) => s !== fallback.spec && isSuggestSpecAvailable(deps, s)),
  ];

  const classifyCtx = buildEngineCtx(deps, resolveSuggestClassifySpec(deps, fallback.spec));

  let lastRetryable: unknown;
  for (const spec of trySpecs) {
    try {
      const model = resolveLanguageModel(deps, spec);
      if (!model) continue;
      const suggestions = await engineSuggest(args.text, classifyCtx, {
        sentenceId: args.sentenceId,
        model,
        level: args.level,
        numAlternatives: args.numAlternatives,
        customInstruction: args.customInstruction,
        modelName: spec,
        moonshotKind: moonshotKindForDeps(deps),
        profileSentence: args.profileSentence,
      });
      return { suggestions };
    } catch (err) {
      if (isRetryableProviderError(err)) {
        lastRetryable = err;
        console.warn(
          `[suggest:run] ${spec} unavailable:`,
          err instanceof Error ? err.message : err,
        );
        continue;
      }
      throw err;
    }
  }

  throw lastRetryable instanceof Error
    ? lastRetryable
    : new Error(
        "No model available for suggestions — all configured providers failed or rate-limited",
      );
}

/**
 * Register all renderer-callable IPC handlers.
 *
 * This is the entire surface the renderer can reach in the main process.
 * Each handler is a thin wrapper around `@prosodeus/core/node` — no business
 * logic lives here.
 */
export function registerIpcHandlers(ipc: IpcMain, deps: IpcDeps) {
  primeCodexCatalog();

  // ─── Documents ──────────────────────────────────────────────────────────

  ipc.handle(
    "documents:list",
    (_e, opts: { workspaceId?: string; folderId?: string; limit?: number } = {}) => {
      return deps.documentStore.listDocuments(opts);
    },
  );

  ipc.handle("documents:get", (_e, id: string) => {
    return deps.documentStore.getDocument(id);
  });

  ipc.handle(
    "documents:create",
    (
      _e,
      input: {
        id: string;
        title?: string;
        content?: string;
        workspaceId?: string;
        folderId?: string;
      },
    ) => {
      deps.documentStore.createDocument(input);
      return deps.documentStore.getDocument(input.id);
    },
  );

  ipc.handle(
    "documents:updateContent",
    (_e, args: { id: string; content: string; contentFormat?: string }) => {
      // Same upsert as analyze:run — local-first means we materialize on touch.
      if (!deps.documentStore.getDocument(args.id)) {
        deps.documentStore.createDocument({
          id: args.id,
          content: args.content,
          contentFormat: args.contentFormat,
        });
      }
      deps.documentStore.updateDocumentContent(args.id, args.content, args.contentFormat);
      return deps.documentStore.getDocument(args.id);
    },
  );

  ipc.handle("documents:rename", (_e, args: { id: string; title: string }) => {
    deps.documentStore.renameDocument(args.id, args.title);
    return deps.documentStore.getDocument(args.id);
  });

  ipc.handle("documents:delete", (_e, id: string) => {
    deps.documentStore.deleteDocument(id);
    return { ok: true };
  });

  // ─── Iterations & versions ─────────────────────────────────────────────

  ipc.handle("iterations:list", (_e, args: { documentId: string; limit?: number }) => {
    return deps.documentStore.listIterations(args.documentId, args.limit);
  });

  ipc.handle("versions:list", (_e, args: { documentId: string; limit?: number }) => {
    return deps.documentStore.listVersions(args.documentId, args.limit);
  });

  ipc.handle("versions:get", (_e, versionId: number) => {
    return deps.documentStore.getVersion(versionId);
  });

  ipc.handle(
    "versions:create",
    (
      _e,
      input: {
        documentId: string;
        content: string;
        name?: string;
        source?: string;
        profile?: StylometricProfile;
      },
    ) => {
      const { source, ...rest } = input;
      return deps.documentStore.persistVersion({ ...rest, source: source ?? "manual" });
    },
  );

  // ─── Styles & models (renderer startup queries) ────────────────────────

  ipc.handle("styles:list", () => listStyleGuides());

  ipc.handle("models:list", async () => {
    // Claude is always available (Agent SDK uses bundled credentials).
    const models: Array<{ id: string; name: string; provider: string; mode?: string }> = [
      { id: "claude-haiku-4-5", name: "Claude Haiku 4.5", provider: "claude" },
      { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6", provider: "claude" },
    ];
    // Codex is a local host: global Codex CLI + ChatGPT auth. Do not list a
    // selectable model unless both are present.
    if (hasCodexHost()) {
      models.push(
        ...(await listCodexModelConfigs()).map(({ id, name, provider, mode }) => ({
          id,
          name,
          provider,
          mode,
        })),
      );
    }
    if (deps.cfStore.isConfigured()) {
      models.push(
        {
          id: `cloudflare/${CF_DEFAULT_GATE_MODEL}`,
          name: "Llama 3.2 3B (Workers AI)",
          provider: "cloudflare",
        },
        {
          id: "cloudflare/@cf/meta/llama-3.3-70b-instruct-fp8-fast",
          name: "Llama 3.3 70B (Workers AI)",
          provider: "cloudflare",
        },
      );
    }
    // Surface non-Claude providers only when the user has supplied a BYOK key.
    for (const provider of deps.byokStore.listConfigured()) {
      const defaults: Record<string, Array<{ id: string; name: string }>> = {
        groq: [{ id: "qwen/qwen3-32b", name: "Qwen 3 32B (Groq)" }],
        google: [{ id: "gemini-2.5-flash", name: "Gemini 2.5 Flash" }],
        mistral: [{ id: "mistral", name: "Mistral" }],
        openai: [{ id: "gpt-4o-mini", name: "GPT-4o mini" }],
        moonshot: (() => {
          const key = deps.byokStore.get("moonshot");
          return key ? listMoonshotModelOptions(moonshotKeyKind(key)) : [];
        })(),
      };
      for (const m of defaults[provider] ?? []) {
        models.push({ id: `${provider}/${m.id}`, name: m.name, provider });
      }
    }
    return models;
  });

  // ─── Claude credentials ────────────────────────────────────────────────

  ipc.handle("claude:hasCredentials", () => hasClaudeCredentials());
  ipc.handle("claude:login", async () => {
    const win = deps.getMainWindow();
    if (!win) throw new Error("No main window — cannot stream login progress");
    await loginViaRenderer(win.webContents);
    return { ok: true };
  });

  // ─── Codex credentials ─────────────────────────────────────────────────

  ipc.handle("codex:hasCredentials", () => hasCodexCredentials());
  ipc.handle("codex:login", async () => {
    const win = deps.getMainWindow();
    if (!win) throw new Error("No main window — cannot stream login progress");
    await codexLoginViaRenderer(win.webContents);
    return { ok: true };
  });

  // ─── BYOK keys ──────────────────────────────────────────────────────────

  ipc.handle("byok:list", () => deps.byokStore.listConfigured());
  ipc.handle("byok:devVarsStatus", () => devVarsStatus());
  ipc.handle("byok:set", (_e, args: { provider: Provider; apiKey: string }) => {
    deps.byokStore.set(args.provider, args.apiKey);
    return { ok: true };
  });
  ipc.handle("byok:remove", (_e, provider: Provider) => {
    deps.byokStore.remove(provider);
    return { ok: true };
  });

  // ─── Cloudflare Workers AI credentials ───────────────────────────────────

  ipc.handle("cf:hasCredentials", () => deps.cfStore.isConfigured());
  ipc.handle("cf:set", (_e, args: { accountId: string; apiToken: string }) => {
    deps.cfStore.set({ accountId: args.accountId, apiToken: args.apiToken });
    return { ok: true };
  });
  ipc.handle("cf:remove", () => {
    deps.cfStore.remove();
    return { ok: true };
  });

  // ─── LLM usage counters ───────────────────────────────────────────────────

  ipc.handle("usage:list", () => getAllProviderUsage());

  // ─── Concurrency guard (Mistral free tier = 5 RPS, we stay at ≤ 3 concurrent) ──
  const MAX_CONCURRENT = 3;
  let activeCalls = 0;
  const queue: Array<() => void> = [];

  async function withConcurrency<T>(fn: () => Promise<T>): Promise<T> {
    if (activeCalls >= MAX_CONCURRENT) {
      await new Promise<void>((resolve) => queue.push(resolve));
    }
    activeCalls++;
    try {
      return await fn();
    } finally {
      activeCalls--;
      const next = queue.shift();
      if (next) next();
    }
  }

  // ─── Analyze ───────────────────────────────────────────────────────────

  ipc.handle(
    "analyze:run",
    async (
      _e,
      args: {
        documentId: string;
        text: string;
        style?: string;
        model?: string;
        topSuggestions?: number;
        analyzeMode?: "full" | "incremental";
        changedSentenceIds?: number[];
        suggestMode?: "batch" | "none";
        aiSlopMode?: "off" | "fast" | "tiered" | "exhaustive";
      },
    ) => {
      if (!deps.documentStore.getDocument(args.documentId)) {
        deps.documentStore.createDocument({ id: args.documentId, content: args.text });
      }

      const spec = args.model ?? resolveDefaultClassifierSpec(deps);
      const provider = providerFromSpec(spec);

      const ctx: EngineContext = {
        ...buildEngineCtx(deps, args.model),
        persistIteration: (docId, profile, sentences) => {
          deps.documentStore.persistIteration(docId, profile, sentences, "local");
        },
        maybeSnapshot: (docId, text, profile) => {
          const latest = deps.documentStore.latestVersionContent(docId);
          if (latest !== text) {
            deps.documentStore.persistVersion({
              documentId: docId,
              content: text,
              source: "auto",
              profile,
            });
          }
        },
      };

      const suggestMode =
        args.suggestMode ?? (args.analyzeMode === "incremental" ? "none" : "batch");
      const topSuggestions = args.topSuggestions ?? (suggestMode === "batch" ? 3 : 0);

      const result = await withConcurrency(() =>
        engineAnalyze(args.text, ctx, {
          documentId: args.documentId,
          style: args.style,
          topSuggestions,
          suggestMode,
          changedSentenceIds: args.changedSentenceIds,
          aiSlopMode: args.aiSlopMode,
          onPartialProfile: (profile, done) => {
            deps.getMainWindow()?.webContents.send("analyze:partial", {
              documentId: args.documentId,
              profile,
              done,
            });
          },
        }),
      );

      incrementProviderUsage(provider);

      // Suggestions arrive later on a heavier model — push them to the renderer
      // as an event so the profile (heat map) renders immediately.
      void result.suggestionsPromise?.then((suggestions) => {
        deps.getMainWindow()?.webContents.send("analyze:suggestions", {
          documentId: args.documentId,
          suggestions,
        });
      });

      return { profile: result.profile };
    },
  );

  // ─── Rewrite (single-shot) ─────────────────────────────────────────────

  ipc.handle(
    "rewrite:run",
    async (
      _e,
      args: {
        text: string;
        style?: string;
        model?: string;
        passageStart?: number;
        passageEnd?: number;
        usePCE?: boolean;
      },
    ) => {
      const ctx = buildEngineCtx(deps, args.model);
      const result = await engineRewrite(args.text, ctx, {
        style: args.style,
        passageStart: args.passageStart,
        passageEnd: args.passageEnd,
        usePCE: args.usePCE,
      });
      // Single rewrite — return the data directly
      return result.kind === "single" ? result.data : result.data.alternatives[0];
    },
  );

  // ─── Rewrite Alternatives ──────────────────────────────────────────────

  ipc.handle(
    "rewrite:alternatives",
    async (
      _e,
      args: {
        text: string;
        passageStart: number;
        passageEnd: number;
        constraints?: RewriteConstraints;
        n: number;
        style?: string;
        model?: string;
      },
    ) => {
      const ctx = buildEngineCtx(deps, args.model);
      const result = await withConcurrency(() =>
        engineRewrite(args.text, ctx, {
          style: args.style,
          passageStart: args.passageStart,
          passageEnd: args.passageEnd,
          n: args.n,
          constraints: args.constraints,
        }),
      );
      return result.kind === "alternatives"
        ? result.data
        : { original: args.text, constraints: args.constraints ?? null, alternatives: [] };
    },
  );

  // ─── Opposition Rewriter (binary-opposition removal) ───────────────────

  ipc.handle(
    "opposition:run",
    async (
      _e,
      args: {
        text: string;
        style?: string;
        model?: string;
        maxPasses?: number;
      },
    ) => {
      if (!args.text?.trim()) throw new Error("Empty text");
      const wordCount = args.text.trim().split(/\s+/).filter(Boolean).length;
      if (wordCount > 50_000) throw new Error("Text exceeds 50,000 word limit");

      const spec = args.model ?? resolveDefaultClassifierSpec(deps);
      const ctx = buildEngineCtx(deps, args.model);
      const judgeModel = ctx.resolveModel?.(args.model ?? "default");
      const rewriteModel = ctx.resolveModel?.(args.model ?? "default");
      if (!judgeModel || !rewriteModel) {
        throw new Error(
          "No model available for the opposition rewriter — add a BYOK key or sign in to the cloud worker",
        );
      }

      const result = await withConcurrency(() =>
        rewriteOppositions(args.text, {
          classifier: ctx.classifier,
          cache: ctx.cache,
          judgeModel,
          rewriteModel,
          maxPasses: args.maxPasses,
          style: args.style,
          onProgress: (step) =>
            deps.getMainWindow()?.webContents.send("opposition:progress", { step }),
        }),
      );

      incrementProviderUsage(providerFromSpec(spec));

      return oppositionResultToWire(result);
    },
  );

  // ─── Equilibrium ───────────────────────────────────────────────────────

  ipc.handle(
    "equilibrium:run",
    async (
      _e,
      args: {
        text: string;
        style?: string;
        model?: string;
      },
    ) => {
      const spec = args.model ?? "claude-haiku-4-5";
      const ctx = buildEngineCtx(deps, args.model);
      const councilModel = resolveLanguageModel(deps, spec);
      if (!councilModel) throw new Error(`No model configured for ${spec}`);
      const classifier = spec.startsWith("claude")
        ? new deps.AgentSDKClassifier({ model: spec })
        : new deps.LLMClassifier(councilModel);

      return await engineEquilibrium(args.text, ctx, {
        style: args.style,
        councilModels: [councilModel],
        classifier,
        maxRounds: 3,
      });
    },
  );

  // ─── Reverse-Engineer Style Guide ──────────────────────────────────────

  ipc.handle(
    "reverse-guide:run",
    async (
      _e,
      args: {
        text: string;
        name: string;
        description: string;
        model?: string;
      },
    ) => {
      if (!args.text?.trim()) throw new Error("Empty exemplar text");
      if (!args.name?.trim()) throw new Error("Guide name required");

      const ctx = buildEngineCtx(deps, args.model);
      return await engineReverseGuide(args.text, ctx, {
        name: args.name.trim(),
        description: args.description?.trim() || "",
      });
    },
  );

  // ─── Rewrite Suggestions ───────────────────────────────────────────────

  ipc.handle(
    "suggest:run",
    async (
      _e,
      args: {
        text: string;
        sentenceId: number;
        model?: string;
        models?: string[];
        mode?: "single" | "council";
        level?: "word" | "sentence" | "paragraph";
        numAlternatives?: number;
        customInstruction?: string;
        profileSentence?: {
          text: string;
          classification: import("@prosodeus/core/node").SentenceClassification;
        };
      },
    ) => engineSuggestWithFallback(deps, args),
  );

  // ─── Version Compare ───────────────────────────────────────────────────

  ipc.handle("versions:compare", (_e, args: { versionA: number; versionB: number }) => {
    const a = deps.documentStore.getVersion(args.versionA);
    const b = deps.documentStore.getVersion(args.versionB);
    if (!a || !b) throw new Error("Version not found");
    return { a, b };
  });
}
