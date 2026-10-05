import type * as React from "react";
import { cn } from "@/lib/utils";

type PolicyFieldProps = {
  label: string;
  description?: string;
  source?: string;
  children: React.ReactNode;
  className?: string;
};

export function PolicyField({ label, description, source, children, className }: PolicyFieldProps) {
  return (
    <section
      className={cn(
        "grid gap-2 rounded-md border border-border bg-background px-3 py-3",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold leading-snug text-foreground">{label}</h3>
          {description ? (
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {source ? (
          <span className="shrink-0 rounded-md border border-border bg-background px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
            {source}
          </span>
        ) : null}
      </div>
      {children}
    </section>
  );
}
