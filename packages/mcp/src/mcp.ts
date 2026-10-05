import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AnalyzeOptions, StylometricProfile } from "@prosodeus/core";
import {
  analyze,
  generateConstraints,
  listStyleGuides,
  loadStyleGuide,
  rewritePassage,
  splitAndHash,
} from "@prosodeus/core";
import type { LanguageModel } from "ai";
import * as z from "zod/v4";

export interface McpDependencies {
  analyzeOptions: Omit<AnalyzeOptions, "style" | "onProgress">;
  /** Model used for rewriting — if not provided, rewrite tool is unavailable */
  rewriteModel?: LanguageModel;
  /** Model used for classification in rewrite verification — defaults to analyzeOptions.classifier's model */
  classifierModel?: LanguageModel;
}

export function createServer(deps: McpDependencies): McpServer {
  const server = new McpServer({
    name: "prosodeus",
    version: "0.1.0",
  });

  // ─── Tools ───────────────────────────────────────────────────────────────

  server.registerTool(
    "screen_text",
    {
      title: "Screen Text",
      description:
        "Analyze text for structural uniformity patterns (LLM-typical writing). Returns a human-readable summary and full StylometricProfile.",
      inputSchema: z.object({
        text: z.string().describe("The text to analyze"),
        style: z
          .string()
          .optional()
          .describe("Style guide name to compare against (e.g. 'general', 'technical', 'fiction')"),
      }),
    },
    async ({ text, style }) => {
      const profile = await analyze(text, {
        ...deps.analyzeOptions,
        style,
      });
      const summary = formatSummary(profile);
      return {
        content: [
          { type: "text", text: summary },
          {
            type: "text",
            text: "```json\n" + JSON.stringify(profile, null, 2) + "\n```",
          },
        ],
      };
    },
  );

  server.registerTool(
    "generate_constraints",
    {
      title: "Generate Constraints",
      description:
        "Analyze text and generate structured rewrite constraints. Returns a diagnosis, avoid/target lists, and a copy-pasteable rewrite instruction.",
      inputSchema: z.object({
        text: z.string().describe("The text to analyze"),
        style: z.string().optional().describe("Style guide name"),
        passage_start: z
          .number()
          .optional()
          .describe("Start sentence index for partial rewrite (0-based)"),
        passage_end: z
          .number()
          .optional()
          .describe("End sentence index for partial rewrite (inclusive)"),
      }),
    },
    async ({ text, style, passage_start, passage_end }) => {
      const profile = await analyze(text, {
        ...deps.analyzeOptions,
        style,
      });
      const range =
        passage_start !== undefined && passage_end !== undefined
          ? { start: passage_start, end: passage_end }
          : undefined;
      const doc = generateConstraints(profile, range);
      return {
        content: [
          {
            type: "text",
            text: [
              "## Diagnosis",
              `Mean heat: ${doc.diagnosis.mean_heat}/10`,
              `Hot patterns: ${doc.diagnosis.hot_patterns.join(", ") || "none"}`,
              `Sentence length autocorrelation: ${doc.diagnosis.sentence_length_autocorrelation}`,
              `Device entropy: ${doc.diagnosis.device_entropy}`,
              `Convergence slope: ${doc.diagnosis.convergence_slope}`,
              "",
              "## Constraints",
              ...(doc.constraints.avoid.length > 0
                ? ["**Avoid:**", ...doc.constraints.avoid.map((a) => `- ${a}`)]
                : []),
              ...(doc.constraints.target.length > 0
                ? ["**Target:**", ...doc.constraints.target.map((t) => `- ${t}`)]
                : []),
              "",
              "## Rewrite Instruction",
              "```",
              doc.instruction,
              "```",
            ].join("\n"),
          },
        ],
      };
    },
  );

  server.registerTool(
    "verify_rewrite",
    {
      title: "Verify Rewrite",
      description:
        "Compare an original and rewritten text to verify structural improvement. Shows before/after metrics with improvement/regression indicators.",
      inputSchema: z.object({
        original_text: z.string().describe("The original text"),
        rewritten_text: z.string().describe("The rewritten text"),
        style: z.string().optional().describe("Style guide name"),
      }),
    },
    async ({ original_text, rewritten_text, style }) => {
      const [originalProfile, rewrittenProfile] = await Promise.all([
        analyze(original_text, { ...deps.analyzeOptions, style }),
        analyze(rewritten_text, { ...deps.analyzeOptions, style }),
      ]);

      const metrics = [
        {
          name: "Mean heat",
          before: originalProfile.mean_heat,
          after: rewrittenProfile.mean_heat,
          lowerIsBetter: true,
        },
        {
          name: "Device entropy",
          before: originalProfile.global_device_entropy,
          after: rewrittenProfile.global_device_entropy,
          lowerIsBetter: false,
        },
        {
          name: "Convergence slope",
          before: originalProfile.convergence_slope,
          after: rewrittenProfile.convergence_slope,
          lowerIsBetter: true,
        },
        {
          name: "Length autocorrelation",
          before: originalProfile.global_sentence_length_autocorrelation,
          after: rewrittenProfile.global_sentence_length_autocorrelation,
          lowerIsBetter: true,
        },
        {
          name: "Hot regions",
          before: originalProfile.hot_regions.length,
          after: rewrittenProfile.hot_regions.length,
          lowerIsBetter: true,
        },
      ];

      // Count changed sentences
      const originalHashes = new Set(splitAndHash(original_text).map((s) => s.hash));
      const rewrittenHashed = splitAndHash(rewritten_text);
      const changedCount = rewrittenHashed.filter((s) => !originalHashes.has(s.hash)).length;

      const lines = [
        "## Rewrite Verification",
        "",
        `Sentences: ${originalProfile.sentence_count} → ${rewrittenProfile.sentence_count}`,
        `Changed: ${changedCount} of ${rewrittenProfile.sentence_count}`,
        "",
        "| Metric | Before | After | Change |",
        "|--------|--------|-------|--------|",
      ];

      let improvements = 0;
      let regressions = 0;

      for (const m of metrics) {
        const delta = m.after - m.before;
        const improved = m.lowerIsBetter ? delta < -0.01 : delta > 0.01;
        const regressed = m.lowerIsBetter ? delta > 0.01 : delta < -0.01;
        const icon = improved ? "+" : regressed ? "-" : "=";
        if (improved) improvements++;
        if (regressed) regressions++;
        lines.push(`| ${m.name} | ${m.before} | ${m.after} | ${icon} |`);
      }

      lines.push("");
      if (improvements > regressions) {
        lines.push(`**Overall: Improved** (${improvements} better, ${regressions} worse)`);
      } else if (regressions > improvements) {
        lines.push(`**Overall: Regressed** (${improvements} better, ${regressions} worse)`);
      } else {
        lines.push(`**Overall: Mixed** (${improvements} better, ${regressions} worse)`);
      }

      // Style guide comparison
      if (originalProfile.delta && rewrittenProfile.delta) {
        lines.push("");
        lines.push(
          `Style distance: ${originalProfile.delta.overall_distance} → ${rewrittenProfile.delta.overall_distance}`,
        );
        lines.push(
          `Violations: ${originalProfile.delta.violations.length} → ${rewrittenProfile.delta.violations.length}`,
        );
      }

      return {
        content: [{ type: "text", text: lines.join("\n") }],
      };
    },
  );

  server.registerTool(
    "list_style_guides",
    {
      title: "List Style Guides",
      description: "List all available style guides with their names and descriptions.",
      inputSchema: z.object({}),
    },
    async () => {
      const guides = listStyleGuides();
      const text = guides.map((g) => `- **${g.name}**: ${g.description}`).join("\n");
      return {
        content: [{ type: "text", text }],
      };
    },
  );

  server.registerTool(
    "get_style_guide",
    {
      title: "Get Style Guide",
      description: "Get the full details of a specific style guide.",
      inputSchema: z.object({
        name: z.string().describe("Style guide name"),
      }),
    },
    async ({ name }) => {
      const guide = loadStyleGuide(name);
      if (!guide) {
        return {
          content: [
            {
              type: "text",
              text: `Style guide "${name}" not found. Use list_style_guides to see available guides.`,
            },
          ],
          isError: true,
        };
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(guide, null, 2),
          },
        ],
      };
    },
  );

  // ─── Rewrite Tool ──────────────────────────────────────────────────────────

  if (deps.rewriteModel) {
    const rewriteModel = deps.rewriteModel;
    const classifierModel = deps.classifierModel ?? rewriteModel;

    server.registerTool(
      "rewrite_passage",
      {
        title: "Rewrite Passage",
        description:
          "Analyze text and rewrite it to fix structural uniformity patterns. Returns the rewritten text with before/after metrics comparison.",
        inputSchema: z.object({
          text: z.string().describe("The full document text"),
          style: z.string().optional().describe("Style guide name"),
          passage_start: z.number().optional().describe("Start sentence index (0-based)"),
          passage_end: z.number().optional().describe("End sentence index (inclusive)"),
          use_pce: z
            .boolean()
            .optional()
            .describe("Use PCE decomposition for higher quality (slower)"),
        }),
      },
      async ({ text, style, passage_start, passage_end, use_pce }) => {
        const profile = await analyze(text, {
          ...deps.analyzeOptions,
          style,
        });

        const passageRange =
          passage_start !== undefined && passage_end !== undefined
            ? { start: passage_start, end: passage_end }
            : undefined;

        const result = await rewritePassage({
          profile,
          passageRange,
          style,
          usePCE: use_pce,
          rewriteModel,
          classifierModel,
        });

        const lines = [
          "## Rewrite Result",
          "",
          "### Before/After Metrics",
          "| Metric | Before | After | Change |",
          "|--------|--------|-------|--------|",
        ];

        const metrics = [
          {
            name: "Mean heat",
            before: result.before.mean_heat,
            after: result.after.mean_heat,
            lower: true,
          },
          {
            name: "Device entropy",
            before: result.before.device_entropy,
            after: result.after.device_entropy,
            lower: false,
          },
          {
            name: "Autocorrelation",
            before: result.before.autocorrelation,
            after: result.after.autocorrelation,
            lower: true,
          },
          {
            name: "Pattern count",
            before: result.before.pattern_count,
            after: result.after.pattern_count,
            lower: true,
          },
        ];

        for (const m of metrics) {
          const delta = m.after - m.before;
          const improved = m.lower ? delta < -0.01 : delta > 0.01;
          const regressed = m.lower ? delta > 0.01 : delta < -0.01;
          const icon = improved ? "+" : regressed ? "-" : "=";
          lines.push(`| ${m.name} | ${m.before} | ${m.after} | ${icon} |`);
        }

        lines.push("", "### Rewritten Text", "", result.text);

        if (result.constraints.avoid.length > 0) {
          lines.push("", "### Constraints Applied", "**Avoid:**");
          for (const a of result.constraints.avoid) lines.push(`- ${a}`);
        }

        return {
          content: [{ type: "text", text: lines.join("\n") }],
        };
      },
    );
  }

  // ─── Resources ─────────────────────────────────────────────────────────────

  server.registerResource(
    "style-guides",
    "prosodeus://style-guides",
    {
      title: "Style Guides",
      description: "List of all available Prosodeus style guides",
      mimeType: "application/json",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          text: JSON.stringify(listStyleGuides(), null, 2),
        },
      ],
    }),
  );

  server.registerResource(
    "style-guide",
    new ResourceTemplate("prosodeus://style-guide/{name}", {
      list: async () => ({
        resources: listStyleGuides().map((g) => ({
          uri: `prosodeus://style-guide/${g.name}`,
          name: g.name,
        })),
      }),
    }),
    {
      title: "Style Guide",
      description: "Full style guide with targets and parameters",
      mimeType: "application/json",
    },
    async (uri, { name }) => {
      const guide = loadStyleGuide(name as string);
      return {
        contents: [
          {
            uri: uri.href,
            text: guide
              ? JSON.stringify(guide, null, 2)
              : JSON.stringify({ error: `Style guide "${name}" not found` }),
          },
        ],
      };
    },
  );

  return server;
}

// ─── Summary Formatting ──────────────────────────────────────────────────────

function formatSummary(profile: StylometricProfile): string {
  const lines = [
    "## Prosodeus Analysis",
    "",
    `- **Words:** ${profile.word_count}`,
    `- **Sentences:** ${profile.sentence_count}`,
    `- **Paragraphs:** ${profile.paragraph_count}`,
    `- **Mean heat:** ${profile.mean_heat}/10`,
    `- **Convergence:** ${profile.convergence_slope}`,
    `- **Biber entropy:** ${profile.global_biber_entropy}`,
    `- **Device entropy:** ${profile.global_device_entropy}`,
    `- **Length autocorrelation:** ${profile.global_sentence_length_autocorrelation}`,
  ];

  if (profile.hot_regions.length > 0) {
    lines.push("");
    lines.push(`### Hot Regions (${profile.hot_regions.length})`);
    for (const r of profile.hot_regions) {
      lines.push(`- [${r.start_sentence}-${r.end_sentence}] heat ${r.heat}: ${r.description}`);
    }
  } else {
    lines.push("");
    lines.push("No hot regions detected.");
  }

  if (profile.delta) {
    lines.push("");
    lines.push(
      `### Style Guide: ${profile.delta.guide} (distance: ${profile.delta.overall_distance})`,
    );
    if (profile.delta.violations.length === 0) {
      lines.push("All targets met.");
    } else {
      for (const v of profile.delta.violations) {
        const icon = v.severity === "high" ? "!!" : v.severity === "medium" ? " !" : "  ";
        lines.push(`${icon} ${v.dimension}: ${v.current} (target: ${v.target})`);
      }
    }
  }

  return lines.join("\n");
}
