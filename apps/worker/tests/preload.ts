import { mock } from "bun:test";

// Mock Cloudflare Workers runtime module before any test imports
mock.module("cloudflare:workers", () => ({
  DurableObject: class DurableObject {
    ctx: unknown;
    env: unknown;
    constructor(ctx: unknown, env: unknown) {
      this.ctx = ctx;
      this.env = env;
    }
  },
}));

const documents: Array<Record<string, unknown>> = [];

function selectedDocuments() {
  return documents.map((doc) => ({
    id: doc.id,
    title: doc.title,
    word_count: doc.wordCount ?? null,
    sentence_count: doc.sentenceCount ?? null,
    mean_heat: doc.meanHeat ?? null,
    status: doc.status ?? "draft",
    folder_id: doc.folderId ?? null,
    workspace_id: doc.workspaceId ?? null,
    due_date: doc.dueDate ?? null,
    created_at: doc.createdAt,
    updated_at: doc.updatedAt,
  }));
}

function asyncRows(rows: unknown[]) {
  return Object.assign(Promise.resolve(rows), {
    orderBy: () => Promise.resolve(rows),
    returning: () => Promise.resolve(rows),
    then: Promise.resolve(rows).then.bind(Promise.resolve(rows)),
  });
}

function mockDb() {
  return {
    insert: () => ({
      values: (row: Record<string, unknown>) => {
        const now = new Date();
        documents.push({
          ...row,
          createdAt: row.createdAt ?? now,
          updatedAt: row.updatedAt ?? now,
        });
        return Promise.resolve([]);
      },
    }),
    select: () => ({
      from: () => ({
        where: () => asyncRows(selectedDocuments()),
        orderBy: () => Promise.resolve(selectedDocuments()),
      }),
    }),
    update: () => ({
      set: (data: Record<string, unknown>) => ({
        where: () => {
          Object.assign(documents[0] ?? {}, data);
          return Promise.resolve([]);
        },
      }),
    }),
    delete: () => ({
      where: () => ({
        returning: () => Promise.resolve(documents.length ? [{ id: documents[0]!.id }] : []),
      }),
    }),
  };
}

mock.module("../src/db/index.ts", () => ({
  createDb: () => mockDb(),
}));
