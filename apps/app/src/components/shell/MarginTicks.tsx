import * as React from "react";
import { cn } from "@/lib/utils";

export type MarginTick = {
  id: string;
  /** 0..1 vertical position relative to the editor body. */
  position: number;
  /** 0..1 magnitude (drives tick width). */
  magnitude: number;
  /** "low" | "medium" | "high" — drives color from heat scale. */
  level: "low" | "medium" | "high";
  label?: string;
  onClick?: () => void;
};

const LEVEL_BG: Record<MarginTick["level"], string> = {
  low: "bg-[var(--moss)]",
  medium: "bg-[var(--amber)]",
  high: "bg-[var(--blood)]",
};

type MarginTicksProps = {
  ticks: MarginTick[];
  className?: string;
};

export function MarginTicks({ ticks, className }: MarginTicksProps) {
  return (
    <div aria-hidden className={cn("relative w-3 shrink-0 border-r border-border/60", className)}>
      {ticks.map((t) => {
        const widthPct = Math.max(20, Math.min(100, t.magnitude * 100));
        return (
          <button
            key={t.id}
            type="button"
            onClick={t.onClick}
            title={t.label}
            className={cn(
              "absolute left-0 h-[3px] rounded-r-sm opacity-80 hover:opacity-100",
              LEVEL_BG[t.level],
            )}
            style={{
              top: `${(t.position * 100).toFixed(2)}%`,
              width: `${widthPct}%`,
            }}
          />
        );
      })}
    </div>
  );
}
