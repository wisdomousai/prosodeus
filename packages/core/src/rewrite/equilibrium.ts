import { generateText, type LanguageModel } from "ai";
import type { SentenceClassifier } from "../analysis/analyze.ts";
import { classifyParagraphs, type ParagraphAnalysis } from "../analysis/paragraph-purpose.ts";
import { assembleProfile } from "../analysis/profile.ts";
import { computeDelta, loadStyleGuide } from "../analysis/style-guide.ts";
import { computeHeat } from "../classification/classifier.ts";
import { computeAutocorrelation, computeDeviceEntropy, countWords } from "../text/math.ts";
import { splitAndHash } from "../text/splitter.ts";
import type { ClassifiedSentence, HotRegion, PatternType, StylometricProfile } from "../types.ts";
import { buildNegativeConstraints, buildPositiveTargets } from "./pce.ts";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface StructuralSketch {
  region: { start: number; end: number };
  description: string;
  predicted_heat_reduction: number;
}

export interface CouncilRound {
  round: number;
  sketches: StructuralSketch[];
  simulated_heat: number;
  simulated_entropy: number;
  converged: boolean;
}

export interface EquilibriumResult {
  rounds: CouncilRound[];
  converged: boolean;
  final_heat: number;
  final_entropy: number;
  blueprint: StructuralSketch[];
  paragraph_purposes: ParagraphAnalysis[];
  cost_estimate: { council_tokens: number; classifier_tokens: number };
}

export interface FindEquilibriumOptions {
  profile: StylometricProfile;
  style?: string;
  councilModels: LanguageModel[];
  classifier: SentenceClassifier;
  maxRounds?: number;
  onProgress?: (round: CouncilRound) => void;
}

// ─── Council Sketch Prompt ──────────────────────────────────────────────────

const SKETCH_SYSTEM = `You are a structural writing advisor. Given a problematic passage and its issues, propose STRUCTURAL changes — not actual prose.

Respond with ONLY valid JSON:
{"sketches": [
  {"description": "what structural change to make", "predicted_heat_reduction": 0.5}
]}

Rules:
- Describe structural changes: "Break the 3-clause balanced sentence into 2 asymmetric sentences", "Replace the binary contrast with a causal chain"
- Do NOT write actual prose
- Estimate heat reduction per change (0.1 to 2.0)
- Focus on the highest-impact changes first
- Maximum 3 sketches per region`;

// ─── Engine ─────────────────────────────────────────────────────────────────

/**
 * Find document-level structural equilibrium using cheap council models.
 *
 * Per round:
 * 1. Identify hot regions from current profile
 * 2. Council models produce structural sketches (not prose)
 * 3. Simulate new metrics with sketched replacements
 * 4. Check convergence against style guide targets
 * 5. Adjust constraints and repeat (max 5 rounds)
 */
export async function findEquilibrium(options: FindEquilibriumOptions): Promise<EquilibriumResult> {
  const { profile, style, councilModels, classifier, maxRounds = 5, onProgress } = options;

  const paragraphPurposes = classifyParagraphs(profile.sentences);

  // Style guide targets for convergence check
  const guide = style ? loadStyleGuide(style) : undefined;
  const targetHeat = guide ? 2.0 : 2.5;
  const targetEntropy = guide?.targets.device_entropy.min ?? 2.0;

  const rounds: CouncilRound[] = [];
  const allSketches: StructuralSketch[] = [];

  let currentHeat = profile.mean_heat;
  let currentEntropy = profile.global_device_entropy;
  const currentProfile = profile;
  let totalCouncilTokens = 0;
  const totalClassifierTokens = 0;

  for (let round = 0; round < maxRounds; round++) {
    // 1. Check convergence
    if (currentHeat <= targetHeat && currentEntropy >= targetEntropy) {
      const result: CouncilRound = {
        round,
        sketches: [],
        simulated_heat: currentHeat,
        simulated_entropy: currentEntropy,
        converged: true,
      };
      rounds.push(result);
      onProgress?.(result);
      break;
    }

    // 2. Identify hot regions
    const hotRegions = currentProfile.hot_regions;
    if (hotRegions.length === 0) {
      const result: CouncilRound = {
        round,
        sketches: [],
        simulated_heat: currentHeat,
        simulated_entropy: currentEntropy,
        converged: true,
      };
      rounds.push(result);
      onProgress?.(result);
      break;
    }

    // 3. Get council sketches for top hot regions
    const topRegions = hotRegions.slice(0, 3);
    const roundSketches: StructuralSketch[] = [];

    // Round-robin across council models
    const councilModel = councilModels[round % councilModels.length]!;

    for (const region of topRegions) {
      const regionSentences = currentProfile.sentences.filter(
        (s) => s.id >= region.start_sentence && s.id <= region.end_sentence,
      );
      const passage = regionSentences.map((s) => s.text).join(" ");
      const avoid = buildNegativeConstraints(regionSentences);

      // Find paragraph purpose for this region
      const regionPurpose = paragraphPurposes.find((p) =>
        regionSentences.some((s) => s.paragraph_id === p.paragraph_id),
      );

      const prompt = [
        `PASSAGE (heat: ${region.heat}/10):`,
        passage,
        "",
        `PARAGRAPH PURPOSE: ${regionPurpose?.purpose ?? "analytical"}`,
        "",
        "ISSUES:",
        ...avoid.map((a) => `- ${a}`),
        "",
        `TARGET: Reduce heat below ${targetHeat}, increase device entropy above ${targetEntropy}`,
      ].join("\n");

      try {
        const { text: raw, usage } = await generateText({
          model: councilModel,
          system: SKETCH_SYSTEM,
          prompt,
          maxOutputTokens: 1024,
        });

        totalCouncilTokens += usage?.totalTokens ?? 0;

        const sketches = parseSketchResponse(raw, region);
        roundSketches.push(...sketches);
      } catch {}
    }

    allSketches.push(...roundSketches);

    // 4. Simulate new metrics
    // Estimate: each sketch reduces heat by its predicted amount
    const totalReduction = roundSketches.reduce((sum, s) => sum + s.predicted_heat_reduction, 0);
    const simulatedHeat = Math.max(0, currentHeat - totalReduction * 0.6); // 60% of predicted (conservative)
    const simulatedEntropy = currentEntropy + roundSketches.length * 0.1; // slight entropy increase per change

    currentHeat = simulatedHeat;
    currentEntropy = Math.min(4.0, simulatedEntropy);

    const converged = currentHeat <= targetHeat && currentEntropy >= targetEntropy;

    const result: CouncilRound = {
      round,
      sketches: roundSketches,
      simulated_heat: Math.round(simulatedHeat * 10) / 10,
      simulated_entropy: Math.round(simulatedEntropy * 1000) / 1000,
      converged,
    };
    rounds.push(result);
    onProgress?.(result);

    if (converged) break;
  }

  const converged = rounds.length > 0 && rounds[rounds.length - 1]!.converged;

  // Deduplicate and rank blueprint by impact
  const blueprint = deduplicateSketches(allSketches).sort(
    (a, b) => b.predicted_heat_reduction - a.predicted_heat_reduction,
  );

  return {
    rounds,
    converged,
    final_heat: Math.round(currentHeat * 10) / 10,
    final_entropy: Math.round(currentEntropy * 1000) / 1000,
    blueprint,
    paragraph_purposes: paragraphPurposes,
    cost_estimate: {
      council_tokens: totalCouncilTokens,
      classifier_tokens: totalClassifierTokens,
    },
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseSketchResponse(raw: string, region: HotRegion): StructuralSketch[] {
  try {
    let cleaned = raw.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
    const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) cleaned = fence[1]!.trim();

    const start = cleaned.search(/[[{]/);
    if (start >= 0) cleaned = cleaned.slice(start);
    // Trim trailing text
    const lastBracket = Math.max(cleaned.lastIndexOf("]"), cleaned.lastIndexOf("}"));
    if (lastBracket >= 0) cleaned = cleaned.slice(0, lastBracket + 1);

    cleaned = cleaned.replace(/,(\s*[}\]])/g, "$1");

    const parsed = JSON.parse(cleaned);
    const sketches = parsed.sketches ?? parsed;

    if (!Array.isArray(sketches)) return [];

    return sketches
      .filter((s: unknown) => s && typeof s === "object")
      .slice(0, 3)
      .map((s: Record<string, unknown>) => ({
        region: { start: region.start_sentence, end: region.end_sentence },
        description: typeof s.description === "string" ? s.description : "Structural adjustment",
        predicted_heat_reduction:
          typeof s.predicted_heat_reduction === "number"
            ? Math.max(0.1, Math.min(2.0, s.predicted_heat_reduction))
            : 0.5,
      }));
  } catch {
    return [];
  }
}

function deduplicateSketches(sketches: StructuralSketch[]): StructuralSketch[] {
  const seen = new Set<string>();
  return sketches.filter((s) => {
    const key = `${s.region.start}-${s.region.end}:${s.description.slice(0, 50)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
