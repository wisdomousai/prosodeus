/**
 * PatternTooltip: floating tooltip that appears above a hovered pattern highlight
 * inside the Tiptap editor. Positioned absolutely relative to the editor container.
 */

import type { RewriteSuggestion } from "@prosodeus/core/browser";
import type { Editor } from "@tiptap/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { PATTERN_LABELS, patternSin, SIN_COLORS } from "./utils/pattern-styles";

interface Props {
  editor: Editor | null;
  containerRef: React.RefObject<HTMLDivElement | null>;
  suggestions?: Map<number, RewriteSuggestion[]>;
}

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  label: string;
  color: string;
  suggestionText?: string;
  suggestionRationale?: string;
}

export function PatternTooltip({ editor, containerRef, suggestions }: Props) {
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    x: 0,
    y: 0,
    label: "",
    color: "",
  });

  const handleMouseOver = useCallback(
    (e: MouseEvent) => {
      const el = (e.target as HTMLElement).closest(".prosodeus-pattern") as HTMLElement | null;
      if (!el || !containerRef.current) return;

      const type = el.getAttribute("data-pattern-type") ?? "";
      const sin = patternSin(type);
      const style = SIN_COLORS[sin];
      const label = PATTERN_LABELS[type] ?? type;

      const containerRect = containerRef.current.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();

      // Look up suggestion for this sentence
      let suggestionText: string | undefined;
      let suggestionRationale: string | undefined;
      if (suggestions) {
        const sentenceIdStr = el.getAttribute("data-sentence-id");
        const sentenceId = sentenceIdStr != null ? parseInt(sentenceIdStr, 10) : NaN;
        if (!isNaN(sentenceId)) {
          const sugs = suggestions.get(sentenceId);
          if (sugs && sugs.length > 0) {
            const firstAlt = sugs[0]!.alternatives[0];
            if (firstAlt) {
              suggestionText = firstAlt.text;
              suggestionRationale = firstAlt.rationale;
            }
          }
        }
      }

      setTooltip({
        visible: true,
        x: elRect.left + elRect.width / 2 - containerRect.left,
        y: elRect.top - containerRect.top - 8,
        label,
        color: style.tooltip,
        suggestionText,
        suggestionRationale,
      });
    },
    [containerRef, suggestions],
  );

  const handleMouseOut = useCallback((e: MouseEvent) => {
    const el = (e.target as HTMLElement).closest(".prosodeus-pattern");
    if (el) setTooltip((prev) => ({ ...prev, visible: false }));
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener("mouseover", handleMouseOver);
    container.addEventListener("mouseout", handleMouseOut);
    return () => {
      container.removeEventListener("mouseover", handleMouseOver);
      container.removeEventListener("mouseout", handleMouseOut);
    };
  }, [containerRef, handleMouseOver, handleMouseOut]);

  if (!tooltip.visible) return null;

  return (
    <div
      className="absolute z-20 pointer-events-none"
      style={{
        left: tooltip.x,
        top: tooltip.y,
        transform: "translate(-50%, -100%)",
      }}
    >
      <span
        className="whitespace-nowrap"
        style={{
          display: "block",
          fontFamily: "var(--font-mono, monospace)",
          fontSize: "0.5rem",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          padding: "3px 8px",
          borderRadius: tooltip.suggestionText ? "2px 2px 0 0" : 2,
          background: tooltip.color,
          color: "#ede6db",
        }}
      >
        {tooltip.label}
      </span>
      {tooltip.suggestionText && (
        <span
          className="block max-w-[320px] whitespace-normal"
          style={{
            fontFamily: "var(--font-mono, monospace)",
            fontSize: "0.6rem",
            padding: "3px 8px",
            borderRadius: "0 0 2px 2px",
            background: "rgba(30,30,30,0.92)",
            color: "#c8d0b8",
            lineHeight: 1.4,
          }}
        >
          {tooltip.suggestionText}
          {tooltip.suggestionRationale && (
            <span style={{ display: "block", color: "#888", marginTop: 2 }}>
              {tooltip.suggestionRationale}
            </span>
          )}
        </span>
      )}
    </div>
  );
}
