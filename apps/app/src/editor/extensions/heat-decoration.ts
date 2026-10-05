/**
 * HeatDecoration: ProseMirror plugin that applies heat-based background colors
 * to sentences. The decorations are ephemeral — computed from the analysis profile,
 * not stored in the document.
 */

import type { PatternType, StylometricProfile } from "@prosodeus/core/browser";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { heatToColor, patternSin, SIN_COLORS } from "../utils/pattern-styles";
import { buildSentencePositions } from "./sentence-tracker";

export const heatDecorationKey = new PluginKey("heatDecoration");

export type HeatDecorationMeta = {
  profile?: StylometricProfile | null;
  selectedSentenceIds?: number[];
  clusterHighlightPatternType?: PatternType | null;
  staleSentenceIds?: Set<number>;
  hotSentenceIds?: Set<number>;
  suggestionReadyIds?: Set<number>;
  suggestQueuedIds?: Set<number>;
};

interface HeatPluginState {
  profile: StylometricProfile | null;
  selectedSentenceIds: number[];
  clusterHighlightPatternType: PatternType | null;
  staleSentenceIds: Set<number>;
  hotSentenceIds: Set<number>;
  suggestionReadyIds: Set<number>;
  suggestQueuedIds: Set<number>;
  decorations: DecorationSet;
}

function buildDecorations(
  doc: Parameters<typeof buildSentencePositions>[0],
  profile: StylometricProfile | null,
  selectedSentenceIds: number[],
  clusterHighlightPatternType: PatternType | null,
  staleSentenceIds: Set<number>,
  hotSentenceIds: Set<number>,
  suggestionReadyIds: Set<number>,
  suggestQueuedIds: Set<number>,
): DecorationSet {
  if (!profile || profile.sentences.length === 0) {
    return DecorationSet.empty;
  }

  const positions = buildSentencePositions(doc, profile.sentences);
  const decorations: Decoration[] = [];
  const selectedSet = new Set(selectedSentenceIds);

  for (const sp of positions) {
    const { sentence, from, to } = sp;
    if (from >= to) continue;

    const isSelected = selectedSet.has(sentence.id);
    const isStale = staleSentenceIds.has(sentence.id);
    const isHot = hotSentenceIds.has(sentence.id);
    const isReady = suggestionReadyIds.has(sentence.id);
    const isQueued = suggestQueuedIds.has(sentence.id);

    const inCluster =
      clusterHighlightPatternType !== null &&
      sentence.classification.patterns.some((p) => p.type === clusterHighlightPatternType);

    const hasPatterns = sentence.classification.patterns.some(
      (p) => p.evidence && sentence.text.toLowerCase().includes(p.evidence.toLowerCase()),
    );

    if (isStale) {
      decorations.push(
        Decoration.inline(from, to, {
          style:
            "box-shadow: inset 3px 0 0 var(--muted-foreground); opacity: 0.5; border-radius: 2px;",
          class: "prosodeus-stale",
          "data-sentence-id": String(sentence.id),
        }),
      );
      continue;
    }

    // Hot sentences: subtle left bar by heat tier (patterned / eligible).
    if (isHot && !isSelected) {
      const { fg } = heatToColor(Math.max(sentence.heat, 2));
      const barStyle = isQueued
        ? `box-shadow: inset 3px 0 0 ${fg}; border-radius: 2px; opacity: 0.85;`
        : isReady
          ? `box-shadow: inset 3px 0 0 var(--moss); border-radius: 2px;`
          : `box-shadow: inset 3px 0 0 color-mix(in srgb, ${fg} 65%, transparent); border-radius: 2px;`;
      decorations.push(
        Decoration.inline(from, to, {
          style: barStyle,
          class: isReady
            ? "prosodeus-hot-ready"
            : isQueued
              ? "prosodeus-hot-queued"
              : "prosodeus-hot",
          "data-sentence-id": String(sentence.id),
          "data-heat": String(sentence.heat),
          title: `Heat: ${sentence.heat.toFixed(1)}/10`,
        }),
      );
    } else if (sentence.heat >= 8 && !hasPatterns) {
      const { bg } = heatToColor(sentence.heat);
      decorations.push(
        Decoration.inline(from, to, {
          style: `background: ${bg}; border-radius: 2px;`,
          class: "prosodeus-heat",
          "data-sentence-id": String(sentence.id),
          "data-heat": String(sentence.heat),
          title: `Heat: ${sentence.heat.toFixed(1)}/10`,
        }),
      );
    }

    if (inCluster) {
      decorations.push(
        Decoration.inline(from, to, {
          style:
            "box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--amber) 70%, transparent); border-radius: 2px;",
          class: "prosodeus-cluster",
          "data-sentence-id": String(sentence.id),
        }),
      );
    }

    if (isSelected) {
      decorations.push(
        Decoration.inline(from, to, {
          style:
            "box-shadow: inset 3px 0 0 var(--ink); background: var(--ink-soft); border-radius: 2px;",
          class: "prosodeus-selected",
        }),
      );
    }

    if (isStale) continue;

    for (let i = 0; i < sentence.classification.patterns.length; i++) {
      const pattern = sentence.classification.patterns[i]!;
      if (!pattern.evidence) continue;

      const evidenceIdx = sentence.text.toLowerCase().indexOf(pattern.evidence.toLowerCase());
      if (evidenceIdx < 0) continue;

      const evidenceFrom = from + evidenceIdx;
      const evidenceTo = evidenceFrom + pattern.evidence.length;

      if (evidenceFrom >= evidenceTo || evidenceTo > to) continue;

      const sin = patternSin(pattern.type);
      const sinStyle = SIN_COLORS[sin];

      decorations.push(
        Decoration.inline(evidenceFrom, evidenceTo, {
          style: `border-bottom: 2px solid ${sinStyle.color}; cursor: pointer;`,
          class: `prosodeus-pattern prosodeus-pattern-${pattern.type}`,
          "data-pattern-type": pattern.type,
          "data-sentence-id": String(sentence.id),
          "data-pattern-idx": String(i),
        }),
      );
    }
  }

  return DecorationSet.create(doc, decorations);
}

export function createHeatDecorationPlugin() {
  return new Plugin<HeatPluginState>({
    key: heatDecorationKey,

    state: {
      init(): HeatPluginState {
        return {
          profile: null,
          selectedSentenceIds: [],
          clusterHighlightPatternType: null,
          staleSentenceIds: new Set(),
          hotSentenceIds: new Set(),
          suggestionReadyIds: new Set(),
          suggestQueuedIds: new Set(),
          decorations: DecorationSet.empty,
        };
      },

      apply(tr, prev, _oldState, newState): HeatPluginState {
        const meta = tr.getMeta(heatDecorationKey) as HeatDecorationMeta | undefined;

        if (meta) {
          const profile = meta.profile !== undefined ? meta.profile : prev.profile;
          const selected =
            meta.selectedSentenceIds !== undefined
              ? meta.selectedSentenceIds
              : prev.selectedSentenceIds;
          const clusterHighlight =
            meta.clusterHighlightPatternType !== undefined
              ? meta.clusterHighlightPatternType
              : prev.clusterHighlightPatternType;
          const stale =
            meta.staleSentenceIds !== undefined ? meta.staleSentenceIds : prev.staleSentenceIds;
          const hot = meta.hotSentenceIds !== undefined ? meta.hotSentenceIds : prev.hotSentenceIds;
          const ready =
            meta.suggestionReadyIds !== undefined
              ? meta.suggestionReadyIds
              : prev.suggestionReadyIds;
          const queued =
            meta.suggestQueuedIds !== undefined ? meta.suggestQueuedIds : prev.suggestQueuedIds;
          return {
            profile,
            selectedSentenceIds: selected,
            clusterHighlightPatternType: clusterHighlight,
            staleSentenceIds: stale,
            hotSentenceIds: hot,
            suggestionReadyIds: ready,
            suggestQueuedIds: queued,
            decorations: buildDecorations(
              newState.doc,
              profile,
              selected,
              clusterHighlight,
              stale,
              hot,
              ready,
              queued,
            ),
          };
        }

        if (tr.docChanged && prev.profile) {
          return {
            ...prev,
            decorations: buildDecorations(
              newState.doc,
              prev.profile,
              prev.selectedSentenceIds,
              prev.clusterHighlightPatternType,
              prev.staleSentenceIds,
              prev.hotSentenceIds,
              prev.suggestionReadyIds,
              prev.suggestQueuedIds,
            ),
          };
        }

        return prev;
      },
    },

    props: {
      decorations(state) {
        return this.getState(state)?.decorations ?? DecorationSet.empty;
      },
    },
  });
}
