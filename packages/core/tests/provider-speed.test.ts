import { describe, expect, test } from "bun:test";
import {
  estimateOutputTokens,
  isRateLimitError,
  providerFromModelSpec,
  resolveSpeedProfile,
  splitBatchForRetry,
} from "../src/models/provider-speed.ts";

describe("resolveSpeedProfile", () => {
  test("groq uses conservative full batch limits", () => {
    const profile = resolveSpeedProfile("groq");
    expect(profile.gate.batchSize).toBe(8);
    expect(profile.full.batchSize).toBe(4);
    expect(profile.full.maxParallel).toBe(1);
  });

  test("google uses higher parallelism", () => {
    const profile = resolveSpeedProfile("google");
    expect(profile.gate.batchSize).toBe(16);
    expect(profile.full.maxParallel).toBe(3);
  });

  test("workers-ai maps to cloudflare preset", () => {
    const profile = resolveSpeedProfile("workers-ai");
    expect(profile.gate.batchSize).toBe(12);
  });

  test("throttles at 80% usage", () => {
    const base = resolveSpeedProfile("google");
    const throttled = resolveSpeedProfile("google", undefined, 85);
    expect(throttled.gate.maxParallel).toBeLessThan(base.gate.maxParallel!);
    expect(throttled.gate.batchSize).toBeLessThan(base.gate.batchSize!);
  });

  test("forces serial at 95% usage", () => {
    const throttled = resolveSpeedProfile("groq", undefined, 96);
    expect(throttled.gate.maxParallel).toBe(1);
    expect(throttled.full.maxParallel).toBe(1);
  });
});

describe("estimateOutputTokens", () => {
  test("scales with batch length and phase", () => {
    expect(estimateOutputTokens(4, "gate")).toBeLessThan(estimateOutputTokens(4, "full"));
    expect(estimateOutputTokens(8, "full")).toBeGreaterThan(estimateOutputTokens(4, "full"));
  });
});

describe("rate limit helpers", () => {
  test("isRateLimitError detects 429", () => {
    expect(isRateLimitError({ statusCode: 429 })).toBe(true);
    expect(isRateLimitError({ status: 429 })).toBe(true);
    expect(isRateLimitError({ status: 500 })).toBe(false);
  });

  test("splitBatchForRetry halves batches", () => {
    const [a, b] = splitBatchForRetry([1, 2, 3, 4])!;
    expect(a).toEqual([1, 2]);
    expect(b).toEqual([3, 4]);
    expect(splitBatchForRetry([1])).toBeNull();
  });
});

describe("providerFromModelSpec", () => {
  test("parses provider prefixes", () => {
    expect(providerFromModelSpec("groq/llama-3.3-70b-versatile")).toBe("groq");
    expect(providerFromModelSpec("cloudflare/@cf/meta/llama")).toBe("cloudflare");
    expect(providerFromModelSpec("claude-sonnet")).toBe("claude");
    expect(providerFromModelSpec("codex-gpt-5.5")).toBe("codex");
  });
});
