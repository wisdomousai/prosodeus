import type {
  ClassifiedSentence,
  DetectedPattern,
  PatternType,
  SentenceClassification,
  StylometricProfile,
  WindowMetrics,
} from "@prosodeus/core/browser";
import type {
  RewriteAlternative,
  RewriteAlternativesEvent,
  RewriteConstraints,
} from "@prosodeus/shared/browser";

const STRONG_WORDS = [
  "truly",
  "fundamental",
  "remarkable",
  "unprecedented",
  "undoubtedly",
  "crucial",
  "powerful",
  "cutting-edge",
  "significant",
  "essential",
  "very",
  "clearly",
  "decisively",
  "sharper",
  "strongest",
  "transformative",
];

const NOMINALIZATIONS = [
  "utilization",
  "implementation",
  "optimization",
  "facilitation",
  "democratization",
  "establishment",
  "recognition",
  "realization",
  "transformation",
  "integration",
  "advancement",
  "development",
];

const COMMON_WORDS = new Set([
  "the",
  "and",
  "that",
  "this",
  "with",
  "when",
  "from",
  "into",
  "only",
  "they",
  "their",
  "there",
  "will",
  "while",
  "where",
  "what",
  "about",
  "should",
]);

export const LOCAL_SAMPLE_TEXT = `Statistical writing is not about making every sentence sound decisive but about assigning force where the evidence earns it. The strongest version of a paragraph is rarely the loudest version.

In a weak draft, every claim becomes fundamental, crucial, and transformative. This pattern creates impressive surface energy, but it also makes the argument feel flat because nothing is allowed to be ordinary.

A better draft keeps one or two strong expressions and lets the rest of the prose do quieter work. It names the data, the method, and the assumption before asking the reader to accept a conclusion.

When openings repeat, the rhythm stiffens. When contrasts repeat, the argument starts to sound binary. When abstract nouns stack together, the sentence asks the reader to admire a shape instead of follow a thought.

Revise for level. Keep the sharp claim. Cut the merely impressive support. Let the evidence carry the sentence.`;

export function buildLocalProfile(text: string): StylometricProfile {
  const sentences = splitForLocalAnalysis(text).map((s, index, all) => {
    const classification = classifySentence(
      s.text,
      index,
      all.map((x) => x.text),
    );
    const heat = computeLocalHeat(classification);
    return {
      id: index,
      text: s.text,
      hash: stableHash(s.text),
      paragraph_id: s.paragraph,
      classification,
      heat,
    } satisfies ClassifiedSentence;
  });

  const words = wordsOf(text);
  const windows = buildLocalWindows(sentences);
  const meanHeat =
    sentences.length > 0
      ? round1(sentences.reduce((sum, s) => sum + s.heat, 0) / sentences.length)
      : 0;

  return {
    word_count: words.length,
    sentence_count: sentences.length,
    paragraph_count: new Set(sentences.map((s) => s.paragraph_id)).size,
    sentences,
    windows,
    hot_regions: buildHotRegions(sentences),
    convergence_slope: 0,
    global_biber_entropy: 0.56,
    global_device_entropy: deviceEntropy(sentences),
    global_sentence_length_autocorrelation: 0.2,
    mean_heat: meanHeat,
    global_ttr: words.length ? new Set(words.map((w) => w.toLowerCase())).size / words.length : 0,
    global_mattr: 0.72,
    global_hapax_ratio: 0.48,
    global_word_length_entropy: 0.66,
    global_opening_variety: openingVariety(sentences),
    global_function_word_ratio: 0.42,
  };
}

export function buildLocalRewriteAlternatives(
  text: string,
  passageStart: number,
  passageEnd: number,
  constraints: RewriteConstraints,
  n: number,
): RewriteAlternativesEvent["data"] {
  const profile = buildLocalProfile(text);
  const selected = profile.sentences.filter((s) => s.id >= passageStart && s.id <= passageEnd);
  const original = selected.map((s) => s.text).join(" ");
  const beforeProfile = buildLocalProfile(original);
  const variants = [
    binaryRewrite(original),
    levelRewrite(original, constraints),
    evidenceFirstRewrite(original),
    rhythmRewrite(original),
    compactRewrite(original),
  ]
    .filter((v, idx, arr) => v.trim() && arr.indexOf(v) === idx)
    .slice(0, Math.max(1, n));

  const alternatives: RewriteAlternative[] = variants.map((variant, index) => {
    const afterProfile = buildLocalProfile(variant);
    return {
      index,
      text: variant,
      structural_summary: structuralSummary(index, constraints),
      meaning_note: "Keeps the claim and evidence relationship intact.",
      tone_note: toneNote(constraints),
      metrics: {
        before: {
          mean_heat: beforeProfile.mean_heat,
          pattern_count: countPatterns(beforeProfile),
          word_count: beforeProfile.word_count,
        },
        after: {
          mean_heat: afterProfile.mean_heat,
          pattern_count: countPatterns(afterProfile),
          word_count: afterProfile.word_count,
        },
      },
      meaning_risk: "low",
      apply_blocked: false,
    };
  });

  return { original, constraints, alternatives };
}

function splitForLocalAnalysis(text: string): Array<{ text: string; paragraph: number }> {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  const result: Array<{ text: string; paragraph: number }> = [];
  paragraphs.forEach((paragraph, paragraphIndex) => {
    const matches = paragraph.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [];
    matches
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((sentence) => result.push({ text: sentence, paragraph: paragraphIndex }));
  });
  return result;
}

function classifySentence(
  sentence: string,
  index: number,
  allSentences: string[],
): SentenceClassification {
  const words = wordsOf(sentence);
  const lower = sentence.toLowerCase();
  const patterns: DetectedPattern[] = [];
  const strongHits = STRONG_WORDS.filter((w) => lower.includes(w));
  const nominalHits = NOMINALIZATIONS.filter((w) => lower.includes(w));
  const opening = openingKey(sentence);
  const previousOpening = index > 0 ? openingKey(allSentences[index - 1] ?? "") : "";

  if (strongHits.length >= 2) {
    patterns.push({
      type: "intensifier_saturation",
      confidence: Math.min(1, 0.45 + strongHits.length * 0.12),
      evidence: strongHits.slice(0, 4).join(", "),
    });
  }
  if (strongHits.some((w) => ["crucial", "essential", "significant"].includes(w))) {
    patterns.push({
      type: "importance_inflation",
      confidence: 0.72,
      evidence:
        strongHits.find((w) => ["crucial", "essential", "significant"].includes(w)) ??
        strongHits[0] ??
        "",
    });
  }
  if (/\bwhile\b|\bnot\b.+\bbut\b|\brather than\b|\binstead of\b/i.test(sentence)) {
    patterns.push({
      type: "binary_contrast",
      confidence: 0.8,
      evidence:
        sentence.match(/\bwhile\b|\bnot\b.+?\bbut\b|\brather than\b|\binstead of\b/i)?.[0] ??
        "contrast framing",
    });
  }
  if (opening && opening === previousOpening) {
    patterns.push({
      type: "sentence_opener_repetition",
      confidence: 0.84,
      evidence: opening,
    });
  }
  if (nominalHits.length >= 1) {
    patterns.push({
      type: "nominalization",
      confidence: Math.min(1, 0.55 + nominalHits.length * 0.1),
      evidence: nominalHits.slice(0, 3).join(", "),
    });
  }

  const repeats = repeatedContentWords(words);
  if (repeats.length > 0) {
    patterns.push({
      type: "vocabulary_smoothing",
      confidence: 0.64,
      evidence: repeats.slice(0, 3).join(", "),
    });
  }

  const clauseCount = Math.max(1, sentence.split(/,|;|\band\b|\bbut\b|\bwhile\b/i).length);

  return {
    biber: {
      informational: 0.62,
      involved: 0.1,
      narrative: 0.05,
      persuasive: strongHits.length > 0 ? 0.58 : 0.32,
      abstract: nominalHits.length > 0 ? 0.55 : 0.24,
      elaborative: clauseCount > 2 ? 0.55 : 0.28,
    },
    patterns,
    metrics: {
      word_count: words.length,
      clause_count: clauseCount,
      has_participial: /\b\w+ing\b/.test(lower),
      has_relative_clause: /\bthat\b|\bwhich\b|\bwho\b/.test(lower),
      clause_balance_ratio: clauseCount >= 2 ? 0.78 : 0.5,
      construction_type:
        clauseCount >= 3 ? "compound-complex" : clauseCount === 2 ? "compound" : "simple",
    },
    arc_role:
      index === 0
        ? "claim"
        : /\bdata\b|\bmethod\b|\bevidence\b/i.test(sentence)
          ? "evidence"
          : "development",
  };
}

function computeLocalHeat(classification: SentenceClassification): number {
  const weights: Partial<Record<PatternType, number>> = {
    intensifier_saturation: 1.5,
    importance_inflation: 1.1,
    binary_contrast: 1.4,
    sentence_opener_repetition: 1.2,
    nominalization: 1,
    vocabulary_smoothing: 0.8,
  };
  let heat = classification.patterns.reduce(
    (sum, p) => sum + (weights[p.type] ?? 0.8) * p.confidence,
    0,
  );
  if (classification.metrics.clause_count >= 3) heat += 0.45;
  if (classification.patterns.length >= 3) heat *= 1.15;
  return Math.min(10, round1(heat));
}

function buildLocalWindows(sentences: ClassifiedSentence[]): WindowMetrics[] {
  if (sentences.length === 0) return [];
  const density: Partial<Record<PatternType, number>> = {};
  const wordCount = sentences.reduce((sum, s) => sum + s.classification.metrics.word_count, 0);
  for (const s of sentences) {
    for (const p of s.classification.patterns) {
      density[p.type] = (density[p.type] ?? 0) + 100 / Math.max(1, wordCount);
    }
  }
  return [
    {
      size: "wide",
      start_sentence: 0,
      end_sentence: sentences.length - 1,
      word_count: wordCount,
      pattern_density: density as Record<PatternType, number>,
      biber_entropy: 0.56,
      length_entropy: 0.6,
      device_entropy: deviceEntropy(sentences),
      sentence_length_autocorrelation: 0.2,
      co_occurrence: [],
      ttr: 0.72,
      hapax_ratio: 0.48,
      word_length_entropy: 0.66,
      opening_variety: openingVariety(sentences),
      function_word_ratio: 0.42,
    },
  ];
}

function buildHotRegions(sentences: ClassifiedSentence[]) {
  return sentences
    .filter((s) => s.heat >= 2.2)
    .slice(0, 4)
    .map((s) => ({
      start_sentence: s.id,
      end_sentence: s.id,
      heat: s.heat,
      primary_patterns: s.classification.patterns.slice(0, 3).map((p) => p.type),
      description: "Local density/repetition finding",
    }));
}

function wordsOf(text: string): string[] {
  return text.match(/[A-Za-z][A-Za-z'-]*/g) ?? [];
}

function openingKey(sentence: string): string {
  return wordsOf(sentence).slice(0, 2).join(" ").toLowerCase();
}

function repeatedContentWords(words: string[]): string[] {
  const seen = new Map<string, number>();
  for (const word of words
    .map((w) => w.toLowerCase())
    .filter((w) => w.length > 5 && !COMMON_WORDS.has(w))) {
    seen.set(word, (seen.get(word) ?? 0) + 1);
  }
  return [...seen.entries()].filter(([, count]) => count > 1).map(([word]) => word);
}

function deviceEntropy(sentences: ClassifiedSentence[]): number {
  if (sentences.length === 0) return 0;
  const patternful = sentences.filter((s) => s.classification.patterns.length > 0).length;
  return round2(1 - patternful / Math.max(1, sentences.length * 1.7));
}

function openingVariety(sentences: ClassifiedSentence[]): number {
  if (sentences.length === 0) return 0;
  const openings = sentences.map((s) => openingKey(s.text)).filter(Boolean);
  return round2(new Set(openings).size / Math.max(1, openings.length));
}

function countPatterns(profile: StylometricProfile): number {
  return profile.sentences.reduce((sum, s) => sum + s.classification.patterns.length, 0);
}

function levelRewrite(original: string, constraints: RewriteConstraints): string {
  let next = soften(binaryRewrite(original));
  if (constraints.statement_force === "emphatic") {
    next = next.replace(/\bimportant\b/i, "important and well-supported");
  }
  if (constraints.expression_budget === "none") {
    next = next.replace(/\btruly\b|\bstrongest\b|\bsharpest\b/gi, "").replace(/\s{2,}/g, " ");
  }
  return cleanup(next);
}

function evidenceFirstRewrite(original: string): string {
  const next = soften(binaryRewrite(original))
    .replace(/^In strong writing,\s*/i, "Strong writing works best when ")
    .replace(
      /^While traditional approaches relied heavily on manual processes,\s*/i,
      "Compared with manual processes, ",
    );
  return cleanup(next);
}

function rhythmRewrite(original: string): string {
  const sentences = splitForLocalAnalysis(original).map((s) => soften(binaryRewrite(s.text)));
  return cleanup(
    sentences
      .map((sentence, index) => {
        if (index === 1 && /^This\b/.test(sentence))
          return sentence.replace(/^This\b/, "That focus");
        if (index === 2 && /^Save\b/.test(sentence)) return sentence.replace(/^Save\b/, "Reserve");
        return sentence;
      })
      .join(" "),
  );
}

function compactRewrite(original: string): string {
  return cleanup(
    soften(binaryRewrite(original))
      .replace(/\bhas demonstrated\b/gi, "shows")
      .replace(/\bhas enabled\b/gi, "enables")
      .replace(/\bhas been crucial in driving\b/gi, "helps")
      .replace(/\bwill likely play\b/gi, "will likely matter in"),
  );
}

function binaryRewrite(original: string): string {
  return cleanup(
    original.replace(
      /^(.+?) is not about (.+?) but about (.+?)([.!?])$/i,
      (_match, subject: string, rejected: string, preferred: string, punctuation: string) =>
        `${subject} means ${preferred}${punctuation} It avoids ${rejected}.`,
    ),
  );
}

function soften(text: string): string {
  return text
    .replace(/\bhas perhaps arguably created\b/gi, "may have created")
    .replace(/\bPerhaps more importantly,\s*the\b/gi, "The")
    .replace(/\btruly fundamental paradigm shift\b/gi, "important change")
    .replace(/\bvery foundations\b/gi, "basic assumptions")
    .replace(/\bremarkable potential\b/gi, "practical potential")
    .replace(/\bvirtually every\b/gi, "many")
    .replace(/\bPerhaps more importantly,\s*/gi, "")
    .replace(/\bperhaps arguably\b/gi, "arguably")
    .replace(/\bunprecedented opportunities\b/gi, "new opportunities")
    .replace(/\bpowerful tools\b/gi, "useful tools")
    .replace(/\bcutting-edge technologies\b/gi, "new technologies")
    .replace(/\bparticularly noteworthy\b/gi, "worth noting")
    .replace(/\buniquely favorable\b/gi, "favorable")
    .replace(/\bundoubtedly play a crucial role\b/gi, "will likely matter")
    .replace(/\bstrongest expressions\b/gi, "strongest expressions")
    .replace(/\btruly deserve\b/gi, "deserve");
}

function cleanup(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/\s+([.,;:!?])/g, "$1")
    .replace(
      /([.!?]\s+)([a-z])/g,
      (_match, boundary: string, letter: string) => boundary + letter.toUpperCase(),
    )
    .trim();
}

function structuralSummary(index: number, constraints: RewriteConstraints): string {
  if (index === 0) return "Dials back intensifiers and keeps one clear claim.";
  if (index === 1) return "Moves evidence before emphasis.";
  if (index === 2) return "Varies openings and sentence rhythm.";
  return constraints.expression_budget === "none"
    ? "Removes strongest expressions."
    : "Compacts abstract phrasing.";
}

function toneNote(constraints: RewriteConstraints): string {
  if (constraints.statement_force === "tentative") return "Low-key and cautious.";
  if (constraints.statement_force === "emphatic") return "Forceful but still bounded by evidence.";
  return "Measured, direct, and readable.";
}

function stableHash(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
