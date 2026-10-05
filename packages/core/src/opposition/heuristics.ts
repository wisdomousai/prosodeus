import type { PatternType } from "../types.ts";
import type { OppositionSpan, SubstanceVerdict } from "./types.ts";

export interface HeuristicSubstanceResult {
  verdict: SubstanceVerdict;
  rationale: string;
}

/** Classic vacuous "not X, but Y" / strawman contrast templates. */
const NOT_ABOUT_REFRAME_RE =
  /\bnot about\b[^.!?]{0,120}(?:\bbut(?:\s+about)?\b|[,;:\u2014-]\s*(?:(?:it'?s|it is|this is|that is)\s+)?about\b)/i;
const NOT_BUT_RE =
  /\b(?:it'?s|this is|that is|they are|we are)\s+not\b[^.!?]{0,100}\b(?:but|rather|instead)\b/i;
const NOT_SIMPLY_BUT_RE = /\bnot (?:simply|just|only|merely)\b[^.!?]{0,80}\bbut\b/i;
const MOST_BEST_RE = /\bmost\b[^.!?]{0,80}\b(?:the best|winners|leaders)\b/i;
const ON_ONE_HAND_RE = /\bon (?:the )?one hand\b/i;
const ON_OTHER_HAND_RE = /\bon the other hand\b/i;

const OPPOSITION_SIGNAL_RE =
  /\b(but|rather than|instead of|not about|it's not|is not|on the other hand|while\b[^.!?]{0,60},)/i;

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

function gerundToInfinitive(value: string): string {
  const trimmed = value.trim();
  const firstWord = trimmed.match(/^([a-z]+)ing\b/i)?.[1];
  if (!firstWord) return trimmed;
  const base =
    firstWord.endsWith("at") || firstWord.endsWith("it")
      ? `${firstWord}e`
      : firstWord.endsWith("t")
        ? firstWord.slice(0, -1)
        : firstWord;
  return `${base}${trimmed.slice(firstWord.length + 3)}`;
}

/**
 * Deterministic correction for the most obvious opposition templates.
 *
 * This keeps the Operations review queue useful even when the model is slow:
 * the user can inspect and edit a direct replacement instead of waiting on a
 * generic sentence rewrite for a shape we already understand.
 */
export function heuristicOppositionRewrite(sentence: string): string | null {
  const trimmed = sentence.trim().replace(/\s+/g, " ");
  if (!trimmed) return null;

  const notAbout = trimmed.match(
    /^(.+?)\s+(?:is|are|was|were)\s+not\s+about\s+(.+?)(?:,\s*)?(?:but\s+(?:it\s+)?(?:is\s+)?about|[,;:\u2014-]\s*(?:(?:it'?s|it is|this is|that is)\s+)?about)\s+(.+?)[.!?]?$/i,
  );
  if (notAbout?.[1] && notAbout[3]) {
    return finishSentence(`${notAbout[1].trim()} depends on ${removeLeadingArticle(notAbout[3])}`);
  }

  const notMerelyAbout = trimmed.match(
    /^(?:it|this|that)\s+is\s+not\s+(?:simply|just|only|merely)\s+about\s+(.+?)\s+but\s+about\s+(.+?)[.!?]?$/i,
  );
  if (notMerelyAbout?.[2]) {
    return finishSentence(`The work is to ${gerundToInfinitive(notMerelyAbout[2])}`);
  }

  const notOnlyCan = trimmed.match(
    /^not\s+only\s+can\s+([A-Z][\w-]*)\s+(.+?),\s+but\s+(?:it|they|he|she|we|that)\s+can\s+also\s+(.+?)[.!?]?$/i,
  );
  if (notOnlyCan?.[1] && notOnlyCan[2] && notOnlyCan[3]) {
    return finishSentence(
      `${notOnlyCan[1]} can ${notOnlyCan[2]} and ${notOnlyCan[3].replace(/^also\s+/i, "")}`,
    );
  }

  const nuanced = trimmed.match(
    /^but\s+the\s+real\s+opportunity\s+is\s+much\s+more\s+nuanced:\s*(.+?)[.!?]?$/i,
  );
  if (nuanced?.[1]) {
    return finishSentence(`The practical opportunity is ${lowerFirst(nuanced[1])}`);
  }

  const oneHand = trimmed.match(
    /^on\s+(?:the\s+)?one\s+hand,\s*(.+?)[.;]\s*on\s+the\s+other\s+hand,\s*(.+?)[.!?]?$/i,
  );
  if (oneHand?.[1] && oneHand[2]) {
    return finishSentence(`${oneHand[1].trim()}, but ${lowerFirst(oneHand[2].trim())}`);
  }

  const oneHandOnly = trimmed.match(/^on\s+(?:the\s+)?one\s+hand,\s*(.+?)[.!?]?$/i);
  if (oneHandOnly?.[1]) {
    return finishSentence(upperFirst(oneHandOnly[1]));
  }

  const otherHandOnly = trimmed.match(/^on\s+the\s+other\s+hand,\s*(.+?)[.!?]?$/i);
  if (otherHandOnly?.[1]) {
    return finishSentence(upperFirst(otherHandOnly[1]));
  }

  return null;
}

export function hasVacuousOppositionTemplate(sentence: string): boolean {
  const trimmed = sentence.trim();
  return (
    NOT_ABOUT_REFRAME_RE.test(trimmed) ||
    NOT_BUT_RE.test(trimmed) ||
    NOT_SIMPLY_BUT_RE.test(trimmed) ||
    MOST_BEST_RE.test(trimmed) ||
    ON_ONE_HAND_RE.test(trimmed) ||
    ON_OTHER_HAND_RE.test(trimmed)
  );
}

/**
 * Fast-path vacuous detection for obvious template oppositions.
 * Skips an LLM call when the sentence shape is unambiguous.
 */
export function heuristicSubstanceVerdict(
  _span: OppositionSpan,
  sentence: string,
): HeuristicSubstanceResult | null {
  const trimmed = sentence.trim();
  if (!trimmed) return null;

  if (NOT_ABOUT_REFRAME_RE.test(trimmed)) {
    return {
      verdict: "vacuous",
      rationale: "Generic not-about-but-about opposition without a real opposing position.",
    };
  }
  if (NOT_BUT_RE.test(trimmed) || NOT_SIMPLY_BUT_RE.test(trimmed)) {
    return {
      verdict: "vacuous",
      rationale: "Template not-X-but-Y contrast without specific evidence.",
    };
  }
  if (MOST_BEST_RE.test(trimmed)) {
    return {
      verdict: "vacuous",
      rationale: "Generic most-versus-best strawman contrast.",
    };
  }
  if (ON_ONE_HAND_RE.test(trimmed)) {
    return {
      verdict: "vacuous",
      rationale: "Formulaic on-the-one-hand scaffolding.",
    };
  }
  if (ON_OTHER_HAND_RE.test(trimmed)) {
    return {
      verdict: "vacuous",
      rationale: "Formulaic on-the-other-hand scaffolding.",
    };
  }

  return null;
}

/** Clause-symmetry hits need explicit opposition language — parallel lists alone are not targets. */
export function isOppositionCandidate(sentence: string, patternType: PatternType): boolean {
  if (patternType !== "clause_symmetry") return true;
  return OPPOSITION_SIGNAL_RE.test(sentence);
}

/** When the judge is unsure but the template is obvious, still treat as vacuous. */
export function shouldPromoteUncertainToVacuous(sentence: string, span: OppositionSpan): boolean {
  if (span.patternType !== "binary_contrast" && span.patternType !== "negation_reframe") {
    return false;
  }
  return heuristicSubstanceVerdict(span, sentence)?.verdict === "vacuous";
}
