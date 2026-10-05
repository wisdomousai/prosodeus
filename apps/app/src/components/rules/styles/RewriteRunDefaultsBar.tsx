import { FileText, Link2, RotateCw, SlidersHorizontal, Thermometer } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";

const RUN_SETTINGS = [
  { icon: FileText, label: "Scope", value: "Full document" },
  { icon: RotateCw, label: "Passes", value: "2" },
  { icon: Thermometer, label: "Temperature", value: "Balanced" },
  { icon: Link2, label: "Preserve citations", value: "On" },
];

export function RewriteRunDefaultsBar() {
  return (
    <section className="mx-5 mb-5 flex shrink-0 items-center gap-3 overflow-x-auto rounded-b-md border border-border bg-card px-5 py-2 shadow-sm">
      <div className="mr-auto flex shrink-0 items-baseline gap-3">
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Rewrite run settings
        </p>
        <p className="hidden text-xs text-muted-foreground lg:block">
          Applied after style defaults and pattern overrides.
        </p>
      </div>
      {RUN_SETTINGS.map((setting) => {
        const Icon = setting.icon;
        return (
          <div
            key={setting.label}
            className="flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-xs"
          >
            <Icon className="size-3.5 text-muted-foreground" strokeWidth={1.8} />
            <span className="text-muted-foreground">{setting.label}:</span>
            <span className="font-medium text-foreground">{setting.value}</span>
          </div>
        );
      })}
      <Button type="button" variant="outline" size="sm" className="h-8 shrink-0 gap-1.5 text-xs">
        <SlidersHorizontal className="size-3.5" />
        Edit run settings
      </Button>
    </section>
  );
}
