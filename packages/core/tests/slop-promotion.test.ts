import { describe, expect, test } from "bun:test";
import {
  attachAiSlopCandidates,
  stripAiSlopCandidates,
} from "../src/classification/ai-slop-candidates.ts";
import { getDefaultClassification } from "../src/classification/classifier.ts";
import { promoteSlopCandidates } from "../src/classification/slop-promotion.ts";

describe("promoteSlopCandidates", () => {
  test("promotes mapped playbook patterns from slop candidates", () => {
    const classification = attachAiSlopCandidates(
      { text: "We will delve into the landscape." },
      getDefaultClassification(),
      "tiered",
    );
    const promoted = promoteSlopCandidates(classification);
    expect(promoted.patterns.length).toBeGreaterThan(classification.patterns.length);
    expect(stripAiSlopCandidates(promoted).ai_slop_candidates).toBeUndefined();
  });

  test("deduplicates when classifier already found pattern", () => {
    const base = getDefaultClassification();
    const withPattern = {
      ...base,
      patterns: [{ type: "llm_fingerprint_word" as const, confidence: 0.95, evidence: "delve" }],
      ai_slop_candidates: [
        {
          source: "kimi_field_manual" as const,
          source_id: "delve",
          category: "lexical",
          subcategory: "fingerprint",
          matcher_role: "manual_phrase" as const,
          evidence: "delve",
          mapped_pattern_types: ["llm_fingerprint_word" as const],
          verdict: "candidate_only" as const,
        },
      ],
    };
    const promoted = promoteSlopCandidates(withPattern);
    expect(promoted.patterns.filter((p) => p.type === "llm_fingerprint_word")).toHaveLength(1);
  });
});
