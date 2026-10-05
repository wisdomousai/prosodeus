export { checkFidelity } from "./fidelity-check.ts";
export {
  OPPOSITION_PATTERN_TYPES,
  type OppositionParagraphHit,
  type OppositionScan,
  type OppositionSectionHit,
  type OppositionSentenceHit,
  scanOppositions,
} from "./opposition-scan.ts";
export { rewriteOppositions } from "./rewrite-oppositions.ts";
export { rewriteSpan } from "./span-rewrite.ts";
export { scoreSubstance } from "./substance-scorer.ts";
export type {
  OppositionEdit,
  OppositionMetrics,
  OppositionModelOptions,
  OppositionResult,
  OppositionSpan,
  OppositionSpanSource,
  RewriteOppositionsOptions,
  SubstanceVerdict,
} from "./types.ts";
