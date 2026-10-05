import { AlertTriangle, CheckCircle2, FileSearch } from "lucide-react";
import * as React from "react";
import { Panel, PanelBody, PanelHeader, PanelRow, PanelTitle } from "@/components/shell/Panel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import type { PatternDetail as PatternDetailType } from "@/lib/api";

type Props = {
  pattern: PatternDetailType | null;
  loading?: boolean;
};

/**
 * Right-column calibration panel for a pattern. Shows the density threshold,
 * severity, and the rewrite directive used when this pattern is detected.
 *
 * Density threshold and severity are surfaced read-only here for now; persistent
 * editing flows through the inline PatternEditor in the center column.
 */
export function PatternCalibration({ pattern, loading }: Props) {
  if (loading) {
    return (
      <Panel>
        <PanelHeader>
          <PanelTitle>Calibration</PanelTitle>
        </PanelHeader>
        <PanelBody>
          <p className="text-xs text-muted-foreground">Loading…</p>
        </PanelBody>
      </Panel>
    );
  }
  if (!pattern) {
    return (
      <Panel>
        <PanelHeader>
          <PanelTitle>Calibration</PanelTitle>
        </PanelHeader>
        <PanelBody>
          <div className="flex flex-col items-center py-6 text-center">
            <div className="mb-3 flex size-10 items-center justify-center rounded-md border border-border bg-muted/40 text-muted-foreground">
              <FileSearch className="size-5" strokeWidth={1.75} />
            </div>
            <p className="text-sm font-medium text-foreground">No rule selected</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Choose a pattern to preview its detection threshold and rewrite directive.
            </p>
          </div>
        </PanelBody>
      </Panel>
    );
  }

  const pceDirective = pattern.pce_directive?.trim();
  const detectionHint = pattern.detection_hint?.trim();
  const missingHint = !detectionHint;
  const missingExamples = !pattern.examples?.length;
  const missingRewriteMenu = !pattern.rewrite_menu?.length;

  return (
    <div className="flex flex-col gap-3">
      {(missingHint || missingExamples || missingRewriteMenu) && (
        <Alert variant="default" className="border-amber-500/40 bg-amber-500/5">
          <AlertTriangle className="size-4 text-amber-600" />
          <AlertTitle className="text-sm">Rule completeness</AlertTitle>
          <AlertDescription className="text-xs text-muted-foreground space-y-1">
            {missingHint ? <p>Detection hint is empty.</p> : null}
            {missingExamples ? <p>No positive examples are set.</p> : null}
            {missingRewriteMenu ? <p>Rewrite menu is empty.</p> : null}
            <p className="pt-1">Edit the pattern to tighten validation (see main detail column).</p>
          </AlertDescription>
        </Alert>
      )}
      {!missingHint && !missingExamples && !missingRewriteMenu ? (
        <Alert variant="default" className="border-border">
          <CheckCircle2 className="size-4 text-moss" />
          <AlertTitle className="text-sm">Core fields present</AlertTitle>
          <AlertDescription className="text-xs text-muted-foreground">
            Hint, examples, and rewrite menu are set.
          </AlertDescription>
        </Alert>
      ) : null}

      <Panel>
        <PanelHeader>
          <PanelTitle>Calibration</PanelTitle>
        </PanelHeader>
        <PanelBody>
          <PanelRow>
            <span className="text-muted-foreground">Severity</span>
            <Badge variant="secondary" className="font-mono text-[10px] uppercase tracking-wider">
              {pattern.severity}
            </Badge>
          </PanelRow>
          <PanelRow>
            <span className="text-muted-foreground">Level</span>
            <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-wider">
              {pattern.level}
            </Badge>
          </PanelRow>
          <PanelRow>
            <span className="text-muted-foreground">Self-amplification</span>
            <span className="font-mono text-xs">{pattern.self_amplification ?? "—"}</span>
          </PanelRow>
          <PanelRow>
            <span className="text-muted-foreground">Flags when clustered</span>
            <span className="font-mono text-xs">
              {densityFlagFor(pattern.severity ?? "medium")}
            </span>
          </PanelRow>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle>Rewrite directive</PanelTitle>
        </PanelHeader>
        <PanelBody>
          {pceDirective ? (
            <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-foreground">
              {pceDirective}
            </pre>
          ) : (
            <p className="text-xs text-muted-foreground">
              No rewrite directive set. The detection hint is used as a fallback.
            </p>
          )}
          {!pceDirective && detectionHint ? (
            <pre className="mt-2 whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-muted-foreground">
              {detectionHint}
            </pre>
          ) : null}
        </PanelBody>
      </Panel>
    </div>
  );
}

/**
 * Default mapping from severity to a density flag shown in the editor lens.
 */
function densityFlagFor(severity: string): string {
  switch (severity) {
    case "critical":
      return "≥1 per 200 words";
    case "high":
      return "≥2 per 500 words";
    case "medium":
      return "≥3 per 1k words";
    case "low":
      return "≥5 per 1k words";
    default:
      return "—";
  }
}
