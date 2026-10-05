import type { HotRegion, StylometricProfile } from "../types.ts";

// ─── Types ──────────────────────────────────────────────────────────────────

export type ModelTier = "cheap" | "mid" | "expensive";

export interface ModelCost {
  /** Cost per 1M input tokens in USD */
  input_per_million: number;
  /** Cost per 1M output tokens in USD */
  output_per_million: number;
}

export interface Intervention {
  region: { start: number; end: number };
  predicted_impact: number; // heat reduction
  estimated_tokens: number;
  estimated_cost: number;
  tier: ModelTier;
  /** Impact per dollar — higher is better */
  efficiency: number;
}

export interface CostReport {
  interventions: Intervention[];
  total_tokens: number;
  total_cost: number;
  /** How the interventions were sorted */
  strategy: "impact_per_dollar" | "impact_first";
}

// ─── Known Model Costs (approximate, USD per 1M tokens) ────────────────────

const MODEL_COSTS: Record<string, ModelCost> = {
  // Cheap (council tier)
  "google/gemma-3-1b-it": { input_per_million: 0.04, output_per_million: 0.08 },
  "qwen/qwen3-32b": { input_per_million: 0.2, output_per_million: 0.2 },
  "mistral-small-latest": { input_per_million: 0.2, output_per_million: 0.6 },
  // Mid (PCE/classification tier)
  "claude-haiku-4-5-20251001": { input_per_million: 1.0, output_per_million: 5.0 },
  "gpt-4o-mini": { input_per_million: 0.15, output_per_million: 0.6 },
  // Expensive (rewrite tier)
  "claude-sonnet-4-6": { input_per_million: 3.0, output_per_million: 15.0 },
  "gpt-4o": { input_per_million: 2.5, output_per_million: 10.0 },
  "claude-opus-4-6": { input_per_million: 15.0, output_per_million: 75.0 },
};

/**
 * Classify a model into a cost tier based on its ID.
 */
export function classifyModelTier(modelId: string): ModelTier {
  const lower = modelId.toLowerCase();
  if (lower.includes("gemma") || lower.includes("1b") || lower.includes("3b")) return "cheap";
  if (lower.includes("haiku") || lower.includes("mini") || lower.includes("small")) return "mid";
  if (lower.includes("qwen") || lower.includes("llama")) return "cheap";
  return "expensive";
}

/**
 * Get the cost per token for a model. Returns a default if unknown.
 */
export function getModelCost(modelId: string): ModelCost {
  // Check exact match
  if (MODEL_COSTS[modelId]) return MODEL_COSTS[modelId]!;

  // Check partial match
  for (const [key, cost] of Object.entries(MODEL_COSTS)) {
    if (modelId.includes(key) || key.includes(modelId)) return cost;
  }

  // Default based on tier
  const tier = classifyModelTier(modelId);
  switch (tier) {
    case "cheap":
      return { input_per_million: 0.1, output_per_million: 0.2 };
    case "mid":
      return { input_per_million: 0.5, output_per_million: 2.0 };
    case "expensive":
      return { input_per_million: 3.0, output_per_million: 15.0 };
  }
}

/**
 * Estimate token count for a text string (rough approximation: 1 token ≈ 4 chars).
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Estimate cost in USD for a given token count and model.
 */
export function estimateCost(inputTokens: number, outputTokens: number, modelId: string): number {
  const cost = getModelCost(modelId);
  return (
    (inputTokens * cost.input_per_million + outputTokens * cost.output_per_million) / 1_000_000
  );
}

/**
 * Rank hot regions by impact-per-token and generate an intervention plan.
 * Returns interventions sorted by efficiency (best bang-for-buck first).
 */
export function planInterventions(
  profile: StylometricProfile,
  rewriteModelId: string,
  budget?: number,
): CostReport {
  const interventions: Intervention[] = [];
  const cost = getModelCost(rewriteModelId);
  const tier = classifyModelTier(rewriteModelId);

  for (const region of profile.hot_regions) {
    const regionSentences = profile.sentences.filter(
      (s) => s.id >= region.start_sentence && s.id <= region.end_sentence,
    );
    const passageText = regionSentences.map((s) => s.text).join(" ");
    const inputTokens = estimateTokens(passageText) + 500; // prompt overhead
    const outputTokens = estimateTokens(passageText) * 1.2; // roughly same length output
    const estimatedCost =
      (inputTokens * cost.input_per_million + outputTokens * cost.output_per_million) / 1_000_000;

    const predictedImpact = region.heat * 0.5; // conservative: fix half the heat
    const efficiency = estimatedCost > 0 ? predictedImpact / estimatedCost : 0;

    interventions.push({
      region: { start: region.start_sentence, end: region.end_sentence },
      predicted_impact: Math.round(predictedImpact * 10) / 10,
      estimated_tokens: Math.round(inputTokens + outputTokens),
      estimated_cost: Math.round(estimatedCost * 1_000_000) / 1_000_000, // 6 decimals
      tier,
      efficiency: Math.round(efficiency * 100) / 100,
    });
  }

  // Sort by efficiency (impact per dollar)
  interventions.sort((a, b) => b.efficiency - a.efficiency);

  // Apply budget constraint if provided
  let selected = interventions;
  if (budget !== undefined) {
    selected = [];
    let spent = 0;
    for (const i of interventions) {
      if (spent + i.estimated_cost > budget) continue;
      selected.push(i);
      spent += i.estimated_cost;
    }
  }

  return {
    interventions: selected,
    total_tokens: selected.reduce((sum, i) => sum + i.estimated_tokens, 0),
    total_cost:
      Math.round(selected.reduce((sum, i) => sum + i.estimated_cost, 0) * 1_000_000) / 1_000_000,
    strategy: "impact_per_dollar",
  };
}
