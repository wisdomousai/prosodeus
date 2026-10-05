/**
 * Shared analysis engine — single pipeline for all runtimes.
 *
 * Each runtime (dev server, CF Worker, Electron) builds an EngineContext
 * that injects its deps (cache, classifier, model resolution, rate limits,
 * persistence) and then calls these thin functions.
 */
import type { LanguageModel } from "ai";
import type { SentenceClassifier } from "../analysis/analyze.ts";
import { selectHotSentencesFromProfile } from "../analysis/hot-sentences.ts";
import { assembleProfile } from "../analysis/profile.ts";
import { computeDelta, loadStyleGuide, reverseEngineerGuide } from "../analysis/style-guide.ts";
import {
  attachAiSlopCandidates,
  stripAiSlopCandidates,
} from "../classification/ai-slop-candidates.ts";
import {
  computeHeat,
  getDefaultClassification,
  LLMClassifier,
} from "../classification/classifier.ts";
import {
  type ClassifyPipelineOpts,
  classifyUncachedPipeline,
} from "../classification/classify-pipeline.ts";
import { promoteSlopCandidates } from "../classification/slop-promotion.ts";
import { CODEX_DEFAULT_MODEL_SPEC } from "../models/codex-config.ts";
import type { MoonshotKeyKind } from "../models/moonshot-config.ts";
import type {
  CouncilRound,
  EquilibriumResult,
  FindEquilibriumOptions,
} from "../rewrite/equilibrium.ts";
import { findEquilibrium } from "../rewrite/equilibrium.ts";
import {
  assessRewriteMeaning,
  describeTone,
  encodeConstraintsAsDirectives,
  type RewriteAlternative,
  type RewriteConstraints,
  summarizeStructuralChange,
} from "../rewrite/rewrite-policy.ts";
import { rewritePassage } from "../rewrite/rewriter.ts";
import {
  suggestGenericRewrites,
  suggestRewrites,
  suggestRewritesBatch,
} from "../rewrite/suggest.ts";
import { isValidRewriteSuggestion } from "../rewrite/suggestion-validation.ts";
import type { ClassificationCache, StoredSuggestion, SuggestionCache } from "../storage/cache.ts";
import { splitAndHash } from "../text/splitter.ts";
import type {
  AiSlopMatcherMode,
  ClassifiedSentence,
  RewriteResult,
  RewriteSuggestion,
  SentenceClassification,
  StylometricProfile,
} from "../types.ts";

// ─── Engine Context ──────────────────────────────────────────────────────────

export interface EngineContext {
  cache: ClassificationCache;
  suggestionCache?: SuggestionCache;
  classifier: {
    classify(
      sentences: Array<{ id: number; text: string; hash: string; paragraph_id: number }>,
    ): Promise<ClassifiedSentence[]>;
  };
  /** Optional cheap gate — escalates positives to medium/full classifiers. */
  gateClassifier?: {
    classify(
      sentences: Array<{ id: number; text: string; hash: string; paragraph_id: number }>,
    ): Promise<ClassifiedSentence[]>;
  };
  /** Optional medium tier for gate positives in [0.4, 0.7). */
  mediumClassifier?: {
    classify(
      sentences: Array<{ id: number; text: string; hash: string; paragraph_id: number }>,
    ): Promise<ClassifiedSentence[]>;
  };
  /** Optional — only required for rewrite/suggest/equilibrium flows. */
  resolveModel?(spec: string): LanguageModel | null;
  disabledPatterns?: Set<string>;
  /** Recall-only static matcher mode for Kimi/OAI candidate evidence. */
  aiSlopMode?: AiSlopMatcherMode;
  checkLimit?: (action: string) => Promise<{ allowed: boolean; message?: string }>;
  recordUsage?: (action: string, count?: number) => Promise<void>;
  persistIteration?: (
    docId: string,
    profile: StylometricProfile,
    sentences: ClassifiedSentence[],
  ) => void;
  maybeSnapshot?: (docId: string, text: string, profile: StylometricProfile) => void;
}

// ─── Classify Result ─────────────────────────────────────────────────────────

export interface ClassifyResult {
  profile: StylometricProfile;
  classified: ClassifiedSentence[];
}

export interface AnalyzeRunResult extends ClassifyResult {
  /**
   * Rewrite suggestions for the hottest sentences, generated on a heavier
   * model AFTER the profile is ready. Started eagerly but not awaited, so
   * callers can ship the profile first. Never rejects (resolves [] on failure).
   */
  suggestionsPromise?: Promise<RewriteSuggestion[]>;
}

export interface ClassifyProgress {
  total: number;
  cached: number;
  classifying: number;
  completed?: number;
}

export interface ClassifyTextOpts extends ClassifyPipelineOpts {}

// ─── classifyText ────────────────────────────────────────────────────────────

/**
 * Steps 1-6: split → cache lookup → classify uncached → cache store → filter
 * disabled patterns → compute heat → assemble profile.
 */
export async function classifyText(
  text: string,
  ctx: EngineContext,
  style?: string,
  onProgress?: (p: ClassifyProgress) => void,
  classifyOpts?: ClassifyTextOpts,
): Promise<ClassifyResult> {
  const hashed = splitAndHash(text);
  if (hashed.length === 0) {
    return { profile: assembleProfile([]), classified: [] };
  }

  const cached = await ctx.cache.getMany(hashed.map((s) => s.hash));
  const uncached = hashed.filter((s) => !cached.has(s.hash));

  onProgress?.({ total: hashed.length, cached: cached.size, classifying: uncached.length });

  const pipelineOpts: ClassifyPipelineOpts = {
    ...classifyOpts,
    style: style ?? classifyOpts?.style,
    onProgress,
    onPartialProfile: classifyOpts?.onPartialProfile,
  };

  if (cached.size > 0 && pipelineOpts.onPartialProfile) {
    const partialClassified: ClassifiedSentence[] = hashed.map((s) => {
      const raw = cached.get(s.hash) ?? getDefaultClassification();
      const withSlop = attachAiSlopCandidates(s, raw, pipelineOpts.aiSlopMode ?? ctx.aiSlopMode);
      const promoted = promoteSlopCandidates(withSlop, { playbookOnly: true });
      return { ...s, classification: promoted, heat: computeHeat(promoted) };
    });
    let delta;
    if (style) {
      const guide = loadStyleGuide(style);
      if (guide) delta = computeDelta(partialClassified, guide);
    }
    pipelineOpts.onPartialProfile(assembleProfile(partialClassified, delta), false);
  }

  let freshlyClassified: ClassifiedSentence[] = [];
  if (uncached.length > 0) {
    freshlyClassified = await classifyUncachedPipeline(uncached, hashed, cached, ctx, pipelineOpts);
    await ctx.cache.setMany(
      freshlyClassified.map((s) => ({
        hash: s.hash,
        classification: stripAiSlopCandidates(s.classification),
      })),
    );
  }

  const freshMap = new Map<string, SentenceClassification>();
  for (const s of freshlyClassified) freshMap.set(s.hash, s.classification);

  // Merge, filter disabled patterns, compute heat
  const disabledSet = ctx.disabledPatterns;
  const allClassified: ClassifiedSentence[] = hashed.map((s) => {
    const raw = cached.get(s.hash) ?? freshMap.get(s.hash) ?? getDefaultClassification();
    const filtered =
      disabledSet && disabledSet.size > 0
        ? {
            ...raw,
            patterns: raw.patterns.filter((p: { type: string }) => !disabledSet.has(p.type)),
          }
        : raw;
    const withSlop = attachAiSlopCandidates(s, filtered, pipelineOpts.aiSlopMode ?? ctx.aiSlopMode);
    const promoted = promoteSlopCandidates(withSlop, { playbookOnly: true });
    return { ...s, classification: promoted, heat: computeHeat(promoted) };
  });

  // Style guide delta
  let delta;
  if (style) {
    const guide = loadStyleGuide(style);
    if (guide) delta = computeDelta(allClassified, guide);
  }

  const profile = assembleProfile(allClassified, delta);
  return { profile, classified: allClassified };
}

// ─── engineAnalyze ───────────────────────────────────────────────────────────

export interface AnalyzeOpts {
  documentId: string;
  style?: string;
  aiSlopMode?: AiSlopMatcherMode;
  onProgress?: (p: ClassifyProgress) => void;
  onPartialProfile?: (profile: StylometricProfile, done: boolean) => void;
  changedSentenceIds?: number[];
  neighborParagraphs?: boolean;
  /** Number of hottest sentences to pre-generate suggestions for (default 0). */
  topSuggestions?: number;
  /** `batch` runs top-N suggest after profile; `none` skips (default). */
  suggestMode?: "batch" | "none";
  /** How many alternatives per hot sentence (default 3). */
  suggestAlternatives?: number;
}

export async function engineAnalyze(
  text: string,
  ctx: EngineContext,
  opts: AnalyzeOpts,
): Promise<AnalyzeRunResult> {
  const classifyOpts: ClassifyTextOpts = {
    changedSentenceIds: opts.changedSentenceIds,
    neighborParagraphs: opts.neighborParagraphs,
    onPartialProfile: opts.onPartialProfile,
    aiSlopMode: opts.aiSlopMode,
  };
  const result: AnalyzeRunResult = await classifyText(
    text,
    ctx,
    opts.style,
    opts.onProgress,
    classifyOpts,
  );

  if (ctx.persistIteration) {
    ctx.persistIteration(opts.documentId, result.profile, result.classified);
  }
  if (ctx.maybeSnapshot) {
    ctx.maybeSnapshot(opts.documentId, text, result.profile);
  }

  // Kick off suggestion generation without awaiting it — the profile is
  // returned immediately and callers deliver suggestions when they arrive.
  const suggestMode =
    opts.suggestMode ??
    (opts.topSuggestions !== undefined ? (opts.topSuggestions > 0 ? "batch" : "none") : "none");
  const topN = suggestMode === "batch" ? (opts.topSuggestions ?? 3) : 0;
  if (topN > 0 && result.classified.length > 0) {
    result.suggestionsPromise = runSuggestPhase(
      result.profile,
      ctx,
      topN,
      opts.suggestAlternatives ?? 3,
    );
  }

  return result;
}

// ─── Suggest phase ───────────────────────────────────────────────────────────

/** Bump when BATCH_SYSTEM_PROMPT or the suggestion format changes materially. */
const SUGGESTION_CACHE_VERSION = "s1";

function djb2(text: string): string {
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * Suggestions depend on the sentence text (hash), which patterns were flagged
 * (disabledPatterns changes that set), the suggest model, and the alternative
 * count. Neighbor-sentence context goes into the prompt but is deliberately
 * NOT part of the key: including it would kill the hit rate on every edit,
 * and structural rewrites of a sentence rarely change with their neighbors.
 */
function suggestionCacheKey(
  sentence: ClassifiedSentence,
  modelKey: string,
  numAlternatives: number,
): string {
  const patternsDigest = djb2(
    [...new Set(sentence.classification.patterns.map((p) => p.type))].sort().join(","),
  );
  return `${SUGGESTION_CACHE_VERSION}:${sentence.hash}:${patternsDigest}:${modelKey}:${numAlternatives}`;
}

/** Mid-tier models for the background suggest batch (BYOK-friendly). Google last. */
export const SUGGEST_MODEL_SPECS = [
  "groq/qwen/qwen3-32b",
  "mistral/mistral-medium-latest",
  "moonshot/kimi-k2.6",
  "openai/gpt-4o-mini",
  "claude-haiku-4-5",
  "claude-sonnet-4-6",
  CODEX_DEFAULT_MODEL_SPEC,
  "google/gemini-2.5-flash",
  "google/gemini-2.5-pro",
  "default",
] as const;

export function resolveSuggestModel(ctx: EngineContext): LanguageModel | null {
  for (const spec of SUGGEST_MODEL_SPECS) {
    const model = ctx.resolveModel?.(spec);
    if (model) return model;
  }
  return null;
}

async function runSuggestPhase(
  profile: StylometricProfile,
  ctx: EngineContext,
  maxCount: number,
  numAlternatives: number,
): Promise<RewriteSuggestion[]> {
  try {
    const suggestModel = resolveSuggestModel(ctx);
    if (!suggestModel) return [];

    const targets = selectHotSentencesFromProfile(profile, maxCount);
    if (targets.length === 0) return [];

    const classified = profile.sentences;

    const modelKey = (suggestModel as { modelId?: string }).modelId ?? "default";
    const keyBySentence = new Map(
      targets.map((s) => [s, suggestionCacheKey(s, modelKey, numAlternatives)] as const),
    );

    const cachedByKey = ctx.suggestionCache
      ? await ctx.suggestionCache.getSuggestions([...keyBySentence.values()])
      : new Map<string, StoredSuggestion[]>();

    const results: RewriteSuggestion[] = [];
    const misses: ClassifiedSentence[] = [];
    for (const [sentence, key] of keyBySentence) {
      const stored = cachedByKey.get(key);
      if (!stored) {
        misses.push(sentence);
        continue;
      }
      for (const s of stored) {
        results.push({
          original: sentence.text,
          alternatives: s.alternatives,
          pattern_type: s.pattern_type,
          sentence_id: sentence.id,
          model_name: s.model_name ?? modelKey,
          level: "sentence",
        });
      }
    }

    if (misses.length > 0) {
      const fresh = await suggestRewritesBatch(misses, classified, suggestModel, numAlternatives, {
        modelName: modelKey,
      });
      results.push(...fresh);

      // Persist per-sentence, including empty results as a negative cache.
      // A fully empty batch is indistinguishable from a model error
      // (suggestRewritesBatch swallows failures), so skip caching then.
      if (ctx.suggestionCache && fresh.length > 0) {
        const bySentenceId = new Map<number, StoredSuggestion[]>();
        for (const s of misses) bySentenceId.set(s.id, []);
        for (const r of fresh) {
          bySentenceId.get(r.sentence_id)?.push({
            pattern_type: r.pattern_type,
            alternatives: r.alternatives,
            model_name: r.model_name ?? modelKey,
          });
        }
        await ctx.suggestionCache.setSuggestions(
          misses.map((s) => ({
            key: keyBySentence.get(s)!,
            suggestions: bySentenceId.get(s.id) ?? [],
          })),
        );
      }
    }

    return results;
  } catch {
    // The suggest phase is best-effort; never surface a rejection to callers
    // that may not attach a handler until later (or at all).
    return [];
  }
}

// ─── engineRewrite ───────────────────────────────────────────────────────────

export interface RewriteOpts {
  style?: string;
  passageStart?: number;
  passageEnd?: number;
  usePCE?: boolean;
  n?: number;
  constraints?: RewriteConstraints;
  editorialDirectives?: string[];
  contextPrefix?: string;
  contextSuffix?: string;
  onProgress?: (step: string) => void;
}

export interface RewriteSingleResult {
  kind: "single";
  data: RewriteResult;
}

export interface RewriteAlternativesResult {
  kind: "alternatives";
  data: {
    original: string;
    constraints: RewriteConstraints | null;
    alternatives: RewriteAlternative[];
  };
}

export type RewriteEngineResult = RewriteSingleResult | RewriteAlternativesResult;

export async function engineRewrite(
  text: string,
  ctx: EngineContext,
  opts: RewriteOpts,
): Promise<RewriteEngineResult> {
  if (ctx.checkLimit) {
    const n = Math.max(1, Math.min(4, opts.n ?? 1));
    for (let i = 0; i < n; i++) {
      const limit = await ctx.checkLimit("rewrite");
      if (!limit.allowed) throw new Error(limit.message ?? "Rewrite limit reached");
    }
  }

  const { profile } = await classifyText(text, ctx, opts.style);
  const n = Math.max(1, Math.min(4, opts.n ?? 1));

  const passageRange =
    opts.passageStart !== undefined && opts.passageEnd !== undefined
      ? { start: opts.passageStart, end: opts.passageEnd }
      : undefined;

  // Resolve models
  const rewriteModel = ctx.resolveModel?.("default");
  if (!rewriteModel) throw new Error("No model available for rewrite");
  const classifierModel = ctx.resolveModel?.("classifier") ?? rewriteModel;

  // Build editorial directives from constraints + context
  const baseDirectives =
    opts.editorialDirectives ?? encodeConstraintsAsDirectives(opts.constraints);
  let enrichedDirectives = baseDirectives;
  if (opts.contextPrefix || opts.contextSuffix) {
    const contextLines: string[] = ["SURROUNDING CONTEXT (read-only — do NOT modify):"];
    if (opts.contextPrefix) contextLines.push(`[Before] ${opts.contextPrefix}`);
    if (opts.contextSuffix) contextLines.push(`[After] ${opts.contextSuffix}`);
    contextLines.push(
      "Rewrite ONLY the target passage. Use the context for tone and flow reference.",
    );
    enrichedDirectives = [...baseDirectives, ...contextLines];
  }

  if (n === 1) {
    const result = await rewritePassage({
      profile,
      passageRange,
      style: opts.style,
      usePCE: opts.usePCE,
      rewriteModel,
      classifierModel,
      editorialDirectives: enrichedDirectives,
      onProgress: opts.onProgress,
    });
    if (ctx.recordUsage) await ctx.recordUsage("rewrite");
    return { kind: "single", data: result };
  }

  // Multi-alternative path
  if (opts.onProgress) opts.onProgress(`Generating ${n} alternatives in parallel...`);

  const results = await Promise.all(
    Array.from({ length: n }, (_, i) =>
      rewritePassage({
        profile,
        passageRange,
        style: opts.style,
        usePCE: opts.usePCE,
        rewriteModel,
        classifierModel,
        editorialDirectives: enrichedDirectives,
        variantSeed: i + 1,
      }),
    ),
  );

  if (ctx.recordUsage) await ctx.recordUsage("rewrite", n);

  const passageOriginal = results[0]?.original ?? text;

  const alternatives: RewriteAlternative[] = results
    .map((r, idx) => {
      const beforeWords = passageRange
        ? profile.sentences
            .filter((s) => s.id >= passageRange.start && s.id <= passageRange.end)
            .reduce((sum, s) => sum + s.classification.metrics.word_count, 0)
        : profile.word_count;
      const afterWords = r.text.trim().split(/\s+/).filter(Boolean).length;
      const { meaning_note, meaning_risk, apply_blocked } = assessRewriteMeaning(
        r.original,
        r.text,
        opts.constraints,
      );
      return {
        index: idx,
        text: r.text,
        structural_summary: summarizeStructuralChange(r),
        meaning_note,
        tone_note: describeTone(opts.constraints),
        meaning_risk,
        apply_blocked,
        word_delta: afterWords - beforeWords,
        metrics: {
          before: {
            mean_heat: r.before.mean_heat,
            pattern_count: r.before.pattern_count,
            word_count: beforeWords,
          },
          after: {
            mean_heat: r.after.mean_heat,
            pattern_count: r.after.pattern_count,
            word_count: afterWords,
          },
        },
      };
    })
    .filter((alt) => isValidRewriteSuggestion(passageOriginal, alt.text))
    .map((alt, index) => ({ ...alt, index }));

  return {
    kind: "alternatives",
    data: {
      original: passageOriginal,
      constraints: opts.constraints ?? null,
      alternatives,
    },
  };
}

// ─── engineEquilibrium ───────────────────────────────────────────────────────

export interface EquilibriumOpts {
  style?: string;
  councilModels: LanguageModel[];
  classifier: SentenceClassifier;
  maxRounds?: number;
  onProgress?: (round: CouncilRound) => void;
}

export async function engineEquilibrium(
  text: string,
  ctx: EngineContext,
  opts: EquilibriumOpts,
): Promise<EquilibriumResult> {
  if (ctx.checkLimit) {
    const limit = await ctx.checkLimit("rewrite");
    if (!limit.allowed) throw new Error(limit.message ?? "Rewrite limit reached");
  }

  const { profile } = await classifyText(text, ctx, opts.style);

  if (profile.mean_heat <= 2) {
    throw new Error("Heat is already low — no optimization needed");
  }

  const result = await findEquilibrium({
    profile,
    style: opts.style,
    councilModels: opts.councilModels,
    classifier: opts.classifier,
    maxRounds: opts.maxRounds ?? 3,
    onProgress: opts.onProgress,
  });

  if (ctx.recordUsage) await ctx.recordUsage("rewrite");
  return result;
}

// ─── engineReverseGuide ──────────────────────────────────────────────────────

export interface ReverseGuideOpts {
  name: string;
  description: string;
}

export async function engineReverseGuide(text: string, ctx: EngineContext, opts: ReverseGuideOpts) {
  const { classified } = await classifyText(text, ctx);

  if (classified.length === 0) {
    throw new Error("No sentences found in exemplar");
  }

  return reverseEngineerGuide(opts.name, opts.description, classified);
}

// ─── engineSuggest ───────────────────────────────────────────────────────────

export interface ProfileSentenceSnapshot {
  text: string;
  classification: SentenceClassification;
}

export interface SuggestOpts {
  sentenceId: number;
  model: LanguageModel;
  level?: "word" | "sentence" | "paragraph";
  numAlternatives?: number;
  customInstruction?: string;
  modelName?: string;
  style?: string;
  moonshotKind?: MoonshotKeyKind;
  /** UI profile snapshot — used when text still matches to avoid re-classify drift. */
  profileSentence?: ProfileSentenceSnapshot;
}

export async function engineSuggest(
  text: string,
  ctx: EngineContext,
  opts: SuggestOpts,
): Promise<RewriteSuggestion[]> {
  if (ctx.checkLimit) {
    const limit = await ctx.checkLimit("rewrite");
    if (!limit.allowed) throw new Error(limit.message ?? "Rewrite limit reached");
  }

  const { profile } = await classifyText(text, ctx, opts.style);

  let target = profile.sentences.find((s) => s.id === opts.sentenceId);
  if (!target) throw new Error("Sentence not found");

  if (opts.profileSentence && opts.profileSentence.text.trim() === target.text.trim()) {
    target = { ...target, classification: opts.profileSentence.classification };
  }

  const before =
    opts.sentenceId > 0
      ? (profile.sentences.find((s) => s.id === opts.sentenceId - 1)?.text ?? "")
      : "";
  const after =
    opts.sentenceId < profile.sentences.length - 1
      ? (profile.sentences.find((s) => s.id === opts.sentenceId + 1)?.text ?? "")
      : "";

  let paragraph: string | undefined;
  if (opts.level === "paragraph") {
    const paraId = target.paragraph_id;
    paragraph = profile.sentences
      .filter((s) => s.paragraph_id === paraId)
      .map((s) => s.text)
      .join(" ");
  }

  const suggestOpts = {
    level: opts.level ?? ("sentence" as const),
    numAlternatives: opts.numAlternatives,
    customInstruction: opts.customInstruction,
    modelName: opts.modelName,
    moonshotKind: opts.moonshotKind,
  };

  const suggestions =
    target.classification.patterns.length === 0
      ? await suggestGenericRewrites(
          target as ClassifiedSentence,
          { before, after, paragraph },
          opts.model,
          suggestOpts,
        )
      : await suggestRewrites(
          target as ClassifiedSentence,
          { before, after, paragraph },
          opts.model,
          suggestOpts,
        );

  if (ctx.recordUsage) await ctx.recordUsage("rewrite");
  return suggestions;
}
