import type { ClassifiedSentence, StyleGuide } from "@prosodeus/core/browser";
import { reverseEngineerGuide, splitAndHash } from "@prosodeus/core/browser";

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function exemplarToClassifiedSentences(text: string): ClassifiedSentence[] {
  return splitAndHash(text).map((part, id) => ({
    id,
    text: part.text,
    hash: part.hash,
    paragraph_id: 0,
    classification: {
      biber: {
        informational: 0.4,
        involved: 0.3,
        narrative: 0.1,
        persuasive: 0.1,
        abstract: 0.05,
        elaborative: 0.05,
      },
      patterns: [],
      metrics: {
        word_count: countWords(part.text),
        clause_count: 1,
        has_participial: false,
        has_relative_clause: false,
        clause_balance_ratio: 0.5,
        construction_type: "simple",
      },
      arc_role: "claim",
    },
    heat: 0,
  }));
}

export function compactVoiceDna(guide: StyleGuide): string {
  const t = guide.targets;
  return [
    `Sentence length ~${t.sentence_length.mean} words.`,
    `Vary rhythm (autocorrelation ≤${t.sentence_length_autocorrelation.max_rho}).`,
    `Device entropy ≥${t.device_entropy.min}.`,
    `Nominalization max ${t.nominalization_ratio.max}.`,
  ].join(" ");
}

export function trainVoiceFromExemplar(text: string, name = "My Voice") {
  const sentences = exemplarToClassifiedSentences(text);
  const guide = reverseEngineerGuide(name, "Derived from exemplar text", sentences);
  return { guide, voiceDna: compactVoiceDna(guide) };
}
