/**
 * SelectionBridge: ProseMirror plugin that maps TipTap's native selection
 * (cursor / drag) to overlapping sentence IDs from the analysis profile.
 *
 * Eliminates the need for a separate `data-sentence-id` click handler —
 * the user's cursor position IS the selection.
 */

import type { StylometricProfile } from "@prosodeus/core/browser";
import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { heatDecorationKey } from "./heat-decoration";
import { buildSentencePositions } from "./sentence-tracker";

export interface SelectionContext {
  sentenceIds: number[]; // [] pre-analysis; [3] cursor; [3,4,5] drag
  focalSentenceId: number | null; // anchor sentence (for inspector focus)
  from: number; // ProseMirror position
  to: number;
  isRange: boolean; // true when user dragged a selection
}

export const EMPTY_SELECTION_CONTEXT: SelectionContext = {
  sentenceIds: [],
  focalSentenceId: null,
  from: 0,
  to: 0,
  isRange: false,
};

export type SelectionChangeCallback = (ctx: SelectionContext) => void;

const selectionBridgeKey = new PluginKey("selectionBridge");

function resolveSelectionContext(view: EditorView): SelectionContext {
  const { from, to } = view.state.selection;
  const isRange = from !== to;

  // Read profile from the heat decoration plugin state
  const heatState = heatDecorationKey.getState(view.state);
  const profile: StylometricProfile | null = heatState?.profile ?? null;

  if (!profile || profile.sentences.length === 0) {
    return { sentenceIds: [], focalSentenceId: null, from, to, isRange };
  }

  const positions = buildSentencePositions(view.state.doc, profile.sentences);

  // Find all sentence positions that overlap with the selection range
  const overlapping: number[] = [];
  for (const sp of positions) {
    if (sp.from < to && sp.to > from) {
      overlapping.push(sp.sentence.id);
    }
  }

  // Focal sentence: the one containing the anchor (selection.from)
  let focalSentenceId: number | null = null;
  for (const sp of positions) {
    if (sp.from <= from && sp.to >= from) {
      focalSentenceId = sp.sentence.id;
      break;
    }
  }
  // Fallback: first overlapping sentence
  if (focalSentenceId === null && overlapping.length > 0) {
    focalSentenceId = overlapping[0]!;
  }

  return {
    sentenceIds: overlapping,
    focalSentenceId,
    from,
    to,
    isRange,
  };
}

function createSelectionBridgePlugin(onSelectionChange: SelectionChangeCallback) {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let lastCtxJson = "";

  return new Plugin({
    key: selectionBridgeKey,

    view() {
      return {
        update(view) {
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            const ctx = resolveSelectionContext(view);
            const json = JSON.stringify(ctx);
            if (json !== lastCtxJson) {
              lastCtxJson = json;
              onSelectionChange(ctx);
            }
          }, 50);
        },
        destroy() {
          if (debounceTimer) clearTimeout(debounceTimer);
        },
      };
    },
  });
}

export const SelectionBridge = Extension.create<{
  onSelectionChange: SelectionChangeCallback;
}>({
  name: "selectionBridge",

  addOptions() {
    return {
      onSelectionChange: () => {},
    };
  },

  addProseMirrorPlugins() {
    return [createSelectionBridgePlugin(this.options.onSelectionChange)];
  },
});
