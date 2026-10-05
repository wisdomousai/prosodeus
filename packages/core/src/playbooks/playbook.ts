import {
  computeDensityViolations,
  violationCountByPattern,
} from "../analysis/density-violations.ts";
import { generateConstraints } from "../rewrite/constraints.ts";
import type { RewriteConstraints } from "../rewrite/rewrite-policy.ts";
import { encodeConstraintsAsDirectives } from "../rewrite/rewrite-policy.ts";
import type { StyleGenre } from "../taxonomy/pattern-registry.ts";
import type { PatternType, StylometricProfile } from "../types.ts";
import { formatLexiconSwaps, type LexiconHit, lexiconHits } from "./copy-lexicon.ts";
import {
  COPY_PLAYBOOK,
  type CopyPlaybook,
  getPlaybookPatternIds,
  type PlaybookLayerId,
  type PlaybookPlatform,
} from "./copy-playbook.ts";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PlaybookLayerScore {
  id: PlaybookLayerId;
  label: string;
  hitCount: number;
  patternHits: Array<{ type: PatternType; count: number }>;
  violationCount?: number;
}

export interface PlaybookLayerScores {
  layers: PlaybookLayerScore[];
  worstLayerId: PlaybookLayerId | null;
  totalHits: number;
  violations?: import("../analysis/density-violations.ts").DensityViolation[];
}

export interface PlaybookCluster {
  type: PatternType;
  count: number;
  density: number;
  sentences: number[];
}

export type PlaybookAuditStatus = "pass" | "fail" | "warn" | "manual";

export interface PlaybookAuditResult {
  id: string;
  label: string;
  automated: boolean;
  status: PlaybookAuditStatus;
  detail?: string;
  hint?: string;
}

export interface PlaybookAuditReport {
  checks: PlaybookAuditResult[];
  automatedPassed: number;
  automatedTotal: number;
}

export interface BuildPlaybookPromptOptions {
  playbook?: CopyPlaybook;
  platform?: PlaybookPlatform | null;
  constraints?: RewriteConstraints | null;
  passage?: string;
  profile?: StylometricProfile;
  voiceDna?: string;
  lexiconSwaps?: string[];
}

// ─── Pattern helpers ─────────────────────────────────────────────────────────

export { getPlaybookPatternIds } from "./copy-playbook.ts";

function countPatternsInProfile(
  profile: StylometricProfile,
  patternIds: Set<PatternType>,
): Map<PatternType, number> {
  const counts = new Map<PatternType, number>();
  for (const s of profile.sentences) {
    for (const p of s.classification.patterns) {
      if (!patternIds.has(p.type)) continue;
      counts.set(p.type, (counts.get(p.type) ?? 0) + 1);
    }
  }
  return counts;
}

export function scorePlaybookLayers(
  profile: StylometricProfile,
  playbook: CopyPlaybook = COPY_PLAYBOOK,
  options?: { genre?: StyleGenre },
): PlaybookLayerScores {
  const genre = options?.genre ?? "general";
  const allIds = new Set(getPlaybookPatternIds(playbook));
  const violations = computeDensityViolations(profile.windows, profile.sentences, genre, allIds);
  const violationByPattern = violationCountByPattern(violations);
  const counts = countPatternsInProfile(profile, allIds);

  const layers: PlaybookLayerScore[] = playbook.layers.map((layer) => {
    const patternHits: Array<{ type: PatternType; count: number }> = [];
    let hitCount = 0;
    let violationCount = 0;
    for (const type of layer.patterns) {
      const vCount = violationByPattern.get(type) ?? 0;
      const c = counts.get(type) ?? 0;
      const weight = vCount > 0 ? vCount : c > 0 ? 1 : 0;
      if (weight > 0) {
        patternHits.push({ type, count: vCount > 0 ? vCount : c });
        hitCount += weight;
        violationCount += vCount;
      }
    }
    patternHits.sort((a, b) => b.count - a.count);
    return { id: layer.id, label: layer.label, hitCount, patternHits, violationCount };
  });

  let worstLayerId: PlaybookLayerId | null = null;
  let worstHits = 0;
  for (const layer of layers) {
    if (layer.hitCount > worstHits) {
      worstHits = layer.hitCount;
      worstLayerId = layer.id;
    }
  }

  const totalHits = layers.reduce((sum, l) => sum + l.hitCount, 0);

  return { layers, worstLayerId, totalHits, violations };
}

export function filterPlaybookClusters(
  clusters: PlaybookCluster[],
  playbook: CopyPlaybook = COPY_PLAYBOOK,
): PlaybookCluster[] {
  const allowed = new Set(getPlaybookPatternIds(playbook));
  return clusters.filter((c) => allowed.has(c.type)).sort((a, b) => b.density - a.density);
}

// ─── Audit ───────────────────────────────────────────────────────────────────

const BINARY_REFRAME_RE =
  /\b(it'?s|this is) not\b[^.!?]{0,80}\b(it'?s|but)\b|\bnot (simply|just|only)\b[^.!?]{0,60}\bbut\b/gi;

const FORMAL_TRANSITION_RE = /(?:^|[.!?]\s+)(Furthermore|However|Moreover|Therefore)\b/g;

const META_COMMENTARY_RE =
  /\b(in this article|let me explain|in conclusion|to summarize|in today's)\b/gi;

const VAGUE_ENDING_RE =
  /\b(the future looks bright|the possibilities are endless|only time will tell)\b/gi;

const THREE_ITEM_LIST_RE = /[^.!?\n]+[,;][^.!?\n]+[,;][^.!?\n]+\band\b[^.!?\n]*/gi;

const STIFF_CONTRACTION_RE = /\b(do not|cannot|will not|you are|we are|they are|it is)\b/gi;

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function firstWords(paragraph: string): string {
  const m = paragraph.match(/^\s*(?:[#>*-]+\s*)*(\w+)/);
  return m?.[1]?.toLowerCase() ?? "";
}

function runAutomatedCheck(
  checkId: string,
  text: string,
  profile: StylometricProfile,
  playbook: CopyPlaybook,
): { status: PlaybookAuditStatus; detail?: string } {
  switch (checkId) {
    case "em_dash": {
      const em = (text.match(/—/g) ?? []).length;
      const double = (text.match(/--/g) ?? []).length;
      const total = em + double;
      return total <= 1
        ? { status: "pass", detail: total === 0 ? "No em dashes" : "1 em dash" }
        : { status: "fail", detail: `${total} em dashes found` };
    }
    case "worst_words": {
      const lower = text.toLowerCase();
      const found = playbook.banned_words.filter((w) => {
        const re = new RegExp(`\\b${w.replace(/-/g, "[- ]")}\\b`, "i");
        return re.test(lower);
      });
      return found.length === 0
        ? { status: "pass", detail: "No banned words" }
        : {
            status: "fail",
            detail: `Found: ${found.slice(0, 5).join(", ")}${found.length > 5 ? "…" : ""}`,
          };
    }
    case "lexicon_scan": {
      const hits = lexiconHits(text);
      if (hits.length === 0) {
        return { status: "pass", detail: "No lexicon hits" };
      }
      const swaps = formatLexiconSwaps(hits).slice(0, 3);
      return {
        status: "fail",
        detail: `${hits.length} banned phrase(s) — swap: ${swaps.join("; ")}`,
      };
    }
    case "binary_reframe": {
      const regexHits = (text.match(BINARY_REFRAME_RE) ?? []).length;
      let patternHits = 0;
      for (const s of profile.sentences) {
        for (const p of s.classification.patterns) {
          if (p.type === "binary_contrast" || p.type === "negation_reframe") patternHits++;
        }
      }
      const total = regexHits + patternHits;
      return total === 0
        ? { status: "pass", detail: "No binary reframes" }
        : { status: "fail", detail: `${total} binary reframe signal(s)` };
    }
    case "formal_transitions": {
      const hits = (text.match(FORMAL_TRANSITION_RE) ?? []).length;
      return hits === 0
        ? { status: "pass", detail: "No formal openers" }
        : { status: "fail", detail: `${hits} formal transition(s)` };
    }
    case "meta_commentary": {
      const hits = (text.match(META_COMMENTARY_RE) ?? []).length;
      return hits === 0
        ? { status: "pass", detail: "No meta-commentary" }
        : { status: "fail", detail: `${hits} meta-commentary phrase(s)` };
    }
    case "vague_ending": {
      const hits = (text.match(VAGUE_ENDING_RE) ?? []).length;
      return hits === 0
        ? { status: "pass", detail: "No vague closers" }
        : { status: "fail", detail: `${hits} vague ending(s)` };
    }
    case "three_item_list": {
      const hits = (text.match(THREE_ITEM_LIST_RE) ?? []).length;
      return hits === 0
        ? { status: "pass", detail: "No three-item list chains" }
        : {
            status: "warn",
            detail: `${hits} possible three-item list(s) — verify each needs three`,
          };
    }
    case "paragraph_opener": {
      const paragraphs = splitParagraphs(text);
      const freq = new Map<string, number>();
      for (const p of paragraphs) {
        const w = firstWords(p);
        if (!w) continue;
        freq.set(w, (freq.get(w) ?? 0) + 1);
      }
      const max = Math.max(0, ...freq.values());
      return max < 3
        ? { status: "pass", detail: "Paragraph openers vary" }
        : { status: "fail", detail: `${max} paragraphs start the same way` };
    }
    case "contraction": {
      const stiff = (text.match(STIFF_CONTRACTION_RE) ?? []).length;
      return stiff <= 2
        ? { status: "pass", detail: stiff === 0 ? "Contractions OK" : `${stiff} stiff form(s)` }
        : {
            status: "warn",
            detail: `${stiff} stiff forms (do not, cannot…) — consider contractions`,
          };
    }
    default:
      return { status: "pass" };
  }
}

export function runPlaybookAudit(
  text: string,
  profile: StylometricProfile,
  playbook: CopyPlaybook = COPY_PLAYBOOK,
): PlaybookAuditReport {
  const checks: PlaybookAuditResult[] = playbook.audit_checks.map((check) => {
    if (!check.automated) {
      return {
        id: check.id,
        label: check.label,
        automated: false,
        status: "manual",
        hint: check.hint,
      };
    }
    const result = runAutomatedCheck(check.id, text, profile, playbook);
    return {
      id: check.id,
      label: check.label,
      automated: true,
      status: result.status,
      detail: result.detail,
    };
  });

  const automated = checks.filter((c) => c.automated);
  const automatedPassed = automated.filter((c) => c.status === "pass").length;

  return {
    checks,
    automatedPassed,
    automatedTotal: automated.length,
  };
}

// ─── Prompt builder ────────────────────────────────────────────────────────────

export function buildPlaybookPrompt(options: BuildPlaybookPromptOptions = {}): string {
  if (options.profile) {
    return generateConstraints(options.profile, undefined, {
      playbookId: "anti-slop-copy",
      platform: options.platform ?? undefined,
      voiceDna: options.voiceDna,
      rewriteConstraints: options.constraints,
      lexiconSwaps: options.lexiconSwaps,
    }).instruction;
  }

  const playbook = options.playbook ?? COPY_PLAYBOOK;
  const lines = [
    "Write the following passage. Preserve all factual content exactly.",
    "",
    `BANNED VOCABULARY: ${playbook.banned_words.join(", ")}`,
    "",
    "STRUCTURAL BANS:",
  ];

  for (const ban of playbook.structural_bans) {
    lines.push(`- ${ban}`);
  }

  if (options.platform) {
    const preset = playbook.platform_presets[options.platform];
    if (preset) {
      lines.push("", `PLATFORM (${preset.label}): ${preset.tone_note}`);
    }
  }

  const mergedConstraints: RewriteConstraints = {
    ...(options.platform ? playbook.platform_presets[options.platform]?.constraints : {}),
    ...options.constraints,
  };

  const directives = encodeConstraintsAsDirectives(mergedConstraints);
  if (directives.length > 0) {
    lines.push("", "EDITORIAL DIRECTIVES:");
    for (const d of directives) {
      lines.push(`- ${d}`);
    }
  }

  if (mergedConstraints.notes) {
    lines.push(`- Note: ${mergedConstraints.notes}`);
  }

  if (options.passage?.trim()) {
    lines.push("", "PASSAGE:", options.passage.trim());
  }

  if (options.voiceDna?.trim()) {
    lines.push("", `VOICE: ${options.voiceDna.trim()}`);
  }

  if (options.lexiconSwaps?.length) {
    lines.push("", "LEXICON SWAPS:");
    for (const swap of options.lexiconSwaps) {
      lines.push(`- ${swap}`);
    }
  }

  return lines.join("\n");
}

export function getLexiconHitsForText(text: string): LexiconHit[] {
  return lexiconHits(text);
}

export function getLexiconSwapLines(text: string): string[] {
  return formatLexiconSwaps(lexiconHits(text));
}

export function getPlatformPreset(
  platform: PlaybookPlatform,
  playbook: CopyPlaybook = COPY_PLAYBOOK,
): RewriteConstraints {
  return { ...playbook.platform_presets[platform].constraints };
}
