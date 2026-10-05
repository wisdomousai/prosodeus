import type { ClassifiedSentence, RewriteSuggestion } from "@prosodeus/core/browser";
import type {
  RewriteAlternative,
  RewriteConstraints,
  RewriteStatus,
} from "@prosodeus/shared/browser";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  Copy as CopyIcon,
  Pin,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
import * as React from "react";
import { InlineDiff } from "@/components/diff/InlineDiff";
import type { RewriteScope } from "@/components/inspector/RewriteSetupPanel";
import { RewriteSetupPanel } from "@/components/inspector/RewriteSetupPanel";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/shell/Panel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { SentenceInspectState } from "@/lib/sentence-inspect-state";
import { cn } from "@/lib/utils";
import { heatLevel, patternLabel } from "./types";

const HEAT_DOT: Record<string, string> = {
  none: "bg-muted-foreground/40",
  low: "bg-amber-500",
  medium: "bg-orange-500",
  high: "bg-red-500",
};

export type RewriteTabProps = {
  sentence: ClassifiedSentence | null;
  inspectState: SentenceInspectState;
  selectedSpan: { start: number; end: number } | null;
  // Setup state
  scope: RewriteScope;
  onScopeChange: (scope: RewriteScope) => void;
  constraints: RewriteConstraints;
  onConstraintChange: <K extends keyof RewriteConstraints>(
    key: K,
    value: RewriteConstraints[K],
  ) => void;
  alternativesCount: number;
  onAlternativesCountChange: (n: number) => void;
  isRewriting: boolean;
  rewriteStatus: RewriteStatus;
  rewriteStep: string | null;
  onRun: () => void;
  // Results state
  alternativesData: {
    original: string;
    constraints: RewriteConstraints | null;
    alternatives: RewriteAlternative[];
  } | null;
  onApply: (text: string, original: string) => void;
  onCopyAlternative: (text: string) => void;
  onPinVersion: () => void;
  onReject: () => void;
  // Quick model suggestions (sentence scope)
  quickSuggestions: RewriteSuggestion[];
  onRequestSuggestions: () => void;
  onApplySuggestion: (text: string) => void;
  suggestCouncil: boolean;
  onSuggestCouncilChange: (value: boolean) => void;
  councilModels: Array<{ id: string; name: string }>;
  selectedCouncilModelIds: string[];
  onCouncilModelToggle: (id: string, selected: boolean) => void;
  onCouncilSelectAll: () => void;
  onCouncilClear: () => void;
  suggestReturnedEmpty: boolean;
  suggestNotice: string | null;
  onReAnalyze: () => void;
};

export function RewriteTab(props: RewriteTabProps) {
  const { sentence, inspectState, selectedSpan, alternativesData, isRewriting } = props;

  const [selectedIdx, setSelectedIdx] = React.useState<number | null>(null);
  const [applyRiskOverride, setApplyRiskOverride] = React.useState(false);
  const [showSetupWithResults, setShowSetupWithResults] = React.useState(false);

  React.useEffect(() => {
    setSelectedIdx(alternativesData ? 0 : null);
    setShowSetupWithResults(false);
  }, [alternativesData]);

  React.useEffect(() => {
    setApplyRiskOverride(false);
  }, [selectedIdx]);

  if (!sentence) {
    return (
      <Panel>
        <PanelHeader>
          <PanelTitle>Rewrite</PanelTitle>
        </PanelHeader>
        <PanelBody>
          <p className="text-sm text-muted-foreground">
            Place your cursor in a sentence — or pick a hot spot or cluster in Analyze — to set up a
            rewrite.
          </p>
        </PanelBody>
      </Panel>
    );
  }

  const alternatives = alternativesData?.alternatives ?? [];
  const hasResults = alternatives.length > 0;
  const original = alternativesData?.original ?? sentence.text;
  const selectedAlt =
    selectedIdx !== null && alternatives[selectedIdx] !== undefined
      ? alternatives[selectedIdx]
      : null;

  const meaningRisk = selectedAlt?.meaning_risk ?? "low";
  const applyBlocked = selectedAlt?.apply_blocked === true;
  const applyDisabled = isRewriting || (applyBlocked && !applyRiskOverride);

  const patterns = sentence.classification.patterns;
  const showPatterns = inspectState !== "stale" && patterns.length > 0;

  const setupPanel = (
    <RewriteSetupPanel
      constraints={props.constraints}
      onConstraintChange={props.onConstraintChange}
      scope={props.scope}
      onScopeChange={props.onScopeChange}
      alternativesCount={props.alternativesCount}
      onAlternativesCountChange={props.onAlternativesCountChange}
      hasDetectedPatterns={patterns.length > 0}
      isRewriting={isRewriting}
      rewriteStep={props.rewriteStep}
      disabled={!selectedSpan}
      onGenerate={props.onRun}
    />
  );

  return (
    <div className="flex flex-col gap-3">
      {/* ── Selected passage ── */}
      <Panel>
        <PanelHeader>
          <div className="flex items-center gap-2">
            <PanelTitle>Selected passage</PanelTitle>
            <div className={cn("h-1.5 w-1.5 rounded-full", HEAT_DOT[heatLevel(sentence.heat)])} />
            <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
              {sentence.heat.toFixed(1)}
            </span>
          </div>
          {selectedSpan && selectedSpan.start !== selectedSpan.end ? (
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              sentences {selectedSpan.start + 1}–{selectedSpan.end + 1}
            </span>
          ) : null}
        </PanelHeader>
        <PanelBody className="space-y-3">
          <div className="rounded-lg border border-[var(--amber)]/30 bg-[var(--amber)]/5 px-4 py-3 font-serif text-[15px] leading-relaxed">
            {sentence.text}
          </div>
          {showPatterns && (
            <div className="flex flex-wrap gap-1.5">
              {patterns.map((p, idx) => (
                <span
                  key={`${p.type}-${idx}`}
                  className="inline-flex items-center rounded-full border border-border bg-background px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
                >
                  {patternLabel(p.type)}
                </span>
              ))}
            </div>
          )}
          {inspectState === "stale" && (
            <p className="text-xs text-muted-foreground">
              Pattern tags hidden until this sentence is re-analyzed.
            </p>
          )}
        </PanelBody>
      </Panel>

      {/* ── Suggest lifecycle notices ── */}
      {!hasResults ? <SuggestStatusNotice {...props} /> : null}

      {/* ── Quick model suggestions ── */}
      {!hasResults ? <QuickSuggestions {...props} /> : null}

      {/* ── Setup (full when idle, collapsible once results exist) ── */}
      {hasResults ? (
        <div>
          <button
            type="button"
            onClick={() => setShowSetupWithResults((v) => !v)}
            className="flex w-full items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-sm text-muted-foreground transition hover:text-foreground"
          >
            <span>Adjust constraints & re-run</span>
            {showSetupWithResults ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
          {showSetupWithResults ? <div className="mt-3">{setupPanel}</div> : null}
        </div>
      ) : (
        setupPanel
      )}

      {/* ── Alternatives list ── */}
      {hasResults ? (
        <Panel>
          <PanelHeader className="border-b-0 pb-0">
            <PanelTitle>Alternatives</PanelTitle>
            <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              {alternatives.length} options
            </span>
          </PanelHeader>
          <PanelBody className="p-0">
            <ul className="flex flex-col">
              {alternatives.map((alt) => {
                const isSelected = selectedIdx === alt.index;
                const heatDelta = alt.metrics.after.mean_heat - alt.metrics.before.mean_heat;
                const wordDelta = alt.metrics.after.word_count - alt.metrics.before.word_count;
                const isLast = alt.index === alternatives.length - 1;
                return (
                  <li key={alt.index}>
                    <button
                      type="button"
                      onClick={() => setSelectedIdx(alt.index)}
                      className={cn(
                        "flex w-full flex-col gap-1 px-3 py-2 text-left hover:bg-accent",
                        isSelected && "bg-ink-soft border-l-[3px] border-l-primary",
                        !isSelected && "border-l-[3px] border-l-transparent",
                        !isLast && "border-b border-border",
                      )}
                    >
                      <p className="font-serif text-[13px] leading-relaxed text-foreground line-clamp-2">
                        {alt.text}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
                        <Badge
                          variant="outline"
                          className={cn(
                            "font-mono text-[10px] uppercase tracking-wider border-0 h-4",
                            heatDelta < -0.1 && "bg-[var(--moss)]/15 text-[var(--moss)]",
                            heatDelta >= -0.1 &&
                              heatDelta <= 0.3 &&
                              "bg-secondary text-secondary-foreground",
                            heatDelta > 0.3 && "bg-[var(--blood)]/15 text-[var(--blood)]",
                          )}
                        >
                          {heatDelta >= 0 ? "+" : ""}
                          {heatDelta.toFixed(1)}
                        </Badge>
                        <span>{alt.structural_summary}</span>
                        <span>
                          {wordDelta >= 0 ? "+" : ""}
                          {wordDelta}w
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </PanelBody>
        </Panel>
      ) : null}

      {/* ── Diff + actions for selected alternative ── */}
      {selectedAlt ? (
        <Panel>
          <PanelHeader className="border-b-0 pb-0">
            <PanelTitle>Diff</PanelTitle>
            <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              alt {selectedAlt.index + 1}
            </span>
          </PanelHeader>
          <PanelBody className="space-y-3">
            <div className="rounded-md border border-border bg-background p-3">
              <InlineDiff before={original} after={selectedAlt.text} />
            </div>
            {meaningRisk !== "low" || applyBlocked ? (
              <Alert variant={applyBlocked ? "destructive" : "default"} className="border-border">
                <AlertTriangle className="size-4" />
                <AlertTitle className="text-sm">Meaning check</AlertTitle>
                <AlertDescription className="text-xs text-muted-foreground">
                  <span className="font-mono uppercase tracking-wider text-foreground">
                    {meaningRisk}
                  </span>
                  {applyBlocked ? " — blocked until confirmed." : " — review before applying."}{" "}
                  {selectedAlt.meaning_note}
                </AlertDescription>
              </Alert>
            ) : null}
            {meaningRisk === "low" && !applyBlocked && selectedAlt.meaning_note ? (
              <p className="text-[11px] text-muted-foreground">{selectedAlt.meaning_note}</p>
            ) : null}
            <div className="flex items-center gap-2">
              <Button
                className="h-9 flex-1 gap-1.5"
                disabled={applyDisabled}
                onClick={() => props.onApply(selectedAlt.text, original)}
              >
                <Check className="h-3.5 w-3.5" />
                Apply
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-9 gap-1.5"
                aria-label="Copy alternative"
                onClick={() => props.onCopyAlternative(selectedAlt.text)}
              >
                <CopyIcon className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-9 gap-1.5 text-muted-foreground"
                aria-label="Pin current version"
                onClick={props.onPinVersion}
              >
                <Pin className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-9 gap-1.5 ml-auto text-destructive/70 hover:text-destructive"
                aria-label="Reject alternatives"
                onClick={props.onReject}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
            {applyBlocked && !applyRiskOverride ? (
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 w-full border-[var(--amber)]/40 text-[var(--amber)]"
                type="button"
                onClick={() => {
                  if (
                    window.confirm(
                      "This alternative may change the claim more than your constraints allow. Apply anyway?",
                    )
                  ) {
                    setApplyRiskOverride(true);
                  }
                }}
              >
                Apply anyway…
              </Button>
            ) : null}
          </PanelBody>
        </Panel>
      ) : null}
    </div>
  );
}

/** Per-sentence suggest lifecycle notices for the setup state. */
function SuggestStatusNotice({
  inspectState,
  suggestNotice,
  suggestReturnedEmpty,
  onReAnalyze,
}: RewriteTabProps) {
  return (
    <>
      {inspectState === "stale" ? (
        <div className="space-y-3 rounded-lg border border-dashed border-border bg-muted/20 px-4 py-3">
          <p className="text-sm text-muted-foreground">
            Classification outdated — text changed since last analyze.
          </p>
          <Button size="sm" variant="outline" className="gap-2" onClick={onReAnalyze}>
            <RefreshCw className="h-3.5 w-3.5" />
            Re-analyze sentence
          </Button>
        </div>
      ) : null}
      {inspectState === "suggest_queued" ? (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          <Sparkles className="h-4 w-4 animate-pulse" />
          Queued for background rewrites…
        </div>
      ) : null}
      {inspectState === "suggest_loading" ? (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          <Sparkles className="h-4 w-4 animate-pulse" />
          Fetching rewrite options…
        </div>
      ) : null}
      {inspectState === "analyze_pending" ? (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          <Sparkles className="h-4 w-4 animate-pulse" />
          Analysis in progress — rewrites available when complete
        </div>
      ) : null}
      {suggestNotice ? (
        <p className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          {suggestNotice}
        </p>
      ) : null}
      {suggestReturnedEmpty ? (
        <p className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
          No usable rewrite options came back from the model. Run alternatives below for a
          constrained pass, or pick another model.
        </p>
      ) : null}
    </>
  );
}

/** Quick per-sentence model suggestions: fetch + one-click apply. */
function QuickSuggestions(props: RewriteTabProps) {
  const {
    inspectState,
    quickSuggestions,
    onRequestSuggestions,
    onApplySuggestion,
    isRewriting,
    suggestCouncil,
    onSuggestCouncilChange,
    councilModels,
    selectedCouncilModelIds,
    onCouncilModelToggle,
    onCouncilSelectAll,
    onCouncilClear,
  } = props;

  const cleanSuggestions = React.useMemo(
    () =>
      quickSuggestions
        .flatMap((s) => (s.alternatives ?? []).map((alt) => ({ ...alt, modelName: s.model_name })))
        .filter((a) => typeof a.text === "string" && a.text.trim().length > 0),
    [quickSuggestions],
  );
  const modelNames = React.useMemo(
    () => [...new Set(cleanSuggestions.map((alt) => alt.modelName).filter(Boolean))],
    [cleanSuggestions],
  );

  const selectedCouncilSet = React.useMemo(
    () => new Set(selectedCouncilModelIds),
    [selectedCouncilModelIds],
  );
  const councilSelectedCount = selectedCouncilModelIds.filter((id) =>
    councilModels.some((model) => model.id === id),
  ).length;
  const suggestDisabled =
    isRewriting || (suggestCouncil && councilModels.length > 0 && councilSelectedCount === 0);

  if (cleanSuggestions.length > 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between text-xs uppercase tracking-[0.5px] text-muted-foreground">
          <span>Quick suggestions</span>
          <span className="font-mono">
            {modelNames.length > 0 ? modelNames.join(", ") : `${cleanSuggestions.length} options`}
          </span>
        </div>
        <div className="grid gap-2">
          {cleanSuggestions.map((alt, idx) => (
            <button
              key={`quick-${idx}-${alt.text.slice(0, 24)}`}
              type="button"
              onClick={() => onApplySuggestion(alt.text)}
              className="group flex items-start gap-3 rounded-lg border border-border px-4 py-3 text-left transition-all active:scale-[0.985] hover:border-primary/50 hover:bg-accent/50"
            >
              <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border font-mono text-[10px] text-muted-foreground group-hover:border-primary">
                {idx + 1}
              </div>
              <div className="min-w-0 flex-1 font-serif text-[14px] leading-snug text-foreground/90">
                {alt.text.length > 180 ? `${alt.text.slice(0, 177)}…` : alt.text}
              </div>
              <ArrowRight className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
            </button>
          ))}
        </div>
        <div className="pt-3 text-right">
          <Button
            variant="ghost"
            size="sm"
            onClick={onRequestSuggestions}
            disabled={suggestDisabled}
            className="text-xs"
          >
            Regenerate
          </Button>
        </div>
      </div>
    );
  }

  if (inspectState !== "critique_ready") return null;

  return (
    <div className="flex gap-2">
      <Button
        size="lg"
        variant="outline"
        className="h-11 flex-1 gap-2"
        onClick={onRequestSuggestions}
        disabled={suggestDisabled}
      >
        <Sparkles className="h-4 w-4" />
        Get quick suggestions
      </Button>
      <div className="flex h-11 shrink-0 overflow-hidden rounded-lg border border-border">
        <label className="flex cursor-pointer items-center gap-2 px-3 text-xs font-medium text-muted-foreground">
          <input
            type="checkbox"
            className="sr-only"
            checked={suggestCouncil}
            onChange={(event) => onSuggestCouncilChange(event.currentTarget.checked)}
          />
          <span
            aria-hidden="true"
            className={cn(
              "relative inline-flex h-4 w-7 shrink-0 rounded-full border transition-colors",
              suggestCouncil ? "border-primary bg-primary/80" : "border-border bg-muted",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 h-2.5 w-2.5 rounded-full bg-background shadow-sm transition-transform",
                suggestCouncil ? "translate-x-3.5" : "translate-x-0.5",
              )}
            />
          </span>
          <span>Council</span>
        </label>
        {suggestCouncil ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-full rounded-none border-l border-border px-2 text-xs text-muted-foreground"
              >
                {councilSelectedCount}/{councilModels.length}
                <ChevronDown className="ml-1 h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Council models
              </DropdownMenuLabel>
              <div className="flex gap-1 px-1 pb-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={onCouncilSelectAll}
                >
                  All
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={onCouncilClear}
                >
                  None
                </Button>
              </div>
              <DropdownMenuSeparator />
              {councilModels.length === 0 ? (
                <DropdownMenuItem disabled>No models available</DropdownMenuItem>
              ) : (
                councilModels.map((model) => (
                  <DropdownMenuCheckboxItem
                    key={model.id}
                    checked={selectedCouncilSet.has(model.id)}
                    onCheckedChange={(checked) => onCouncilModelToggle(model.id, checked === true)}
                    onSelect={(event) => event.preventDefault()}
                    className="text-xs"
                  >
                    <span className="truncate">{model.name}</span>
                  </DropdownMenuCheckboxItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </div>
  );
}
