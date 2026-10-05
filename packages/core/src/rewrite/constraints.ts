import {
  computeDensityViolations,
  violationCountByPattern,
} from "../analysis/density-violations.ts";
import type { PlaybookPlatform } from "../playbooks/copy-playbook.ts";
import { COPY_PLAYBOOK, getPlaybookPatternIds } from "../playbooks/copy-playbook.ts";
import type { RewriteConstraints } from "../rewrite/rewrite-policy.ts";
import { encodeConstraintsAsDirectives } from "../rewrite/rewrite-policy.ts";
import {
  getConstraintDirective,
  getPattern,
  getTolerance,
  rollRewriteOption,
  type StyleGenre,
} from "../taxonomy/pattern-registry.ts";
import type { PatternType, StylometricProfile } from "../types.ts";

// ─── Types ───────────────────────────────────────────────────────────────────

export type PlaybookId = "anti-slop-copy";

export interface ConstraintDocument {
  passage: string;
  diagnosis: {
    hot_patterns: PatternType[];
    mean_heat: number;
    sentence_length_autocorrelation: number;
    device_entropy: number;
    convergence_slope: number;
  };
  constraints: {
    avoid: string[];
    target: string[];
    style_guide?: string;
    lexicon_swaps?: string[];
  };
  instruction: string;
}

export type RewriteHistory = Map<string, number>;

export interface GenerateConstraintsOptions {
  genre?: StyleGenre;
  rewriteHistory?: RewriteHistory;
  playbookId?: PlaybookId;
  platform?: PlaybookPlatform;
  voiceDna?: string;
  rewriteConstraints?: RewriteConstraints | null;
  lexiconSwaps?: string[];
  personalStyleTargets?: string[];
}

// ─── Generator ───────────────────────────────────────────────────────────────

export function generateConstraints(
  profile: StylometricProfile,
  passageRange?: { start: number; end: number },
  options?: GenerateConstraintsOptions,
): ConstraintDocument {
  const genre = options?.genre ?? "general";
  const history = options?.rewriteHistory ?? new Map();
  const playbook = options?.playbookId === "anti-slop-copy" ? COPY_PLAYBOOK : null;
  const playbookPatternIds = playbook ? new Set(getPlaybookPatternIds(playbook)) : null;

  const sentences = passageRange
    ? profile.sentences.filter((s) => s.id >= passageRange.start && s.id <= passageRange.end)
    : profile.sentences;

  const passage = sentences.map((s) => s.text).join(" ");

  const patternCounts: Record<string, number> = {};
  for (const s of sentences) {
    for (const p of s.classification.patterns) {
      if (playbookPatternIds && !playbookPatternIds.has(p.type)) continue;
      patternCounts[p.type] = (patternCounts[p.type] ?? 0) + 1;
    }
  }

  const violationWeights = playbook
    ? violationCountByPattern(
        computeDensityViolations(profile.windows, profile.sentences, genre, playbookPatternIds!),
      )
    : new Map<PatternType, number>();

  const hotPatterns = Object.entries(patternCounts)
    .filter(([type]) => getTolerance(type, genre) < 1.5)
    .sort((a, b) => {
      const vA = violationWeights.get(a[0] as PatternType) ?? 0;
      const vB = violationWeights.get(b[0] as PatternType) ?? 0;
      if (vA !== vB) return vB - vA;
      const entryA = getPattern(a[0]);
      const entryB = getPattern(b[0]);
      const ampOrder = { high: 0, med: 1, low: 2 };
      const ampA = ampOrder[entryA?.self_amplification ?? "low"];
      const ampB = ampOrder[entryB?.self_amplification ?? "low"];
      if (ampA !== ampB) return ampA - ampB;
      return b[1] - a[1];
    })
    .slice(0, 5)
    .map(([type]) => type as PatternType);

  const avoid = hotPatterns.map((patternId) => {
    const option = rollRewriteOption(patternId, history.get(patternId));
    if (option) {
      history.set(patternId, option.id);
      const entry = getPattern(patternId);
      const count = patternCounts[patternId] ?? 0;
      const vCount = violationWeights.get(patternId) ?? 0;
      const suffix = vCount > 0 ? `, ${vCount} window violation(s)` : "";
      return `${entry?.name ?? patternId} (${count}× detected${suffix}): ${option.instruction}`;
    }
    return getConstraintDirective(patternId);
  });

  const target: string[] = [];
  if (profile.delta) {
    for (const v of profile.delta.violations) {
      target.push(`${formatDimension(v.dimension)}: currently ${v.current}, target ${v.target}`);
    }
  }

  if (profile.global_sentence_length_autocorrelation > 0.3) {
    target.push("Vary sentence length rhythm — avoid adjacent sentences of similar length");
  }
  if (profile.global_device_entropy < 2.0) {
    target.push("Increase rhetorical variety — mix claims, evidence, pivots, and elaboration");
  }
  if (profile.convergence_slope < -0.1) {
    target.push("Maintain structural variety throughout — avoid entropy decay toward the end");
  }

  if (options?.personalStyleTargets?.length) {
    for (const line of options.personalStyleTargets) {
      target.push(line);
    }
  }

  const diagnosis = {
    hot_patterns: hotPatterns,
    mean_heat: profile.mean_heat,
    sentence_length_autocorrelation: profile.global_sentence_length_autocorrelation,
    device_entropy: profile.global_device_entropy,
    convergence_slope: profile.convergence_slope,
  };

  const lexicon_swaps = options?.lexiconSwaps ?? [];

  const constraints = {
    avoid,
    target,
    style_guide: profile.delta?.guide,
    lexicon_swaps: lexicon_swaps.length > 0 ? lexicon_swaps : undefined,
  };

  const instruction = buildInstruction(passage, constraints, {
    playbook,
    platform: options?.platform,
    voiceDna: options?.voiceDna,
    rewriteConstraints: options?.rewriteConstraints,
  });

  return { passage, diagnosis, constraints, instruction };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildInstruction(
  passage: string,
  constraints: ConstraintDocument["constraints"],
  playbookOpts?: {
    playbook: typeof COPY_PLAYBOOK | null;
    platform?: PlaybookPlatform;
    voiceDna?: string;
    rewriteConstraints?: RewriteConstraints | null;
  },
): string {
  const playbook = playbookOpts?.playbook;
  const opener = playbook
    ? "Write the following passage. Preserve all factual content exactly."
    : "Rewrite the following passage. Preserve all factual content exactly.";

  const lines = [opener, ""];

  if (playbook) {
    lines.push(`BANNED VOCABULARY: ${playbook.banned_words.join(", ")}`, "", "STRUCTURAL BANS:");
    for (const ban of playbook.structural_bans) {
      lines.push(`- ${ban}`);
    }
    lines.push("");
  }

  if (playbook && playbookOpts?.platform) {
    const preset = playbook.platform_presets[playbookOpts.platform];
    if (preset) {
      lines.push(`PLATFORM (${preset.label}): ${preset.tone_note}`, "");
    }
  }

  const mergedRewrite: RewriteConstraints = {
    ...(playbook && playbookOpts?.platform
      ? playbook.platform_presets[playbookOpts.platform]?.constraints
      : {}),
    ...playbookOpts?.rewriteConstraints,
  };
  const directives = encodeConstraintsAsDirectives(mergedRewrite);
  if (directives.length > 0) {
    lines.push("EDITORIAL DIRECTIVES:");
    for (const d of directives) {
      lines.push(`- ${d}`);
    }
    if (mergedRewrite.notes) {
      lines.push(`- Note: ${mergedRewrite.notes}`);
    }
    lines.push("");
  }

  if (playbookOpts?.voiceDna?.trim()) {
    lines.push("VOICE:", playbookOpts.voiceDna.trim(), "");
  }

  lines.push("STRUCTURAL CONSTRAINTS:");

  if (constraints.avoid.length > 0) {
    lines.push("AVOID:");
    for (const a of constraints.avoid) {
      lines.push(`- ${a}`);
    }
  }

  if (constraints.lexicon_swaps && constraints.lexicon_swaps.length > 0) {
    lines.push("LEXICON SWAPS:");
    for (const swap of constraints.lexicon_swaps) {
      lines.push(`- ${swap}`);
    }
  }

  if (constraints.target.length > 0) {
    lines.push("TARGET:");
    for (const t of constraints.target) {
      lines.push(`- ${t}`);
    }
  }

  if (constraints.style_guide) {
    lines.push(`\nSTYLE GUIDE: ${constraints.style_guide}`);
  }

  lines.push("", "PASSAGE:", passage);

  return lines.join("\n");
}

function formatDimension(dim: string): string {
  return dim.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
