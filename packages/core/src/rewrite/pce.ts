import { generateText, type LanguageModel } from "ai";
import { loadStyleGuide } from "../analysis/style-guide.ts";
import { getPCEDirective } from "../taxonomy/pattern-registry.ts";
import type {
  ClassifiedSentence,
  PatternType,
  PCEResult,
  PropositionGraph,
  StylometricProfile,
} from "../types.ts";

const PCE_SYSTEM_PROMPT = `You are a structural decomposition engine. Given a passage of text, extract its propositional content — the factual and logical substance — stripped of all stylistic choices.

Respond with ONLY valid JSON in this format:
{
  "propositions": {
    "propositions": [
      {"subject": "...", "predicate": "...", "object": "...", "modifiers": ["..."]}
    ],
    "logical_flow": ["1 CAUSES 2", "3 CONTRASTS 4"]
  }
}

Rules:
- Each proposition is one atomic claim (subject + predicate + optional object)
- Strip all rhetorical devices, hedging, inflation, and transitions
- Preserve factual content and logical relationships exactly
- logical_flow uses: CAUSES, ENABLES, CONTRASTS, ELABORATES, EXEMPLIFIES, FOLLOWS
- Do NOT add, remove, or alter any factual claims`;

/**
 * Extract propositional content from a passage.
 * Channel 1 of the three-channel decomposition.
 */
export async function extractPropositions(
  text: string,
  model: LanguageModel,
): Promise<PropositionGraph> {
  const { text: raw } = await generateText({
    model,
    system: PCE_SYSTEM_PROMPT,
    prompt: text,
    maxOutputTokens: 4096,
  });

  try {
    // Strip think tags and fences
    let cleaned = raw.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
    const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) cleaned = fence[1]!.trim();

    const start = cleaned.search(/[[{]/);
    if (start >= 0) cleaned = cleaned.slice(start);

    const parsed = JSON.parse(cleaned);
    const graph = parsed.propositions ?? parsed;

    return {
      propositions: Array.isArray(graph.propositions) ? graph.propositions : [],
      logical_flow: Array.isArray(graph.logical_flow) ? graph.logical_flow : [],
    };
  } catch {
    // Fallback: treat each sentence as a proposition
    return {
      propositions: text
        .split(/[.!?]+/)
        .filter(Boolean)
        .map((s) => ({
          subject: s.trim(),
          predicate: "states",
        })),
      logical_flow: [],
    };
  }
}

/**
 * Build negative constraints (Channel 2) from the profile's detected patterns.
 * Uses PCE directives from the pattern registry.
 */
export function buildNegativeConstraints(sentences: ClassifiedSentence[]): string[] {
  const patternCounts: Record<string, number> = {};
  for (const s of sentences) {
    for (const p of s.classification.patterns) {
      patternCounts[p.type] = (patternCounts[p.type] ?? 0) + 1;
    }
  }

  return Object.entries(patternCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([type]) => getPCEDirective(type))
    .filter(Boolean);
}

/**
 * Build positive style targets (Channel 3) from the style guide and profile metrics.
 */
export function buildPositiveTargets(profile: StylometricProfile, styleName?: string): string[] {
  const targets: string[] = [];

  if (profile.global_sentence_length_autocorrelation > 0.25) {
    targets.push("Vary sentence lengths — alternate short (5-8 words) and long (20-35 words)");
  }

  if (profile.global_device_entropy < 2.0) {
    targets.push(
      "Mix rhetorical structures — use questions, fragments, inversions, not just declaratives",
    );
  }

  if (profile.convergence_slope < -0.05) {
    targets.push(
      "Maintain structural variety throughout — don't let the writing flatten toward the end",
    );
  }

  if (styleName) {
    const guide = loadStyleGuide(styleName);
    if (guide) {
      targets.push(
        `Target sentence length std dev: ${guide.targets.sentence_length.std_dev}+ words`,
      );
      targets.push(`Target device entropy: ${guide.targets.device_entropy.min}+`);
      if (guide.targets.sentence_length_autocorrelation.max_rho < 0.3) {
        targets.push(
          `Keep rhythm autocorrelation below ${guide.targets.sentence_length_autocorrelation.max_rho}`,
        );
      }
    }
  }

  return targets;
}

/**
 * Full PCE pipeline: extract propositions + build negative/positive constraints.
 */
export async function runPCE(
  passage: string,
  sentences: ClassifiedSentence[],
  profile: StylometricProfile,
  model: LanguageModel,
  styleName?: string,
): Promise<PCEResult> {
  const propositions = await extractPropositions(passage, model);
  const avoid = buildNegativeConstraints(sentences);
  const targets = buildPositiveTargets(profile, styleName);

  return { propositions, avoid, targets };
}
