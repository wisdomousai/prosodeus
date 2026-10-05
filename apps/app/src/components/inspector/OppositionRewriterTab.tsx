import type { StylometricProfile } from "@prosodeus/core/browser";
import type { OppositionResultEvent, OppositionStatus } from "@prosodeus/shared/browser";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Circle,
  Edit3,
  GitCompareArrows,
  Loader2,
  MoreHorizontal,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from "lucide-react";
import * as React from "react";
import { OppositionMapPanel } from "@/components/inspector/OppositionMapPanel";
import {
  buildOppositionReviewItems,
  isOppositionRunStale,
  normalizeOppositionSentence,
  type OppositionReviewItem,
  type OppositionReviewStatus,
  oppositionEditKey,
} from "@/components/inspector/opposition-review-model";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { OppositionSentenceReplacementRequest } from "@/hooks/doc/sentence-replacement";
import { cn } from "@/lib/utils";

export interface OppositionRewriterTabProps {
  text: string;
  profile: StylometricProfile | null;
  onSelectSentence?: (sentenceId: number) => void;
  status: OppositionStatus;
  step: string | null;
  result: OppositionResultEvent["data"] | null;
  expanded?: boolean;
  onRun: () => void;
  onApplySentenceReplacement?: (args: OppositionSentenceReplacementRequest) => string | null;
  onClear: () => void;
}

const OPERATIONS = [
  { id: "opposition", label: "Opposition", icon: GitCompareArrows, active: true },
  { id: "transitions", label: "Transitions", icon: ArrowRight, active: false },
  { id: "inflation", label: "Inflation", icon: SlidersHorizontal, active: false },
  { id: "rhythm", label: "Rhythm", icon: MoreHorizontal, active: false },
];

const MAX_VISIBLE_OPTIONS = 3;

export function OppositionRewriterTab({
  text,
  profile,
  onSelectSentence,
  status,
  step,
  result,
  expanded = false,
  onRun,
  onApplySentenceReplacement,
  onClear,
}: OppositionRewriterTabProps) {
  const isRunning = status === "running";
  const hasResult = status === "done" && result != null;
  const hasError = status === "error";
  const edits = result?.edits ?? [];
  const [selectedKey, setSelectedKey] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState("");
  const [selectedOptionIndex, setSelectedOptionIndex] = React.useState(0);
  const [editingOption, setEditingOption] = React.useState(false);
  const [correctionStatuses, setCorrectionStatuses] = React.useState<
    Map<string, OppositionReviewStatus>
  >(new Map());
  const [operationText, setOperationText] = React.useState<string | null>(null);
  const resultSignature = React.useMemo(
    () =>
      result
        ? [
            result.original_text,
            result.rewritten_text,
            ...result.edits.map(oppositionEditKey),
          ].join("\u0000")
        : "none",
    [result],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: resultSignature is the operation-result reset signal.
  React.useEffect(() => {
    setSelectedKey(null);
    setDraft("");
    setSelectedOptionIndex(0);
    setEditingOption(false);
    setCorrectionStatuses(new Map());
    setOperationText(result?.original_text ?? null);
  }, [resultSignature, result?.original_text]);

  const sourceText = operationText ?? result?.original_text ?? "";
  const isResultStale = Boolean(hasResult && result && isOppositionRunStale(text, sourceText));

  const reviewItems = React.useMemo(
    () =>
      hasResult && !isResultStale ? buildOppositionReviewItems(edits, correctionStatuses) : [],
    [correctionStatuses, edits, hasResult, isResultStale],
  );

  const selectedItem = React.useMemo(() => {
    if (reviewItems.length === 0) return null;
    if (selectedKey) {
      const explicit = reviewItems.find((item) => item.key === selectedKey);
      if (explicit) return explicit;
    }
    return reviewItems.find((item) => item.status === "pending") ?? null;
  }, [reviewItems, selectedKey]);

  const selectedItemOrdinal = selectedItem
    ? reviewItems.findIndex((item) => item.key === selectedItem.key) + 1
    : 0;
  const selectedDraftSeed =
    selectedItem?.status === "pending" ? selectedItem.primaryReplacement : "";

  React.useEffect(() => {
    if (!selectedItem) {
      setSelectedKey(null);
      setDraft("");
      setSelectedOptionIndex(0);
      setEditingOption(false);
      return;
    }
    setSelectedKey(selectedItem.key);
    setSelectedOptionIndex(0);
    setDraft(selectedDraftSeed);
    setEditingOption(false);
  }, [selectedItem, selectedDraftSeed]);

  const appliedCount = reviewItems.filter((item) => item.status === "applied").length;
  const skippedCount = reviewItems.filter((item) => item.status === "ignored").length;
  const pendingCount = reviewItems.filter((item) => item.status === "pending").length;
  const allHandled = hasResult && reviewItems.length > 0 && pendingCount === 0;
  const canApplySentence =
    selectedItem?.status === "pending" &&
    !isResultStale &&
    Boolean(sourceText) &&
    Boolean(onApplySentenceReplacement && draft.trim()) &&
    normalizeOppositionSentence(draft) !==
      normalizeOppositionSentence(selectedItem.edit.original_sentence);

  const markCorrectionAndAdvance = React.useCallback(
    (item: OppositionReviewItem, nextStatus: "applied" | "ignored") => {
      const nextStatuses = new Map(correctionStatuses);
      nextStatuses.set(item.key, nextStatus);
      setCorrectionStatuses(nextStatuses);

      const currentIndex = reviewItems.findIndex((candidate) => candidate.key === item.key);
      const ordered =
        currentIndex >= 0
          ? [...reviewItems.slice(currentIndex + 1), ...reviewItems.slice(0, currentIndex)]
          : reviewItems;
      const nextItem = ordered.find((candidate) => !nextStatuses.has(candidate.key)) ?? null;
      setSelectedKey(nextItem ? nextItem.key : null);
      setDraft(nextItem?.primaryReplacement ?? "");
      setSelectedOptionIndex(0);
      setEditingOption(false);
      if (nextItem) onSelectSentence?.(nextItem.edit.span.sentence_id);
    },
    [correctionStatuses, onSelectSentence, reviewItems],
  );

  const handleSelectItem = React.useCallback(
    (item: OppositionReviewItem) => {
      setSelectedKey(item.key);
      setSelectedOptionIndex(0);
      setDraft(item.status === "pending" ? item.primaryReplacement : "");
      setEditingOption(false);
      onSelectSentence?.(item.edit.span.sentence_id);
    },
    [onSelectSentence],
  );

  const handleApplySelected = React.useCallback(() => {
    if (!selectedItem || !canApplySentence || !sourceText) return;
    const updatedText = onApplySentenceReplacement?.({
      sourceText,
      sentenceId: selectedItem.edit.span.sentence_id,
      sentenceEndId: selectedItem.edit.span.sentence_end_id,
      originalSentence: selectedItem.edit.original_sentence,
      newText: draft,
    });
    if (!updatedText) return;
    setOperationText(updatedText);
    markCorrectionAndAdvance(selectedItem, "applied");
  }, [
    canApplySentence,
    draft,
    markCorrectionAndAdvance,
    onApplySentenceReplacement,
    selectedItem,
    sourceText,
  ]);

  const handleOptionChange = React.useCallback((index: number, text: string) => {
    setSelectedOptionIndex(index);
    setDraft(text);
    setEditingOption(false);
  }, []);

  const stalePanel =
    hasResult && result && isResultStale ? (
      <StaleResultPanel isRunning={isRunning} hasText={Boolean(text.trim())} onRun={onRun} />
    ) : null;

  const header = (
    <div className="space-y-2 border-b border-border px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold leading-tight tracking-tight">
            Opposition rewriter
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Binary contrasts, negation reframes, earned tradeoffs.
          </p>
        </div>
        {hasResult && !isResultStale ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={onClear}
            aria-label="Clear operation result"
          >
            <X className="size-4" />
          </Button>
        ) : null}
      </div>
      {!hasResult || isResultStale ? (
        <>
          <OperationRail wide={expanded} />
          <WorkflowBar status={status} hasResult={hasResult && !isResultStale} />
        </>
      ) : null}
    </div>
  );

  if (stalePanel) {
    return (
      <div className="min-w-0">
        <section className="overflow-hidden rounded-md border border-border bg-card">
          {header}
          <div className="p-4">{stalePanel}</div>
        </section>
      </div>
    );
  }

  if (hasResult) {
    return (
      <div className="min-w-0">
        <section className="overflow-hidden rounded-md border border-border bg-card">
          {header}
          <div className={cn("space-y-4", expanded ? "p-4" : "p-3")}>
            {reviewItems.length === 0 ? (
              <EmptyResultPanel
                onRun={onRun}
                isRunning={isRunning}
                hasText={Boolean(text.trim())}
              />
            ) : allHandled ? (
              <CompletionStrip
                totalCount={reviewItems.length}
                appliedCount={appliedCount}
                skippedCount={skippedCount}
                isRunning={isRunning}
                hasText={Boolean(text.trim())}
                onRun={onRun}
                onClear={onClear}
              />
            ) : selectedItem ? (
              <>
                <ProgressNavigator
                  items={reviewItems}
                  selectedKey={selectedItem.key}
                  ordinal={selectedItemOrdinal}
                  onSelect={handleSelectItem}
                />
                {selectedItem.status === "pending" ? (
                  <ChoiceStage
                    item={selectedItem}
                    draft={draft}
                    selectedOptionIndex={selectedOptionIndex}
                    editingOption={editingOption}
                    canApply={canApplySentence}
                    onOptionChange={handleOptionChange}
                    onDraftChange={setDraft}
                    onToggleEdit={() => setEditingOption((value) => !value)}
                    onApply={handleApplySelected}
                    onSkip={() => markCorrectionAndAdvance(selectedItem, "ignored")}
                  />
                ) : (
                  <HandledItemPanel
                    item={selectedItem}
                    onContinue={() => {
                      const nextPending = reviewItems.find(
                        (candidate) => candidate.status === "pending",
                      );
                      if (nextPending) handleSelectItem(nextPending);
                    }}
                    hasPending={pendingCount > 0}
                  />
                )}
              </>
            ) : (
              <div className="rounded-md border border-dashed border-border bg-muted/20 p-5 text-center">
                <GitCompareArrows className="mx-auto mb-3 size-7 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Select a correction</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Pick a progress step to review its rewrite options.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <section className="overflow-hidden rounded-md border border-border bg-card">
        {header}
        <div className="space-y-3 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold">
                {isRunning ? "Finding corrections" : "Run rewrite"}
              </h3>
              <p className="text-xs text-muted-foreground">
                Generate sentence-level fixes for weak contrast frames.
              </p>
            </div>
          </div>

          <Button
            type="button"
            size="sm"
            onClick={onRun}
            disabled={isRunning || !text.trim()}
            className="h-9 w-full gap-1.5"
          >
            {isRunning ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
            {isRunning ? "Running..." : "Generate corrections"}
          </Button>

          {isRunning && step ? (
            <div className="rounded-md border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
              <Loader2 className="mr-2 inline size-3.5 animate-spin" />
              {step}
            </div>
          ) : null}

          {hasError ? (
            <Alert variant="destructive">
              <AlertDescription>
                Opposition rewriter failed. Try again or choose a different model.
              </AlertDescription>
            </Alert>
          ) : null}

          <OppositionMapPanel profile={profile} onSelectSentence={onSelectSentence} />
        </div>
      </section>
    </div>
  );
}

function ProgressNavigator({
  items,
  selectedKey,
  ordinal,
  onSelect,
}: {
  items: OppositionReviewItem[];
  selectedKey: string;
  ordinal: number;
  onSelect: (item: OppositionReviewItem) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold">
          Opposition · {ordinal} of {items.length}
        </p>
        <p className="text-xs text-muted-foreground">Choose a rewrite, then apply or skip.</p>
      </div>
      <div
        className="flex flex-wrap items-center gap-1.5"
        role="tablist"
        aria-label="Correction progress"
      >
        {items.map((item, index) => {
          const active = item.key === selectedKey;
          return (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={active}
              aria-label={`Correction ${index + 1}, ${statusLabel(item.status)}`}
              onClick={() => onSelect(item)}
              className={cn(
                "flex h-7 min-w-7 items-center justify-center rounded-full border px-2 font-mono text-[11px] transition-colors",
                active
                  ? "border-teal-700 bg-teal-700 text-white"
                  : item.status === "pending"
                    ? "border-border bg-background text-foreground hover:bg-muted/40"
                    : item.status === "applied"
                      ? "border-teal-600/30 bg-teal-50 text-teal-800"
                      : "border-border bg-muted text-muted-foreground",
              )}
            >
              {item.status === "applied" ? (
                <Check className="size-3" />
              ) : item.status === "ignored" ? (
                <span className="text-[10px]">–</span>
              ) : (
                index + 1
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ChoiceStage({
  item,
  draft,
  selectedOptionIndex,
  editingOption,
  canApply,
  onOptionChange,
  onDraftChange,
  onToggleEdit,
  onApply,
  onSkip,
}: {
  item: OppositionReviewItem;
  draft: string;
  selectedOptionIndex: number;
  editingOption: boolean;
  canApply: boolean;
  onOptionChange: (index: number, text: string) => void;
  onDraftChange: (next: string) => void;
  onToggleEdit: () => void;
  onApply: () => void;
  onSkip: () => void;
}) {
  const options = item.replacementOptions.slice(0, MAX_VISIBLE_OPTIONS);
  const originalLabel = item.edit.span.sentence_end_id ? "Original sentences" : "Original sentence";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="gap-1">
          <Edit3 className="size-3" />
          {item.edit.span.pattern_type}
        </Badge>
        <span className="text-xs text-muted-foreground">{oppositionSentenceDescription(item)}</span>
      </div>

      <div className="rounded-md border border-border bg-muted/20 p-3">
        <div className="mb-2 text-xs font-semibold text-muted-foreground">{originalLabel}</div>
        <p className="text-sm leading-relaxed text-foreground">{item.edit.original_sentence}</p>
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold">
            {options.length > 1 ? "Choose a rewrite" : "Proposed rewrite"}
          </h3>
          {options.length > 1 ? (
            <span className="font-mono text-[10px] text-muted-foreground">
              {options.length} options
            </span>
          ) : null}
        </div>
        <div className="space-y-2">
          {options.map((option, index) => {
            const selected = selectedOptionIndex === index;
            const showingDraft =
              selected &&
              normalizeOppositionSentence(draft) !== normalizeOppositionSentence(option);
            return (
              <div
                key={option}
                className={cn(
                  "rounded-md border transition-colors",
                  selected
                    ? "border-teal-700 bg-teal-50/40"
                    : "border-border bg-background hover:bg-muted/20",
                )}
              >
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    if (!selected) onOptionChange(index, option);
                  }}
                  className="flex w-full items-start gap-3 p-3 text-left"
                >
                  <span
                    className={cn(
                      "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
                      selected
                        ? "border-teal-700 bg-teal-700 text-white"
                        : "border-border bg-background",
                    )}
                    aria-hidden
                  >
                    {selected ? <Check className="size-2.5" /> : null}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                        Option {index + 1}
                      </span>
                      {selected && showingDraft ? (
                        <span className="text-[10px] font-medium text-teal-800">Edited</span>
                      ) : null}
                    </div>
                    <p className="text-sm leading-relaxed text-foreground">
                      {selected ? draft : option}
                    </p>
                  </div>
                </button>
                {selected ? (
                  <div className="border-t border-teal-700/15 px-3 py-2">
                    <button
                      type="button"
                      onClick={onToggleEdit}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-800 hover:text-teal-950"
                    >
                      <Edit3 className="size-3" />
                      {editingOption ? "Done editing" : "Edit"}
                    </button>
                    {editingOption ? (
                      <label className="mt-2 block">
                        <span className="sr-only">Edit rewrite</span>
                        <textarea
                          value={draft}
                          onChange={(event) => onDraftChange(event.target.value)}
                          className="min-h-24 w-full resize-none rounded-md border border-teal-600/30 bg-background p-3 text-sm leading-relaxed text-foreground outline-none transition-colors focus:border-teal-700"
                        />
                      </label>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className="sticky bottom-0 z-10 grid grid-cols-2 gap-2 border-t border-border bg-card/95 py-3 backdrop-blur">
        <Button type="button" className="h-10 gap-1.5" disabled={!canApply} onClick={onApply}>
          <Check className="size-4" />
          Apply
        </Button>
        <Button type="button" variant="outline" className="h-10" onClick={onSkip}>
          Skip
        </Button>
      </div>

      <WhyThisRewrite item={item} />
    </div>
  );
}

function WhyThisRewrite({ item }: { item: OppositionReviewItem }) {
  const isAccepted = item.edit.accepted;
  return (
    <Collapsible>
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 rounded-md border border-border bg-muted/20 px-3 py-2 text-left text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground [&[data-state=open]>svg]:rotate-180">
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck className="size-3.5 text-teal-700" />
          Why this rewrite
        </span>
        <ChevronDown className="size-3.5 shrink-0 transition-transform" />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-2 rounded-md border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-medium text-foreground">
            {isAccepted ? "Meaning check" : "Review note"}
          </span>
          <span className="text-teal-700">
            {isAccepted && item.edit.fidelity_score > 0
              ? `Preserved · ${item.edit.fidelity_score.toFixed(2)}`
              : "Manual review"}
          </span>
        </div>
        <p className="leading-relaxed">{item.edit.fidelity_reason}</p>
        <p className="leading-relaxed">
          Detected as{" "}
          <span className="font-medium text-foreground">{item.edit.span.pattern_type}</span>
          {item.edit.span.evidence ? ` from "${item.edit.span.evidence}"` : ""}.
          {item.edit.verdict ? (
            <>
              {" "}
              Verdict: <span className="font-medium text-foreground">{item.edit.verdict}</span>.
            </>
          ) : null}
        </p>
      </CollapsibleContent>
    </Collapsible>
  );
}

function HandledItemPanel({
  item,
  onContinue,
  hasPending,
}: {
  item: OppositionReviewItem;
  onContinue: () => void;
  hasPending: boolean;
}) {
  return (
    <div className="space-y-3 rounded-md border border-teal-600/25 bg-teal-50/50 p-4">
      <div>
        <h3 className="text-sm font-semibold text-teal-950">
          {item.status === "applied" ? "Applied" : "Skipped"}
        </h3>
        <p className="mt-1 text-sm leading-relaxed text-teal-900">
          {item.status === "applied"
            ? "This rewrite was applied in this session."
            : "This correction was skipped in this session."}
        </p>
      </div>
      {hasPending ? (
        <Button type="button" size="sm" className="h-8" onClick={onContinue}>
          Continue to next
        </Button>
      ) : null}
    </div>
  );
}

function CompletionStrip({
  totalCount,
  appliedCount,
  skippedCount,
  isRunning,
  hasText,
  onRun,
  onClear,
}: {
  totalCount: number;
  appliedCount: number;
  skippedCount: number;
  isRunning: boolean;
  hasText: boolean;
  onRun: () => void;
  onClear: () => void;
}) {
  return (
    <div className="rounded-md border border-teal-600/25 bg-teal-50/40 p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-teal-700 text-white">
          <Check className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-teal-950">Corrections handled</h3>
          <p className="mt-1 text-sm text-teal-900">
            {appliedCount} applied
            {skippedCount > 0 ? `, ${skippedCount} skipped` : ""} · {totalCount} total. Other
            Analyze highlights may remain.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5"
              disabled={isRunning || !hasText}
              onClick={onRun}
            >
              {isRunning ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RefreshCw className="size-3.5" />
              )}
              Regenerate
            </Button>
            <Button type="button" variant="ghost" size="sm" className="h-8" onClick={onClear}>
              Clear
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyResultPanel({
  onRun,
  isRunning,
  hasText,
}: {
  onRun: () => void;
  isRunning: boolean;
  hasText: boolean;
}) {
  return (
    <div className="rounded-md border border-dashed border-border bg-muted/20 p-5 text-center">
      <GitCompareArrows className="mx-auto mb-3 size-7 text-muted-foreground" />
      <h3 className="text-sm font-semibold">No opposition corrections found</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        This run did not return any actionable replacement sentences.
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-4 h-8 gap-1.5"
        disabled={isRunning || !hasText}
        onClick={onRun}
      >
        {isRunning ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <RefreshCw className="size-3.5" />
        )}
        Regenerate
      </Button>
    </div>
  );
}

function StaleResultPanel({
  isRunning,
  hasText,
  onRun,
}: {
  isRunning: boolean;
  hasText: boolean;
  onRun: () => void;
}) {
  return (
    <section className="rounded-md border border-amber-500/30 bg-amber-50/60 p-4">
      <h3 className="text-sm font-semibold text-amber-950">Operation result is stale</h3>
      <p className="mt-1 text-sm leading-relaxed text-amber-900">
        The draft no longer matches this operation result. Re-run to generate corrections for the
        current text.
      </p>
      <Button
        type="button"
        className="mt-4 h-10 gap-1.5"
        disabled={isRunning || !hasText}
        onClick={onRun}
      >
        {isRunning ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
        {isRunning ? "Running..." : "Re-run operation"}
      </Button>
    </section>
  );
}

function OperationRail({ wide = false }: { wide?: boolean }) {
  const activeOperations = OPERATIONS.filter((item) => item.active);
  return (
    <div>
      <div className="mb-2 text-xs font-medium text-muted-foreground">Pattern operations</div>
      <div className={cn("grid gap-1.5", wide ? "max-w-sm" : "grid-cols-1")}>
        {activeOperations.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.id}
              aria-current="true"
              className="flex h-9 min-w-0 items-center gap-2 rounded-md border border-teal-700 bg-teal-50 px-2 text-left text-xs text-teal-900"
            >
              <Icon className="size-3.5 shrink-0" />
              <span className="truncate">{item.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WorkflowBar({ status, hasResult }: { status: OppositionStatus; hasResult: boolean }) {
  const steps = ["Generate", "Choose", "Apply"];
  const active = status === "running" ? 0 : hasResult ? 1 : 0;
  return (
    <div className="grid grid-cols-3 gap-1 rounded-md border border-border bg-background p-1">
      {steps.map((step, idx) => (
        <div
          key={step}
          className={cn(
            "flex min-w-0 flex-col items-center gap-1 rounded-[5px] px-1.5 py-1.5 text-center",
            idx === active && "bg-muted/50",
          )}
        >
          <span
            className={cn(
              "flex h-5 w-5 items-center justify-center rounded-full border text-xs",
              idx < active
                ? "border-teal-700 bg-teal-700 text-white"
                : idx === active
                  ? "border-teal-700 text-teal-800"
                  : "border-border text-muted-foreground",
            )}
          >
            {idx < active ? <Check className="size-3" /> : <Circle className="size-1.5" />}
          </span>
          <span className="truncate text-[10px] font-medium text-muted-foreground">{step}</span>
        </div>
      ))}
    </div>
  );
}

function oppositionSentenceDescription(item: OppositionReviewItem): string {
  const start = item.edit.span.sentence_id + 1;
  const end = (item.edit.span.sentence_end_id ?? item.edit.span.sentence_id) + 1;
  return start === end ? `Sentence ${start}` : `Sentences ${start}-${end}`;
}

function statusLabel(status: OppositionReviewStatus): string {
  if (status === "applied") return "applied";
  if (status === "ignored") return "skipped";
  return "pending";
}
