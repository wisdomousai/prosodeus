#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { createGroq } from "@ai-sdk/groq";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { ClassifiedSentence, HashedSentence, StylometricProfile } from "@prosodeus/core";
import {
  AgentSDKClassifier,
  analyze,
  generateConstraints,
  generateHtmlReport,
  LLMClassifier,
  LocalCache,
  listStyleGuides,
  NullCache,
  rewriteOppositions,
  splitAndHash,
} from "@prosodeus/core";
import type { LanguageModel } from "ai";
import { Command } from "commander";

// ─── Classifier creation ────────────────────────────────────────────────────

interface Classifier {
  classify(sentences: HashedSentence[]): Promise<ClassifiedSentence[]>;
}

function createClassifier(providerName: string): Classifier {
  if (providerName === "claude") {
    const modelId = process.env.PROSODEUS_MODEL ?? "claude-haiku-4-5";
    return new AgentSDKClassifier({ model: modelId });
  }
  const model = createModel(providerName);
  return new LLMClassifier(model);
}

function createModel(providerName: string): LanguageModel {
  const modelId = process.env.PROSODEUS_MODEL;

  switch (providerName) {
    case "groq": {
      const apiKey = process.env.GROQ_API_KEY ?? process.env.PROSODEUS_PROVIDER_KEY;
      if (!apiKey) {
        console.error("Error: GROQ_API_KEY or PROSODEUS_PROVIDER_KEY required");
        process.exit(1);
      }
      const groq = createGroq({ apiKey });
      return groq(modelId ?? "qwen/qwen3-32b");
    }
    case "mistral": {
      const apiKey = process.env.MISTRAL_API_KEY ?? process.env.PROSODEUS_PROVIDER_KEY;
      if (!apiKey) {
        console.error("Error: MISTRAL_API_KEY or PROSODEUS_PROVIDER_KEY required");
        process.exit(1);
      }
      const mistral = createOpenAICompatible({
        name: "mistral",
        baseURL: "https://api.mistral.ai/v1",
        apiKey,
      });
      return mistral(modelId ?? "mistral-small-latest");
    }
    case "workers-ai": {
      const apiKey = process.env.AI_API_KEY ?? process.env.PROSODEUS_PROVIDER_KEY;
      const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
      if (!apiKey || !accountId) {
        console.error("Error: AI_API_KEY + CLOUDFLARE_ACCOUNT_ID required for workers-ai");
        process.exit(1);
      }
      const cf = createOpenAICompatible({
        name: "workers-ai",
        baseURL: `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1`,
        apiKey,
      });
      return cf(modelId ?? "@cf/meta/llama-3.3-70b-instruct-fp8-fast");
    }
    case "deepinfra": {
      const apiKey = process.env.DEEPINFRA_API_KEY ?? process.env.PROSODEUS_PROVIDER_KEY;
      if (!apiKey) {
        console.error("Error: DEEPINFRA_API_KEY or PROSODEUS_PROVIDER_KEY required");
        process.exit(1);
      }
      const di = createOpenAICompatible({
        name: "deepinfra",
        baseURL: "https://api.deepinfra.com/v1/openai",
        apiKey,
      });
      return di(modelId ?? "google/gemma-3-1b-it");
    }
    default: {
      console.error(
        `Error: unknown provider "${providerName}". Available: groq, mistral, workers-ai, deepinfra`,
      );
      process.exit(1);
    }
  }
}

// The on-disk cache needs Bun's bun:sqlite. On Node, run uncached rather than failing.
function openCache(opts: { cache: boolean; cachePath?: string }) {
  if (!opts.cache) return new NullCache();
  try {
    return new LocalCache(opts.cachePath);
  } catch {
    console.error("Note: the classification cache needs the Bun runtime; running without a cache.");
    return new NullCache();
  }
}

const program = new Command();

program.name("prosodeus").description("Structural prose analysis and correction").version("0.1.0");

// ─── analyze ────────────────────────────────────────────────────────────────

program
  .command("analyze")
  .description("Analyze a document for structural uniformity")
  .argument("<file>", "Path to text file")
  .option(
    "--provider <name>",
    "LLM provider (claude, groq, mistral, workers-ai, deepinfra)",
    "groq",
  )
  .option("--style <name>", "Style guide to compare against")
  .option("--no-cache", "Disable classification cache")
  .option("--cache-path <path>", "Custom cache database path")
  .option("--json", "Output raw JSON instead of formatted summary")
  .action(async (file: string, opts) => {
    const text = await readFile(file, "utf8");

    if (!text.trim()) {
      console.error("Error: file is empty");
      process.exit(1);
    }

    const classifier = createClassifier(opts.provider);
    const cache = openCache(opts);

    const profile = await analyze(text, {
      cache,
      classifier,
      style: opts.style,
      onProgress: (p) => {
        if (!opts.json) {
          console.error(
            `Sentences: ${p.total} total, ${p.cached} cached, ${p.classifying} to classify`,
          );
        }
      },
    });

    if (opts.json) {
      console.log(JSON.stringify(profile, null, 2));
    } else {
      printSummary(profile);
    }
  });

// ─── report ─────────────────────────────────────────────────────────────────

program
  .command("report")
  .description("Generate an HTML heatmap report")
  .argument("<file>", "Path to text file")
  .option("--provider <name>", "LLM provider", "groq")
  .option("--style <name>", "Style guide to compare against")
  .option("--output <path>", "Output HTML file path", "report.html")
  .option("--no-cache", "Disable classification cache")
  .option("--cache-path <path>", "Custom cache database path")
  .action(async (file: string, opts) => {
    const text = await readFile(file, "utf8");

    if (!text.trim()) {
      console.error("Error: file is empty");
      process.exit(1);
    }

    const classifier = createClassifier(opts.provider);
    const cache = openCache(opts);

    console.error("Analyzing...");
    const profile = await analyze(text, {
      cache,
      classifier,
      style: opts.style,
      onProgress: (p) => {
        console.error(
          `Sentences: ${p.total} total, ${p.cached} cached, ${p.classifying} to classify`,
        );
      },
    });

    const html = generateHtmlReport(profile);
    await writeFile(opts.output, html);
    console.log(`Report written to ${opts.output}`);
  });

// ─── constrain ──────────────────────────────────────────────────────────────

program
  .command("constrain")
  .description("Generate rewrite constraints for a document")
  .argument("<file>", "Path to text file")
  .option("--provider <name>", "LLM provider", "groq")
  .option("--style <name>", "Style guide to compare against")
  .option("--passage <range>", "Sentence range (start:end)")
  .option("--no-cache", "Disable classification cache")
  .option("--cache-path <path>", "Custom cache database path")
  .action(async (file: string, opts) => {
    const text = await readFile(file, "utf8");

    if (!text.trim()) {
      console.error("Error: file is empty");
      process.exit(1);
    }

    const classifier = createClassifier(opts.provider);
    const cache = openCache(opts);

    const profile = await analyze(text, {
      cache,
      classifier,
      style: opts.style,
      onProgress: (p) => {
        console.error(
          `Sentences: ${p.total} total, ${p.cached} cached, ${p.classifying} to classify`,
        );
      },
    });

    let range: { start: number; end: number } | undefined;
    if (opts.passage) {
      const [start, end] = opts.passage.split(":").map(Number);
      if (start != null && end != null && !Number.isNaN(start) && !Number.isNaN(end)) {
        range = { start, end };
      }
    }

    const doc = generateConstraints(profile, range);

    console.log("\n─── Diagnosis ───────────────────────────────\n");
    console.log(`  Mean heat:    ${doc.diagnosis.mean_heat}/10`);
    console.log(`  Hot patterns: ${doc.diagnosis.hot_patterns.join(", ") || "none"}`);
    console.log(`  Length rho:   ${doc.diagnosis.sentence_length_autocorrelation}`);
    console.log(`  Device H:     ${doc.diagnosis.device_entropy}`);
    console.log(`  Convergence:  ${doc.diagnosis.convergence_slope}`);

    if (doc.constraints.avoid.length > 0) {
      console.log("\n─── Avoid ───────────────────────────────────\n");
      for (const a of doc.constraints.avoid) {
        console.log(`  - ${a}`);
      }
    }

    if (doc.constraints.target.length > 0) {
      console.log("\n─── Target ──────────────────────────────────\n");
      for (const t of doc.constraints.target) {
        console.log(`  - ${t}`);
      }
    }

    console.log("\n─── Rewrite Instruction ─────────────────────\n");
    console.log(doc.instruction);
    console.log();
  });

// ─── rewrite ────────────────────────────────────────────────────────────────

program
  .command("rewrite")
  .description("Rewrite a document or passage to fix structural uniformity")
  .argument("<file>", "Path to text file")
  .option("--provider <name>", "LLM provider", "groq")
  .option("--style <name>", "Style guide to compare against")
  .option("--passage <range>", "Sentence range (start:end)")
  .option("--pce", "Use PCE decomposition for higher quality")
  .option("--no-cache", "Disable classification cache")
  .option("--cache-path <path>", "Custom cache database path")
  .option("--output <path>", "Write rewritten text to file")
  .action(async (file: string, opts) => {
    const text = await readFile(file, "utf8");

    if (!text.trim()) {
      console.error("Error: file is empty");
      process.exit(1);
    }

    if (opts.provider === "claude") {
      console.error(
        "Error: 'rewrite' is not supported with --provider claude yet (Phase B is analyze-only)",
      );
      process.exit(1);
    }
    const model = createModel(opts.provider);
    const classifier = new LLMClassifier(model);
    const cache = openCache(opts);

    console.error("Analyzing...");
    const profile = await analyze(text, { cache, classifier, style: opts.style });

    let range: { start: number; end: number } | undefined;
    if (opts.passage) {
      const [start, end] = opts.passage.split(":").map(Number);
      if (start != null && end != null && !Number.isNaN(start) && !Number.isNaN(end)) {
        range = { start, end };
      }
    }

    const { rewritePassage } = await import("@prosodeus/core");
    const result = await rewritePassage({
      profile,
      passageRange: range,
      style: opts.style,
      usePCE: opts.pce,
      rewriteModel: model,
      classifierModel: model,
      onProgress: (step) => console.error(step),
    });

    console.log("\n─── Rewrite Result ──────────────────────────\n");
    console.log(`  Heat:     ${result.before.mean_heat} → ${result.after.mean_heat}`);
    console.log(`  Device H: ${result.before.device_entropy} → ${result.after.device_entropy}`);
    console.log(`  Rho:      ${result.before.autocorrelation} → ${result.after.autocorrelation}`);
    console.log(`  Patterns: ${result.before.pattern_count} → ${result.after.pattern_count}`);
    console.log("\n─── Rewritten Text ──────────────────────────\n");
    console.log(result.text);
    console.log("\n──────────────────────────────────────────────\n");

    if (opts.output) {
      await writeFile(opts.output, result.text);
      console.error(`Written to ${opts.output}`);
    }
  });

// ─── opposition ──────────────────────────────────────────────────────────────

program
  .command("opposition")
  .alias("scrub")
  .description("Rewrite vacuous binary oppositions in a document")
  .argument("<file>", "Path to text file")
  .option(
    "--provider <name>",
    "LLM provider (claude, groq, mistral, workers-ai, deepinfra)",
    "groq",
  )
  .option("--style <name>", "Style guide to compare against")
  .option("--max-passes <n>", "Maximum detection→rewrite passes", "3")
  .option("--no-cache", "Disable classification cache")
  .option("--cache-path <path>", "Custom cache database path")
  .option("--output <path>", "Write rewritten text to file")
  .option("--json", "Output raw JSON result instead of formatted summary")
  .action(async (file: string, opts) => {
    const text = await readFile(file, "utf8");

    if (!text.trim()) {
      console.error("Error: file is empty");
      process.exit(1);
    }

    if (opts.provider === "claude") {
      console.error(
        "Error: 'opposition' is not supported with --provider claude yet (rewrite requires a generateText-capable model)",
      );
      process.exit(1);
    }

    const model = createModel(opts.provider);
    const classifier = new LLMClassifier(model);
    const cache = openCache(opts);
    const maxPasses = Number.parseInt(opts.maxPasses, 10);

    const result = await rewriteOppositions(text, {
      cache,
      classifier,
      judgeModel: model,
      rewriteModel: model,
      style: opts.style,
      maxPasses: Number.isNaN(maxPasses) ? 3 : maxPasses,
      onProgress: (step) => console.error(step),
    });

    if (opts.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    console.log("\n─── Opposition Rewriter Result ──────────────\n");
    console.log(`  Passes:            ${result.metrics.passes}`);
    console.log(`  Sentences checked: ${result.metrics.spansDetected}`);
    console.log(`  Vacuous:           ${result.metrics.vacuousSpans}`);
    console.log(`  Earned:            ${result.metrics.earnedSpans}`);
    console.log(`  Uncertain:         ${result.metrics.uncertainSpans}`);
    console.log(`  Accepted edits:    ${result.metrics.acceptedEdits}`);
    console.log(`  Rejected edits:    ${result.metrics.rejectedEdits}`);
    console.log(`  Fidelity failures: ${result.metrics.fidelityFailures}`);

    if (result.edits.length > 0) {
      console.log("\n─── Edits ───────────────────────────────────\n");
      for (const edit of result.edits) {
        const status = edit.accepted ? "✓" : "✗";
        console.log(`  ${status} [${edit.span.patternType}] ${edit.verdict}`);
        console.log(`    Original:  ${edit.originalSentence}`);
        if (edit.accepted) {
          console.log(`    Rewritten: ${edit.rewrittenSentence}`);
        } else {
          console.log(`    Rejected:  ${edit.fidelityReason}`);
        }
      }
    }

    console.log("\n─── Rewritten Text ──────────────────────────\n");
    console.log(result.rewrittenText);
    console.log("\n──────────────────────────────────────────────\n");

    if (opts.output) {
      await writeFile(opts.output, result.rewrittenText);
      console.error(`Written to ${opts.output}`);
    }
  });

// ─── compare ────────────────────────────────────────────────────────────────

program
  .command("compare")
  .description("Compare original and rewritten text")
  .argument("<original>", "Path to original text file")
  .argument("<rewritten>", "Path to rewritten text file")
  .option("--provider <name>", "LLM provider", "groq")
  .option("--style <name>", "Style guide to compare against")
  .option("--no-cache", "Disable classification cache")
  .option("--cache-path <path>", "Custom cache database path")
  .action(async (originalFile: string, rewrittenFile: string, opts) => {
    const [originalText, rewrittenText] = await Promise.all([
      readFile(originalFile, "utf8"),
      readFile(rewrittenFile, "utf8"),
    ]);

    if (!originalText.trim() || !rewrittenText.trim()) {
      console.error("Error: one or both files are empty");
      process.exit(1);
    }

    const classifier = createClassifier(opts.provider);
    const cache = openCache(opts);

    console.error("Analyzing original...");
    const originalProfile = await analyze(originalText, {
      cache,
      classifier,
      style: opts.style,
    });

    console.error("Analyzing rewritten...");
    const rewrittenProfile = await analyze(rewrittenText, {
      cache,
      classifier,
      style: opts.style,
    });

    // Count changed sentences
    const originalHashes = new Set(splitAndHash(originalText).map((s) => s.hash));
    const rewrittenHashed = splitAndHash(rewrittenText);
    const changedCount = rewrittenHashed.filter((s) => !originalHashes.has(s.hash)).length;

    console.log("\n─── Rewrite Comparison ──────────────────────\n");
    console.log(
      `  Sentences: ${originalProfile.sentence_count} → ${rewrittenProfile.sentence_count}`,
    );
    console.log(`  Changed:   ${changedCount} of ${rewrittenProfile.sentence_count}`);

    const metrics = [
      {
        name: "Mean heat",
        before: originalProfile.mean_heat,
        after: rewrittenProfile.mean_heat,
        lower: true,
      },
      {
        name: "Device H",
        before: originalProfile.global_device_entropy,
        after: rewrittenProfile.global_device_entropy,
        lower: false,
      },
      {
        name: "Convergence",
        before: originalProfile.convergence_slope,
        after: rewrittenProfile.convergence_slope,
        lower: true,
      },
      {
        name: "Length rho",
        before: originalProfile.global_sentence_length_autocorrelation,
        after: rewrittenProfile.global_sentence_length_autocorrelation,
        lower: true,
      },
      {
        name: "Hot regions",
        before: originalProfile.hot_regions.length,
        after: rewrittenProfile.hot_regions.length,
        lower: true,
      },
    ];

    console.log("\n  Metric         Before  After   Change");
    console.log("  ─────────────  ──────  ──────  ──────");

    let improvements = 0;
    let regressions = 0;

    for (const m of metrics) {
      const delta = m.after - m.before;
      const improved = m.lower ? delta < -0.01 : delta > 0.01;
      const regressed = m.lower ? delta > 0.01 : delta < -0.01;
      const icon = improved ? " +" : regressed ? " -" : " =";
      if (improved) improvements++;
      if (regressed) regressions++;
      console.log(
        `  ${m.name.padEnd(15)}${String(m.before).padStart(6)}  ${String(m.after).padStart(6)}  ${icon}`,
      );
    }

    console.log();
    if (improvements > regressions) {
      console.log(`  Overall: Improved (${improvements} better, ${regressions} worse)`);
    } else if (regressions > improvements) {
      console.log(`  Overall: Regressed (${improvements} better, ${regressions} worse)`);
    } else {
      console.log(`  Overall: Mixed (${improvements} better, ${regressions} worse)`);
    }

    if (originalProfile.delta && rewrittenProfile.delta) {
      console.log(
        `\n  Style distance: ${originalProfile.delta.overall_distance} → ${rewrittenProfile.delta.overall_distance}`,
      );
      console.log(
        `  Violations:     ${originalProfile.delta.violations.length} → ${rewrittenProfile.delta.violations.length}`,
      );
    }

    console.log("\n──────────────────────────────────────────────\n");
  });

// ─── styles ─────────────────────────────────────────────────────────────────

program
  .command("styles")
  .description("List available style guides")
  .action(() => {
    const guides = listStyleGuides();
    console.log("\nAvailable style guides:\n");
    for (const g of guides) {
      console.log(`  ${g.name.padEnd(16)} ${g.description}`);
    }
    console.log();
  });

// ─── Summary Formatting ─────────────────────────────────────────────────────

function printSummary(profile: StylometricProfile) {
  console.log("\n─── Prosodeus Analysis ───────────────────────\n");
  console.log(`  Words:        ${profile.word_count}`);
  console.log(`  Sentences:    ${profile.sentence_count}`);
  console.log(`  Paragraphs:   ${profile.paragraph_count}`);
  console.log(`  Mean heat:    ${profile.mean_heat}/10`);
  console.log(`  Convergence:  ${profile.convergence_slope}`);
  console.log(`  Biber H:      ${profile.global_biber_entropy}`);
  console.log(`  Device H:     ${profile.global_device_entropy}`);
  console.log(`  Length rho:   ${profile.global_sentence_length_autocorrelation}`);

  if (profile.hot_regions.length > 0) {
    console.log(`\n─── Hot Regions (${profile.hot_regions.length}) ──────────────────────\n`);
    for (const r of profile.hot_regions) {
      console.log(`  [${r.start_sentence}-${r.end_sentence}] heat ${r.heat}: ${r.description}`);
    }
  } else {
    console.log("\n  No hot regions detected.");
  }

  if (profile.delta) {
    console.log(
      `\n─── Style Guide: ${profile.delta.guide} (distance: ${profile.delta.overall_distance}) ──\n`,
    );
    if (profile.delta.violations.length === 0) {
      console.log("  All targets met.");
    } else {
      for (const v of profile.delta.violations) {
        const icon = v.severity === "high" ? "!!" : v.severity === "medium" ? " !" : "  ";
        console.log(`  ${icon} ${v.dimension}: ${v.current} (target: ${v.target})`);
      }
    }
  }

  console.log("\n──────────────────────────────────────────────\n");
}

program.parse();
