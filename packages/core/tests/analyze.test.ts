import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { LanguageModel } from "ai";
import { existsSync, unlinkSync } from "fs";
import { analyze } from "../src/analysis/analyze.ts";
import { LLMClassifier } from "../src/classification/classifier.ts";
import type {
  ClassificationCache,
  ClassifiedSentence,
  SentenceClassification,
} from "../src/index.ts";
import { LocalCache, NullCache } from "../src/storage/cache.ts";

// ─── Dummy model for mock classifiers ───────────────────────────────────────

const dummyModel = { modelId: "test", provider: "test" } as unknown as LanguageModel;

// ─── Mock cache for testing ─────────────────────────────────────────────────

class MockCache implements ClassificationCache {
  store = new Map<string, SentenceClassification>();
  getCalls = 0;
  setCalls = 0;

  async getMany(hashes: string[]): Promise<Map<string, SentenceClassification>> {
    this.getCalls++;
    const results = new Map<string, SentenceClassification>();
    for (const hash of hashes) {
      const val = this.store.get(hash);
      if (val) results.set(hash, val);
    }
    return results;
  }

  async setMany(
    entries: Array<{ hash: string; classification: SentenceClassification }>,
  ): Promise<void> {
    this.setCalls++;
    for (const { hash, classification } of entries) {
      this.store.set(hash, classification);
    }
  }
}

// ─── Mock classifier that returns deterministic results ─────────────────────

class MockClassifier extends LLMClassifier {
  classifyCalls = 0;
  lastBatchSize = 0;

  constructor() {
    super(dummyModel);
  }

  override async classify(
    sentences: import("../src/types.ts").HashedSentence[],
  ): Promise<ClassifiedSentence[]> {
    this.classifyCalls++;
    this.lastBatchSize = sentences.length;
    return sentences.map((s) => ({
      ...s,
      classification: {
        biber: {
          informational: 0.5,
          involved: 0.2,
          narrative: 0.1,
          persuasive: 0.1,
          abstract: 0.05,
          elaborative: 0.05,
        },
        patterns: [],
        metrics: {
          word_count: s.text.split(/\s+/).length,
          clause_count: 1,
          has_participial: false,
          has_relative_clause: false,
          clause_balance_ratio: 0.5,
          construction_type: "simple",
        },
        arc_role: "claim",
      },
      heat: 0,
    }));
  }
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("analyze", () => {
  test("produces a valid profile", async () => {
    const cache = new MockCache();
    const classifier = new MockClassifier();

    const profile = await analyze("First sentence here. Second sentence here.", {
      cache,
      classifier,
    });

    expect(profile.sentence_count).toBe(2);
    expect(profile.word_count).toBeGreaterThan(0);
    expect(profile.sentences).toHaveLength(2);
  });

  test("caches classifications on first run", async () => {
    const cache = new MockCache();
    const classifier = new MockClassifier();

    await analyze("Hello world. Goodbye world.", { cache, classifier });

    expect(cache.store.size).toBe(2);
    expect(classifier.classifyCalls).toBe(1);
  });

  test("uses cache on second run with same text", async () => {
    const cache = new MockCache();
    const classifier = new MockClassifier();
    const text = "Hello world. Goodbye world.";

    await analyze(text, { cache, classifier });
    expect(classifier.classifyCalls).toBe(1);

    await analyze(text, { cache, classifier });
    // Classifier should NOT be called again — all cached
    expect(classifier.classifyCalls).toBe(1);
  });

  test("only classifies changed sentences on rewrite", async () => {
    const cache = new MockCache();
    const classifier = new MockClassifier();

    await analyze("First sentence. Second sentence. Third sentence.", {
      cache,
      classifier,
    });
    expect(classifier.classifyCalls).toBe(1);
    expect(classifier.lastBatchSize).toBe(3);

    // Change only the second sentence
    await analyze("First sentence. Modified second. Third sentence.", {
      cache,
      classifier,
    });
    expect(classifier.classifyCalls).toBe(2);
    expect(classifier.lastBatchSize).toBe(1); // only the changed sentence
  });

  test("calls onProgress callback", async () => {
    const cache = new MockCache();
    const classifier = new MockClassifier();
    let progressCalled = false;

    await analyze("Some text here. More text.", {
      cache,
      classifier,
      onProgress: (p) => {
        progressCalled = true;
        expect(p.total).toBe(2);
        expect(p.cached).toBe(0);
        expect(p.classifying).toBe(2);
      },
    });

    expect(progressCalled).toBe(true);
  });

  test("applies style guide when specified", async () => {
    const cache = new MockCache();
    const classifier = new MockClassifier();

    const profile = await analyze("Some text. More text.", {
      cache,
      classifier,
      style: "general",
    });

    expect(profile.delta).toBeDefined();
    expect(profile.delta!.guide).toBe("general");
  });

  test("handles empty text", async () => {
    const cache = new MockCache();
    const classifier = new MockClassifier();

    const profile = await analyze("", { cache, classifier });
    expect(profile.sentence_count).toBe(0);
    expect(classifier.classifyCalls).toBe(0);
  });
});

describe("NullCache", () => {
  test("always returns empty map", async () => {
    const cache = new NullCache();
    const result = await cache.getMany(["abc", "def"]);
    expect(result.size).toBe(0);
  });

  test("setMany is a no-op", async () => {
    const cache = new NullCache();
    await cache.setMany([
      {
        hash: "abc",
        classification: {
          biber: {
            informational: 0,
            involved: 0,
            narrative: 0,
            persuasive: 0,
            abstract: 0,
            elaborative: 0,
          },
          patterns: [],
          metrics: {
            word_count: 0,
            clause_count: 1,
            has_participial: false,
            has_relative_clause: false,
            clause_balance_ratio: 0.5,
            construction_type: "simple",
          },
          arc_role: "claim",
        },
      },
    ]);
    const result = await cache.getMany(["abc"]);
    expect(result.size).toBe(0);
  });
});

describe("LocalCache", () => {
  const testDbPath = new URL("./test-cache.sqlite", import.meta.url).pathname;

  function cleanupDb() {
    for (const suffix of ["", "-wal", "-shm"]) {
      const p = testDbPath + suffix;
      if (existsSync(p)) unlinkSync(p);
    }
  }

  beforeEach(cleanupDb);
  afterEach(cleanupDb);

  test("round-trips classifications", async () => {
    const cache = new LocalCache(testDbPath);
    const classification: SentenceClassification = {
      biber: {
        informational: 0.8,
        involved: 0.1,
        narrative: 0.2,
        persuasive: 0.3,
        abstract: 0.5,
        elaborative: 0.3,
      },
      patterns: [{ type: "nominalization", confidence: 0.9, evidence: "implementation" }],
      metrics: {
        word_count: 15,
        clause_count: 2,
        has_participial: false,
        has_relative_clause: false,
        clause_balance_ratio: 0.6,
        construction_type: "complex",
      },
      arc_role: "claim",
    };

    await cache.setMany([{ hash: "testhash", classification }]);
    const result = await cache.getMany(["testhash"]);
    expect(result.size).toBe(1);
    expect(result.get("testhash")).toEqual(classification);
  });

  test("returns empty for unknown hashes", async () => {
    const cache = new LocalCache(testDbPath);
    const result = await cache.getMany(["nonexistent"]);
    expect(result.size).toBe(0);
  });

  test("handles multiple entries", async () => {
    const cache = new LocalCache(testDbPath);
    const base: SentenceClassification = {
      biber: {
        informational: 0,
        involved: 0,
        narrative: 0,
        persuasive: 0,
        abstract: 0,
        elaborative: 0,
      },
      patterns: [],
      metrics: {
        word_count: 5,
        clause_count: 1,
        has_participial: false,
        has_relative_clause: false,
        clause_balance_ratio: 0.5,
        construction_type: "simple",
      },
      arc_role: "claim",
    };

    await cache.setMany([
      { hash: "a", classification: { ...base, arc_role: "claim" } },
      { hash: "b", classification: { ...base, arc_role: "evidence" } },
      { hash: "c", classification: { ...base, arc_role: "pivot" } },
    ]);

    const result = await cache.getMany(["a", "b", "c", "d"]);
    expect(result.size).toBe(3);
    expect(result.get("a")!.arc_role).toBe("claim");
    expect(result.get("b")!.arc_role).toBe("evidence");
    expect(result.get("c")!.arc_role).toBe("pivot");
    expect(result.has("d")).toBe(false);
  });
});
