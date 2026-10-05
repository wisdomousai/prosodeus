import type { RewriteSuggestion } from "../types.ts";

const PLACEHOLDER_RE = /please (supply|provide|give|restructure)|\[.*?\]|TODO|placeholder/i;

/** Known hallucination tropes when the source sentence is abstract/generic. */
const FOREIGN_SCENE_RE =
  /\b(skyline|tower|towers|warehouse|corporate headquarters|financial district|steel and glass|channel\s*\d|gleaming spire)\b/i;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

function overlapRatio(a: string, b: string): number {
  const aTokens = new Set(tokenize(a));
  const bTokens = new Set(tokenize(b));
  if (aTokens.size === 0 || bTokens.size === 0) return 0;

  let shared = 0;
  for (const t of aTokens) {
    if (bTokens.has(t)) shared += 1;
  }
  return shared / Math.min(aTokens.size, bTokens.size);
}

function introducesForeignContent(original: string, suggestion: string): boolean {
  if (!FOREIGN_SCENE_RE.test(suggestion)) return false;
  return !FOREIGN_SCENE_RE.test(original);
}

export function isPlaceholderSuggestion(text: string): boolean {
  return !text || text.length < 12 || PLACEHOLDER_RE.test(text);
}

/**
 * Returns true when a rewrite alternative plausibly rewrites the source sentence
 * instead of inventing unrelated content.
 */
export function isValidRewriteSuggestion(original: string, suggestion: string): boolean {
  if (isPlaceholderSuggestion(suggestion)) return false;
  if (suggestion.trim() === original.trim()) return false;
  if (introducesForeignContent(original, suggestion)) return false;

  const overlap = overlapRatio(original, suggestion);
  // Structural rewrites should share a meaningful fraction of content words.
  if (overlap < 0.22) return false;

  // Reject suggestions that are wildly longer with almost no shared vocabulary.
  const lenRatio = suggestion.length / Math.max(original.length, 1);
  if (lenRatio > 2.5 && overlap < 0.35) return false;

  return true;
}

export function filterRewriteSuggestion(suggestion: RewriteSuggestion): RewriteSuggestion | null {
  const alternatives = suggestion.alternatives.filter((alt) =>
    isValidRewriteSuggestion(suggestion.original, alt.text),
  );
  if (alternatives.length === 0) return null;
  return { ...suggestion, alternatives };
}

export function filterRewriteSuggestions(suggestions: RewriteSuggestion[]): RewriteSuggestion[] {
  return suggestions.map(filterRewriteSuggestion).filter((s): s is RewriteSuggestion => s !== null);
}
