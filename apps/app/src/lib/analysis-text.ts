/** Canonical text identity for analysis freshness checks. */
export function canonicalizeAnalysisText(text: string): string {
  return text
    .replace(/\u00a0/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function analysisTextEquals(a: string, b: string): boolean {
  return canonicalizeAnalysisText(a) === canonicalizeAnalysisText(b);
}

export function hasAnalysisText(text: string): boolean {
  return canonicalizeAnalysisText(text).length > 0;
}
