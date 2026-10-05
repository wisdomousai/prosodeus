import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/** Known free-tier daily request limits (approximate). */
export const PROVIDER_DAILY_LIMITS: Record<string, number> = {
  google: 1000,
  groq: 14400,
  mistral: 500,
  cloudflare: 10000,
  openai: 500,
};

interface UsageFile {
  /** ISO date (UTC) → provider → call count */
  days: Record<string, Record<string, number>>;
}

const USAGE_PATH = join(homedir(), ".prosodeus", "usage.json");

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function readUsage(): UsageFile {
  if (!existsSync(USAGE_PATH)) return { days: {} };
  try {
    return JSON.parse(readFileSync(USAGE_PATH, "utf-8")) as UsageFile;
  } catch {
    return { days: {} };
  }
}

function writeUsage(data: UsageFile) {
  const dir = join(homedir(), ".prosodeus");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(USAGE_PATH, JSON.stringify(data, null, 2), { mode: 0o600 });
}

export function incrementProviderUsage(provider: string, count = 1): void {
  const day = todayUtc();
  const usage = readUsage();
  if (!usage.days[day]) usage.days[day] = {};
  usage.days[day][provider] = (usage.days[day][provider] ?? 0) + count;
  writeUsage(usage);
}

export interface ProviderUsageSnapshot {
  provider: string;
  count: number;
  limit: number | null;
  pct: number | null;
  nearLimit: boolean;
}

export function getProviderUsage(provider: string): ProviderUsageSnapshot {
  const day = todayUtc();
  const usage = readUsage();
  const count = usage.days[day]?.[provider] ?? 0;
  const limit = PROVIDER_DAILY_LIMITS[provider] ?? null;
  const pct = limit ? Math.round((count / limit) * 100) : null;
  return {
    provider,
    count,
    limit,
    pct,
    nearLimit: limit !== null && count / limit >= 0.8,
  };
}

export function getAllProviderUsage(): ProviderUsageSnapshot[] {
  const day = todayUtc();
  const usage = readUsage();
  const providers = new Set([
    ...Object.keys(PROVIDER_DAILY_LIMITS),
    ...Object.keys(usage.days[day] ?? {}),
  ]);
  return [...providers]
    .map((p) => getProviderUsage(p))
    .filter((s) => s.count > 0 || s.limit !== null);
}

export function getUsagePct(provider: string): number | undefined {
  const snap = getProviderUsage(provider);
  return snap.pct ?? undefined;
}
