import { describe, expect, test } from "bun:test";
import { selectDefaultWorkflowModelId } from "./useDocumentWorkflow";

describe("selectDefaultWorkflowModelId", () => {
  test("prefers GPT-5.5 when no valid model is selected", () => {
    expect(
      selectDefaultWorkflowModelId([
        { id: "claude-haiku-4-5" },
        { id: "codex-gpt-5.5" },
        { id: "moonshot/kimi-for-coding" },
      ]),
    ).toBe("codex-gpt-5.5");
  });

  test("preserves an explicit valid user selection", () => {
    expect(
      selectDefaultWorkflowModelId(
        [{ id: "claude-haiku-4-5" }, { id: "codex-gpt-5.5" }],
        "claude-haiku-4-5",
      ),
    ).toBe("claude-haiku-4-5");
  });

  test("falls back to the first available model without GPT-5.5", () => {
    expect(selectDefaultWorkflowModelId([{ id: "claude-haiku-4-5" }])).toBe("claude-haiku-4-5");
  });
});
