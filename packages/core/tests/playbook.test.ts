import { describe, expect, test } from "bun:test";
import { COPY_PLAYBOOK } from "../src/playbooks/copy-playbook.ts";
import {
  buildPlaybookPrompt,
  filterPlaybookClusters,
  getPlatformPreset,
  getPlaybookPatternIds,
  runPlaybookAudit,
  scorePlaybookLayers,
} from "../src/playbooks/playbook.ts";
import type { ClassifiedSentence, StylometricProfile } from "../src/types.ts";

function makeSentence(
  id: number,
  text: string,
  patterns: ClassifiedSentence["classification"]["patterns"] = [],
): ClassifiedSentence {
  return {
    id,
    text,
    hash: `hash${id}`,
    paragraph_id: 0,
    classification: {
      biber: {
        informational: 0.5,
        involved: 0.2,
        narrative: 0.1,
        persuasive: 0.1,
        abstract: 0.05,
        elaborative: 0.05,
      },
      patterns,
      metrics: {
        word_count: text.split(/\s+/).length,
        clause_count: 1,
        has_participial: false,
        has_relative_clause: false,
        clause_balance_ratio: 0.5,
        construction_type: "simple",
      },
      arc_role: "claim",
    },
    heat: 0,
  };
}

function makeProfile(sentences: ClassifiedSentence[]): StylometricProfile {
  return {
    word_count: sentences.reduce((sum, s) => sum + s.classification.metrics.word_count, 0),
    sentence_count: sentences.length,
    paragraph_count: 1,
    sentences,
    windows: [],
    hot_regions: [],
    convergence_slope: 0,
    global_biber_entropy: 2.0,
    global_device_entropy: 2.5,
    global_sentence_length_autocorrelation: 0.2,
    mean_heat: 0,
    global_ttr: 0.8,
    global_mattr: 0.75,
    global_hapax_ratio: 0.6,
    global_word_length_entropy: 2.0,
    global_opening_variety: 0.9,
    global_function_word_ratio: 0.4,
  };
}

describe("playbook", () => {
  test("getPlaybookPatternIds dedupes hedging across layers", () => {
    const ids = getPlaybookPatternIds();
    expect(ids.filter((id) => id === "hedging").length).toBe(1);
    expect(ids.length).toBeGreaterThan(20);
  });

  test("scorePlaybookLayers counts layer hits", () => {
    const profile = makeProfile([
      makeSentence(0, "We will delve into the landscape.", [
        { type: "llm_fingerprint_word", confidence: 0.9, evidence: "delve" },
      ]),
      makeSentence(1, "It's not about traffic, it's about trust.", [
        { type: "negation_reframe", confidence: 0.9, evidence: "not about" },
      ]),
    ]);
    const scores = scorePlaybookLayers(profile);
    expect(scores.totalHits).toBe(2);
    expect(scores.layers.find((l) => l.id === "lexical")?.hitCount).toBe(1);
    expect(scores.layers.find((l) => l.id === "phrase")?.hitCount).toBe(1);
    expect(scores.worstLayerId).not.toBeNull();
  });

  test("filterPlaybookClusters keeps only playbook patterns", () => {
    const clusters = filterPlaybookClusters([
      { type: "binary_contrast", count: 3, density: 0.3, sentences: [0, 1] },
      { type: "nominalization", count: 2, density: 0.2, sentences: [2] },
    ]);
    expect(clusters).toHaveLength(1);
    expect(clusters[0]?.type).toBe("binary_contrast");
  });

  test("runPlaybookAudit flags em dashes and banned words", () => {
    const text =
      "This pivotal update — which leverages synergy — has been a game-changer for our team.";
    const profile = makeProfile([makeSentence(0, text)]);
    const report = runPlaybookAudit(text, profile);
    const emDash = report.checks.find((c) => c.id === "em_dash");
    const words = report.checks.find((c) => c.id === "worst_words");
    expect(emDash?.status).toBe("fail");
    expect(words?.status).toBe("fail");
    expect(report.automatedPassed).toBeLessThan(report.automatedTotal);
  });

  test("runPlaybookAudit flags binary reframes", () => {
    const text = "It's not about SEO, it's about trust.";
    const profile = makeProfile([makeSentence(0, text)]);
    const report = runPlaybookAudit(text, profile);
    const binary = report.checks.find((c) => c.id === "binary_reframe");
    expect(binary?.status).toBe("fail");
  });

  test("buildPlaybookPrompt includes banned words and platform note", () => {
    const prompt = buildPlaybookPrompt({
      platform: "linkedin",
      passage: "Sample text.",
    });
    expect(prompt).toContain("BANNED VOCABULARY");
    expect(prompt).toContain("delve");
    expect(prompt).toContain("PLATFORM (LinkedIn)");
    expect(prompt).toContain("PASSAGE:");
    expect(prompt).toContain("Sample text.");
  });

  test("getPlatformPreset returns linkedin constraints", () => {
    const preset = getPlatformPreset("linkedin");
    expect(preset.binary_contrast).toBe("avoid");
    expect(preset.abstraction_level).toBe("concrete");
  });

  test("manual audit checks have manual status", () => {
    const profile = makeProfile([makeSentence(0, "Clean short copy.")]);
    const report = runPlaybookAudit("Clean short copy.", profile);
    const readAloud = report.checks.find((c) => c.id === "read_aloud");
    expect(readAloud?.status).toBe("manual");
    expect(readAloud?.hint).toBeTruthy();
  });

  test("COPY_PLAYBOOK has 13 audit checks", () => {
    expect(COPY_PLAYBOOK.audit_checks).toHaveLength(13);
    expect(COPY_PLAYBOOK.audit_checks.filter((c) => c.automated)).toHaveLength(10);
  });
});
