import { describe, expect, test } from "bun:test";
import type { LanguageModel } from "ai";
import type { SentenceClassifier } from "../src/analysis/analyze.ts";
import { checkFidelity } from "../src/opposition/fidelity-check.ts";
import {
  heuristicOppositionRewrite,
  heuristicSubstanceVerdict,
  isOppositionCandidate,
} from "../src/opposition/heuristics.ts";
import { rewriteOppositions } from "../src/opposition/rewrite-oppositions.ts";
import { rewriteSpan, rewriteSpanAlternatives } from "../src/opposition/span-rewrite.ts";
import { scoreSubstance } from "../src/opposition/substance-scorer.ts";
import { NullCache } from "../src/storage/cache.ts";
import type { ClassifiedSentence, HashedSentence, SentenceClassification } from "../src/types.ts";

// ─── Fake LLM helper ─────────────────────────────────────────────────────────

function fakeModel(responseText: string): LanguageModel {
  return {
    specificationVersion: "v3",
    provider: "test",
    modelId: "test-model",
    async doGenerate() {
      return {
        content: [{ type: "text" as const, text: responseText }],
        finishReason: "stop",
        usage: {
          totalTokens: 0,
          inputTokens: { total: 0 },
          outputTokens: { total: 0 },
        },
        warnings: [],
      };
    },
  } as unknown as LanguageModel;
}

// ─── Substance scorer ────────────────────────────────────────────────────────

describe("heuristicSubstanceVerdict", () => {
  const span = {
    sentenceId: 0,
    start: 0,
    end: 80,
    text: "",
    patternType: "binary_contrast" as const,
    confidence: 0.9,
    source: "detected_pattern" as const,
    evidence: "not about",
  };

  test("flags not-about-but-about as vacuous", () => {
    const result = heuristicSubstanceVerdict(
      span,
      "Statistical writing is not about making every sentence sound decisive but about assigning force where the evidence earns it.",
    );
    expect(result?.verdict).toBe("vacuous");
  });

  test("flags not-about-it-is-about as vacuous", () => {
    const result = heuristicSubstanceVerdict(
      span,
      "AI adoption is not about tools, it is about the support workflow around them.",
    );
    expect(result?.verdict).toBe("vacuous");
  });

  test("flags not-merely-but as vacuous", () => {
    const result = heuristicSubstanceVerdict(
      span,
      "It is not merely about automating tickets but about giving agents better escalation context.",
    );
    expect(result?.verdict).toBe("vacuous");
  });

  test("does not flag parallel lists without opposition", () => {
    expect(
      isOppositionCandidate(
        "In a weak draft, every claim becomes fundamental, crucial, and transformative.",
        "clause_symmetry",
      ),
    ).toBe(false);
  });
});

describe("heuristicOppositionRewrite", () => {
  test("rewrites not-about-it-is-about as a direct dependency", () => {
    expect(heuristicOppositionRewrite("AI adoption is not about tools, it is about mindset.")).toBe(
      "AI adoption depends on mindset.",
    );
  });

  test("rewrites not-merely-about-but-about as work to do", () => {
    expect(
      heuristicOppositionRewrite(
        "It is not merely about automating tickets but about empowering teams to focus on what matters.",
      ),
    ).toBe("The work is to empower teams to focus on what matters.");
  });

  test("rewrites not-only-can-but-can-also as one direct claim", () => {
    expect(
      heuristicOppositionRewrite(
        "Not only can AI reduce response times, but it can also unlock deeper customer insights.",
      ),
    ).toBe("AI can reduce response times and unlock deeper customer insights.");
  });

  test("removes one-hand scaffolding from separate sentences", () => {
    expect(
      heuristicOppositionRewrite(
        "On one hand, some teams worry that automation will make support feel cold.",
      ),
    ).toBe("Some teams worry that automation will make support feel cold.");
    expect(
      heuristicOppositionRewrite(
        "On the other hand, the right implementation can create a more personalized service model.",
      ),
    ).toBe("The right implementation can create a more personalized service model.");
  });
});

describe("scoreSubstance", () => {
  test("uses heuristic without calling the model", async () => {
    const model = {
      specificationVersion: "v3" as const,
      provider: "test",
      modelId: "test-model",
      async doGenerate() {
        throw new Error("model should not be called");
      },
    } as unknown as LanguageModel;

    const result = await scoreSubstance(
      {
        sentenceId: 0,
        start: 0,
        end: 35,
        text: "It's not about speed but about precision.",
        patternType: "binary_contrast",
        confidence: 0.9,
        source: "detected_pattern",
        evidence: "not about speed but about precision",
      },
      { sentence: "It's not about speed but about precision." },
      { model },
    );
    expect(result.verdict).toBe("vacuous");
  });

  test("parses vacuous verdict", async () => {
    const model = fakeModel('{"verdict":"vacuous","rationale":"Generic opposition"}');
    const result = await scoreSubstance(
      {
        sentenceId: 0,
        start: 0,
        end: 35,
        text: "It's not about speed; it's about precision.",
        patternType: "binary_contrast",
        confidence: 0.9,
        source: "detected_pattern",
        evidence: "not about speed; it's about precision",
      },
      { sentence: "It's not about speed; it's about precision." },
      { model },
    );
    expect(result.verdict).toBe("vacuous");
    expect(result.rationale).toContain("Generic");
  });

  test("parses earned verdict", async () => {
    const model = fakeModel('{"verdict":"earned","rationale":"Real clinical trade-off"}');
    const result = await scoreSubstance(
      {
        sentenceId: 0,
        start: 0,
        end: 50,
        text: "The drug reduces symptoms, but it also raises liver enzymes.",
        patternType: "binary_contrast",
        confidence: 0.9,
        source: "detected_pattern",
        evidence: "reduces symptoms, but it also raises liver enzymes",
      },
      { sentence: "The drug reduces symptoms, but it also raises liver enzymes." },
      { model },
    );
    expect(result.verdict).toBe("earned");
  });

  test("defaults to uncertain on unparseable output", async () => {
    const model = fakeModel("this is not json");
    const result = await scoreSubstance(
      {
        sentenceId: 0,
        start: 0,
        end: 10,
        text: "Some sentence.",
        patternType: "binary_contrast",
        confidence: 0.9,
        source: "detected_pattern",
        evidence: "Some",
      },
      { sentence: "Some sentence." },
      { model },
    );
    expect(result.verdict).toBe("uncertain");
  });
});

// ─── Span rewrite ────────────────────────────────────────────────────────────

describe("rewriteSpan", () => {
  test("extracts replacement from JSON", async () => {
    const model = fakeModel('{"replacement":"Precision matters more than speed here."}');
    const result = await rewriteSpan(
      {
        sentenceId: 0,
        start: 0,
        end: 35,
        text: "It's not about speed; it's about precision.",
        patternType: "binary_contrast",
        confidence: 0.9,
        source: "detected_pattern",
        evidence: "not about speed; it's about precision",
      },
      { sentence: "It's not about speed; it's about precision." },
      { model },
    );
    expect(result).toBe("Precision matters more than speed here.");
  });

  test("returns null when model echoes original", async () => {
    const model = fakeModel('{"replacement":"It\'s not about speed; it\'s about precision."}');
    const result = await rewriteSpan(
      {
        sentenceId: 0,
        start: 0,
        end: 35,
        text: "It's not about speed; it's about precision.",
        patternType: "binary_contrast",
        confidence: 0.9,
        source: "detected_pattern",
        evidence: "not about speed; it's about precision",
      },
      { sentence: "It's not about speed; it's about precision." },
      { model },
    );
    expect(result).toBeNull();
  });

  test("returns null when model echoes original with different whitespace", async () => {
    const model = fakeModel(
      '{"replacement":"  It\'s not about speed;   it\'s about precision.  "}',
    );
    const result = await rewriteSpan(
      {
        sentenceId: 0,
        start: 0,
        end: 35,
        text: "It's not about speed; it's about precision.",
        patternType: "binary_contrast",
        confidence: 0.9,
        source: "detected_pattern",
        evidence: "not about speed; it's about precision",
      },
      { sentence: "It's not about speed; it's about precision." },
      { model },
    );
    expect(result).toBeNull();
  });

  test("returns null on unparseable output", async () => {
    const model = fakeModel("no json here");
    const result = await rewriteSpan(
      {
        sentenceId: 0,
        start: 0,
        end: 10,
        text: "Some sentence.",
        patternType: "binary_contrast",
        confidence: 0.9,
        source: "detected_pattern",
        evidence: "Some",
      },
      { sentence: "Some sentence." },
      { model },
    );
    expect(result).toBeNull();
  });

  test("accepts plain-text replacement when JSON is missing", async () => {
    const model = fakeModel("Precision matters more than speed for this failure mode.");
    const result = await rewriteSpan(
      {
        sentenceId: 0,
        start: 0,
        end: 35,
        text: "It's not about speed; it's about precision.",
        patternType: "binary_contrast",
        confidence: 0.9,
        source: "detected_pattern",
        evidence: "not about speed; it's about precision",
      },
      { sentence: "It's not about speed; it's about precision." },
      { model },
    );
    expect(result).toBe("Precision matters more than speed for this failure mode.");
  });
});

describe("rewriteSpanAlternatives", () => {
  test("extracts multiple alternatives from JSON", async () => {
    const model = fakeModel(
      '{"alternatives":["Precision matters more than speed.","Speed is secondary to precision here.","Assign force where evidence earns it."]}',
    );
    const result = await rewriteSpanAlternatives(
      {
        sentenceId: 0,
        start: 0,
        end: 35,
        text: "It's not about speed; it's about precision.",
        patternType: "binary_contrast",
        confidence: 0.9,
        source: "detected_pattern",
        evidence: "not about speed; it's about precision",
      },
      { sentence: "It's not about speed; it's about precision." },
      { model, count: 3 },
    );
    expect(result).toHaveLength(3);
    expect(result[0]).toContain("Precision");
  });

  test("drops whitespace-normalized unchanged alternatives", async () => {
    const model = fakeModel(
      '{"alternatives":["  It\'s not about speed;   it\'s about precision. ","Precision matters more than speed."]}',
    );
    const result = await rewriteSpanAlternatives(
      {
        sentenceId: 0,
        start: 0,
        end: 35,
        text: "It's not about speed; it's about precision.",
        patternType: "binary_contrast",
        confidence: 0.9,
        source: "detected_pattern",
        evidence: "not about speed; it's about precision",
      },
      { sentence: "It's not about speed; it's about precision." },
      { model, count: 3 },
    );
    expect(result).toEqual(["Precision matters more than speed."]);
  });
});

// ─── Fidelity checker ────────────────────────────────────────────────────────

describe("checkFidelity", () => {
  test("passes high-overlap rewrites without entailment model", async () => {
    const result = await checkFidelity(
      "The drug reduces symptoms but raises liver enzymes.",
      "The drug reduces symptoms and raises liver enzymes.",
      { overlapThreshold: 0.5 },
    );
    expect(result.passed).toBe(true);
    expect(result.score).toBeGreaterThan(0.5);
  });

  test("fails low-overlap rewrites", async () => {
    const result = await checkFidelity(
      "It's not about speed; it's about precision.",
      "The weather is nice today.",
      { overlapThreshold: 0.5 },
    );
    expect(result.passed).toBe(false);
  });

  test("uses entailment model when provided", async () => {
    const model = fakeModel('{"entails":true,"confidence":0.9,"explanation":"Preserves meaning"}');
    const result = await checkFidelity(
      "The drug reduces symptoms but raises liver enzymes.",
      "The drug reduces symptoms and raises liver enzymes.",
      { overlapThreshold: 0.5, entailmentModel: model },
    );
    expect(result.passed).toBe(true);
    expect(result.reason).toContain("Preserves meaning");
  });

  test("rejects rewrite that fails entailment", async () => {
    const model = fakeModel('{"entails":false,"confidence":0.8,"explanation":"Drops a key claim"}');
    const result = await checkFidelity(
      "The drug reduces symptoms but raises liver enzymes.",
      "The drug reduces symptoms.",
      { overlapThreshold: 0.3, entailmentModel: model },
    );
    expect(result.passed).toBe(false);
  });
});

// ─── End-to-end opposition pipeline ───────────────────────────────────────────────

function makeClassification(patterns: SentenceClassification["patterns"]): SentenceClassification {
  return {
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
      word_count: 10,
      clause_count: 1,
      has_participial: false,
      has_relative_clause: false,
      clause_balance_ratio: 0.5,
      construction_type: "simple",
    },
    arc_role: "claim",
  };
}

function fakeClassifier(classifications: SentenceClassification[]): SentenceClassifier {
  return {
    async classify(sentences: HashedSentence[]): Promise<ClassifiedSentence[]> {
      return sentences.map((s, i) => ({
        ...s,
        classification: classifications[i] ?? makeClassification([]),
        heat: 0,
      }));
    },
  };
}

describe("rewriteOppositions", () => {
  test("removes vacuous binary opposition and preserves earned one", async () => {
    const text =
      "It's not about speed; it's about precision. The drug reduces symptoms, but it also raises liver enzymes.";

    // First pass: sentence 0 is vacuous binary_contrast, sentence 1 is earned binary_contrast.
    const firstPassClassifications: SentenceClassification[] = [
      makeClassification([
        { type: "binary_contrast", confidence: 0.9, evidence: "not about speed" },
      ]),
      makeClassification([
        {
          type: "binary_contrast",
          confidence: 0.9,
          evidence: "reduces symptoms, but it also raises",
        },
      ]),
    ];

    // Second pass: no target patterns remain.
    const secondPassClassifications: SentenceClassification[] = [
      makeClassification([]),
      makeClassification([]),
    ];

    let callCount = 0;
    const classifier: SentenceClassifier = {
      async classify(sentences: HashedSentence[]): Promise<ClassifiedSentence[]> {
        const classifications =
          callCount === 0 ? firstPassClassifications : secondPassClassifications;
        callCount++;
        return sentences.map((s, i) => ({
          ...s,
          classification: classifications[i] ?? makeClassification([]),
          heat: 0,
        }));
      },
    };

    // Model responses in the order rewriteOppositions calls them:
    // rewrite 0, fidelity 0, alternatives 0, score 1. Sentence 0 is judged by the heuristic.
    let generateCall = 0;
    const model = {
      specificationVersion: "v3" as const,
      provider: "test",
      modelId: "test-model",
      async doGenerate() {
        generateCall++;
        let text = "";
        if (generateCall === 1) text = '{"replacement":"It\'s about precision more than speed."}';
        if (generateCall === 2)
          text = '{"entails":true,"confidence":0.9,"explanation":"Preserves meaning"}';
        if (generateCall === 3)
          text =
            '{"alternatives":["Precision matters more than speed.","Speed is secondary to precision."]}';
        if (generateCall === 4) text = '{"verdict":"earned","rationale":"Real trade-off"}';
        return {
          content: [{ type: "text" as const, text }],
          finishReason: "stop",
          usage: {
            totalTokens: 0,
            inputTokens: { total: 0 },
            outputTokens: { total: 0 },
          },
          warnings: [],
        };
      },
    } as unknown as LanguageModel;

    const result = await rewriteOppositions(text, {
      classifier,
      cache: new NullCache(),
      judgeModel: model,
      rewriteModel: model,
      maxPasses: 3,
    });

    expect(result.metrics.spansDetected).toBe(2);
    expect(result.metrics.vacuousSpans).toBe(1);
    expect(result.metrics.earnedSpans).toBe(1);
    expect(result.metrics.acceptedEdits).toBe(1);
    expect(result.rewrittenText).toContain("It's about precision more than speed.");
    expect(result.rewrittenText).toContain(
      "The drug reduces symptoms, but it also raises liver enzymes.",
    );
    expect(result.edits.find((edit) => edit.accepted)?.alternatives?.length).toBeGreaterThan(0);
  });

  test("rejects rewrite that fails fidelity", async () => {
    const text = "It's not about speed; it's about precision.";

    const classifier = fakeClassifier([
      makeClassification([
        { type: "binary_contrast", confidence: 0.9, evidence: "not about speed" },
      ]),
    ]);

    let generateCall = 0;
    const model = {
      specificationVersion: "v3" as const,
      provider: "test",
      modelId: "test-model",
      async doGenerate() {
        generateCall++;
        let text = "";
        if (generateCall === 1) text = '{"replacement":"The weather is nice today."}';
        if (generateCall === 2)
          text = '{"entails":false,"confidence":0.8,"explanation":"Completely different meaning"}';
        if (generateCall === 3)
          text =
            '{"alternatives":["Precision matters more than speed.","Speed is secondary to precision here."]}';
        return {
          content: [{ type: "text" as const, text }],
          finishReason: "stop",
          usage: {
            totalTokens: 0,
            inputTokens: { total: 0 },
            outputTokens: { total: 0 },
          },
          warnings: [],
        };
      },
    } as unknown as LanguageModel;

    const result = await rewriteOppositions(text, {
      classifier,
      cache: new NullCache(),
      judgeModel: model,
      rewriteModel: model,
      maxPasses: 1,
    });

    expect(result.metrics.acceptedEdits).toBe(0);
    expect(result.metrics.rejectedEdits).toBe(1);
    expect(result.metrics.fidelityFailures).toBe(1);
    expect(result.rewrittenText).toBe(text);
    expect(result.edits[0]?.alternatives?.length).toBeGreaterThan(0);
  });

  test("returns rewrite options for uncertain spans", async () => {
    const text =
      "This pattern creates impressive surface energy, but it also makes the argument feel flat because nothing is allowed to be ordinary.";

    const classifier = fakeClassifier([
      makeClassification([
        { type: "binary_contrast", confidence: 0.9, evidence: "creates impressive surface energy" },
      ]),
    ]);

    let generateCall = 0;
    const model = {
      specificationVersion: "v3" as const,
      provider: "test",
      modelId: "test-model",
      async doGenerate() {
        generateCall++;
        let text = "";
        if (generateCall === 1) text = "this is not json";
        if (generateCall === 2)
          text =
            '{"alternatives":["The pattern adds surface energy without letting ordinary claims breathe.","Surface energy here crowds out ordinary argument."]}';
        return {
          content: [{ type: "text" as const, text }],
          finishReason: "stop",
          usage: {
            totalTokens: 0,
            inputTokens: { total: 0 },
            outputTokens: { total: 0 },
          },
          warnings: [],
        };
      },
    } as unknown as LanguageModel;

    const result = await rewriteOppositions(text, {
      classifier,
      cache: new NullCache(),
      judgeModel: model,
      rewriteModel: model,
      maxPasses: 1,
    });

    expect(result.metrics.uncertainSpans).toBe(1);
    expect(result.edits[0]?.verdict).toBe("uncertain");
    expect(result.edits[0]?.alternatives?.length).toBeGreaterThan(0);
  });

  test("returns a reviewable correction when classifier misses an obvious template", async () => {
    const text =
      "Operational review is not about making every sentence sound decisive but about assigning force where the evidence earns it.";
    const classifier = fakeClassifier([makeClassification([])]);

    const model = fakeModel(
      '{"alternatives":["Operational review assigns force where the evidence earns it.","Operational review puts force only where evidence earns it.","Force follows evidence in operational review."]}',
    );

    const result = await rewriteOppositions(text, {
      classifier,
      cache: new NullCache(),
      judgeModel: model,
      rewriteModel: model,
      maxPasses: 2,
    });

    expect(result.metrics.spansDetected).toBe(1);
    expect(result.metrics.vacuousSpans).toBe(1);
    expect(result.metrics.acceptedEdits).toBe(0);
    expect(result.edits[0]?.span.patternType).toBe("binary_contrast");
    expect(result.rewrittenText).toBe(text);
    expect(result.edits[0]?.rewrittenSentence).toBe(
      "Operational review depends on assigning force where the evidence earns it.",
    );
    expect(result.edits[0]?.alternatives?.length).toBeGreaterThanOrEqual(2);
    expect(result.edits[0]?.alternatives?.[0]).toBe(
      "Operational review depends on assigning force where the evidence earns it.",
    );
  });

  test("returns sentence-range corrections for adjacent opposition pairs", async () => {
    const text = [
      "AI adoption is not about tools, it is about mindset.",
      "",
      "In today's rapidly changing business landscape, leaders need to embrace a transformative approach to customer support. It is not merely about automating tickets but about empowering teams to focus on what truly matters.",
      "",
      "At first glance, AI may seem like a simple efficiency play. But the real opportunity is much more nuanced: creating a seamless synergy between human empathy and machine intelligence.",
      "",
      "Not only can AI reduce response times, but it can also unlock deeper customer insights, elevate the employee experience, and drive meaningful business outcomes.",
      "",
      "On one hand, some teams worry that automation will make support feel cold. On the other hand, the right implementation can create a more personalized, scalable, and resilient service model.",
      "",
      "The lesson is clear: success is not about replacing people with AI. It is about building a culture where people and AI work together to deliver exceptional experiences at scale.",
    ].join("\n");
    const classifier = fakeClassifier(Array.from({ length: 10 }, () => makeClassification([])));

    const model = fakeModel(
      '{"alternatives":["Direct claim one.","Direct claim two.","Direct claim three."]}',
    );

    const result = await rewriteOppositions(text, {
      classifier,
      cache: new NullCache(),
      judgeModel: model,
      rewriteModel: model,
      maxPasses: 1,
    });

    expect(result.metrics.spansDetected).toBe(6);
    expect(result.metrics.vacuousSpans).toBe(6);
    expect(result.metrics.acceptedEdits).toBe(0);
    expect(result.edits).toHaveLength(6);
    expect(result.edits.map((edit) => [edit.span.sentenceId, edit.span.sentenceEndId])).toEqual([
      [0, undefined],
      [2, undefined],
      [3, 4],
      [5, undefined],
      [6, 7],
      [8, 9],
    ]);
    expect(result.edits.map((edit) => edit.rewrittenSentence)).toContain(
      "The lesson is clear: success depends on building a culture where people and AI work together to deliver exceptional experiences at scale.",
    );
    for (const edit of result.edits) {
      expect(edit.alternatives?.length).toBeGreaterThanOrEqual(2);
    }
  });

  test("stops early when no candidates remain", async () => {
    const text = "This is a clean sentence with no opposition.";
    const classifier = fakeClassifier([makeClassification([])]);
    const model = fakeModel("{}");

    const result = await rewriteOppositions(text, {
      classifier,
      cache: new NullCache(),
      judgeModel: model,
      rewriteModel: model,
      maxPasses: 3,
    });

    expect(result.metrics.passes).toBe(1);
    expect(result.metrics.spansDetected).toBe(0);
    expect(result.rewrittenText).toBe(text);
  });
});
