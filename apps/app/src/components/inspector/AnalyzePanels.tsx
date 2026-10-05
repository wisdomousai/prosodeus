import type { ClassifiedSentence, StylometricProfile } from "@prosodeus/core/browser";
import type { ProgressEvent } from "@prosodeus/shared/browser";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Layers3,
  Pin,
  SlidersHorizontal,
  Wand2,
} from "lucide-react";
import type * as React from "react";
import { Panel, PanelBody, PanelHeader, PanelRow, PanelTitle } from "@/components/shell/Panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { type HeatLevel, heatLevel, type PatternCluster, patternLabel } from "./types";

const HEAT_DOT: Record<HeatLevel, string> = {
  none: "bg-muted",
  low: "bg-[var(--moss)]",
  medium: "bg-[var(--amber)]",
  high: "bg-[var(--blood)]",
};

const HEAT_LABEL: Record<HeatLevel, string> = {
  none: "Calm",
  low: "Mild",
  medium: "Warm",
  high: "Hot",
};

export function AnalysisProgress({
  isAnalyzing,
  progress,
}: {
  isAnalyzing?: boolean;
  progress?: ProgressEvent | null;
}) {
  if (!isAnalyzing || !progress) return null;
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2 font-mono text-xs text-foreground shadow-sm">
      Updating analysis: {progress.classifying}/{progress.total}
      {progress.cached && progress.cached > 0 ? ` · ${progress.cached} cached` : ""}
    </div>
  );
}

export function AnalysisEmptyState({
  isAnalyzing,
  progress,
}: {
  isAnalyzing?: boolean;
  progress?: ProgressEvent | null;
}) {
  return (
    <div className="flex flex-col gap-3">
      <AnalysisProgress isAnalyzing={isAnalyzing} progress={progress} />
      <Panel>
        <PanelHeader>
          <PanelTitle>Analysis</PanelTitle>
        </PanelHeader>
        <PanelBody>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Run analysis to inspect density, repetition, and clause shape.
          </p>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Rewrite setup appears only after a sentence or cluster is selected.
          </p>
        </PanelBody>
      </Panel>
    </div>
  );
}

export function SelectedSentenceCard({
  number,
  sentence,
  onNavigate,
}: {
  number?: number;
  sentence: ClassifiedSentence | null;
  onNavigate: (direction: "prev" | "next") => void;
}) {
  return (
    <Panel>
      <PanelHeader number={number} className="border-b-0 pb-1">
        <PanelTitle>Selected sentence</PanelTitle>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => onNavigate("prev")}
            disabled={!sentence}
            aria-label="Previous sentence"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => onNavigate("next")}
            disabled={!sentence}
            aria-label="Next sentence"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </PanelHeader>
      <PanelBody className="pt-1">
        {sentence ? (
          <div className="rounded-md border border-[var(--amber)]/30 bg-[var(--amber)]/5 border-l-[3px] border-l-[var(--amber)] px-4 py-3">
            <p className="font-serif text-[15px] leading-relaxed text-foreground">
              {sentence.text}
            </p>
            <div className="mt-3 flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">Density</span>
              <span className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${HEAT_DOT[heatLevel(sentence.heat)]}`} />
                <span className="font-mono text-xs">{sentence.heat.toFixed(2)}</span>
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3 text-muted-foreground">
            <ChevronRight className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="space-y-0.5">
              <p className="text-sm">Click any sentence in the editor</p>
              <p className="text-xs">Its structural diagnosis will appear here</p>
            </div>
          </div>
        )}
      </PanelBody>
    </Panel>
  );
}

export function PatternEvidenceCard({
  number,
  sentence,
}: {
  number?: number;
  sentence: ClassifiedSentence | null;
}) {
  const patterns = sentence?.classification.patterns ?? [];
  const candidates = sentence?.classification.ai_slop_candidates ?? [];
  return (
    <Panel>
      <PanelHeader number={number}>
        <PanelTitle>Pattern evidence</PanelTitle>
      </PanelHeader>
      <PanelBody className="space-y-3">
        {patterns.length > 0 ? (
          <>
            {patterns.slice(0, 3).map((pattern, index) => (
              <div
                key={`${pattern.type}-${index}`}
                className="grid grid-cols-[auto_1fr_auto] gap-3 rounded-md border border-border bg-background px-3 py-3"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-ink-soft font-mono text-[11px] font-semibold text-primary">
                  {patternLabel(pattern.type).slice(0, 1)}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold leading-snug text-foreground">
                      {patternLabel(pattern.type)}
                    </p>
                    <Badge
                      variant="secondary"
                      className="h-5 font-mono text-[10px] uppercase tracking-wider"
                    >
                      {index === 0 ? "High" : "Medium"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {pattern.evidence}
                  </p>
                </div>
                <span className="self-center font-mono text-xs text-muted-foreground">
                  {sentence ? sentence.heat.toFixed(1) : ""}
                </span>
              </div>
            ))}
            {patterns.length > 3 ? (
              <Button
                type="button"
                variant="ghost"
                className="h-8 w-full justify-between px-2 text-sm"
              >
                View all pattern evidence ({patterns.length})
                <ChevronRight className="size-4" />
              </Button>
            ) : null}
          </>
        ) : (
          <p className="text-xs leading-relaxed text-muted-foreground">
            This sentence has no flagged patterns. Select a warmer sentence to see structural
            evidence.
          </p>
        )}
        {candidates.length > 0 ? (
          <div className="space-y-2 border-t border-border pt-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Static candidates
              </p>
              <Badge variant="outline" className="h-5 font-mono text-[10px]">
                {candidates.length}
              </Badge>
            </div>
            {candidates.slice(0, 3).map((candidate, index) => (
              <div
                key={`${candidate.source_id}-${candidate.start ?? index}`}
                className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-2"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs font-medium text-foreground">{candidate.category}</p>
                  <Badge variant="secondary" className="h-5 font-mono text-[10px] uppercase">
                    candidate
                  </Badge>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {candidate.evidence}
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </PanelBody>
    </Panel>
  );
}

export function RewriteSetupPreviewCard({
  number,
  sentence,
  styleLabel,
  onRewriteSentence,
  onCopyConstraints,
  onPinVersion,
}: {
  number?: number;
  sentence: ClassifiedSentence | null;
  /** Name of the selected style guide, if any. */
  styleLabel?: string;
  onRewriteSentence: (id: number) => void;
  onCopyConstraints: () => void;
  onPinVersion: () => void;
}) {
  if (!sentence || sentence.classification.patterns.length === 0) return null;

  return (
    <Panel>
      <PanelHeader number={number}>
        <PanelTitle>Rewrite setup preview</PanelTitle>
      </PanelHeader>
      <PanelBody className="space-y-3">
        <SourcePolicyRow
          icon={<SlidersHorizontal className="size-4" />}
          label="Style"
          value={styleLabel ?? "No style guide"}
          description={
            styleLabel
              ? "Style policy supplies the default constraints."
              : "Select a style guide in the toolbar to set constraint defaults."
          }
        />
        <SourcePolicyRow
          icon={<Wand2 className="size-4" />}
          label="Detected pattern"
          value={patternLabel(sentence.classification.patterns[0]!.type)}
          description="Use the rule as an ingredient after setup is confirmed."
        />
        <SourcePolicyRow
          icon={<Layers3 className="size-4" />}
          label="Density"
          value={HEAT_LABEL[heatLevel(sentence.heat)]}
          description="Limit strongest expressions unless local evidence earns them."
        />
        <Button
          type="button"
          className="h-10 w-full gap-2"
          onClick={() => onRewriteSentence(sentence.id)}
        >
          <Wand2 className="size-4" />
          Open rewrite setup
        </Button>
        <div className="flex flex-wrap gap-2 border-t border-border/50 pt-3 mt-1">
          <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={onCopyConstraints}>
            <Copy className="h-3.5 w-3.5" />
            Copy constraints
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 gap-1.5 text-muted-foreground"
            onClick={onPinVersion}
          >
            <Pin className="h-3.5 w-3.5" />
            Pin version
          </Button>
        </div>
      </PanelBody>
    </Panel>
  );
}

export function DensityOverviewCard({
  number,
  profile,
  visibleSentenceIds,
}: {
  number?: number;
  profile: StylometricProfile;
  visibleSentenceIds?: Set<number>;
}) {
  const docLevel = heatLevel(profile.mean_heat);
  const visibleCount = visibleSentenceIds?.size ?? 0;
  const totalCount = profile.sentence_count;
  return (
    <Panel>
      <PanelHeader number={number}>
        <PanelTitle>Document density</PanelTitle>
        <span className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${HEAT_DOT[docLevel]}`} />
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {HEAT_LABEL[docLevel]}
          </span>
        </span>
      </PanelHeader>
      <PanelBody>
        <PanelRow>
          <span className="text-muted-foreground">Mean density</span>
          <span className="font-mono text-xs">{profile.mean_heat.toFixed(2)}</span>
        </PanelRow>
        <PanelRow>
          <span className="text-muted-foreground">Sentences</span>
          <span className="font-mono text-xs">
            {visibleCount > 0 ? `${visibleCount} in view / ${totalCount}` : totalCount}
          </span>
        </PanelRow>
        <PanelRow>
          <span className="text-muted-foreground">Words</span>
          <span className="font-mono text-xs">{profile.word_count}</span>
        </PanelRow>
      </PanelBody>
    </Panel>
  );
}

export function PatternClusterCard({
  number,
  clusters,
  selectedClusterType,
  onSelectClusterType,
  onRewriteCluster,
  onCopyClusterConstraints,
  visibleSentenceIds,
}: {
  number?: number;
  clusters: PatternCluster[];
  selectedClusterType: PatternCluster["type"] | null;
  onSelectClusterType: (type: PatternCluster["type"] | null) => void;
  onRewriteCluster: (cluster: PatternCluster) => void;
  onCopyClusterConstraints: (cluster: PatternCluster) => void;
  visibleSentenceIds?: Set<number>;
}) {
  return (
    <Panel>
      <PanelHeader number={number}>
        <PanelTitle>Pattern clusters</PanelTitle>
        <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          by density
        </span>
      </PanelHeader>
      <PanelBody>
        {clusters.length === 0 ? (
          <p className="text-xs text-muted-foreground">No clustered patterns yet.</p>
        ) : (
          <div className="grid gap-2">
            {clusters.slice(0, 6).map((cluster) => {
              const active = selectedClusterType === cluster.type;
              return (
                <div
                  key={cluster.type}
                  className={cn(
                    "rounded-md border border-border bg-background transition-colors",
                    active && "border-primary/40 bg-ink-soft",
                  )}
                >
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
                    onClick={() => onSelectClusterType(active ? null : cluster.type)}
                  >
                    <span className="text-sm font-medium text-foreground">
                      {patternLabel(cluster.type)}
                    </span>
                    <span className="flex shrink-0 items-center gap-2 font-mono text-xs text-muted-foreground">
                      <span>{cluster.count}×</span>
                      <span>{(cluster.density * 100).toFixed(0)}%</span>
                      {visibleSentenceIds && visibleSentenceIds.size > 0 ? (
                        <span className="text-[10px]">
                          {cluster.sentences.filter((sid) => visibleSentenceIds.has(sid)).length}{" "}
                          visible
                        </span>
                      ) : null}
                    </span>
                  </button>
                  {active ? (
                    <div className="flex flex-wrap gap-2 border-t border-border/70 px-3 py-3">
                      <Button
                        size="sm"
                        className="h-8 gap-1.5"
                        onClick={() => onRewriteCluster(cluster)}
                      >
                        <Wand2 className="h-3.5 w-3.5" />
                        Rewrite cluster
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1.5"
                        onClick={() => onCopyClusterConstraints(cluster)}
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Copy constraints
                      </Button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </PanelBody>
    </Panel>
  );
}

function SourcePolicyRow({
  icon,
  label,
  value,
  description,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  description: string;
}) {
  return (
    <div className="grid grid-cols-[auto_1fr] gap-3">
      <span className="mt-0.5 flex size-8 items-center justify-center rounded-md bg-muted text-primary">
        {icon}
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-foreground">{label}</p>
          <Badge variant="secondary" className="font-mono text-[10px]">
            {value}
          </Badge>
        </div>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
