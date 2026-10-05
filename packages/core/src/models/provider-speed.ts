import type { ClassifierOptions } from "../classification/classifier.ts";

export type ClassifyPhase = "gate" | "medium" | "full";

export interface ProviderSpeedProfile {
  gate: ClassifierOptions;
  full: ClassifierOptions;
  medium: ClassifierOptions;
}

interface SpeedPreset {
  gate: { batchSize: number; maxParallel: number };
  full: { batchSize: number; maxParallel: number };
}

const PRESETS: Record<string, SpeedPreset> = {
  groq: { gate: { batchSize: 8, maxParallel: 2 }, full: { batchSize: 4, maxParallel: 1 } },
  google: { gate: { batchSize: 16, maxParallel: 3 }, full: { batchSize: 12, maxParallel: 3 } },
  cloudflare: { gate: { batchSize: 12, maxParallel: 2 }, full: { batchSize: 8, maxParallel: 2 } },
  mistral: { gate: { batchSize: 10, maxParallel: 2 }, full: { batchSize: 6, maxParallel: 2 } },
  openai: { gate: { batchSize: 10, maxParallel: 2 }, full: { batchSize: 8, maxParallel: 2 } },
  moonshot: { gate: { batchSize: 8, maxParallel: 2 }, full: { batchSize: 6, maxParallel: 2 } },
  claude: { gate: { batchSize: 8, maxParallel: 1 }, full: { batchSize: 8, maxParallel: 1 } },
  // Codex CLI has high fixed startup/context cost per exec call, so keep it
  // serial but use larger batches to amortize that cost.
  codex: { gate: { batchSize: 24, maxParallel: 1 }, full: { batchSize: 12, maxParallel: 1 } },
};

const DEFAULT_PRESET: SpeedPreset = {
  gate: { batchSize: 12, maxParallel: 2 },
  full: { batchSize: 12, maxParallel: 2 },
};

/** Estimate max output tokens from batch size and classify phase. */
export function estimateOutputTokens(batchLen: number, phase: ClassifyPhase): number {
  const perSentence = phase === "gate" ? 80 : phase === "medium" ? 200 : 400;
  const base = phase === "gate" ? 256 : phase === "medium" ? 512 : 1024;
  return Math.min(phase === "full" ? 16384 : 8192, base + batchLen * perSentence);
}

function applyUsageThrottle(preset: SpeedPreset, usagePct?: number): SpeedPreset {
  if (usagePct == null || usagePct < 80) return preset;
  const scale = usagePct >= 95 ? { batch: 0.5, parallel: 1 } : { batch: 0.75, parallel: 0.5 };
  return {
    gate: {
      batchSize: Math.max(1, Math.floor(preset.gate.batchSize * scale.batch)),
      maxParallel:
        usagePct >= 95 ? 1 : Math.max(1, Math.floor(preset.gate.maxParallel * scale.parallel)),
    },
    full: {
      batchSize: Math.max(1, Math.floor(preset.full.batchSize * scale.batch)),
      maxParallel:
        usagePct >= 95 ? 1 : Math.max(1, Math.floor(preset.full.maxParallel * scale.parallel)),
    },
  };
}

function normalizeProvider(provider: string): string {
  if (provider === "workers-ai") return "cloudflare";
  return provider.toLowerCase();
}

export function resolveSpeedProfile(
  provider: string,
  _modelId?: string,
  usagePct?: number,
): ProviderSpeedProfile {
  const key = normalizeProvider(provider);
  const base = PRESETS[key] ?? DEFAULT_PRESET;
  const preset = applyUsageThrottle(base, usagePct);

  const toOpts = (
    p: { batchSize: number; maxParallel: number },
    phase: ClassifyPhase,
  ): ClassifierOptions => ({
    batchSize: p.batchSize,
    maxParallel: p.maxParallel,
    maxOutputTokens: estimateOutputTokens(p.batchSize, phase),
  });

  return {
    gate: toOpts(preset.gate, "gate"),
    medium: toOpts(
      {
        batchSize: Math.max(4, Math.floor(preset.full.batchSize * 0.75)),
        maxParallel: preset.full.maxParallel,
      },
      "medium",
    ),
    full: toOpts(preset.full, "full"),
  };
}

export function providerFromModelSpec(spec: string): string {
  if (spec.startsWith("claude")) return "claude";
  if (spec.startsWith("codex")) return "codex";
  if (spec.startsWith("cloudflare/")) return "cloudflare";
  const slashIdx = spec.indexOf("/");
  return slashIdx > 0 ? spec.slice(0, slashIdx) : spec;
}

/** True when an error looks like a rate-limit (429). */
export function isRateLimitError(err: unknown): boolean {
  const status =
    (err as { statusCode?: number })?.statusCode ?? (err as { status?: number })?.status;
  if (status === 429) return true;
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return /too many requests|resource_exhausted|quota exceeded|rate limit/i.test(msg);
}

/** Auth or quota errors — try the next BYOK provider instead of failing. */
export function isRetryableProviderError(err: unknown): boolean {
  if (isRateLimitError(err)) return true;
  if (err && typeof err === "object") {
    const e = err as {
      statusCode?: number;
      message?: string;
      lastError?: unknown;
      errors?: unknown[];
    };
    if (e.statusCode === 401 || e.statusCode === 403) return true;
    if (
      typeof e.message === "string" &&
      /invalid authentication|invalid_authentication|unauthorized/i.test(e.message)
    ) {
      return true;
    }
    if (e.lastError && isRetryableProviderError(e.lastError)) return true;
    if (Array.isArray(e.errors) && e.errors.some(isRetryableProviderError)) return true;
  }
  return false;
}

/** Split a batch in half for retry after rate limiting. */
export function splitBatchForRetry<T>(items: T[]): [T[], T[]] | null {
  if (items.length <= 1) return null;
  const mid = Math.ceil(items.length / 2);
  return [items.slice(0, mid), items.slice(mid)];
}
