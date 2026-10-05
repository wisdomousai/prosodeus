import type { OppositionResultEvent } from "@prosodeus/shared/browser";
import { analysisTextEquals } from "@/lib/analysis-text";

export type OppositionEdit = OppositionResultEvent["data"]["edits"][number];

export type OppositionReviewStatus = "pending" | "applied" | "ignored";

export interface OppositionReviewItem {
  edit: OppositionEdit;
  key: string;
  status: OppositionReviewStatus;
  statusLabel: string;
  replacementOptions: string[];
  primaryReplacement: string;
}

const STATUS_LABELS: Record<OppositionReviewStatus, string> = {
  pending: "Pending",
  applied: "Applied",
  ignored: "Ignored",
};

export function normalizeOppositionSentence(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

export function isOppositionRunStale(currentText: string, sourceText: string): boolean {
  return !analysisTextEquals(currentText, sourceText);
}

export function oppositionEditKey(edit: OppositionEdit): string {
  const endId = edit.span.sentence_end_id ?? edit.span.sentence_id;
  return `${edit.span.sentence_id}-${endId}:${normalizeOppositionSentence(edit.original_sentence)}`;
}

export function oppositionReplacementOptions(edit: OppositionEdit): string[] {
  const original = normalizeOppositionSentence(edit.original_sentence);
  const seen = new Set<string>();
  const values = [
    edit.rewritten_sentence !== edit.original_sentence ? edit.rewritten_sentence : null,
    ...(edit.alternatives ?? []),
  ];
  const out: string[] = [];

  for (const value of values) {
    if (!value) continue;
    const trimmed = value.trim();
    const normalized = normalizeOppositionSentence(trimmed);
    if (!trimmed || normalized === original || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(trimmed);
  }

  return out;
}

function buildOppositionReviewItemFromOptions(
  edit: OppositionEdit,
  replacementOptions: string[],
  status: OppositionReviewStatus = "pending",
): OppositionReviewItem | null {
  const primaryReplacement = replacementOptions[0];
  if (!primaryReplacement) return null;

  return {
    edit,
    key: oppositionEditKey(edit),
    status,
    statusLabel: STATUS_LABELS[status],
    replacementOptions,
    primaryReplacement,
  };
}

export function buildOppositionReviewItem(
  edit: OppositionEdit,
  status: OppositionReviewStatus = "pending",
): OppositionReviewItem | null {
  return buildOppositionReviewItemFromOptions(edit, oppositionReplacementOptions(edit), status);
}

export function buildOppositionReviewItems(
  edits: OppositionEdit[],
  statuses: Map<string, OppositionReviewStatus>,
): OppositionReviewItem[] {
  const groups = new Map<string, { representative: OppositionEdit; options: string[] }>();
  for (const edit of edits) {
    const key = oppositionEditKey(edit);
    const options = oppositionReplacementOptions(edit);
    if (options.length === 0) continue;
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, { representative: edit, options: [...options] });
      continue;
    }

    if (!existing.representative.accepted && edit.accepted) {
      existing.representative = edit;
    }
    for (const option of options) {
      const normalized = normalizeOppositionSentence(option);
      if (
        !existing.options.some(
          (existingOption) => normalizeOppositionSentence(existingOption) === normalized,
        )
      ) {
        existing.options.push(option);
      }
    }
  }

  return Array.from(groups.entries()).flatMap(([key, group]) => {
    const item = buildOppositionReviewItemFromOptions(
      group.representative,
      group.options,
      statuses.get(key) ?? "pending",
    );
    return item ? [item] : [];
  });
}
