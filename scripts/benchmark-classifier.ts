#!/usr/bin/env bun
/**
 * Classifier Accuracy Benchmark — measures precision/recall of the LLM classifier
 * against heuristic ground truth and hand-labeled sentences.
 *
 * Two validation layers:
 *   Layer A: Heuristic validators (regex/lexicon, zero API cost)
 *   Layer B: LLM classifier (calls real Groq API)
 *
 * Usage: bun scripts/benchmark-classifier.ts
 */

import { createGroq } from "@ai-sdk/groq";
import type { PatternType } from "@prosodeus/core";
import {
  GATE_SYSTEM_PROMPT,
  GateClassifier,
  gateNeedsFullClassification,
  LLMClassifier,
  SYSTEM_PROMPT,
  splitAndHash,
} from "@prosodeus/core";

const GROQ_API_KEY = process.env.GROQ_API_KEY;
if (!GROQ_API_KEY) {
  console.error("GROQ_API_KEY required — set it in your environment or .env");
  process.exit(1);
}

// ─── Load benchmark data ─────────────────────────────────────────────────────

interface BenchmarkSentence {
  text: string;
  expected_patterns: PatternType[];
  notes: string;
}

const benchmarkPath = new URL("./fixtures/benchmark-sentences.json", import.meta.url).pathname;
const benchmarkData: BenchmarkSentence[] = JSON.parse(await Bun.file(benchmarkPath).text());

// ─── Layer A: Heuristic Validators ───────────────────────────────────────────

const HEURISTIC_VALIDATORS: Record<string, (text: string) => boolean> = {
  nominalization: (text) => /\b\w+(tion|ment|ness|ity)\b/i.test(text),
  hedging: (text) =>
    /\b(perhaps|might|somewhat|potentially|considerable|promising|significant)\b/i.test(text),
  binary_contrast: (text) => /\b(while|although|whereas|both\s+\w+\s+and)\b/i.test(text),
  importance_inflation: (text) =>
    /\b(crucial|fundamental|pivotal|groundbreaking|tremendous|essential)\b/i.test(text),
  transition_formulaic: (text) =>
    /^(Moreover|Furthermore|Additionally|In conclusion|In essence)\b/i.test(text),
  llm_fingerprint_word: (text) => /\b(delve|landscape|tapestry|multifaceted|nuanced)\b/i.test(text),
  agentless_passive: (text) =>
    /\b(is|was|are|were)\s+(considered|implemented|achieved|conducted|recognized)\b/i.test(text),
};

// ─── Layer B: LLM Classifier ─────────────────────────────────────────────────

console.log("=== Classifier Accuracy Benchmark ===\n");
console.log(`Sentences: ${benchmarkData.length}`);
console.log("Classifying with LLM...\n");

const groq = createGroq({ apiKey: GROQ_API_KEY });
const classifier = new LLMClassifier(groq("qwen/qwen3-32b"));

// Classify all benchmark sentences
const hashed = benchmarkData.map((s, i) => {
  const h = splitAndHash(s.text);
  return h[0]!; // Each benchmark entry is a single sentence
});

const classified = await classifier.classify(hashed);

// ─── Scoring ─────────────────────────────────────────────────────────────────

// Track per-pattern metrics
const patternTypes: PatternType[] = [
  "nominalization",
  "hedging",
  "binary_contrast",
  "importance_inflation",
  "transition_formulaic",
  "llm_fingerprint_word",
  "agentless_passive",
  "resumptive_phrase",
  "tricolon_abstract",
];

interface PatternScore {
  tp: number;
  fp: number;
  fn: number;
  heuristic_agree: number;
  heuristic_total: number;
}

const scores: Record<string, PatternScore> = {};
for (const p of patternTypes) {
  scores[p] = { tp: 0, fp: 0, fn: 0, heuristic_agree: 0, heuristic_total: 0 };
}

for (let i = 0; i < benchmarkData.length; i++) {
  const expected = new Set(benchmarkData[i]!.expected_patterns);
  const detected = new Set(classified[i]!.classification.patterns.map((p) => p.type));

  for (const pattern of patternTypes) {
    const score = scores[pattern]!;
    const isExpected = expected.has(pattern as PatternType);
    const isDetected = detected.has(pattern as PatternType);

    if (isExpected && isDetected) score.tp++;
    else if (!isExpected && isDetected) score.fp++;
    else if (isExpected && !isDetected) score.fn++;

    // Heuristic agreement
    const validator = HEURISTIC_VALIDATORS[pattern];
    if (validator) {
      score.heuristic_total++;
      const heuristicSays = validator(benchmarkData[i]!.text);
      if (heuristicSays === isDetected) score.heuristic_agree++;
    }
  }
}

// ─── Output ──────────────────────────────────────────────────────────────────

console.log("| Pattern                  | Precision | Recall  | F1      | Heuristic Agree |");
console.log("|--------------------------|-----------|---------|---------|-----------------|");

let totalTP = 0,
  totalFP = 0,
  totalFN = 0;

for (const pattern of patternTypes) {
  const s = scores[pattern]!;
  totalTP += s.tp;
  totalFP += s.fp;
  totalFN += s.fn;

  const precision = s.tp + s.fp > 0 ? s.tp / (s.tp + s.fp) : 0;
  const recall = s.tp + s.fn > 0 ? s.tp / (s.tp + s.fn) : 0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  const heuristicRate =
    s.heuristic_total > 0 ? `${Math.round((s.heuristic_agree / s.heuristic_total) * 100)}%` : "N/A";

  console.log(
    `| ${pattern.padEnd(24)} | ${precision.toFixed(2).padStart(9)} | ${recall.toFixed(2).padStart(7)} | ${f1.toFixed(2).padStart(7)} | ${heuristicRate.padStart(15)} |`,
  );
}

// Micro-averaged
const microP = totalTP + totalFP > 0 ? totalTP / (totalTP + totalFP) : 0;
const microR = totalTP + totalFN > 0 ? totalTP / (totalTP + totalFN) : 0;
const microF1 = microP + microR > 0 ? (2 * microP * microR) / (microP + microR) : 0;

console.log("|--------------------------|-----------|---------|---------|-----------------|");
console.log(
  `| ${"MICRO AVG".padEnd(24)} | ${microP.toFixed(2).padStart(9)} | ${microR.toFixed(2).padStart(7)} | ${microF1.toFixed(2).padStart(7)} |                 |`,
);

console.log(`\nTotal: ${totalTP} TP, ${totalFP} FP, ${totalFN} FN`);

// Per-sentence detail for debugging
console.log("\n--- Per-Sentence Detail ---\n");
for (let i = 0; i < benchmarkData.length; i++) {
  const expected = benchmarkData[i]!.expected_patterns;
  const detected = classified[i]!.classification.patterns.map((p) => p.type);
  const match = JSON.stringify(expected.sort()) === JSON.stringify([...detected].sort());
  const icon = match ? "OK" : "!!";
  console.log(`[${icon}] "${benchmarkData[i]!.text.slice(0, 60)}..."`);
  if (!match) {
    console.log(`     Expected: [${expected.join(", ")}]`);
    console.log(`     Got:      [${detected.join(", ")}]`);
  }
}

// ─── Layer C: Gate classifier (cheap screen + escalation rate) ───────────────

console.log("\n=== Layer C: Gate Classifier ===\n");

const gateClassifier = new GateClassifier(groq("qwen/qwen3-32b"));
const gateStart = performance.now();
const gateResults = await gateClassifier.classify(hashed);
const gateMs = performance.now() - gateStart;

let escalateCount = 0;
let gateTp = 0;
let gateFn = 0;

for (let i = 0; i < benchmarkData.length; i++) {
  const expected = new Set(benchmarkData[i]!.expected_patterns);
  const gatePatterns = gateResults[i]!.classification.patterns.map((p) => p.type);
  const wouldEscalate = gateNeedsFullClassification(gateResults[i]!.classification);

  if (wouldEscalate) escalateCount++;

  // Gate recall: did gate flag any expected pattern (at any confidence)?
  for (const p of expected) {
    if (gatePatterns.includes(p)) gateTp++;
    else gateFn++;
  }
}

const gateRecall = gateTp + gateFn > 0 ? gateTp / (gateTp + gateFn) : 0;

console.log(
  `Gate system prompt: ${GATE_SYSTEM_PROMPT.length} chars (~${Math.round(GATE_SYSTEM_PROMPT.length / 4)} tokens est.)`,
);
console.log(
  `Full system prompt: ${SYSTEM_PROMPT.length} chars (~${Math.round(SYSTEM_PROMPT.length / 4)} tokens est.)`,
);
console.log(`Gate latency (${hashed.length} sentences): ${gateMs.toFixed(0)}ms`);
console.log(
  `Escalation rate: ${escalateCount}/${hashed.length} (${Math.round((100 * escalateCount) / hashed.length)}%)`,
);
console.log(
  `Gate pattern recall vs expected: ${(gateRecall * 100).toFixed(1)}% (${gateTp} hit, ${gateFn} miss)`,
);
