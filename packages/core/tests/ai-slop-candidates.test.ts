import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  attachAiSlopCandidates,
  extractAiSlopCandidates,
  stripAiSlopCandidates,
} from "../src/classification/ai-slop-candidates.ts";
import { getDefaultClassification } from "../src/classification/classifier.ts";
import { splitAndHash } from "../src/text/splitter.ts";

describe("AI slop candidate extraction", () => {
  test("extracts static matches as candidate-only evidence", () => {
    const candidates = extractAiSlopCandidates(
      "In today's rapidly evolving business landscape, teams need a robust strategy.",
      "tiered",
    );

    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates[0]?.verdict).toBe("candidate_only");
    expect(candidates[0]?.mapped_pattern_types.length).toBeGreaterThan(0);
  });

  test("off mode returns no candidates", () => {
    const candidates = extractAiSlopCandidates("Moreover, this is a groundbreaking idea.", "off");
    expect(candidates).toEqual([]);
  });

  test("attaches and strips candidates without changing patterns", () => {
    const classification = {
      ...getDefaultClassification(),
      patterns: [{ type: "importance_inflation" as const, confidence: 0.8, evidence: "robust" }],
    };
    const attached = attachAiSlopCandidates(
      { text: "This robust strategy unlocks meaningful impact." },
      classification,
      "tiered",
    );

    expect(attached.patterns).toEqual(classification.patterns);
    expect(attached.ai_slop_candidates?.length).toBeGreaterThan(0);
    expect(stripAiSlopCandidates(attached).ai_slop_candidates).toBeUndefined();
  });

  test("tiered mode stays below exhaustive-by-default cost on the fixture", () => {
    const text = readFileSync(
      new URL("../../../scripts/fixtures/sample-llm-text.txt", import.meta.url),
      "utf8",
    );
    const sentences = splitAndHash(text);
    // The first pass pays one-time regex compilation, which varies a lot between machines.
    for (const sentence of sentences) extractAiSlopCandidates(sentence.text, "tiered");
    const t0 = performance.now();
    let total = 0;
    for (const sentence of sentences) {
      total += extractAiSlopCandidates(sentence.text, "tiered").length;
    }
    const elapsed = performance.now() - t0;

    expect(total).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(500);
  });
});

describe("AI slop cache persistence", () => {
  test("strip removes candidates before cache persist shape", () => {
    const classification = {
      ...getDefaultClassification(),
      patterns: [{ type: "importance_inflation" as const, confidence: 0.8, evidence: "robust" }],
    };
    const attached = attachAiSlopCandidates(
      { text: "This robust strategy unlocks meaningful impact." },
      classification,
      "tiered",
    );
    expect(attached.ai_slop_candidates?.length).toBeGreaterThan(0);
    const stripped = stripAiSlopCandidates(attached);
    expect(stripped.ai_slop_candidates).toBeUndefined();
    expect(stripped.patterns).toEqual(classification.patterns);
  });
});
