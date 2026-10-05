import {
  type HashedSentence,
  type StylometricProfile,
  splitAndHash,
} from "@prosodeus/core/browser";
import type { Editor } from "@tiptap/core";
import type { MutableRefObject } from "react";
import { buildSentencePositions } from "@/editor/extensions/sentence-tracker";
import { exportEditorPlaintext, normalizeRewriteInsertText } from "@/lib/editor-plaintext";

export interface ApplySentenceReplacementArgs {
  tiptapEditor: Editor | null;
  profile: StylometricProfile | null;
  sentenceId: number;
  newText: string;
  textRef: MutableRefObject<string>;
  setEditorText: (text: string) => void;
  suppressEditorSideEffectsRef: MutableRefObject<boolean>;
  markApplied: (newText: string, fallbackStaleIds: number[]) => number[];
  patchProfileSentenceText: (sentenceId: number, newText: string) => void;
  dismissSuggestions?: (sentenceId: number) => void;
  onApplied?: () => void;
}

export function applySentenceReplacement(args: ApplySentenceReplacementArgs): boolean {
  const { tiptapEditor, profile, sentenceId, newText } = args;
  if (!tiptapEditor || !profile) return false;

  const positions = buildSentencePositions(tiptapEditor.state.doc, profile.sentences);
  const sp = positions.find((p) => p.sentence.id === sentenceId);
  if (!sp) return false;

  const normalized = normalizeRewriteInsertText(newText);
  if (!normalized) return false;

  args.suppressEditorSideEffectsRef.current = true;
  tiptapEditor.chain().insertContentAt({ from: sp.from, to: sp.to }, normalized).run();

  args.dismissSuggestions?.(sentenceId);

  const updatedText = exportEditorPlaintext(tiptapEditor);
  args.textRef.current = updatedText;
  args.setEditorText(updatedText);

  args.patchProfileSentenceText(sentenceId, normalized);
  args.markApplied(updatedText, [sentenceId]);
  args.onApplied?.();
  return true;
}

export interface OppositionSentenceReplacementRequest {
  sourceText: string;
  sentenceId: number;
  sentenceEndId?: number;
  originalSentence: string;
  newText: string;
}

export interface ApplyOppositionSentenceReplacementArgs
  extends OppositionSentenceReplacementRequest {
  tiptapEditor: Editor | null;
  textRef: MutableRefObject<string>;
  setEditorText: (text: string) => void;
  suppressEditorSideEffectsRef: MutableRefObject<boolean>;
  markApplied: (newText: string, fallbackStaleIds: number[]) => number[];
  patchProfileSentenceText?: (sentenceId: number, newText: string) => void;
  onApplied?: () => void;
}

function normalizeSentenceForMatch(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

function sentenceMatches(sentence: Pick<HashedSentence, "text">, expected: string): boolean {
  return normalizeSentenceForMatch(sentence.text) === normalizeSentenceForMatch(expected);
}

interface OppositionSnapshotRange {
  start: HashedSentence;
  end: HashedSentence;
  sentenceIds: number[];
}

function sentenceRangeText(sentences: HashedSentence[]): string {
  return sentences.map((sentence) => sentence.text).join(" ");
}

function rangeMatches(sentences: HashedSentence[], expected: string): boolean {
  return (
    normalizeSentenceForMatch(sentenceRangeText(sentences)) === normalizeSentenceForMatch(expected)
  );
}

export function resolveOppositionSnapshotSentence(
  sourceText: string,
  sentenceId: number,
  originalSentence: string,
): HashedSentence | null {
  const sentences = splitAndHash(sourceText);
  const hinted = sentences.find((sentence) => sentence.id === sentenceId);
  if (hinted && sentenceMatches(hinted, originalSentence)) return hinted;

  const matches = sentences.filter((sentence) => sentenceMatches(sentence, originalSentence));
  return matches.length === 1 ? (matches[0] ?? null) : null;
}

export function resolveOppositionSnapshotRange(
  sourceText: string,
  sentenceId: number,
  sentenceEndId: number | undefined,
  originalSentence: string,
): OppositionSnapshotRange | null {
  const sentences = splitAndHash(sourceText);
  const endId = sentenceEndId ?? sentenceId;
  if (endId < sentenceId) return null;

  const hinted = sentences.filter((sentence) => sentence.id >= sentenceId && sentence.id <= endId);
  if (
    hinted.length === endId - sentenceId + 1 &&
    hinted.every((sentence, index) => sentence.id === sentenceId + index) &&
    rangeMatches(hinted, originalSentence)
  ) {
    const start = hinted[0];
    const end = hinted[hinted.length - 1];
    if (!start || !end) return null;
    return {
      start,
      end,
      sentenceIds: hinted.map((sentence) => sentence.id),
    };
  }

  const rangeLength = Math.max(1, endId - sentenceId + 1);
  const matches: OppositionSnapshotRange[] = [];
  for (let i = 0; i <= sentences.length - rangeLength; i++) {
    const window = sentences.slice(i, i + rangeLength);
    if (!rangeMatches(window, originalSentence)) continue;
    const start = window[0];
    const end = window[window.length - 1];
    if (!start || !end) continue;
    matches.push({
      start,
      end,
      sentenceIds: window.map((sentence) => sentence.id),
    });
  }

  if (matches.length === 1) return matches[0] ?? null;

  if (rangeLength === 1) {
    const single = resolveOppositionSnapshotSentence(sourceText, sentenceId, originalSentence);
    if (single) return { start: single, end: single, sentenceIds: [single.id] };
  }

  return null;
}

export function applyOppositionSentenceReplacement(
  args: ApplyOppositionSentenceReplacementArgs,
): string | null {
  const {
    tiptapEditor,
    sourceText,
    sentenceId,
    sentenceEndId,
    originalSentence,
    newText,
    textRef,
  } = args;
  if (!tiptapEditor) return null;
  if (textRef.current !== sourceText) return null;

  const normalized = normalizeRewriteInsertText(newText);
  if (!normalized) return null;

  const target = resolveOppositionSnapshotRange(
    sourceText,
    sentenceId,
    sentenceEndId,
    originalSentence,
  );
  if (!target) return null;

  const positions = buildSentencePositions(tiptapEditor.state.doc, splitAndHash(sourceText));
  const startPosition = positions.find(
    (position) =>
      position.sentence.id === target.start.id &&
      sentenceMatches(position.sentence, target.start.text),
  );
  const endPosition = positions.find(
    (position) =>
      position.sentence.id === target.end.id && sentenceMatches(position.sentence, target.end.text),
  );
  if (!startPosition || !endPosition || startPosition.from > endPosition.to) return null;

  args.suppressEditorSideEffectsRef.current = true;
  tiptapEditor
    .chain()
    .insertContentAt({ from: startPosition.from, to: endPosition.to }, normalized)
    .run();

  const updatedText = exportEditorPlaintext(tiptapEditor);
  args.textRef.current = updatedText;
  args.setEditorText(updatedText);

  if (target.start.id === target.end.id) {
    args.patchProfileSentenceText?.(target.start.id, normalized);
  }
  args.markApplied(updatedText, target.sentenceIds);
  args.onApplied?.();
  return updatedText;
}
