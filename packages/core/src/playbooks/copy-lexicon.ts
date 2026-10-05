import type { PatternType } from "../types.ts";
import { COPY_PLAYBOOK } from "./copy-playbook.ts";

export interface LexiconSwap {
  from: string;
  to: string;
  context?: string;
  pattern_id?: PatternType;
}

export interface LexiconHit {
  from: string;
  to: string;
  index: number;
  matched: string;
}

/** Curated swaps for Tier-1 banned words (from field manual replacements). */
export const COPY_LEXICON: LexiconSwap[] = [
  { from: "delve", to: "look at / examine", pattern_id: "llm_fingerprint_word" },
  { from: "leverage", to: "use", pattern_id: "llm_fingerprint_word" },
  { from: "utilize", to: "use", pattern_id: "llm_fingerprint_word" },
  { from: "synergy", to: "combined effect", pattern_id: "llm_fingerprint_word" },
  { from: "optimize", to: "improve / tune", pattern_id: "llm_fingerprint_word" },
  { from: "streamline", to: "simplify", pattern_id: "llm_fingerprint_word" },
  { from: "empower", to: "enable / let", pattern_id: "marketing_register_leak" },
  { from: "innovative", to: "new / first to", pattern_id: "llm_fingerprint_word" },
  { from: "groundbreaking", to: "first to demonstrate", pattern_id: "importance_inflation" },
  { from: "transformative", to: "measurable change in", pattern_id: "importance_inflation" },
  { from: "landscape", to: "market / field", pattern_id: "llm_fingerprint_word" },
  { from: "harness", to: "use", pattern_id: "marketing_register_leak" },
  { from: "unlock", to: "open / enable", pattern_id: "marketing_register_leak" },
  { from: "unleash", to: "release / enable", pattern_id: "marketing_register_leak" },
  { from: "seamless", to: "smooth / without friction", pattern_id: "llm_fingerprint_word" },
  { from: "cutting-edge", to: "recent / current", pattern_id: "llm_fingerprint_word" },
  { from: "game-changer", to: "shifted how X works", pattern_id: "importance_inflation" },
  { from: "paradigm", to: "model / approach", pattern_id: "llm_fingerprint_word" },
  { from: "unprecedented", to: "first since / unlike prior", pattern_id: "importance_inflation" },
  { from: "elevate", to: "raise / improve", pattern_id: "marketing_register_leak" },
  { from: "foster", to: "build / support", pattern_id: "llm_fingerprint_word" },
  { from: "showcase", to: "show / demonstrate", pattern_id: "llm_fingerprint_word" },
  { from: "robust", to: "reliable / stable", pattern_id: "llm_fingerprint_word" },
  { from: "holistic", to: "full-picture / end-to-end", pattern_id: "llm_fingerprint_word" },
  { from: "actionable", to: "specific next step", pattern_id: "llm_fingerprint_word" },
];

const BANNED_SET = new Set(COPY_PLAYBOOK.banned_words.map((w) => w.toLowerCase()));

export function lexiconHits(text: string): LexiconHit[] {
  const lower = text.toLowerCase();
  const hits: LexiconHit[] = [];

  for (const swap of COPY_LEXICON) {
    const re = new RegExp(`\\b${escapeRegex(swap.from)}\\b`, "gi");
    let m: RegExpExecArray | null = re.exec(lower);
    while (m) {
      hits.push({
        from: swap.from,
        to: swap.to,
        index: m.index,
        matched: text.slice(m.index, m.index + m[0].length),
      });
      m = re.exec(lower);
    }
  }

  return hits.sort((a, b) => a.index - b.index);
}

export function formatLexiconSwaps(hits: LexiconHit[]): string[] {
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const h of hits) {
    const key = h.from.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(`"${h.matched}" → ${h.to}`);
  }
  return lines;
}

export function bannedWordWithoutSwap(text: string): string[] {
  const lower = text.toLowerCase();
  const withSwap = new Set(COPY_LEXICON.map((s) => s.from.toLowerCase()));
  const found: string[] = [];
  for (const word of COPY_PLAYBOOK.banned_words) {
    if (withSwap.has(word.toLowerCase())) continue;
    const re = new RegExp(`\\b${escapeRegex(word)}\\b`, "i");
    if (re.test(lower)) found.push(word);
  }
  return found;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/-/g, "[- ]");
}

export function isBannedWord(word: string): boolean {
  return BANNED_SET.has(word.toLowerCase());
}
