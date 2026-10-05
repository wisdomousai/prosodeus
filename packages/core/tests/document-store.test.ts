import { beforeEach, expect, test } from "bun:test";
import { existsSync, unlinkSync } from "node:fs";
import { createBunSqliteAdapter, DocumentStore } from "../src/node.ts";
import type { ClassifiedSentence, StylometricProfile } from "../src/types.ts";

const TEST_DB = "/tmp/prosodeus-test-document-store.sqlite";

beforeEach(() => {
  for (const ext of ["", "-shm", "-wal"]) {
    if (existsSync(TEST_DB + ext)) unlinkSync(TEST_DB + ext);
  }
});

function makeStore() {
  return new DocumentStore(createBunSqliteAdapter(TEST_DB));
}

function makeFakeProfile(meanHeat = 1.5, sentenceCount = 3): StylometricProfile {
  return {
    word_count: 30,
    sentence_count: sentenceCount,
    paragraph_count: 1,
    sentences: [],
    windows: [],
    hot_regions: [],
    mean_heat: meanHeat,
    convergence_slope: 0,
    global_biber_entropy: 1.0,
    global_device_entropy: 0,
    global_sentence_length_autocorrelation: 0,
    global_ttr: 0.5,
    global_mattr: 0.5,
    global_hapax_ratio: 0.3,
    global_word_length_entropy: 2.5,
    global_opening_variety: 0.7,
    global_function_word_ratio: 0.4,
  } as StylometricProfile;
}

function makeFakeSentence(id: number, hash: string): ClassifiedSentence {
  return {
    id,
    text: `Sentence ${id}.`,
    hash,
    paragraph_id: 0,
    classification: {
      biber: {
        informational: 0.5,
        involved: 0,
        narrative: 0,
        persuasive: 0,
        abstract: 0,
        elaborative: 0,
      },
      patterns: [],
      metrics: {
        word_count: 2,
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

test("create and read a document", () => {
  const store = makeStore();
  store.createDocument({ id: "doc-1", title: "My Doc" });

  const got = store.getDocument("doc-1");
  expect(got?.title).toBe("My Doc");
  expect(got?.content).toBeNull();
  expect(got?.content_format).toBe("plaintext");
});

test("list documents filters by workspace and folder", () => {
  const store = makeStore();
  store.createDocument({ id: "a", workspaceId: "ws1", folderId: "f1" });
  store.createDocument({ id: "b", workspaceId: "ws1", folderId: "f2" });
  store.createDocument({ id: "c", workspaceId: "ws2" });

  expect(store.listDocuments({ workspaceId: "ws1" })).toHaveLength(2);
  expect(store.listDocuments({ workspaceId: "ws1", folderId: "f1" })).toHaveLength(1);
  expect(store.listDocuments()).toHaveLength(3);
});

test("update content stamps updated_at", async () => {
  const store = makeStore();
  store.createDocument({ id: "d1" });
  const before = store.getDocument("d1")!.updated_at;

  // SQLite datetime('now') is second-resolution. Sleep just enough.
  await new Promise((r) => setTimeout(r, 1100));
  store.updateDocumentContent("d1", "new content");

  const after = store.getDocument("d1")!;
  expect(after.content).toBe("new content");
  expect(after.updated_at >= before).toBe(true);
});

test("persistIteration writes iteration + sentences and links them", () => {
  const store = makeStore();
  store.createDocument({ id: "d2" });

  const profile = makeFakeProfile(2.5, 3);
  const sentences = [
    makeFakeSentence(0, "hash-a"),
    makeFakeSentence(1, "hash-b"),
    makeFakeSentence(2, "hash-c"),
  ];

  const iterId = store.persistIteration("d2", profile, sentences, "test");
  expect(iterId).toBeGreaterThan(0);

  const iters = store.listIterations("d2");
  expect(iters).toHaveLength(1);
  expect(iters[0]!.mean_heat).toBe(2.5);
  expect(iters[0]!.sentence_count).toBe(3);
  expect(iters[0]!.source).toBe("test");
});

test("iterations are scoped per document", () => {
  const store = makeStore();
  store.createDocument({ id: "d1" });
  store.createDocument({ id: "d2" });

  store.persistIteration("d1", makeFakeProfile(1, 1), [makeFakeSentence(0, "h1")]);
  store.persistIteration("d2", makeFakeProfile(2, 1), [makeFakeSentence(0, "h2")]);

  expect(store.listIterations("d1")).toHaveLength(1);
  expect(store.listIterations("d2")).toHaveLength(1);
  expect(store.listIterations("d1")[0]!.mean_heat).toBe(1);
  expect(store.listIterations("d2")[0]!.mean_heat).toBe(2);
});

test("versions: create, list, get, latestContent", () => {
  const store = makeStore();
  store.createDocument({ id: "dv" });

  const v1 = store.persistVersion({
    documentId: "dv",
    content: "first draft",
    source: "auto",
    profile: makeFakeProfile(3),
  });
  const v2 = store.persistVersion({
    documentId: "dv",
    content: "second draft",
    name: "labeled",
    profile: makeFakeProfile(2),
  });

  expect(v2).toBeGreaterThan(v1);

  const list = store.listVersions("dv");
  expect(list).toHaveLength(2);
  expect(list[0]!.id).toBe(v2);
  expect(list[0]!.name).toBe("labeled");

  const got = store.getVersion(v1);
  expect(got?.content).toBe("first draft");
  expect(got?.profile?.mean_heat).toBe(3);

  expect(store.latestVersionContent("dv")).toBe("second draft");
});

test("deleting a document cascades iterations and versions", () => {
  const store = makeStore();
  store.createDocument({ id: "del" });
  store.persistIteration("del", makeFakeProfile(), [makeFakeSentence(0, "h")]);
  store.persistVersion({ documentId: "del", content: "x" });

  store.deleteDocument("del");

  expect(store.getDocument("del")).toBeNull();
  expect(store.listIterations("del")).toHaveLength(0);
  expect(store.listVersions("del")).toHaveLength(0);
});
