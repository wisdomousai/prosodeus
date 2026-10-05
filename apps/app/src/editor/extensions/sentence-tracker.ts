/**
 * SentenceTracker: maps sentence IDs from the StylometricProfile to ProseMirror
 * document positions. This is the bridge between the classifier's sentence-level
 * output and ProseMirror's position-based decoration system.
 *
 * Algorithm:
 * 1. Walk ProseMirror doc nodes, collecting block-level text nodes with their positions
 * 2. Group by paragraph (consecutive block nodes = 1 paragraph, matching paragraph_id)
 * 3. For each sentence in the profile, find it within the paragraph text using string matching
 * 4. Map the string offset back to a ProseMirror position range (from, to)
 */

import type { ClassifiedSentence, HashedSentence } from "@prosodeus/core/browser";
import type { Node as PMNode } from "@tiptap/pm/model";

type TrackableSentence = Pick<HashedSentence, "id" | "paragraph_id" | "text">;

export interface SentencePosition<TSentence extends TrackableSentence = ClassifiedSentence> {
  sentence: TSentence;
  from: number; // ProseMirror position (inclusive)
  to: number; // ProseMirror position (exclusive)
}

interface BlockInfo {
  node: PMNode;
  from: number; // position of the start of the node's content
  to: number; // position of the end of the node's content
  text: string;
  paragraphIndex: number;
}

/**
 * Build a map from sentence IDs to ProseMirror position ranges.
 */
export function buildSentencePositions(
  doc: PMNode,
  sentences: ClassifiedSentence[],
): SentencePosition[];
export function buildSentencePositions<TSentence extends TrackableSentence>(
  doc: PMNode,
  sentences: TSentence[],
): SentencePosition<TSentence>[];
export function buildSentencePositions<TSentence extends TrackableSentence>(
  doc: PMNode,
  sentences: TSentence[],
): SentencePosition<TSentence>[] {
  // Step 1: Collect block-level text nodes with positions
  const blocks: BlockInfo[] = [];
  let paragraphIndex = 0;

  doc.forEach((node, offset) => {
    if (node.isBlock && node.textContent.trim()) {
      blocks.push({
        node,
        from: offset + 1, // +1 because offset is before the node, content starts at offset+1
        to: offset + 1 + node.content.size,
        text: node.textContent,
        paragraphIndex,
      });
      paragraphIndex++;
    }
  });

  // Step 2: Group sentences by paragraph_id
  const sentencesByParagraph = new Map<number, TSentence[]>();
  for (const s of sentences) {
    const arr = sentencesByParagraph.get(s.paragraph_id) ?? [];
    arr.push(s);
    sentencesByParagraph.set(s.paragraph_id, arr);
  }

  // Step 3: For each block, match its sentences within the block text
  const positions: SentencePosition<TSentence>[] = [];

  for (const block of blocks) {
    const paraSentences = sentencesByParagraph.get(block.paragraphIndex);
    if (!paraSentences) continue;

    let searchFrom = 0;
    for (const sentence of paraSentences) {
      const text = sentence.text.trim();
      if (!text) continue;

      const idx = block.text.indexOf(text, searchFrom);
      if (idx >= 0) {
        positions.push({
          sentence,
          from: block.from + idx,
          to: block.from + idx + text.length,
        });
        searchFrom = idx + text.length;
      } else {
        // Fallback: fuzzy match — try finding the first few words
        const prefix = text.slice(0, Math.min(30, text.length));
        const fuzzyIdx = block.text.indexOf(prefix, searchFrom);
        if (fuzzyIdx >= 0) {
          positions.push({
            sentence,
            from: block.from + fuzzyIdx,
            to: block.from + fuzzyIdx + text.length,
          });
          searchFrom = fuzzyIdx + text.length;
        }
      }
    }
  }

  return positions;
}
