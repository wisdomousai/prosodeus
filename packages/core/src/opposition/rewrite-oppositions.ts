import type { LanguageModel } from "ai";
import type { SentenceClassifier } from "../analysis/analyze.ts";
import { analyze } from "../analysis/analyze.ts";
import type { ClassificationCache } from "../storage/cache.ts";
import type { AiSlopMatcherMode, ClassifiedSentence, PatternType } from "../types.ts";
import { checkFidelity } from "./fidelity-check.ts";
import {
  hasVacuousOppositionTemplate,
  heuristicOppositionRewrite,
  isOppositionCandidate,
  shouldPromoteUncertainToVacuous,
} from "./heuristics.ts";
import { rewriteSpan, rewriteSpanAlternatives } from "./span-rewrite.ts";
import { scoreSubstance } from "./substance-scorer.ts";
import type {
  OppositionEdit,
  OppositionMetrics,
  OppositionResult,
  OppositionSpan,
} from "./types.ts";

/** Default oppositional patterns the opposition rewriter targets. */
export const DEFAULT_TARGET_PATTERNS: PatternType[] = [
  "binary_contrast",
  "negation_reframe",
  "clause_symmetry",
  "concessive_while",
];

export interface InternalRewriteOppositionsOptions {
  classifier: SentenceClassifier;
  cache: ClassificationCache;
  judgeModel: LanguageModel;
  rewriteModel: LanguageModel;
  maxPasses?: number;
  style?: string;
  aiSlopMode?: AiSlopMatcherMode;
  targetPatterns?: PatternType[];
  onProgress?: (message: string) => void;
}

function buildTargetSet(targetPatterns?: PatternType[]): Set<PatternType> {
  return new Set(targetPatterns ?? DEFAULT_TARGET_PATTERNS);
}

function findCandidateSentences(
  sentences: ClassifiedSentence[],
  targetSet: Set<PatternType>,
): ClassifiedSentence[] {
  const seen = new Set<number>();
  const candidates: ClassifiedSentence[] = [];
  for (const s of sentences) {
    if (seen.has(s.id)) continue;
    const detected = s.classification.patterns.some((p) => targetSet.has(p.type));
    const slop = s.classification.ai_slop_candidates?.some((c) =>
      c.mapped_pattern_types.some((t) => targetSet.has(t)),
    );
    const template =
      (targetSet.has("binary_contrast") || targetSet.has("negation_reframe")) &&
      hasVacuousOppositionTemplate(s.text);
    if (detected || slop || template) {
      candidates.push(s);
      seen.add(s.id);
    }
  }
  return candidates;
}

function spanFromSentence(s: ClassifiedSentence, targetSet: Set<PatternType>): OppositionSpan {
  const detected = s.classification.patterns.find((p) => targetSet.has(p.type));
  const slop = s.classification.ai_slop_candidates?.find((c) =>
    c.mapped_pattern_types.some((t) => targetSet.has(t)),
  );

  const source: OppositionSpan["source"] = detected ? "detected_pattern" : "ai_slop_candidate";
  const patternType =
    detected?.type ??
    slop?.mapped_pattern_types.find((t) => targetSet.has(t)) ??
    ([...targetSet][0] as PatternType);
  const evidence = detected?.evidence ?? slop?.evidence ?? s.text;
  const confidence = detected?.confidence ?? 0.7;

  return {
    sentenceId: s.id,
    start: 0,
    end: s.text.length,
    text: s.text,
    patternType,
    confidence,
    source,
    evidence,
  };
}

function finishSentence(value: string): string {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) return trimmed;
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function lowerFirst(value: string): string {
  return value.length > 0 ? `${value[0]?.toLowerCase()}${value.slice(1)}` : value;
}

function upperFirst(value: string): string {
  return value.length > 0 ? `${value[0]?.toUpperCase()}${value.slice(1)}` : value;
}

function removeLeadingArticle(value: string): string {
  return value.trim().replace(/^(?:a|an|the)\s+/i, "");
}

function normalizePairSentence(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[.!?]+$/g, "");
}

function adjacentPairRewrite(
  first: ClassifiedSentence,
  second: ClassifiedSentence,
): { replacement: string; patternType: PatternType; evidence: string } | null {
  if (first.paragraph_id !== second.paragraph_id || second.id !== first.id + 1) return null;

  const firstText = first.text.trim().replace(/\s+/g, " ");
  const secondText = second.text.trim().replace(/\s+/g, " ");

  const atFirstGlance = firstText.match(/^at first glance,\s*(.+?)[.!?]?$/i);
  const realOpportunity = secondText.match(
    /^but\s+the\s+real\s+opportunity\s+is\s+(?:much\s+more\s+nuanced:\s*)?(.+?)[.!?]?$/i,
  );
  if (atFirstGlance?.[1] && realOpportunity?.[1]) {
    return {
      replacement: finishSentence(`The practical opportunity is ${lowerFirst(realOpportunity[1])}`),
      patternType: "concessive_while",
      evidence: `${firstText} ${secondText}`,
    };
  }

  const oneHand = firstText.match(/^on\s+(?:the\s+)?one\s+hand,\s*(.+?)[.!?]?$/i);
  const otherHand = secondText.match(/^on\s+the\s+other\s+hand,\s*(.+?)[.!?]?$/i);
  if (oneHand?.[1] && otherHand?.[1]) {
    return {
      replacement: `${finishSentence(upperFirst(oneHand[1]))} ${finishSentence(upperFirst(otherHand[1]))}`,
      patternType: "binary_contrast",
      evidence: `${firstText} ${secondText}`,
    };
  }

  const notAbout = firstText.match(/^(.+?)\s+(?:is|are|was|were)\s+not\s+about\s+(.+?)[.!?]?$/i);
  const itIsAbout = secondText.match(/^(?:it|this|that)\s+is\s+about\s+(.+?)[.!?]?$/i);
  if (notAbout?.[1] && itIsAbout?.[1]) {
    return {
      replacement: finishSentence(
        `${normalizePairSentence(notAbout[1])} depends on ${removeLeadingArticle(itIsAbout[1])}`,
      ),
      patternType: "negation_reframe",
      evidence: `${firstText} ${secondText}`,
    };
  }

  return null;
}

function findAdjacentPairEdits(
  sentences: ClassifiedSentence[],
  targetSet: Set<PatternType>,
): { edits: OppositionEdit[]; consumedSentenceIds: Set<number> } {
  const edits: OppositionEdit[] = [];
  const consumedSentenceIds = new Set<number>();
  if (
    !targetSet.has("binary_contrast") &&
    !targetSet.has("negation_reframe") &&
    !targetSet.has("concessive_while")
  ) {
    return { edits, consumedSentenceIds };
  }

  for (let i = 0; i < sentences.length - 1; i++) {
    const first = sentences[i];
    const second = sentences[i + 1];
    if (!first || !second) continue;
    if (consumedSentenceIds.has(first.id) || consumedSentenceIds.has(second.id)) continue;
    const rewrite = adjacentPairRewrite(first, second);
    if (!rewrite || !targetSet.has(rewrite.patternType)) continue;

    const original = `${first.text} ${second.text}`;
    const span: OppositionSpan = {
      sentenceId: first.id,
      sentenceEndId: second.id,
      start: 0,
      end: original.length,
      text: original,
      patternType: rewrite.patternType,
      confidence: 0.9,
      source: "detected_pattern",
      evidence: rewrite.evidence,
    };
    edits.push({
      span,
      originalSentence: original,
      rewrittenSentence: rewrite.replacement,
      verdict: "vacuous",
      fidelityScore: 0,
      fidelityReason:
        "Rule-based correction for an adjacent-sentence opposition template. Review before applying.",
      accepted: false,
    });
    consumedSentenceIds.add(first.id);
    consumedSentenceIds.add(second.id);
  }

  return { edits, consumedSentenceIds };
}

function getContext(s: ClassifiedSentence, allSentences: ClassifiedSentence[]) {
  const before = allSentences.find((x) => x.id === s.id - 1 && x.paragraph_id === s.paragraph_id);
  const after = allSentences.find((x) => x.id === s.id + 1 && x.paragraph_id === s.paragraph_id);
  const paragraph = allSentences
    .filter((x) => x.paragraph_id === s.paragraph_id)
    .map((x) => x.text)
    .join(" ");
  return { before: before?.text, after: after?.text, paragraph };
}

function rebuildText(sentences: ClassifiedSentence[]): string {
  const paragraphs = new Map<number, string[]>();
  for (const s of sentences) {
    const list = paragraphs.get(s.paragraph_id);
    if (list) {
      list.push(s.text);
    } else {
      paragraphs.set(s.paragraph_id, [s.text]);
    }
  }
  const sortedIds = [...paragraphs.keys()].sort((a, b) => a - b);
  return sortedIds.map((id) => paragraphs.get(id)?.join(" ") ?? "").join("\n\n");
}

function emptyMetrics(): OppositionMetrics {
  return {
    passes: 0,
    spansDetected: 0,
    vacuousSpans: 0,
    earnedSpans: 0,
    uncertainSpans: 0,
    acceptedEdits: 0,
    rejectedEdits: 0,
    fidelityFailures: 0,
  };
}

function pushSkippedEdit(
  edits: OppositionEdit[],
  span: OppositionSpan,
  sentence: string,
  verdict: "earned",
  rationale: string,
): void {
  edits.push({
    span,
    originalSentence: sentence,
    rewrittenSentence: sentence,
    verdict,
    fidelityScore: 1,
    fidelityReason: rationale,
    accepted: false,
  });
}

const OPPOSITION_ALTERNATIVE_COUNT = 3;

function uniqueAlternatives(
  original: string,
  candidates: Array<string | null | undefined>,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const orig = original.trim().replace(/\s+/g, " ");
  for (const candidate of candidates) {
    if (!candidate) continue;
    const trimmed = candidate.trim();
    const normalized = trimmed.replace(/\s+/g, " ");
    if (!trimmed || normalized === orig) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(trimmed);
  }
  return out;
}

async function draftOppositionAlternatives(
  span: OppositionSpan,
  context: {
    sentence: string;
    before?: string;
    after?: string;
    paragraph?: string;
  },
  rewriteModel: LanguageModel,
  onProgress: ((message: string) => void) | undefined,
  pass: number,
  sentenceId: number,
  extras: Array<string | null | undefined> = [],
): Promise<string[]> {
  onProgress?.(`Pass ${pass}: drafting alternatives for sentence ${sentenceId}...`);
  const fromModel = await rewriteSpanAlternatives(
    span,
    {
      sentence: context.sentence,
      before: context.before,
      after: context.after,
      paragraph: context.paragraph,
    },
    { model: rewriteModel, count: OPPOSITION_ALTERNATIVE_COUNT },
  );
  return uniqueAlternatives(context.sentence, [...extras, ...fromModel]).slice(
    0,
    OPPOSITION_ALTERNATIVE_COUNT,
  );
}

/**
 * Rewrite vacuous binary/contrastive constructions from a passage.
 *
 * Pipeline per pass:
 * 1. Classify the current text.
 * 2. Find sentences with target patterns.
 * 3. Score substance of each candidate.
 * 4. Rewrite vacuous candidates and check fidelity.
 * 5. Apply accepted edits.
 * 6. Re-classify and repeat until stable or max passes.
 */
export async function rewriteOppositions(
  text: string,
  options: InternalRewriteOppositionsOptions,
): Promise<OppositionResult> {
  const targetSet = buildTargetSet(options.targetPatterns);
  const maxPasses = options.maxPasses ?? 3;
  const edits: OppositionEdit[] = [];
  const metrics = emptyMetrics();

  let currentText = text;
  let pass = 0;

  while (pass < maxPasses) {
    pass++;
    options.onProgress?.(`Pass ${pass}: classifying...`);

    const profile = await analyze(currentText, {
      cache: options.cache,
      classifier: options.classifier,
      style: options.style,
    });

    const adjacentPairResult = findAdjacentPairEdits(profile.sentences, targetSet);
    for (const edit of adjacentPairResult.edits) {
      const anchor =
        profile.sentences.find((sentence) => sentence.id === edit.span.sentenceId) ?? null;
      const context = anchor
        ? getContext(anchor, profile.sentences)
        : { before: undefined, after: undefined, paragraph: undefined };
      const alternatives = await draftOppositionAlternatives(
        edit.span,
        { ...context, sentence: edit.originalSentence },
        options.rewriteModel,
        options.onProgress,
        pass,
        edit.span.sentenceId,
        [edit.rewrittenSentence],
      );
      const primary = alternatives[0] ?? edit.rewrittenSentence;
      edits.push({
        ...edit,
        rewrittenSentence: primary,
        alternatives: alternatives.length > 0 ? alternatives : undefined,
      });
      metrics.vacuousSpans++;
    }

    const candidates = findCandidateSentences(profile.sentences, targetSet).filter(
      (candidate) => !adjacentPairResult.consumedSentenceIds.has(candidate.id),
    );
    const detectedCount = adjacentPairResult.edits.length + candidates.length;
    if (detectedCount === 0) {
      options.onProgress?.(`Pass ${pass}: no candidate sentences found.`);
      break;
    }

    metrics.spansDetected += detectedCount;
    options.onProgress?.(`Pass ${pass}: ${detectedCount} candidate correction(s) found.`);

    // Mutable copy of current sentences for this pass.
    const mutableSentences = profile.sentences.map((s) => ({ ...s }));
    let acceptedThisPass = 0;

    for (const candidate of candidates) {
      const span = spanFromSentence(candidate, targetSet);
      if (!isOppositionCandidate(candidate.text, span.patternType)) {
        continue;
      }
      const context = getContext(candidate, profile.sentences);
      const heuristicRewrite = heuristicOppositionRewrite(candidate.text);

      if (heuristicRewrite) {
        metrics.vacuousSpans++;
        const alternatives = await draftOppositionAlternatives(
          span,
          { ...context, sentence: candidate.text },
          options.rewriteModel,
          options.onProgress,
          pass,
          candidate.id,
          [heuristicRewrite],
        );
        const primary = alternatives[0] ?? heuristicRewrite;
        edits.push({
          span,
          originalSentence: candidate.text,
          rewrittenSentence: primary,
          verdict: "vacuous",
          fidelityScore: 0,
          fidelityReason:
            "Rule-based correction for a known opposition template. Review before applying.",
          accepted: false,
          alternatives: alternatives.length > 0 ? alternatives : undefined,
        });
        continue;
      }

      options.onProgress?.(`Pass ${pass}: scoring sentence ${candidate.id}...`);
      let substance = await scoreSubstance(
        span,
        {
          sentence: candidate.text,
          before: context.before,
          after: context.after,
          paragraph: context.paragraph,
        },
        { model: options.judgeModel },
      );

      if (
        substance.verdict === "uncertain" &&
        shouldPromoteUncertainToVacuous(candidate.text, span)
      ) {
        substance = {
          verdict: "vacuous",
          rationale: "Template opposition detected; promoted from uncertain.",
        };
      }

      if (substance.verdict === "earned") {
        metrics.earnedSpans++;
        pushSkippedEdit(edits, span, candidate.text, "earned", substance.rationale);
        continue;
      }
      if (substance.verdict === "uncertain") {
        metrics.uncertainSpans++;
        const alternatives = await draftOppositionAlternatives(
          span,
          { ...context, sentence: candidate.text },
          options.rewriteModel,
          options.onProgress,
          pass,
          candidate.id,
        );
        edits.push({
          span,
          originalSentence: candidate.text,
          rewrittenSentence: candidate.text,
          verdict: "uncertain",
          fidelityScore: 0,
          fidelityReason: substance.rationale,
          accepted: false,
          alternatives: alternatives.length > 0 ? alternatives : undefined,
        });
        continue;
      }

      metrics.vacuousSpans++;
      options.onProgress?.(`Pass ${pass}: rewriting sentence ${candidate.id}...`);
      const rewritten = await rewriteSpan(
        span,
        {
          sentence: candidate.text,
          before: context.before,
          after: context.after,
          paragraph: context.paragraph,
        },
        { model: options.rewriteModel },
      );

      if (!rewritten) {
        metrics.rejectedEdits++;
        const alternatives = await draftOppositionAlternatives(
          span,
          { ...context, sentence: candidate.text },
          options.rewriteModel,
          options.onProgress,
          pass,
          candidate.id,
        );
        edits.push({
          span,
          originalSentence: candidate.text,
          rewrittenSentence: candidate.text,
          verdict: "vacuous",
          fidelityScore: 0,
          fidelityReason: "Model produced no usable rewrite",
          accepted: false,
          alternatives: alternatives.length > 0 ? alternatives : undefined,
        });
        continue;
      }

      const fidelity = await checkFidelity(candidate.text, rewritten, {
        entailmentModel: options.judgeModel,
      });

      if (!fidelity.passed) {
        metrics.rejectedEdits++;
        metrics.fidelityFailures++;
        const alternatives = await draftOppositionAlternatives(
          span,
          { ...context, sentence: candidate.text },
          options.rewriteModel,
          options.onProgress,
          pass,
          candidate.id,
          [rewritten],
        );
        edits.push({
          span,
          originalSentence: candidate.text,
          rewrittenSentence: rewritten,
          verdict: "vacuous",
          fidelityScore: fidelity.score,
          fidelityReason: fidelity.reason,
          accepted: false,
          alternatives: alternatives.length > 0 ? alternatives : undefined,
        });
        continue;
      }

      // Accept the edit for multi-pass rewriting, but still attach options for review UI.
      const targetSentence = mutableSentences[candidate.id];
      if (!targetSentence) continue;
      targetSentence.text = rewritten;
      acceptedThisPass++;
      metrics.acceptedEdits++;
      const alternatives = await draftOppositionAlternatives(
        span,
        { ...context, sentence: candidate.text },
        options.rewriteModel,
        options.onProgress,
        pass,
        candidate.id,
        [rewritten],
      );
      edits.push({
        span,
        originalSentence: candidate.text,
        rewrittenSentence: rewritten,
        verdict: "vacuous",
        fidelityScore: fidelity.score,
        fidelityReason: fidelity.reason,
        accepted: true,
        alternatives: alternatives.length > 0 ? alternatives : undefined,
      });
    }

    if (acceptedThisPass === 0) {
      options.onProgress?.(`Pass ${pass}: no edits accepted; stopping.`);
      break;
    }

    currentText = rebuildText(mutableSentences);
    options.onProgress?.(`Pass ${pass}: accepted ${acceptedThisPass} edit(s).`);
  }

  metrics.passes = pass;
  edits.sort(
    (a, b) =>
      a.span.sentenceId - b.span.sentenceId ||
      (a.span.sentenceEndId ?? a.span.sentenceId) - (b.span.sentenceEndId ?? b.span.sentenceId),
  );

  return {
    originalText: text,
    rewrittenText: currentText,
    edits,
    metrics,
  };
}

// Re-export the public options type aliased to the internal shape.
export type { RewriteOppositionsOptions } from "./types.ts";
