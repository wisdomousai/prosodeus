import { CODEX_DEFAULT_MODEL_SPEC } from "./codex-config.ts";
import type { MoonshotKeyKind } from "./moonshot-config.ts";

/** Which pipeline stages a model is appropriate for. */
export type LlmTask = "gate" | "classify" | "suggest" | "rewrite";

/** Per-model max-output formula for structured suggest (`generateText`). */
export interface SuggestOutputProfile {
  sentenceMax: number;
  sentenceBase: number;
  sentencePerPattern: number;
  paragraphMax: number;
  batchBase: number;
  batchPerAlt: number;
  batchMax: number;
}

export interface ModelCapability {
  tasks: LlmTask[];
  suggestOutput: SuggestOutputProfile;
}

/** Fast models: compact JSON rewrites, no hidden reasoning budget. */
export const STANDARD_SUGGEST_OUTPUT: SuggestOutputProfile = {
  sentenceMax: 8192,
  sentenceBase: 4096,
  sentencePerPattern: 256,
  paragraphMax: 8192,
  batchBase: 4096,
  batchPerAlt: 400,
  batchMax: 16384,
};

/** Reasoning models: full output budget for thinking + JSON (Kimi Code, etc.). */
export const THINKING_SUGGEST_OUTPUT: SuggestOutputProfile = {
  sentenceMax: 65536,
  sentenceBase: 65536,
  sentencePerPattern: 0,
  paragraphMax: 65536,
  batchBase: 65536,
  batchPerAlt: 0,
  batchMax: 65536,
};

/** Per-model suggest output overrides — add entries here, not in suggest.ts. */
export const SUGGEST_OUTPUT_BY_SPEC: Readonly<Record<string, SuggestOutputProfile>> = {
  "moonshot/kimi-for-coding": THINKING_SUGGEST_OUTPUT,
  "groq/qwen/qwen3-32b": STANDARD_SUGGEST_OUTPUT,
  "mistral/mistral-medium-latest": STANDARD_SUGGEST_OUTPUT,
  "mistral/mistral-small-2506": STANDARD_SUGGEST_OUTPUT,
  "moonshot/kimi-k2.6": STANDARD_SUGGEST_OUTPUT,
  "moonshot/kimi-k2-turbo-preview": STANDARD_SUGGEST_OUTPUT,
  "openai/gpt-4o-mini": STANDARD_SUGGEST_OUTPUT,
  [CODEX_DEFAULT_MODEL_SPEC]: STANDARD_SUGGEST_OUTPUT,
  "google/gemini-2.5-flash": STANDARD_SUGGEST_OUTPUT,
  "google/gemini-2.5-pro": STANDARD_SUGGEST_OUTPUT,
};

const DEFAULT_CAPABILITY: ModelCapability = {
  tasks: ["classify", "suggest", "rewrite"],
  suggestOutput: STANDARD_SUGGEST_OUTPUT,
};

/** Specs for background suggest when no toolbar model is selected — Google last. */
export const SUGGEST_CAPABLE_SPECS = [
  "groq/qwen/qwen3-32b",
  "mistral/mistral-medium-latest",
  "mistral/mistral-small-2506",
  "moonshot/kimi-k2.6",
  "moonshot/kimi-k2-turbo-preview",
  "moonshot/kimi-for-coding",
  "openai/gpt-4o-mini",
  "google/gemini-2.5-flash",
  "google/gemini-2.5-pro",
] as const;

export function suggestOutputForSpec(
  spec: string,
  moonshotKind?: MoonshotKeyKind,
): SuggestOutputProfile {
  if (moonshotKind === "coding" && spec.startsWith("moonshot/")) {
    return SUGGEST_OUTPUT_BY_SPEC["moonshot/kimi-for-coding"] ?? THINKING_SUGGEST_OUTPUT;
  }
  return SUGGEST_OUTPUT_BY_SPEC[spec] ?? STANDARD_SUGGEST_OUTPUT;
}

export function modelCapabilityForSpec(
  spec: string,
  moonshotKind?: MoonshotKeyKind,
): ModelCapability {
  const suggestOutput = suggestOutputForSpec(spec, moonshotKind);
  if (spec.startsWith("claude") || spec.startsWith("codex")) {
    return { tasks: ["classify", "suggest", "rewrite"], suggestOutput };
  }
  if (
    spec.includes("kimi-for-coding") ||
    (spec.startsWith("moonshot/") && moonshotKind === "coding")
  ) {
    return { tasks: ["classify", "suggest", "rewrite"], suggestOutput };
  }
  if (spec.startsWith("moonshot/")) {
    return { tasks: ["classify", "suggest", "rewrite"], suggestOutput };
  }
  return { ...DEFAULT_CAPABILITY, suggestOutput };
}

export function supportsTask(spec: string, task: LlmTask, moonshotKind?: MoonshotKeyKind): boolean {
  return modelCapabilityForSpec(spec, moonshotKind).tasks.includes(task);
}

export interface SuggestModelResolution {
  spec: string;
  /** User picked a model unsuitable for structured suggest — we routed elsewhere. */
  notice?: string;
}

/**
 * Pick a model for structured suggest when the toolbar has no selection.
 * When the user picks a model, the caller must use that spec directly.
 */
export function resolveSuggestCapableSpec(
  preferred: string | undefined,
  available: (spec: string) => boolean,
  moonshotKind?: MoonshotKeyKind,
): SuggestModelResolution | null {
  if (preferred) {
    if (available(preferred)) return { spec: preferred };
    return null;
  }

  for (const spec of SUGGEST_CAPABLE_SPECS) {
    if (available(spec)) return { spec };
  }

  return null;
}
