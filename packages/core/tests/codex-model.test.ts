import { describe, expect, test } from "bun:test";
import {
  CODEX_LOCAL_HOST_MODE,
  type CodexCatalogModel,
  codexModelConfigFromCatalog,
  selectCodexTaskModel,
} from "../src/models/codex-config.ts";
import { codexModelId, parseCodexExecOutput } from "../src/models/codex-model.ts";

// JSONL fixtures recorded from `codex exec --json` (codex-cli 0.142.5).

const SUCCESS_LINES = [
  '{"type":"thread.started","thread_id":"t1"}',
  '{"type":"turn.started"}',
  '{"type":"item.completed","item":{"id":"i1","type":"agent_message","text":"{\\"results\\": []}"}}',
  '{"type":"turn.completed","usage":{"input_tokens":15000,"cached_input_tokens":4480,"output_tokens":12}}',
];

const FAILED_LINES = [
  '{"type":"thread.started","thread_id":"t2"}',
  '{"type":"turn.started"}',
  '{"type":"turn.failed","error":{"message":"The requested model is not supported when using Codex with a ChatGPT account"}}',
];

const BENIGN_ERROR_ITEM_LINES = [
  '{"type":"thread.started","thread_id":"t3"}',
  '{"type":"turn.started"}',
  '{"type":"item.completed","item":{"id":"i0","type":"error","message":"skill context exceeded budget"}}',
  '{"type":"item.completed","item":{"id":"i1","type":"agent_message","text":"hello"}}',
  '{"type":"turn.completed","usage":{"input_tokens":100,"output_tokens":2}}',
];

describe("parseCodexExecOutput", () => {
  test("accumulates agent_message text on success", () => {
    const out = parseCodexExecOutput(SUCCESS_LINES);
    expect(out.error).toBeUndefined();
    expect(out.text).toBe('{"results": []}');
  });

  test("surfaces turn.failed error", () => {
    const out = parseCodexExecOutput(FAILED_LINES);
    expect(out.text).toBe("");
    expect(out.error).toContain("not supported when using Codex with a ChatGPT account");
  });

  test("ignores benign error items when the agent message completes", () => {
    const out = parseCodexExecOutput(BENIGN_ERROR_ITEM_LINES);
    expect(out.error).toBeUndefined();
    expect(out.text).toBe("hello");
  });

  test("surfaces top-level error events", () => {
    const out = parseCodexExecOutput(['{"type":"error","message":"stream disconnected"}']);
    expect(out.error).toBe("stream disconnected");
  });

  test("skips non-JSON and interleaved noise lines", () => {
    const out = parseCodexExecOutput([
      "Reading additional input from stdin...",
      "",
      "not json {",
      ...SUCCESS_LINES,
    ]);
    expect(out.text).toBe('{"results": []}');
  });

  test("concatenates multiple agent messages", () => {
    const out = parseCodexExecOutput([
      '{"type":"item.completed","item":{"type":"agent_message","text":"foo"}}',
      '{"type":"item.completed","item":{"type":"agent_message","text":"bar"}}',
    ]);
    expect(out.text).toBe("foobar");
  });
});

describe("codexModelId", () => {
  test("maps specs to raw model ids", () => {
    expect(codexModelId("codex-gpt-5.5")).toBe("gpt-5.5");
    expect(codexModelId("codex/gpt-5.5")).toBe("gpt-5.5");
    expect(codexModelId("codex-gpt-5.4-mini")).toBe("gpt-5.4-mini");
    expect(codexModelId("codex-gpt-5.3-codex")).toBe("gpt-5.3-codex");
    expect(codexModelId("codex")).toBe("gpt-5.5");
  });
});

describe("Codex catalog task routing", () => {
  const catalog: CodexCatalogModel[] = [
    {
      slug: "gpt-5.5",
      displayName: "GPT-5.5",
      visibility: "list",
      defaultReasoningEffort: "medium",
      supportedReasoningEfforts: ["low", "medium", "high", "xhigh"],
      priority: 7,
    },
    {
      slug: "gpt-5.4-mini",
      displayName: "GPT-5.4 Mini",
      visibility: "list",
      defaultReasoningEffort: "medium",
      supportedReasoningEfforts: ["low", "medium", "high"],
      priority: 23,
    },
    {
      slug: "gpt-5.3-codex-spark",
      displayName: "GPT-5.3 Codex Spark",
      visibility: "list",
      defaultReasoningEffort: "high",
      supportedReasoningEfforts: ["low", "medium", "high"],
      priority: 26,
    },
  ];

  test("turns discovered models into selectable local host configs", () => {
    const config = codexModelConfigFromCatalog(catalog[0]!, true);
    expect(config).toMatchObject({
      id: "codex-gpt-5.5",
      model: "gpt-5.5",
      provider: "codex",
      mode: CODEX_LOCAL_HOST_MODE,
      default: true,
    });
  });

  test("uses light catalog models for classifier and selected heavy model for rewrite", () => {
    expect(selectCodexTaskModel(catalog, "classifier")?.spec).toBe("codex-gpt-5.3-codex-spark");
    expect(selectCodexTaskModel(catalog, "classifier")?.reasoningEffort).toBe("low");
    expect(selectCodexTaskModel(catalog, "rewrite", "codex-gpt-5.5")?.spec).toBe("codex-gpt-5.5");
    expect(selectCodexTaskModel(catalog, "rewrite", "codex-gpt-5.5")?.reasoningEffort).toBe("high");
  });
});
