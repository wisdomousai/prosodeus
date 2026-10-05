import { describe, expect, test } from "bun:test";
import { validateWorkspaceSettings } from "../src/workspace-settings.ts";

describe("validateWorkspaceSettings", () => {
  test("accepts valid voice and platform fields", () => {
    const result = validateWorkspaceSettings({
      voice_dna: "Direct, first-person, no fluff.",
      default_playbook_platform: "linkedin",
      voice_style_guide_id: "style-abc",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.voice_dna).toContain("Direct");
      expect(result.value.default_playbook_platform).toBe("linkedin");
    }
  });

  test("rejects invalid platform enum", () => {
    const result = validateWorkspaceSettings({
      default_playbook_platform: "instagram",
    });
    expect(result.ok).toBe(false);
  });

  test("rejects voice_dna over max length", () => {
    const result = validateWorkspaceSettings({
      voice_dna: "x".repeat(4001),
    });
    expect(result.ok).toBe(false);
  });
});
