import { assembleProfile } from "../analysis/profile.ts";
import { computeDelta, loadStyleGuide } from "../analysis/style-guide.ts";
import type { ClassifyProgress, EngineContext } from "../runtime/engine.ts";
import type {
  AiSlopMatcherMode,
  ClassifiedSentence,
  HashedSentence,
  SentenceClassification,
  StylometricProfile,
} from "../types.ts";
import { attachAiSlopCandidates } from "./ai-slop-candidates.ts";
import { computeHeat, getDefaultClassification } from "./classifier.ts";
import { heuristicScreenBatch } from "./heuristic-screen.ts";
import { gateNeedsFullClassification, gateNeedsMediumClassification } from "./medium-classifier.ts";
import { promoteSlopCandidates } from "./slop-promotion.ts";

export interface ClassifyScopeOpts {
  changedSentenceIds?: number[];
  neighborParagraphs?: boolean;
}

export interface ClassifyPipelineOpts extends ClassifyScopeOpts {
  style?: string;
  aiSlopMode?: AiSlopMatcherMode;
  onProgress?: (p: ClassifyProgress) => void;
  onPartialProfile?: (profile: StylometricProfile, done: boolean) => void;
}

export function filterUncachedScope(
  hashed: HashedSentence[],
  uncached: HashedSentence[],
  scope?: ClassifyScopeOpts,
): HashedSentence[] {
  if (!scope?.changedSentenceIds?.length) return uncached;
  const changedSet = new Set(scope.changedSentenceIds);
  const paragraphIds = new Set(
    hashed.filter((s) => changedSet.has(s.id)).map((s) => s.paragraph_id),
  );
  const includeNeighbor = scope.neighborParagraphs !== false;
  return uncached.filter(
    (s) => changedSet.has(s.id) || (includeNeighbor && paragraphIds.has(s.paragraph_id)),
  );
}

function mergeClassified(
  hashed: HashedSentence[],
  cached: Map<string, SentenceClassification>,
  freshByHash: Map<string, SentenceClassification>,
  disabledSet?: Set<string>,
  aiSlopMode?: AiSlopMatcherMode,
): ClassifiedSentence[] {
  return hashed.map((s) => {
    const raw = cached.get(s.hash) ?? freshByHash.get(s.hash) ?? getDefaultClassification();
    const filtered =
      disabledSet && disabledSet.size > 0
        ? { ...raw, patterns: raw.patterns.filter((p) => !disabledSet.has(p.type)) }
        : raw;
    const classification = attachAiSlopCandidates(s, filtered, aiSlopMode);
    const promoted = promoteSlopCandidates(classification, { playbookOnly: true });
    return { ...s, classification: promoted, heat: computeHeat(promoted) };
  });
}

function emitPartial(
  opts: ClassifyPipelineOpts | undefined,
  hashed: HashedSentence[],
  cached: Map<string, SentenceClassification>,
  freshByHash: Map<string, SentenceClassification>,
  ctx: EngineContext,
  done: boolean,
) {
  if (!opts?.onPartialProfile) return;
  const classified = mergeClassified(
    hashed,
    cached,
    freshByHash,
    ctx.disabledPatterns,
    opts.aiSlopMode ?? ctx.aiSlopMode,
  );
  let delta;
  if (opts.style) {
    const guide = loadStyleGuide(opts.style);
    if (guide) delta = computeDelta(classified, guide);
  }
  opts.onPartialProfile(assembleProfile(classified, delta), done);
}

const GATE_CHUNK = 12;

export async function classifyUncachedPipeline(
  uncached: HashedSentence[],
  hashed: HashedSentence[],
  cached: Map<string, SentenceClassification>,
  ctx: EngineContext,
  opts?: ClassifyPipelineOpts,
): Promise<ClassifiedSentence[]> {
  const scoped = filterUncachedScope(hashed, uncached, opts);
  if (scoped.length === 0) return [];

  const freshByHash = new Map<string, SentenceClassification>();
  let completedBatches = 0;

  const touchFresh = (entries: Array<{ hash: string; classification: SentenceClassification }>) => {
    for (const s of entries) freshByHash.set(s.hash, s.classification);
    completedBatches++;
    opts?.onProgress?.({
      total: hashed.length,
      cached: cached.size,
      classifying: scoped.length,
      completed: completedBatches,
    });
    emitPartial(opts, hashed, cached, freshByHash, ctx, false);
  };

  if (!ctx.gateClassifier) {
    const results = await ctx.classifier.classify(scoped);
    touchFresh(results);
    emitPartial(opts, hashed, cached, freshByHash, ctx, true);
    return results;
  }

  const heuristic = heuristicScreenBatch(scoped);
  const resolved: ClassifiedSentence[] = [];
  const needsGate: HashedSentence[] = [];

  for (const s of scoped) {
    const h = heuristic.get(s.id)!;
    if (h.kind === "certain_negative") {
      resolved.push({ ...s, classification: getDefaultClassification(), heat: 0 });
      freshByHash.set(s.hash, getDefaultClassification());
      continue;
    }
    if (h.kind === "certain_positive") {
      resolved.push({
        ...s,
        classification: h.classification,
        heat: computeHeat(h.classification),
      });
      freshByHash.set(s.hash, h.classification);
      continue;
    }
    needsGate.push(s);
  }

  const gateCached = ctx.cache.getGateMany
    ? await ctx.cache.getGateMany(needsGate.map((s) => s.hash))
    : new Map<string, SentenceClassification>();

  const needsGateLlm: HashedSentence[] = [];
  const gateById = new Map<number, SentenceClassification>();

  for (const s of needsGate) {
    const gc = gateCached.get(s.hash);
    if (gc) gateById.set(s.id, gc);
    else needsGateLlm.push(s);
  }

  const mediumById = new Map<number, SentenceClassification>();
  const fullById = new Map<number, SentenceClassification>();

  const drainEscalationQueues = async (
    mediumQueue: HashedSentence[],
    fullQueue: HashedSentence[],
  ) => {
    if (mediumQueue.length > 0 && ctx.mediumClassifier) {
      const medResults = await ctx.mediumClassifier.classify(mediumQueue);
      touchFresh(medResults);
      for (const s of medResults) mediumById.set(s.id, s.classification);
    }
    if (fullQueue.length > 0) {
      const fullResults = await ctx.classifier.classify(fullQueue);
      touchFresh(fullResults);
      for (const s of fullResults) fullById.set(s.id, s.classification);
    }
  };

  for (let i = 0; i < needsGateLlm.length; i += GATE_CHUNK) {
    const batch = needsGateLlm.slice(i, i + GATE_CHUNK);
    const gateResults = await ctx.gateClassifier.classify(batch);
    touchFresh(gateResults);

    if (ctx.cache.setGateMany) {
      await ctx.cache.setGateMany(
        gateResults.map((s) => ({ hash: s.hash, classification: s.classification })),
      );
    }

    const mediumQueue: HashedSentence[] = [];
    const fullQueue: HashedSentence[] = [];
    for (const s of gateResults) {
      gateById.set(s.id, s.classification);
      if (gateNeedsFullClassification(s.classification)) fullQueue.push(s);
      else if (gateNeedsMediumClassification(s.classification) && ctx.mediumClassifier) {
        mediumQueue.push(s);
      }
    }
    await drainEscalationQueues(mediumQueue, fullQueue);
  }

  const mediumQueue: HashedSentence[] = [];
  const fullQueue: HashedSentence[] = [];
  for (const s of needsGate) {
    if (mediumById.has(s.id) || fullById.has(s.id)) continue;
    const gc = gateById.get(s.id);
    if (!gc) continue;
    if (gateNeedsFullClassification(gc)) fullQueue.push(s);
    else if (gateNeedsMediumClassification(gc) && ctx.mediumClassifier) mediumQueue.push(s);
  }
  await drainEscalationQueues(mediumQueue, fullQueue);

  const resolvedIds = new Set(resolved.map((r) => r.id));
  const gateResolved = scoped
    .filter((s) => !resolvedIds.has(s.id))
    .map((s) => {
      const full = fullById.get(s.id);
      if (full) {
        freshByHash.set(s.hash, full);
        return { ...s, classification: full, heat: computeHeat(full) };
      }
      const med = mediumById.get(s.id);
      if (med) {
        freshByHash.set(s.hash, med);
        return { ...s, classification: med, heat: computeHeat(med) };
      }
      const gateNeg = getDefaultClassification();
      freshByHash.set(s.hash, gateNeg);
      return { ...s, classification: gateNeg, heat: 0 };
    });

  emitPartial(opts, hashed, cached, freshByHash, ctx, true);
  return [...resolved, ...gateResolved];
}
