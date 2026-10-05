import { generateText, type LanguageModel } from "ai";
import { assembleProfile } from "../analysis/profile.ts";
import { computeHeat, LLMClassifier } from "../classification/classifier.ts";
import { computeAutocorrelation, computeDeviceEntropy, countWords } from "../text/math.ts";
import { splitAndHash } from "../text/splitter.ts";
import type {
  ClassifiedSentence,
  RewriteOptions,
  RewriteResult,
  StylometricProfile,
} from "../types.ts";
import { generateConstraints } from "./constraints.ts";
import { buildNegativeConstraints, buildPositiveTargets, runPCE } from "./pce.ts";

/**
 * Rewrite a passage using three-channel structural constraints.
 *
 * Pipeline:
 * 1. Extract passage from profile
 * 2. Generate constraints (avoid + target)
 * 3. Optionally run PCE for deeper decomposition
 * 4. Build three-channel prompt
 * 5. Call rewrite model
 * 6. Auto-verify: classify output, compare metrics
 */
export async function rewritePassage(
  options: RewriteOptions & {
    /** Model for rewriting (the user's expensive model) */
    rewriteModel: LanguageModel;
    /** Model for classification/PCE (cheap model) */
    classifierModel: LanguageModel;
  },
): Promise<RewriteResult> {
  const {
    profile,
    passageRange,
    style,
    usePCE,
    onProgress,
    rewriteModel,
    classifierModel,
    rewriteSystemPrompt,
    classifierSystemPrompt,
    editorialDirectives,
    variantSeed,
  } = options;

  // 1. Extract passage
  const sentences = passageRange
    ? profile.sentences.filter((s) => s.id >= passageRange.start && s.id <= passageRange.end)
    : profile.sentences;

  const original = sentences.map((s) => s.text).join(" ");

  onProgress?.("Generating constraints...");

  // 2. Build constraints
  const avoid = buildNegativeConstraints(sentences);
  const targets = buildPositiveTargets(profile, style);

  // 3. Optional PCE
  let pceResult;
  if (usePCE) {
    onProgress?.("Extracting propositions (PCE)...");
    pceResult = await runPCE(original, sentences, profile, classifierModel, style);
  }

  // 4. Build three-channel prompt + editorial directives + variant nudge
  onProgress?.("Rewriting...");
  const prompt = buildRewritePrompt(
    original,
    avoid,
    targets,
    pceResult,
    editorialDirectives,
    variantSeed,
  );

  // 5. Call rewrite model
  const { text: rewritten } = await generateText({
    model: rewriteModel,
    system: rewriteSystemPrompt ?? REWRITE_SYSTEM_PROMPT,
    prompt,
    maxOutputTokens: 4096,
  });

  // Clean the output
  const cleanedRewrite = cleanRewriteOutput(rewritten, original);

  // 6. Auto-verify
  onProgress?.("Verifying rewrite...");
  const classifier = new LLMClassifier(classifierModel, classifierSystemPrompt);
  const rewrittenHashed = splitAndHash(cleanedRewrite);
  const rewrittenClassified = await classifier.classify(rewrittenHashed);

  // Compute before metrics
  const beforeMetrics = computePassageMetrics(sentences);

  // Compute after metrics
  const afterMetrics = computePassageMetrics(rewrittenClassified);

  return {
    text: cleanedRewrite,
    original,
    before: beforeMetrics,
    after: afterMetrics,
    pce: pceResult,
    constraints: { avoid, targets },
  };
}

const REWRITE_SYSTEM_PROMPT = `You are a structural prose editor. You rewrite passages to eliminate compounding uniformity patterns while preserving ALL factual content exactly.

Rules:
- Preserve every factual claim, proper noun, number, and logical relationship
- Change ONLY the structural presentation: sentence shapes, lengths, openings, rhythm
- Do NOT add new information or opinions
- Do NOT use hedging, inflation, or LLM-typical words
- Vary sentence lengths dramatically (mix 5-word and 30-word sentences)
- Use diverse sentence openings (not just subject-verb)
- Output ONLY the rewritten passage, no explanation`;

function buildRewritePrompt(
  original: string,
  avoid: string[],
  targets: string[],
  pce?: {
    propositions: {
      propositions: { subject: string; predicate: string; object?: string }[];
      logical_flow: string[];
    };
    avoid: string[];
    targets: string[];
  },
  editorialDirectives?: string[],
  variantSeed?: number,
): string {
  const sections: string[] = [];

  if (pce) {
    // Three-channel prompt with PCE
    sections.push("CHANNEL 1 — PROPOSITIONAL CONTENT (preserve exactly):");
    for (const p of pce.propositions.propositions) {
      const obj = p.object ? ` → ${p.object}` : "";
      sections.push(`  - ${p.subject} | ${p.predicate}${obj}`);
    }
    if (pce.propositions.logical_flow.length > 0) {
      sections.push(`  Flow: ${pce.propositions.logical_flow.join(", ")}`);
    }
    sections.push("");
  }

  sections.push("CHANNEL 2 — STRUCTURAL CONSTRAINTS (avoid these patterns):");
  for (const a of avoid) {
    sections.push(`  ${a}`);
  }
  sections.push("");

  sections.push("CHANNEL 3 — STYLE TARGETS:");
  for (const t of targets) {
    sections.push(`  ${t}`);
  }
  sections.push("");

  if (editorialDirectives && editorialDirectives.length > 0) {
    sections.push("CHANNEL 4 — EDITORIAL CONSTRAINTS (user-selected):");
    for (const d of editorialDirectives) {
      sections.push(`  ${d}`);
    }
    sections.push("");
  }

  if (variantSeed !== undefined && variantSeed > 0) {
    sections.push(
      `Variant ${variantSeed}: produce a distinct alternative emphasizing a different rhythm and opening shape than other variants. Do not restate the same sentence pattern.`,
    );
    sections.push("");
  }

  sections.push("PASSAGE TO REWRITE:");
  sections.push(original);

  return sections.join("\n");
}

function cleanRewriteOutput(raw: string, original: string): string {
  let cleaned = raw.trim();

  // Strip think tags
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/g, "").trim();

  // Strip markdown fences
  const fence = cleaned.match(/```(?:\w+)?\s*([\s\S]*?)```/);
  if (fence) cleaned = fence[1]!.trim();

  // Strip common preamble patterns
  cleaned = cleaned.replace(
    /^(?:Here(?:'s| is) (?:the|my) rewritten (?:passage|text|version)[:\s]*)/i,
    "",
  );
  cleaned = cleaned.replace(/^(?:Rewritten passage[:\s]*)/i, "");

  // If the output is suspiciously short (< 30% of original), return original
  if (cleaned.length < original.length * 0.3) {
    return original;
  }

  return cleaned;
}

function computePassageMetrics(sentences: ClassifiedSentence[]): {
  mean_heat: number;
  device_entropy: number;
  autocorrelation: number;
  pattern_count: number;
} {
  if (sentences.length === 0) {
    return { mean_heat: 0, device_entropy: 0, autocorrelation: 0, pattern_count: 0 };
  }

  const meanHeat = sentences.reduce((sum, s) => sum + s.heat, 0) / sentences.length;
  const devEntropy = computeDeviceEntropy(sentences);
  const lengths = sentences.map((s) => s.classification.metrics.word_count || countWords(s.text));
  const autocorr = computeAutocorrelation(lengths);
  const patternCount = sentences.reduce((sum, s) => sum + s.classification.patterns.length, 0);

  return {
    mean_heat: Math.round(meanHeat * 10) / 10,
    device_entropy: devEntropy,
    autocorrelation: autocorr,
    pattern_count: patternCount,
  };
}
