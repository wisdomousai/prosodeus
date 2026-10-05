import { describe, expect, test } from "bun:test";
import type { LanguageModel } from "ai";
import type { EngineContext } from "../src/runtime/engine.ts";
import { classifyText, engineAnalyze } from "../src/runtime/engine.ts";
import type {
  ClassificationCache,
  StoredSuggestion,
  SuggestionCache,
} from "../src/storage/cache.ts";
import { NullCache } from "../src/storage/cache.ts";
import type { ClassifiedSentence, HashedSentence, SentenceClassification } from "../src/types.ts";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const SOURCE =
  "When abstract nouns stack together, the sentence asks the reader to admire a shape instead of follow a thought.";
const VALID_ALT =
  "When abstract nouns pile up, the sentence invites admiration of form rather than pursuit of meaning.";

function classification(patterned: boolean, confidence = 0.9): SentenceClassification {
  return {
    biber: {
      informational: 0.5,
      involved: 0.2,
      narrative: 0.1,
      persuasive: 0.1,
      abstract: 0.05,
      elaborative: 0.05,
    },
    patterns: patterned
      ? [{ type: "importance_inflation", confidence, evidence: "stack together" }]
      : [],
    metrics: {
      word_count: 10,
      clause_count: 1,
      has_participial: false,
      has_relative_clause: false,
      clause_balance_ratio: 0.5,
      construction_type: "simple",
    },
    arc_role: "claim",
  } as SentenceClassification;
}

/** Classifier stub: flags every sentence, confidence rising with sentence id. */
class StubClassifier {
  async classify(sentences: HashedSentence[]): Promise<ClassifiedSentence[]> {
    return sentences.map((s) => ({
      ...s,
      classification: classification(true, Math.max(0.85, 0.3 + s.id * 0.1)),
      heat: 0, // recomputed by classifyText
    }));
  }
}

/**
 * Suggest-model stub compatible with `generateText` (mirrors the shape of
 * createAgentSDKModel). Responds with one valid alternative for batch idx 0.
 */
function makeSuggestModel(opts?: { gate?: Promise<void> }) {
  const calls: string[] = [];
  const model = {
    specificationVersion: "v3",
    provider: "test",
    modelId: "fake-model",
    supportedUrls: {},
    async doGenerate(options: any) {
      let userText = "";
      for (const msg of options.prompt) {
        if (msg.role === "user") {
          for (const part of msg.content) {
            if (part.type === "text") userText += part.text;
          }
        }
      }
      calls.push(userText);
      if (opts?.gate) await opts.gate;
      const json = JSON.stringify({
        sentences: [{ idx: 0, suggestions: [{ text: VALID_ALT, rationale: "restructured" }] }],
      });
      return {
        content: [{ type: "text" as const, text: json }],
        finishReason: "stop",
        usage: {
          totalTokens: 0,
          cachedInputTokens: undefined,
          inputTokens: {
            total: 0,
            noCache: undefined,
            cacheRead: undefined,
            cacheWrite: undefined,
          },
          outputTokens: {
            total: 0,
            noCache: undefined,
            cacheRead: undefined,
            cacheWrite: undefined,
          },
        },
        warnings: [],
      };
    },
    async doStream() {
      throw new Error("not supported");
    },
  };
  return { model: model as unknown as LanguageModel, calls };
}

class MockSuggestionCache implements SuggestionCache {
  store = new Map<string, StoredSuggestion[]>();
  getKeys: string[][] = [];
  setEntries: Array<{ key: string; suggestions: StoredSuggestion[] }> = [];

  async getSuggestions(keys: string[]): Promise<Map<string, StoredSuggestion[]>> {
    this.getKeys.push(keys);
    const out = new Map<string, StoredSuggestion[]>();
    for (const key of keys) {
      const val = this.store.get(key);
      if (val) out.set(key, val);
    }
    return out;
  }

  async setSuggestions(
    entries: Array<{ key: string; suggestions: StoredSuggestion[] }>,
  ): Promise<void> {
    this.setEntries.push(...entries);
    for (const { key, suggestions } of entries) this.store.set(key, suggestions);
  }
}

function makeCtx(model: LanguageModel, suggestionCache?: SuggestionCache): EngineContext {
  return {
    cache: new NullCache(),
    suggestionCache,
    classifier: new StubClassifier(),
    resolveModel: () => model,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("engineAnalyze suggest phase", () => {
  test("returns profile before suggestions resolve", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { model, calls } = makeSuggestModel({ gate });

    const result = await engineAnalyze(SOURCE, makeCtx(model), {
      documentId: "d1",
      suggestMode: "batch",
    });

    // engineAnalyze resolved while the suggest model is still gated — the
    // profile does not wait on suggestions.
    expect(result.profile.sentence_count).toBe(1);
    expect(result.suggestionsPromise).toBeDefined();

    release();
    const suggestions = await result.suggestionsPromise!;
    expect(calls.length).toBe(1);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0]!.alternatives[0]!.text).toBe(VALID_ALT);
  });

  test("batch suggest targets up to 3 diverse hot sentences", async () => {
    const { model, calls } = makeSuggestModel();
    const text = [
      "The quick brown fox jumps over the lazy dog today.",
      "A second sentence sits here with plain simple words.",
      "The third sentence follows along with its own words.",
      "Sentence number four continues the pattern of the test.",
      "The fifth and final sentence closes out the paragraph.",
    ].join("\n\n");

    const result = await engineAnalyze(text, makeCtx(model), {
      documentId: "d1",
      suggestMode: "batch",
    });
    await result.suggestionsPromise;

    expect(calls.length).toBe(1);
    const entryCount = (calls[0]!.match(/\bid=\d+/g) ?? []).length;
    expect(entryCount).toBeGreaterThan(0);
    expect(entryCount).toBeLessThanOrEqual(3);
  });

  test("topSuggestions: 0 skips the suggest phase", async () => {
    const { model, calls } = makeSuggestModel();
    const result = await engineAnalyze(SOURCE, makeCtx(model), {
      documentId: "d1",
      topSuggestions: 0,
    });

    expect(result.suggestionsPromise).toBeUndefined();
    expect(calls.length).toBe(0);
  });

  test("suggestion cache: miss writes back, hit skips the model", async () => {
    const { model, calls } = makeSuggestModel();
    const cache = new MockSuggestionCache();
    const ctx = makeCtx(model, cache);

    // First run: cache miss → model called, result written back.
    const first = await engineAnalyze(SOURCE, ctx, { documentId: "d1", suggestMode: "batch" });
    const firstSuggestions = await first.suggestionsPromise!;
    expect(firstSuggestions.length).toBeGreaterThan(0);
    expect(calls.length).toBe(1);
    expect(cache.setEntries.length).toBe(1);

    // Key format: version : sentence-hash : patterns-digest : model : numAlternatives
    const key = cache.setEntries[0]!.key;
    const parts = key.split(":");
    expect(parts.length).toBe(5);
    expect(parts[0]).toBe("s1");
    expect(parts[3]).toBe("fake-model");
    expect(parts[4]).toBe("3");

    // Second run over the same text: cache hit → model NOT called again.
    const second = await engineAnalyze(SOURCE, ctx, { documentId: "d1", suggestMode: "batch" });
    const secondSuggestions = await second.suggestionsPromise!;
    expect(calls.length).toBe(1);
    expect(secondSuggestions.length).toBe(firstSuggestions.length);
    expect(secondSuggestions[0]!.alternatives[0]!.text).toBe(VALID_ALT);
    expect(secondSuggestions[0]!.original).toBe(SOURCE);
  });
});

describe("classifyText incremental + partial profile", () => {
  class TrackingClassifier {
    classifiedIds: number[] = [];
    async classify(sentences: HashedSentence[]): Promise<ClassifiedSentence[]> {
      this.classifiedIds.push(...sentences.map((s) => s.id));
      return sentences.map((s) => ({
        ...s,
        classification: classification(true, 0.9),
        heat: 0,
      }));
    }
  }

  class SeedCache implements ClassificationCache {
    private store = new Map<string, SentenceClassification>();
    constructor(entries: Array<{ hash: string; classification: SentenceClassification }>) {
      for (const e of entries) this.store.set(e.hash, e.classification);
    }
    async getMany(hashes: string[]) {
      const out = new Map<string, SentenceClassification>();
      for (const h of hashes) {
        const v = this.store.get(h);
        if (v) out.set(h, v);
      }
      return out;
    }
    async setMany(entries: Array<{ hash: string; classification: SentenceClassification }>) {
      for (const e of entries) this.store.set(e.hash, e.classification);
    }
  }

  test("changedSentenceIds limits uncached classification subset", async () => {
    const text = [
      "First sentence in paragraph one stays cached.",
      "Second sentence in paragraph one may change.",
      "Third sentence opens paragraph two here.",
      "Fourth sentence continues paragraph two now.",
    ].join(" ");

    const tracker = new TrackingClassifier();
    const first = await classifyText(text, {
      cache: new NullCache(),
      classifier: tracker,
    });
    expect(first.classified.length).toBe(4);

    const cache = new SeedCache(
      first.classified
        .filter((s) => s.id !== 1)
        .map((s) => ({ hash: s.hash, classification: s.classification })),
    );
    const incremental = new TrackingClassifier();
    await classifyText(text, { cache, classifier: incremental }, undefined, undefined, {
      changedSentenceIds: [1],
    });

    expect(incremental.classifiedIds).toEqual([1]);
  });

  test("onPartialProfile fires when cached sentences exist", async () => {
    const partials: number[] = [];
    const text = "One cached sentence. Another fresh sentence follows.";
    const first = await classifyText(text, {
      cache: new NullCache(),
      classifier: new StubClassifier(),
    });
    const cache = new SeedCache(
      first.classified.slice(0, 1).map((s) => ({ hash: s.hash, classification: s.classification })),
    );

    await classifyText(text, { cache, classifier: new StubClassifier() }, undefined, undefined, {
      onPartialProfile: () => {
        partials.push(1);
      },
    });

    expect(partials.length).toBeGreaterThan(0);
  });

  test("classification cache stores classifier output without static candidates", async () => {
    const cache = new SeedCache([]);
    const result = await classifyText(
      "This robust strategy unlocks meaningful impact.",
      { cache, classifier: new StubClassifier() },
      undefined,
      undefined,
      { aiSlopMode: "tiered" },
    );

    const classified = result.classified[0]!;
    expect(classified.classification.ai_slop_candidates?.length).toBeGreaterThan(0);

    const stored = await cache.getMany([classified.hash]);
    expect(stored.get(classified.hash)?.ai_slop_candidates).toBeUndefined();
  });

  test("out-of-scope uncached sentences get default classification", async () => {
    const textBefore = "Alpha stays. Beta stays.\n\nGamma stays.";
    const textAfter = "Alpha stays. Beta changed.\n\nGamma stays.";

    const first = await classifyText(textBefore, {
      cache: new NullCache(),
      classifier: new StubClassifier(),
    });
    const cache = new SeedCache(
      first.classified.map((s) => ({ hash: s.hash, classification: s.classification })),
    );

    const result = await classifyText(
      textAfter,
      { cache, classifier: new StubClassifier() },
      undefined,
      undefined,
      { changedSentenceIds: [2] },
    );

    const beta = result.classified.find((s) => s.text.includes("Beta"));
    expect(beta).toBeDefined();
    expect(beta!.classification.patterns).toEqual([]);
    expect(beta!.heat).toBe(0);
  });
});
