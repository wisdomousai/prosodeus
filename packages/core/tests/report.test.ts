import { describe, expect, test } from "bun:test";
import { generateHtmlReport } from "../src/reporting/report.ts";
import type { ClassifiedSentence, StylometricProfile } from "../src/types.ts";

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeSentence(
  id: number,
  text: string,
  heat = 2,
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
    heat,
  };
}

function makeProfile(overrides: Partial<StylometricProfile> = {}): StylometricProfile {
  const sentences = [
    makeSentence(0, "The fundamental system operates efficiently.", 4, [
      { type: "nominalization", confidence: 0.8, evidence: "system" },
    ]),
    makeSentence(1, "While results vary, outcomes remain consistent.", 5, [
      { type: "binary_contrast", confidence: 0.7, evidence: "while..., remain" },
    ]),
    makeSentence(2, "Simple clean sentence here.", 1),
  ];

  return {
    word_count: 18,
    sentence_count: 3,
    paragraph_count: 1,
    sentences,
    windows: [],
    hot_regions: [
      {
        start_sentence: 0,
        end_sentence: 1,
        heat: 6,
        primary_patterns: ["nominalization", "binary_contrast"],
        description: "High uniformity region with nominal forms and binary contrasts",
      },
    ],
    convergence_slope: -0.02,
    global_biber_entropy: 2.1,
    global_device_entropy: 1.8,
    global_sentence_length_autocorrelation: 0.35,
    mean_heat: 3.3,
    global_ttr: 0.8,
    global_mattr: 0.75,
    global_hapax_ratio: 0.6,
    global_word_length_entropy: 2.0,
    global_opening_variety: 0.9,
    global_function_word_ratio: 0.4,
    ...overrides,
  };
}

// ─── generateHtmlReport ─────────────────────────────────────────────────────

describe("generateHtmlReport", () => {
  test("returns a valid HTML string", () => {
    const html = generateHtmlReport(makeProfile());
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("</html>");
    expect(html).toContain("<head>");
    expect(html).toContain("<body>");
  });

  test("contains the title", () => {
    const html = generateHtmlReport(makeProfile());
    expect(html).toContain("Prosodeus Analysis Report");
  });

  test("contains metrics section", () => {
    const html = generateHtmlReport(makeProfile());
    expect(html).toContain("Mean Heat");
    expect(html).toContain("Biber Entropy");
    expect(html).toContain("Device Entropy");
    expect(html).toContain("Length Autocorr");
    expect(html).toContain("Convergence");
    expect(html).toContain("Hot Regions");
  });

  test("contains heatmap section", () => {
    const html = generateHtmlReport(makeProfile());
    expect(html).toContain("Sentence Heatmap");
    expect(html).toContain('class="sentence"');
  });

  test("contains sentence text in heatmap", () => {
    const html = generateHtmlReport(makeProfile());
    expect(html).toContain("The fundamental system operates efficiently.");
    expect(html).toContain("Simple clean sentence here.");
  });

  test("contains hot regions section", () => {
    const html = generateHtmlReport(makeProfile());
    expect(html).toContain("Hot Regions (1)");
    expect(html).toContain("Sentences 0");
    expect(html).toContain("nominalization");
  });

  test("contains chart sections", () => {
    const html = generateHtmlReport(makeProfile());
    expect(html).toContain("Sentence Length Distribution");
    expect(html).toContain("Heat Distribution");
    expect(html).toContain("<svg");
  });

  test("contains word/sentence counts in subtitle", () => {
    const html = generateHtmlReport(makeProfile());
    expect(html).toContain("18 words");
    expect(html).toContain("3 sentences");
    expect(html).toContain("1 paragraphs");
  });

  test("includes style guide delta when present", () => {
    const html = generateHtmlReport(
      makeProfile({
        delta: {
          guide: "general",
          violations: [
            { dimension: "device_entropy", current: 1.8, target: 2.5, severity: "high" },
          ],
          overall_distance: 0.3,
        },
      }),
    );
    expect(html).toContain("Style Guide: general");
    expect(html).toContain("Device Entropy");
  });

  test("does not include delta section when absent", () => {
    const html = generateHtmlReport(makeProfile());
    expect(html).not.toContain("Style Guide:");
  });

  test("contains footer", () => {
    const html = generateHtmlReport(makeProfile());
    expect(html).toContain("Generated by Prosodeus");
  });

  test("escapes HTML in sentence text", () => {
    const profile = makeProfile();
    profile.sentences[0]!.text = 'Test <script>alert("xss")</script> text.';
    const html = generateHtmlReport(profile);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
