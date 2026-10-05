#!/usr/bin/env bun
/**
 * Multi-Model Rewrite Comparison — same input, different models, compare quality.
 *
 * Analyzes sample text once (shared baseline), then rewrites with each available
 * model and compares heat reduction, entropy change, and wall-clock time.
 *
 * Usage: bun scripts/compare-models.ts
 */

import { createGroq } from "@ai-sdk/groq";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import {
  assembleProfile,
  countWords,
  LLMClassifier,
  rewritePassage,
  splitAndHash,
} from "@prosodeus/core";
import type { LanguageModel } from "ai";

// ─── Discover available models ───────────────────────────────────────────────

interface ModelEntry {
  name: string;
  model: LanguageModel;
}

const models: ModelEntry[] = [];

if (process.env.GROQ_API_KEY) {
  const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });
  models.push(
    { name: "Qwen 3 32B (Groq)", model: groq("qwen/qwen3-32b") },
    { name: "Llama 3.3 70B (Groq)", model: groq("llama-3.3-70b-versatile") },
  );
}

if (process.env.MISTRAL_API_KEY) {
  const mistral = createOpenAICompatible({
    name: "mistral",
    baseURL: "https://api.mistral.ai/v1",
    apiKey: process.env.MISTRAL_API_KEY,
  });
  models.push({ name: "Mistral Small", model: mistral("mistral-small-latest") });
}

if (models.length === 0) {
  console.error("No models available — set GROQ_API_KEY or MISTRAL_API_KEY");
  process.exit(1);
}

// ─── Load sample text and classify baseline ──────────────────────────────────

const samplePath = new URL("./fixtures/sample-llm-text.txt", import.meta.url).pathname;
const sampleText = await Bun.file(samplePath).text();

console.log("=== Multi-Model Rewrite Comparison ===\n");
console.log(`Models available: ${models.length}`);
console.log(`Sample: ${countWords(sampleText)} words\n`);

// Use the first model as the classifier
const classifierModel = models[0]!.model;
const classifier = new LLMClassifier(classifierModel);

console.log("Classifying baseline...");
const hashed = splitAndHash(sampleText);
const classified = await classifier.classify(hashed);
const baselineProfile = assembleProfile(classified);

console.log(`Baseline heat: ${baselineProfile.mean_heat}/10`);
console.log(`Baseline entropy: ${baselineProfile.global_device_entropy}`);
console.log(`Baseline words: ${baselineProfile.word_count}\n`);

// ─── Run rewrites ────────────────────────────────────────────────────────────

interface Result {
  name: string;
  heatBefore: number;
  heatAfter: number;
  heatDelta: number;
  entropyBefore: number;
  entropyAfter: number;
  entropyDelta: number;
  wordStability: number; // after_words / before_words
  timeMs: number;
  error?: string;
}

const results: Result[] = [];

for (const entry of models) {
  console.log(`Rewriting with ${entry.name}...`);
  const start = performance.now();

  try {
    const result = await rewritePassage({
      profile: baselineProfile,
      rewriteModel: entry.model,
      classifierModel,
      onProgress: (step) => console.log(`  ${step}`),
    });

    const timeMs = performance.now() - start;
    const afterWords = countWords(result.text);

    results.push({
      name: entry.name,
      heatBefore: result.before.mean_heat,
      heatAfter: result.after.mean_heat,
      heatDelta: result.after.mean_heat - result.before.mean_heat,
      entropyBefore: result.before.device_entropy,
      entropyAfter: result.after.device_entropy,
      entropyDelta: result.after.device_entropy - result.before.device_entropy,
      wordStability: afterWords / baselineProfile.word_count,
      timeMs,
    });
  } catch (err) {
    const timeMs = performance.now() - start;
    results.push({
      name: entry.name,
      heatBefore: baselineProfile.mean_heat,
      heatAfter: baselineProfile.mean_heat,
      heatDelta: 0,
      entropyBefore: baselineProfile.global_device_entropy,
      entropyAfter: baselineProfile.global_device_entropy,
      entropyDelta: 0,
      wordStability: 1,
      timeMs,
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }

  console.log("");
}

// ─── Output comparison table ─────────────────────────────────────────────────

// Sort by heat reduction (most reduction first)
results.sort((a, b) => a.heatDelta - b.heatDelta);

console.log("=== Results ===\n");
console.log(
  "| Model                    | Heat D | Entropy D | Word Stability | Time    | Status |",
);
console.log(
  "|--------------------------|--------|-----------|----------------|---------|--------|",
);

for (const r of results) {
  const heatStr = `${r.heatDelta > 0 ? "+" : ""}${r.heatDelta.toFixed(1)}`;
  const entropyStr = `${r.entropyDelta > 0 ? "+" : ""}${r.entropyDelta.toFixed(2)}`;
  const stabilityStr = r.wordStability.toFixed(2);
  const timeStr = `${(r.timeMs / 1000).toFixed(1)}s`;
  const statusStr = r.error ? "ERROR" : r.heatDelta < 0 ? "PASS" : "WARN";

  console.log(
    `| ${r.name.padEnd(24)} | ${heatStr.padStart(6)} | ${entropyStr.padStart(9)} | ${stabilityStr.padStart(14)} | ${timeStr.padStart(7)} | ${statusStr.padEnd(6)} |`,
  );
}

if (results.some((r) => r.error)) {
  console.log("\n--- Errors ---");
  for (const r of results.filter((r) => r.error)) {
    console.log(`${r.name}: ${r.error}`);
  }
}

// Best model
const best = results.find((r) => !r.error);
if (best) {
  console.log(
    `\nBest: ${best.name} (heat ${best.heatDelta > 0 ? "+" : ""}${best.heatDelta.toFixed(1)}, ${(best.timeMs / 1000).toFixed(1)}s)`,
  );
}
