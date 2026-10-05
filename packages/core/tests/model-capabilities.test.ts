import { describe, expect, test } from "bun:test";
import {
  modelCapabilityForSpec,
  resolveSuggestCapableSpec,
  supportsTask,
} from "../src/models/model-capabilities.ts";

describe("supportsTask", () => {
  test("kimi-for-coding supports suggest (thinking model)", () => {
    expect(supportsTask("moonshot/kimi-for-coding", "suggest", "coding")).toBe(true);
    expect(supportsTask("moonshot/kimi-for-coding", "rewrite", "coding")).toBe(true);
  });

  test("developer kimi supports suggest", () => {
    expect(supportsTask("moonshot/kimi-k2.6", "suggest", "developer")).toBe(true);
  });

  test("coding key uses thinking suggest profile for moonshot specs", () => {
    expect(modelCapabilityForSpec("moonshot/kimi-k2.6", "coding").suggestOutput).toBe(
      modelCapabilityForSpec("moonshot/kimi-for-coding", "coding").suggestOutput,
    );
  });
});

describe("resolveSuggestCapableSpec", () => {
  test("uses preferred model when available", () => {
    const available = (s: string) => s === "moonshot/kimi-for-coding";
    const r = resolveSuggestCapableSpec("moonshot/kimi-for-coding", available, "coding");
    expect(r?.spec).toBe("moonshot/kimi-for-coding");
    expect(r?.notice).toBeUndefined();
  });

  test("returns null when preferred unavailable", () => {
    const r = resolveSuggestCapableSpec("moonshot/kimi-for-coding", () => false, "coding");
    expect(r).toBeNull();
  });

  test("picks first available when no preferred", () => {
    const available = (s: string) => s.startsWith("groq/");
    const r = resolveSuggestCapableSpec(undefined, available);
    expect(r?.spec).toBe("groq/qwen/qwen3-32b");
  });
});
