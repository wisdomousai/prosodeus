#!/usr/bin/env bun
/**
 * E2E Smoke Test — validates the full Prosodeus pipeline with real API calls.
 *
 * Flow: analyze → detect heat → rewrite → re-analyze → verify improvement.
 * Requires GROQ_API_KEY in environment.
 *
 * Usage: bun scripts/e2e-smoke.ts
 */

import { createGroq } from "@ai-sdk/groq";
import { assembleProfile, LLMClassifier, rewritePassage, splitAndHash } from "@prosodeus/core";

const GROQ_API_KEY = process.env.GROQ_API_KEY;
if (!GROQ_API_KEY) {
  console.error("GROQ_API_KEY required — set it in your environment or .env");
  process.exit(1);
}

const samplePath = new URL("./fixtures/sample-llm-text.txt", import.meta.url).pathname;
const sampleText = await Bun.file(samplePath).text();

console.log("=== Prosodeus E2E Smoke Test ===\n");

// 1. Classify
const groq = createGroq({ apiKey: GROQ_API_KEY });
const model = groq("qwen/qwen3-32b");
const classifier = new LLMClassifier(model);

const hashed = splitAndHash(sampleText);
console.log(`Sentences: ${hashed.length}`);

const classified = await classifier.classify(hashed);
const baselineProfile = assembleProfile(classified);

console.log("\n--- Baseline ---");
console.log(`Mean Heat:       ${baselineProfile.mean_heat}/10`);
console.log(`Device Entropy:  ${baselineProfile.global_device_entropy}`);
console.log(`Autocorrelation: ${baselineProfile.global_sentence_length_autocorrelation}`);
console.log(`Hot Regions:     ${baselineProfile.hot_regions.length}`);

if (baselineProfile.hot_regions.length > 0) {
  for (const r of baselineProfile.hot_regions.slice(0, 3)) {
    console.log(
      `  S${r.start_sentence}–S${r.end_sentence}: heat ${r.heat} [${r.primary_patterns.join(", ")}]`,
    );
  }
}

// 2. Gate check
if (baselineProfile.mean_heat <= 2) {
  console.warn("\nWARN: Sample text has low heat — may not exhibit enough LLM patterns.");
  console.warn("Consider using a more LLM-flavored sample.");
}

// 3. Rewrite
console.log("\nRewriting...");
const rewriteResult = await rewritePassage({
  profile: baselineProfile,
  rewriteModel: model,
  classifierModel: model,
  onProgress: (step) => console.log(`  ${step}`),
});

console.log("\n--- After Rewrite ---");
console.log(`Mean Heat:       ${rewriteResult.after.mean_heat}/10`);
console.log(`Device Entropy:  ${rewriteResult.after.device_entropy}`);
console.log(`Autocorrelation: ${rewriteResult.after.autocorrelation}`);
console.log(`Patterns:        ${rewriteResult.after.pattern_count}`);

// 4. Compute deltas
const heatDelta = rewriteResult.after.mean_heat - rewriteResult.before.mean_heat;
const entropyDelta = rewriteResult.after.device_entropy - rewriteResult.before.device_entropy;

console.log("\n--- Deltas ---");
console.log(`Heat:    ${heatDelta > 0 ? "+" : ""}${heatDelta.toFixed(1)}`);
console.log(`Entropy: ${entropyDelta > 0 ? "+" : ""}${entropyDelta.toFixed(3)}`);

// 5. Pass/fail
if (heatDelta < 0) {
  console.log("\nPASS: Heat decreased after rewrite.");
  process.exit(0);
} else {
  console.error("\nFAIL: Heat did not decrease after rewrite.");
  process.exit(1);
}
