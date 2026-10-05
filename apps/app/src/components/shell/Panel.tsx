import * as React from "react";
import { cn } from "@/lib/utils";

type PanelProps = React.HTMLAttributes<HTMLDivElement> & {
  /**
   * inset = cream surface inside a section (e.g. an inspector tab card).
   * flush = transparent, just spacing + border-bottom separators.
   */
  variant?: "inset" | "flush";
};

export function Panel({ variant = "inset", className, ...rest }: PanelProps) {
  return (
    <div
      className={cn(
        "border border-border/90 shadow-sm",
        variant === "inset" && "bg-card",
        variant === "flush" && "bg-transparent border-0 border-b rounded-none",
        "rounded-md",
        className,
      )}
      {...rest}
    />
  );
}

export function PanelHeader({
  className,
  number,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { number?: number }) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 border-b border-border/70 px-4 py-3",
        className,
      )}
      {...rest}
    >
      {number != null ? (
        <>
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
              {number}
            </span>
            {React.Children.toArray(children)[0]}
          </div>
          {React.Children.count(children) > 1 && React.Children.toArray(children).slice(1)}
        </>
      ) : (
        children
      )}
    </div>
  );
}

export function PanelTitle({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "text-[11px] font-mono uppercase tracking-wider text-muted-foreground",
        className,
      )}
      {...rest}
    />
  );
}

export function PanelBody({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4", className)} {...rest} />;
}

export function PanelRow({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex items-center justify-between gap-3 py-1.5 text-sm", className)}
      {...rest}
    />
  );
}
