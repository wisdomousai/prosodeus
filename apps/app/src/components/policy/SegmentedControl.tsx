import * as React from "react";
import { cn } from "@/lib/utils";

export type SegmentedOption<V extends string> = {
  value: V;
  label: string;
  disabled?: boolean;
};

type SegmentedControlProps<V extends string> = {
  value: V | undefined;
  onChange: (next: V) => void;
  options: SegmentedOption<V>[];
  "aria-label": string;
  className?: string;
  size?: "sm" | "md";
  disabled?: boolean;
};

export function SegmentedControl<V extends string>({
  value,
  onChange,
  options,
  className,
  size = "md",
  disabled,
  "aria-label": ariaLabel,
}: SegmentedControlProps<V>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "grid grid-flow-col auto-cols-fr overflow-hidden rounded-md border border-border bg-muted/45 p-0.5",
        size === "sm" ? "min-h-7" : "min-h-9",
        className,
      )}
    >
      {options.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled || option.disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              "min-w-0 rounded-[5px] text-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-45",
              size === "sm" ? "min-h-6 px-2 py-1.5 text-xs" : "min-h-8 px-2 py-2 text-xs",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-background hover:text-foreground",
            )}
          >
            <span className="block truncate">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
