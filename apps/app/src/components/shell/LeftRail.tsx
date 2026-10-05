import { Link, useLocation } from "@tanstack/react-router";
import {
  ListTree,
  type LucideIcon,
  PencilLine,
  Settings as SettingsIcon,
  SlidersHorizontal,
} from "lucide-react";
import * as React from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type LeftRailEntry = {
  id: string;
  label: string;
  icon: LucideIcon;
  /** If present, clicking navigates here. */
  to?: string;
  /** If present, clicking calls this (used for document-local tabs like Density/Rewrite). */
  onClick?: () => void;
  /** Mark as active explicitly (for local tabs that aren't a route match). */
  active?: boolean;
};

const ENTRY_ORDER: Array<Pick<LeftRailEntry, "id" | "label"> & { icon: LucideIcon; to?: string }> =
  [
    { id: "writing", label: "Writing", icon: PencilLine, to: "/app" },
    { id: "outline", label: "Outline", icon: ListTree },
    { id: "rules", label: "Rules", icon: SlidersHorizontal, to: "/app/rules" },
    { id: "settings", label: "Settings", icon: SettingsIcon, to: "/app/account" },
  ];

type LeftRailProps = {
  /**
   * Override or extend the default entries (e.g. wire Density/Rewrite/Versions
   * to inspector tab switchers when an editor is open).
   */
  entries?: LeftRailEntry[];
  variant?: "compact" | "labeled";
};

export function LeftRail({ entries, variant = "compact" }: LeftRailProps) {
  const location = useLocation();
  const resolved = React.useMemo<LeftRailEntry[]>(() => {
    if (entries && entries.length) return entries;
    return ENTRY_ORDER.map((e) => ({
      id: e.id,
      label: e.label,
      icon: e.icon,
      to: e.to,
    }));
  }, [entries]);

  return (
    <TooltipProvider delayDuration={150}>
      <nav
        aria-label="Primary"
        className={cn(
          "hidden shrink-0 flex-col justify-between border-r border-[#12324f] bg-[#061a2b] py-3 text-[#f7f3eb] shadow-[inset_-1px_0_0_rgba(255,255,255,0.04)] md:flex",
          variant === "compact" && "w-14 items-center",
          variant === "labeled" && "w-28 px-2",
        )}
      >
        <div
          className={cn(
            "flex flex-col gap-2",
            variant === "compact" ? "items-center" : "items-stretch",
          )}
        >
          <Link
            to="/app"
            aria-label="Prosodeus"
            className={cn(
              "mb-3 flex items-center rounded-md text-[#d6a11f]",
              variant === "compact" ? "w-8 justify-center" : "w-full justify-start px-2",
              variant === "labeled" &&
                "min-h-[5.5rem] flex-col justify-center gap-1 px-0 text-center",
            )}
          >
            <span
              className={cn(
                "font-editorial leading-none",
                variant === "compact" ? "text-xl" : "text-5xl",
              )}
            >
              P
            </span>
            {variant === "labeled" ? (
              <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-[#dce7f1]">
                Prosodeus
              </span>
            ) : null}
          </Link>
          {resolved.map((entry) => {
            const Icon = entry.icon;
            const isRouteActive = entry.to !== undefined && location.pathname === entry.to;
            const isActive = entry.active ?? isRouteActive;
            const className = cn(
              "flex h-9 items-center rounded-md text-[#c8d0d9] transition-colors",
              "hover:bg-white/10 hover:text-white",
              isActive && "bg-[#0f4f87] text-white shadow-sm",
              variant === "compact" && "w-9 justify-center",
              variant === "labeled" &&
                "h-[4.6rem] w-full flex-col justify-center gap-2 px-2 text-[13px] font-medium",
            );
            const inner = (
              <>
                <Icon
                  className={cn("shrink-0", variant === "labeled" ? "h-5 w-5" : "h-4 w-4")}
                  strokeWidth={1.75}
                />
                {variant === "labeled" ? <span className="truncate">{entry.label}</span> : null}
              </>
            );
            const node = entry.to ? (
              <Link to={entry.to} className={className} aria-label={entry.label}>
                {inner}
              </Link>
            ) : (
              <button
                type="button"
                onClick={entry.onClick}
                className={className}
                aria-label={entry.label}
              >
                {inner}
              </button>
            );
            if (variant === "labeled") {
              return <React.Fragment key={entry.id}>{node}</React.Fragment>;
            }
            return (
              <Tooltip key={entry.id}>
                <TooltipTrigger asChild>{node}</TooltipTrigger>
                <TooltipContent side="right" sideOffset={6}>
                  <span className="text-xs">{entry.label}</span>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
        <div
          className={cn(
            "flex flex-col",
            variant === "compact" ? "items-center" : "items-stretch gap-1",
          )}
        >
          <button
            type="button"
            aria-label="Help"
            className={cn(
              "flex h-9 items-center rounded-md text-[#c8d0d9] hover:bg-white/10 hover:text-white",
              variant === "compact" && "w-9 justify-center",
              variant === "labeled" &&
                "h-[4.6rem] w-full flex-col justify-center gap-2 px-2 text-[13px] font-medium",
            )}
          >
            <PencilLine
              className={cn(variant === "labeled" ? "h-5 w-5" : "h-4 w-4")}
              strokeWidth={1.75}
            />
            {variant === "labeled" ? <span>Help</span> : null}
          </button>
        </div>
      </nav>
    </TooltipProvider>
  );
}
