import type { RewriteConstraints } from "@prosodeus/shared/browser";
import { Loader2, Sparkles } from "lucide-react";
import * as React from "react";
import { PolicyField } from "@/components/policy/PolicyField";
import {
  EXPRESSION_BUDGET_OPTIONS,
  REPETITION_TOLERANCE_OPTIONS,
  STATEMENT_FORCE_OPTIONS,
} from "@/components/policy/rewrite-policy";
import { SegmentedControl } from "@/components/policy/SegmentedControl";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/shell/Panel";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { DEFAULT_CONSTRAINTS } from "./rewrite-constraints";

export type RewriteScope = "sentence" | "paragraph" | "section";

type RewriteSetupPanelProps = {
  constraints: RewriteConstraints;
  onConstraintChange: <K extends keyof RewriteConstraints>(
    key: K,
    value: RewriteConstraints[K],
  ) => void;
  scope: RewriteScope;
  onScopeChange: (next: RewriteScope) => void;
  alternativesCount: number;
  onAlternativesCountChange: (next: number) => void;
  hasDetectedPatterns: boolean;
  isRewriting: boolean;
  rewriteStep: string | null;
  disabled: boolean;
  onGenerate: () => void;
};

export function RewriteSetupPanel({
  constraints,
  onConstraintChange,
  scope,
  onScopeChange,
  alternativesCount,
  onAlternativesCountChange,
  hasDetectedPatterns,
  isRewriting,
  rewriteStep,
  disabled,
  onGenerate,
}: RewriteSetupPanelProps) {
  return (
    <Panel>
      <PanelHeader className="border-b-0 pb-1">
        <PanelTitle>Rewrite setup</PanelTitle>
      </PanelHeader>
      <PanelBody className="space-y-5 pt-1">
        <PolicyField label="Scope">
          <SegmentedControl<RewriteScope>
            value={scope}
            onChange={onScopeChange}
            aria-label="Rewrite scope"
            options={[
              { value: "sentence", label: "Sentence" },
              { value: "paragraph", label: "Paragraph" },
              { value: "section", label: "Section" },
            ]}
          />
        </PolicyField>

        <div className="grid gap-2 rounded-md border border-border bg-background px-3 py-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-foreground">Settings source</h3>
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              precedence
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <SourceChip label="Style" value="defaults" />
            <SourceChip label="Pattern" value={hasDetectedPatterns ? "active" : "none"} />
            <SourceChip label="Run" value="last" />
          </div>
        </div>

        <PolicyField
          label="How strong should the statement be?"
          description="Choose the force the evidence can carry."
          source={
            constraints.statement_force !== DEFAULT_CONSTRAINTS.statement_force ? "run" : "style"
          }
        >
          <SegmentedControl
            value={constraints.statement_force}
            onChange={(value) => onConstraintChange("statement_force", value)}
            aria-label="Statement strength"
            options={STATEMENT_FORCE_OPTIONS}
          />
        </PolicyField>

        <PolicyField
          label="Allowed strongest expressions"
          description="Controls how many maximal or superlative phrases can remain."
          source={
            constraints.expression_budget !== DEFAULT_CONSTRAINTS.expression_budget
              ? "run"
              : "density"
          }
        >
          <SegmentedControl
            value={constraints.expression_budget}
            onChange={(value) => onConstraintChange("expression_budget", value)}
            aria-label="Allowed strongest expressions"
            options={EXPRESSION_BUDGET_OPTIONS}
          />
        </PolicyField>

        <PolicyField
          label="Opening repetition tolerance"
          description="Keep repeated openings only when they are deliberate."
          source={
            constraints.rhythm_policy !== DEFAULT_CONSTRAINTS.rhythm_policy
              ? "run"
              : hasDetectedPatterns
                ? "pattern"
                : "style"
          }
        >
          <SegmentedControl
            value={constraints.rhythm_policy}
            onChange={(value) => onConstraintChange("rhythm_policy", value)}
            aria-label="Opening repetition tolerance"
            options={REPETITION_TOLERANCE_OPTIONS}
          />
        </PolicyField>

        <div className="rounded-md border border-border bg-background px-3 py-3">
          <h3 className="text-sm font-semibold text-foreground">Preserve</h3>
          <div className="mt-3 grid gap-2 text-sm text-foreground">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked readOnly className="accent-primary" />
              Preserve meaning
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked readOnly className="accent-primary" />
              Preserve terminology
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked readOnly className="accent-primary" />
              Preserve evidence references
            </label>
          </div>
        </div>

        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-foreground">Alternatives</span>
            <div className="inline-grid grid-flow-col overflow-hidden rounded-md border border-border bg-muted/45 p-0.5">
              {[2, 3, 4].map((value) => (
                <button
                  key={value}
                  type="button"
                  className={cn(
                    "h-8 w-12 rounded-[5px] text-xs font-medium transition-colors",
                    alternativesCount === value
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-background hover:text-foreground",
                  )}
                  onClick={() => onAlternativesCountChange(value)}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="w-full" tabIndex={disabled ? 0 : undefined}>
                  <Button
                    size="sm"
                    className="mt-2 h-10 w-full gap-2"
                    disabled={disabled || isRewriting}
                    onClick={onGenerate}
                  >
                    {isRewriting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    {isRewriting ? (rewriteStep ?? "Rewriting") : "Run alternatives"}
                  </Button>
                </span>
              </TooltipTrigger>
              {disabled && !isRewriting ? (
                <TooltipContent>Select a sentence in the editor first</TooltipContent>
              ) : null}
            </Tooltip>
          </TooltipProvider>
        </div>
      </PanelBody>
    </Panel>
  );
}

function SourceChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/50 px-2 py-2">
      <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-xs font-semibold text-foreground">{value}</p>
    </div>
  );
}
