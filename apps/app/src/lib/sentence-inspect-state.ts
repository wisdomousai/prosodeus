import type {
  ClassifiedSentence,
  RewriteSuggestion,
  StylometricProfile,
} from "@prosodeus/core/browser";
import { listEligibleHotSentences, sentenceImpactScore } from "@prosodeus/core/browser";

export type SentenceInspectState =
  | "no_profile"
  | "analyze_pending"
  | "stale"
  | "critique_ready"
  | "suggest_queued"
  | "suggest_loading"
  | "suggest_ready";

export interface SentenceInspectContext {
  profile: StylometricProfile | null;
  /** False while a classify pass is in flight — blocks on-demand suggest. */
  analysisReady: boolean;
  staleSentenceIds: Set<number>;
  batchTargetIds: Set<number>;
  batchInFlight: boolean;
  suggestions: Map<number, RewriteSuggestion[]>;
  suggestionsLoading: number | null;
}

export function resolveSentenceInspectState(
  sentenceId: number,
  ctx: SentenceInspectContext,
): SentenceInspectState {
  if (!ctx.profile) return "no_profile";
  if (ctx.staleSentenceIds.has(sentenceId)) return "stale";

  const hasSuggestions = (ctx.suggestions.get(sentenceId)?.length ?? 0) > 0;
  if (hasSuggestions) return "suggest_ready";

  if (ctx.suggestionsLoading === sentenceId) return "suggest_loading";

  if (ctx.batchInFlight && ctx.batchTargetIds.has(sentenceId) && !hasSuggestions) {
    return "suggest_queued";
  }

  if (!ctx.analysisReady) return "analyze_pending";

  return "critique_ready";
}

/** Eligible hot sentences for navigation and editor highlight, by impact. */
export function listInspectableHotSentences(
  profile: StylometricProfile | null,
): ClassifiedSentence[] {
  if (!profile) return [];
  return listEligibleHotSentences(profile);
}

export function buildSuggestQueuedIds(
  ctx: Pick<SentenceInspectContext, "batchTargetIds" | "batchInFlight" | "suggestions">,
): Set<number> {
  const queued = new Set<number>();
  if (!ctx.batchInFlight) return queued;
  for (const id of ctx.batchTargetIds) {
    if (!ctx.suggestions.has(id)) queued.add(id);
  }
  return queued;
}

export function buildSuggestionReadyIds(
  suggestions: Map<number, RewriteSuggestion[]>,
): Set<number> {
  const ready = new Set<number>();
  for (const [id, sugs] of suggestions) {
    if (sugs.length > 0) ready.add(id);
  }
  return ready;
}

export function buildHotSentenceIds(profile: StylometricProfile | null): Set<number> {
  return new Set(listInspectableHotSentences(profile).map((s) => s.id));
}

export { sentenceImpactScore };
