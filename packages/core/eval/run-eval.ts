#!/usr/bin/env bun
/**
 * Pattern Detection Eval — measures which LLMs actually catch which patterns.
 *
 * Sends hand-labeled fixtures through the classifier with each configured model,
 * then computes per-pattern recall and precision and outputs a comparison table.
 *
 * Usage:
 *   bun packages/core/eval/run-eval.ts                          # All available models
 *   bun packages/core/eval/run-eval.ts --models google,groq     # Specific models
 *   bun packages/core/eval/run-eval.ts --pattern S-21            # Single pattern
 *   bun packages/core/eval/run-eval.ts --difficulty obvious      # Filter by difficulty
 *   bun packages/core/eval/run-eval.ts --out results.json        # Save raw results
 *
 * Requires API keys in environment: GOOGLE_API_KEY, GROQ_API_KEY, MISTRAL_API_KEY
 */

import { createGroq } from "@ai-sdk/groq";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";
import { LLMClassifier, SYSTEM_PROMPT, splitAndHash } from "../src/index.ts";
import { getPatternByTaxonomyId, PATTERN_REGISTRY } from "../src/taxonomy/pattern-registry.ts";
import type { PatternType, SentenceClassification } from "../src/types.ts";
import { type EvalFixture, FIXTURES, getFixtureStats } from "./fixtures.ts";

// ─── CLI Args ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
function getArg(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 ? args[idx + 1] : undefined;
}

const filterModels = getArg("models")?.split(",");
const filterPattern = getArg("pattern");
const filterDifficulty = getArg("difficulty") as EvalFixture["difficulty"] | undefined;
const outFile = getArg("out");

// ─── Model Registry ─────────────────────────────────────────────────────────

interface ModelConfig {
  id: string;
  name: string;
  provider: string;
  create: () => LanguageModel | null;
}

function createGemini(apiKey: string) {
  return createOpenAICompatible({
    name: "google",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
    apiKey,
  });
}

const MODEL_CONFIGS: ModelConfig[] = [
  {
    id: "google",
    name: "Gemini 2.5 Flash",
    provider: "google",
    create: () => {
      const key = process.env.GOOGLE_API_KEY;
      return key ? createGemini(key)("gemini-2.5-flash") : null;
    },
  },
  {
    id: "groq",
    name: "Llama 3.3 70B (Groq)",
    provider: "groq",
    create: () => {
      const key = process.env.GROQ_API_KEY;
      return key ? createGroq({ apiKey: key })("llama-3.3-70b-versatile") : null;
    },
  },
  {
    id: "mistral",
    name: "Mistral Small",
    provider: "mistral",
    create: () => {
      const key = process.env.MISTRAL_API_KEY;
      if (!key) return null;
      const m = createOpenAICompatible({
        name: "mistral",
        baseURL: "https://api.mistral.ai/v1",
        apiKey: key,
      });
      return m("mistral-small-latest");
    },
  },
];

// ─── Types ──────────────────────────────────────────────────────────────────

interface FixtureResult {
  fixture_id: string;
  model: string;
  expected: PatternType[];
  detected: PatternType[];
  true_positives: PatternType[];
  false_negatives: PatternType[];
  false_positives: PatternType[];
  absent_violated: PatternType[]; // Patterns that should be absent but were detected
}

interface PatternMetrics {
  pattern: string;
  taxonomy_id: string;
  total_expected: number;
  results: Record<
    string,
    {
      true_positives: number;
      false_negatives: number;
      false_positives: number;
      recall: number;
      precision: number;
    }
  >;
}

// ─── Runner ─────────────────────────────────────────────────────────────────

async function runEval() {
  // Filter fixtures
  let fixtures = FIXTURES;
  if (filterPattern) {
    const entry = getPatternByTaxonomyId(filterPattern);
    const patternId = entry?.id ?? filterPattern;
    fixtures = fixtures.filter(
      (f) =>
        f.expected.includes(patternId as PatternType) ||
        f.absent?.includes(patternId as PatternType),
    );
  }
  if (filterDifficulty) {
    fixtures = fixtures.filter((f) => f.difficulty === filterDifficulty);
  }

  // Resolve models
  const models = MODEL_CONFIGS.filter((m) => !filterModels || filterModels.includes(m.id))
    .map((cfg) => {
      const model = cfg.create();
      return model ? { ...cfg, model } : null;
    })
    .filter((m): m is ModelConfig & { model: LanguageModel } => m !== null);

  if (models.length === 0) {
    console.error("No models available. Set GOOGLE_API_KEY, GROQ_API_KEY, or MISTRAL_API_KEY.");
    process.exit(1);
  }

  const stats = getFixtureStats();
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║        PROSODEUS PATTERN DETECTION EVAL                 ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log();
  console.log(
    `Fixtures:  ${fixtures.length} (${stats.clean} clean, ${stats.byDifficulty.obvious} obvious, ${stats.byDifficulty.subtle} subtle, ${stats.byDifficulty.decoy} decoy)`,
  );
  console.log(`Patterns:  ${stats.uniquePatterns} unique patterns in test set`);
  console.log(`Models:    ${models.map((m) => m.name).join(", ")}`);
  console.log();

  const allResults: FixtureResult[] = [];

  for (const modelCfg of models) {
    console.log(`─── Evaluating: ${modelCfg.name} ───`);
    const classifier = new LLMClassifier(modelCfg.model);

    // Classify fixtures in batches to avoid rate limits
    const batchSize = 10;
    const classifications: Map<string, SentenceClassification> = new Map();

    for (let i = 0; i < fixtures.length; i += batchSize) {
      const batch = fixtures.slice(i, i + batchSize);
      const hashed = batch.map((f, idx) => ({
        id: i + idx,
        text: f.text,
        hash: `eval-${f.id}`,
        paragraph_id: 0,
      }));

      try {
        const results = await classifier.classify(hashed);
        for (let j = 0; j < results.length; j++) {
          classifications.set(batch[j]!.id, results[j]!.classification);
        }
        process.stdout.write(
          `  Classified ${Math.min(i + batchSize, fixtures.length)}/${fixtures.length}\r`,
        );
      } catch (err) {
        console.error(`  Batch ${i / batchSize + 1} failed:`, (err as Error).message);
        // Fill with empty classifications
        for (const f of batch) {
          classifications.set(f.id, {
            biber: {
              informational: 0,
              involved: 0,
              narrative: 0,
              persuasive: 0,
              abstract: 0,
              elaborative: 0,
            },
            patterns: [],
            metrics: {
              word_count: 0,
              clause_count: 1,
              has_participial: false,
              has_relative_clause: false,
              clause_balance_ratio: 0.5,
              construction_type: "simple",
            },
            arc_role: "claim",
          });
        }
      }

      // Rate limit pause between batches
      if (i + batchSize < fixtures.length) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }
    console.log();

    // Compare against ground truth
    for (const fixture of fixtures) {
      const classification = classifications.get(fixture.id);
      if (!classification) continue;

      const detected = classification.patterns.map((p) => p.type);
      const expectedSet = new Set(fixture.expected);
      const detectedSet = new Set(detected);
      const absentSet = new Set(fixture.absent ?? []);

      const tp = fixture.expected.filter((p) => detectedSet.has(p));
      const fn = fixture.expected.filter((p) => !detectedSet.has(p));
      const fp = detected.filter((p) => !expectedSet.has(p));
      const absentViolated = detected.filter((p) => absentSet.has(p as PatternType));

      allResults.push({
        fixture_id: fixture.id,
        model: modelCfg.id,
        expected: fixture.expected,
        detected: detected as PatternType[],
        true_positives: tp,
        false_negatives: fn,
        false_positives: fp as PatternType[],
        absent_violated: absentViolated as PatternType[],
      });
    }
  }

  // ─── Compute Per-Pattern Metrics ────────────────────────────────────────

  const patternMetrics = computePatternMetrics(
    allResults,
    fixtures,
    models.map((m) => m.id),
  );

  // ─── Print Report ───────────────────────────────────────────────────────

  printReport(patternMetrics, models, fixtures);

  // ─── Print Worst Misses ─────────────────────────────────────────────────

  printWorstMisses(allResults, fixtures, models);

  // ─── Save raw results ───────────────────────────────────────────────────

  if (outFile) {
    await Bun.write(
      outFile,
      JSON.stringify(
        {
          fixtures: fixtures.length,
          models: models.map((m) => m.name),
          results: allResults,
          metrics: patternMetrics,
        },
        null,
        2,
      ),
    );
    console.log(`\nRaw results saved to ${outFile}`);
  }
}

// ─── Metrics Computation ────────────────────────────────────────────────────

function computePatternMetrics(
  results: FixtureResult[],
  fixtures: EvalFixture[],
  modelIds: string[],
): PatternMetrics[] {
  // Collect all patterns that appear in expected
  const patternIds = new Set<string>();
  for (const f of fixtures) {
    for (const p of f.expected) patternIds.add(p);
  }

  return [...patternIds].sort().map((patternId) => {
    const entry = PATTERN_REGISTRY.find((p) => p.id === patternId);
    const taxonomyId = entry?.taxonomy_id ?? "???";

    // Count how many fixtures expect this pattern
    const totalExpected = fixtures.filter((f) =>
      f.expected.includes(patternId as PatternType),
    ).length;

    // Count fixtures where this pattern should be absent (decoys)
    const totalAbsent = fixtures.filter((f) => f.absent?.includes(patternId as PatternType)).length;

    const perModel: PatternMetrics["results"] = {};

    for (const modelId of modelIds) {
      const modelResults = results.filter((r) => r.model === modelId);

      let tp = 0;
      let fn = 0;
      let fp = 0;

      for (const r of modelResults) {
        if (r.expected.includes(patternId as PatternType)) {
          if (r.detected.includes(patternId as PatternType)) tp++;
          else fn++;
        }
        if (r.absent_violated.includes(patternId as PatternType)) {
          fp++;
        }
      }

      const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
      const precision = tp + fp > 0 ? tp / (tp + fp) : 1;

      perModel[modelId] = {
        true_positives: tp,
        false_negatives: fn,
        false_positives: fp,
        recall,
        precision,
      };
    }

    return {
      pattern: patternId,
      taxonomy_id: taxonomyId,
      total_expected: totalExpected,
      results: perModel,
    };
  });
}

// ─── Report Printing ────────────────────────────────────────────────────────

function printReport(
  metrics: PatternMetrics[],
  models: Array<{ id: string; name: string }>,
  fixtures: EvalFixture[],
) {
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║                 PER-PATTERN RECALL                      ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  // Header
  const modelHeaders = models.map((m) => m.name.padEnd(20)).join(" ");
  console.log(`${"Pattern".padEnd(40)} ${"N".padStart(3)} ${modelHeaders}`);
  console.log("─".repeat(40 + 4 + models.length * 21));

  for (const m of metrics) {
    const label = `${m.taxonomy_id} ${m.pattern}`.padEnd(40);
    const n = String(m.total_expected).padStart(3);
    const scores = models
      .map((model) => {
        const r = m.results[model.id];
        if (!r) return "  N/A".padEnd(20);
        const pct = Math.round(r.recall * 100);
        const bar = pct >= 80 ? "██" : pct >= 50 ? "▓▓" : pct >= 25 ? "░░" : "  ";
        return `${bar} ${pct}% (${r.true_positives}/${r.true_positives + r.false_negatives})`.padEnd(
          20,
        );
      })
      .join(" ");
    console.log(`${label} ${n} ${scores}`);
  }

  // Summary
  console.log("\n─".repeat(40 + 4 + models.length * 21));
  for (const model of models) {
    let totalTP = 0;
    let totalFN = 0;
    let totalFP = 0;
    for (const m of metrics) {
      const r = m.results[model.id];
      if (r) {
        totalTP += r.true_positives;
        totalFN += r.false_negatives;
        totalFP += r.false_positives;
      }
    }
    const overallRecall = totalTP + totalFN > 0 ? totalTP / (totalTP + totalFN) : 0;
    const overallPrecision = totalTP + totalFP > 0 ? totalTP / (totalTP + totalFP) : 1;
    console.log(
      `${model.name.padEnd(40)} Overall recall: ${(overallRecall * 100).toFixed(1)}%  precision: ${(overallPrecision * 100).toFixed(1)}%  (TP=${totalTP} FN=${totalFN} FP=${totalFP})`,
    );
  }

  // Clean sentence precision
  const cleanFixtures = fixtures.filter((f) => f.expected.length === 0);
  if (cleanFixtures.length > 0) {
    console.log(`\n${"Clean Sentence Precision".padEnd(40)}`);
    for (const model of models) {
      const cleanResults = cleanFixtures.map((f) => {
        // Find the result for this fixture+model — we'd need to thread results through
        // For now, approximate from false positives
      });
    }
  }
}

function printWorstMisses(
  results: FixtureResult[],
  fixtures: EvalFixture[],
  models: Array<{ id: string; name: string }>,
) {
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║              WORST MISSES (FN details)                  ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  // Find fixtures with the most false negatives across all models
  const fixtureScores: Array<{ fixture: EvalFixture; totalFN: number; details: string[] }> = [];

  for (const fixture of fixtures) {
    if (fixture.expected.length === 0) continue;
    let totalFN = 0;
    const details: string[] = [];

    for (const model of models) {
      const result = results.find((r) => r.fixture_id === fixture.id && r.model === model.id);
      if (result && result.false_negatives.length > 0) {
        totalFN += result.false_negatives.length;
        details.push(`  ${model.name}: missed [${result.false_negatives.join(", ")}]`);
      }
    }

    if (totalFN > 0) {
      fixtureScores.push({ fixture, totalFN, details });
    }
  }

  // Sort by worst misses
  fixtureScores.sort((a, b) => b.totalFN - a.totalFN);

  // Print top 15
  for (const { fixture, details } of fixtureScores.slice(0, 15)) {
    console.log(`${fixture.id} (expected: [${fixture.expected.join(", ")}])`);
    console.log(`  "${fixture.text.slice(0, 100)}${fixture.text.length > 100 ? "..." : ""}"`);
    for (const d of details) console.log(d);
    console.log();
  }

  // Print absent violations (false positives on decoys)
  const absentViolations = results.filter((r) => r.absent_violated.length > 0);
  if (absentViolations.length > 0) {
    console.log("╔══════════════════════════════════════════════════════════╗");
    console.log("║          DECOY VIOLATIONS (false positives)             ║");
    console.log("╚══════════════════════════════════════════════════════════╝\n");
    for (const r of absentViolations) {
      const fixture = fixtures.find((f) => f.id === r.fixture_id);
      const model = models.find((m) => m.id === r.model);
      console.log(
        `${r.fixture_id} — ${model?.name}: falsely detected [${r.absent_violated.join(", ")}]`,
      );
      console.log(`  "${fixture?.text.slice(0, 100)}..."`);
      console.log();
    }
  }
}

// ─── Run ────────────────────────────────────────────────────────────────────

await runEval();
