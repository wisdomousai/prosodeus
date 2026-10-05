import type { PatternType, PlaybookPlatform, StylometricProfile } from "@prosodeus/core/browser";
import {
  COPY_PLAYBOOK,
  filterPlaybookClusters,
  PLAYBOOK_PLATFORMS,
  type PlaybookAuditResult,
  type PlaybookAuditStatus,
  runPlaybookAudit,
  scorePlaybookLayers,
} from "@prosodeus/core/browser";
import type { ProgressEvent } from "@prosodeus/shared/browser";
import { ArrowRight, Check, Copy, LocateFixed, Sparkles, Wand2, X } from "lucide-react";
import type { ReactNode } from "react";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/shell/Panel";
import { Button } from "@/components/ui/button";
import {
  lexiconHitsWithSentenceIds,
  sentenceIdsForLexiconHits,
  sentenceIdsForPattern,
  sentenceIdsMatchingText,
} from "@/lib/playbook-navigation";
import { cn } from "@/lib/utils";
import { AnalysisEmptyState } from "./AnalyzePanels";
import {
  buildPatternClusters,
  type HeatLevel,
  heatLevel,
  type PatternCluster,
  patternLabel,
} from "./types";

const HEAT_DOT: Record<HeatLevel, string> = {
  none: "bg-muted",
  low: "bg-[var(--moss)]",
  medium: "bg-[var(--amber)]",
  high: "bg-[var(--blood)]",
};

const AUDIT_ICON: Record<PlaybookAuditStatus, ReactNode> = {
  pass: <Check className="size-3.5 text-[var(--moss)]" />,
  fail: <X className="size-3.5 text-[var(--blood)]" />,
  warn: <span className="text-[10px] font-mono text-[var(--amber)]">!</span>,
  manual: <Sparkles className="size-3.5 text-muted-foreground" />,
};

export type PlaybookTabProps = {
  profile: StylometricProfile | null;
  text: string;
  platform: PlaybookPlatform | null;
  onPlatformChange: (platform: PlaybookPlatform | null) => void;
  useVoice: boolean;
  onUseVoiceChange: (v: boolean) => void;
  hasVoiceDna: boolean;
  useStyleGuide: boolean;
  onUseStyleGuideChange: (v: boolean) => void;
  hasStyleGuide: boolean;
  onCopyPlaybookPrompt: () => void;
  onApplyPlatformToRewrite: () => void;
  onApplyPlaybookToRewrite: () => void;
  onCopyAuditFailures: () => void;
  onRewriteCluster: (cluster: PatternCluster) => void;
  onCopyClusterConstraints: (cluster: PatternCluster) => void;
  onRunOpposition: () => void;
  onOpenOpposition: () => void;
  onGoToSentence: (sentenceId: number) => void;
  onSelectSentenceRange: (startId: number, endId: number) => void;
  onSelectSentences: (sentenceIds: number[]) => void;
  onSelectClusterType: (type: PatternType | null) => void;
  selectedClusterType: PatternType | null;
  isAnalyzing?: boolean;
  analysisProgress?: ProgressEvent | null;
};

export function PlaybookTab({
  profile,
  text,
  platform,
  onPlatformChange,
  useVoice,
  onUseVoiceChange,
  hasVoiceDna,
  useStyleGuide,
  onUseStyleGuideChange,
  hasStyleGuide,
  onCopyPlaybookPrompt,
  onApplyPlatformToRewrite,
  onApplyPlaybookToRewrite,
  onCopyAuditFailures,
  onRewriteCluster,
  onCopyClusterConstraints,
  onRunOpposition,
  onOpenOpposition,
  onGoToSentence,
  onSelectSentenceRange,
  onSelectSentences,
  onSelectClusterType,
  selectedClusterType,
  isAnalyzing = false,
  analysisProgress = null,
}: PlaybookTabProps) {
  if (!profile) {
    return <AnalysisEmptyState isAnalyzing={isAnalyzing} progress={analysisProgress} />;
  }

  const layerScores = scorePlaybookLayers(profile);
  const audit = runPlaybookAudit(text, profile);
  const clusters = filterPlaybookClusters(buildPatternClusters(profile));
  const topCluster = clusters[0];
  const lexiconHits = lexiconHitsWithSentenceIds(profile, text);
  const failedChecks = audit.checks.filter((c) => c.status === "fail" || c.status === "warn");
  const binaryReframeFailed = audit.checks.some(
    (c) => c.id === "binary_reframe" && c.status === "fail",
  );

  const handleRewriteWindow = (startSentence: number, endSentence: number) => {
    onSelectSentenceRange(startSentence, endSentence);
    onApplyPlaybookToRewrite();
  };

  return (
    <div className="flex flex-col gap-4">
      {failedChecks.length > 0 ? (
        <Panel>
          <PanelHeader>
            <PanelTitle>Quick fixes</PanelTitle>
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {failedChecks.length} issue(s)
            </span>
          </PanelHeader>
          <PanelBody className="flex flex-wrap gap-2">
            {binaryReframeFailed ? (
              <Button type="button" size="sm" className="h-8 gap-1.5" onClick={onRunOpposition}>
                <Sparkles className="size-3.5" />
                Run opposition rewriter
              </Button>
            ) : null}
            {lexiconHits.length > 0 ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5"
                onClick={() => {
                  onSelectSentences(sentenceIdsForLexiconHits(profile, text));
                  onApplyPlaybookToRewrite();
                }}
              >
                <Wand2 className="size-3.5" />
                Rewrite lexicon hits
              </Button>
            ) : null}
            {topCluster && topCluster.count > 0 ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5"
                onClick={() => onRewriteCluster(topCluster)}
              >
                <Wand2 className="size-3.5" />
                Rewrite top pattern
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 gap-1.5"
              onClick={onApplyPlaybookToRewrite}
            >
              <ArrowRight className="size-3.5" />
              Open rewrite with playbook
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5"
              onClick={onCopyAuditFailures}
            >
              <Copy className="size-3.5" />
              Copy failures
            </Button>
          </PanelBody>
        </Panel>
      ) : null}

      <Panel>
        <PanelHeader>
          <PanelTitle>{COPY_PLAYBOOK.name}</PanelTitle>
        </PanelHeader>
        <PanelBody className="space-y-3">
          <p className="text-xs leading-relaxed text-muted-foreground">
            {COPY_PLAYBOOK.description}
          </p>
          <div className="flex flex-wrap gap-2">
            {PLAYBOOK_PLATFORMS.map((id) => {
              const preset = COPY_PLAYBOOK.platform_presets[id];
              const active = platform === id;
              return (
                <Button
                  key={id}
                  type="button"
                  size="sm"
                  variant={active ? "default" : "outline"}
                  className="h-8"
                  onClick={() => onPlatformChange(active ? null : id)}
                >
                  {preset.label}
                </Button>
              );
            })}
          </div>
          {hasVoiceDna ? (
            <Button
              type="button"
              size="sm"
              variant={useVoice ? "default" : "outline"}
              className="h-8"
              onClick={() => onUseVoiceChange(!useVoice)}
            >
              My voice
            </Button>
          ) : null}
          {hasStyleGuide ? (
            <Button
              type="button"
              size="sm"
              variant={useStyleGuide ? "default" : "outline"}
              className="h-8"
              onClick={() => onUseStyleGuideChange(!useStyleGuide)}
            >
              My style guide
            </Button>
          ) : null}
        </PanelBody>
      </Panel>

      {lexiconHits.length > 0 ? (
        <Panel>
          <PanelHeader>
            <PanelTitle>Lexicon</PanelTitle>
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {lexiconHits.length} hit(s)
            </span>
          </PanelHeader>
          <PanelBody className="space-y-2">
            {lexiconHits.slice(0, 8).map((hit) => {
              const sentenceId = hit.sentenceId;
              return (
                <div
                  key={`${hit.from}-${hit.index}-${hit.matched}`}
                  className="flex items-start gap-2 rounded-md border border-border/70 px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-xs text-foreground">
                      "{hit.matched}" → {hit.to}
                    </p>
                    {sentenceId != null ? (
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        Sentence {sentenceId + 1}
                      </p>
                    ) : null}
                  </div>
                  {sentenceId != null ? (
                    <div className="flex shrink-0 gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2"
                        onClick={() => onGoToSentence(sentenceId)}
                      >
                        <LocateFixed className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="h-7"
                        onClick={() => {
                          onGoToSentence(sentenceId);
                          onApplyPlaybookToRewrite();
                        }}
                      >
                        Rewrite
                      </Button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </PanelBody>
        </Panel>
      ) : null}

      <Panel>
        <PanelHeader>
          <PanelTitle>Layer scores</PanelTitle>
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {layerScores.totalHits} hits
          </span>
        </PanelHeader>
        <PanelBody className="space-y-2">
          {layerScores.layers.map((layer) => {
            const level = heatLevel(layer.hitCount);
            const isWorst = layer.id === layerScores.worstLayerId && layer.hitCount > 0;
            const layerPatternIds = new Set(
              COPY_PLAYBOOK.layers.find((l) => l.id === layer.id)?.patterns ?? [],
            );
            const layerViolations =
              layerScores.violations?.filter((v) => layerPatternIds.has(v.pattern_id)) ?? [];
            const topPattern = layer.patternHits[0];
            const topClusterForLayer = topPattern
              ? clusters.find((c) => c.type === topPattern.type)
              : undefined;
            return (
              <div
                key={layer.id}
                className={cn(
                  "flex flex-col gap-2 rounded-md border border-border px-3 py-2",
                  isWorst && "border-primary/40 bg-ink-soft",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-foreground">{layer.label}</span>
                  <span className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                    <span className={`h-2 w-2 rounded-full ${HEAT_DOT[level]}`} />
                    {layer.hitCount}
                    {(layer.violationCount ?? 0) > 0 ? (
                      <span className="text-[10px] text-[var(--amber)]">
                        {layer.violationCount} viol.
                      </span>
                    ) : null}
                  </span>
                </div>
                {layerViolations.slice(0, 3).map((violation) => (
                  <div
                    key={`${violation.pattern_id}-${violation.start_sentence}-${violation.end_sentence}`}
                    className="flex items-center gap-2 rounded border border-dashed border-border/70 px-2 py-1.5"
                  >
                    <p className="min-w-0 flex-1 text-[10px] text-muted-foreground">
                      s{violation.start_sentence + 1}–{violation.end_sentence + 1} ·{" "}
                      {violation.pattern_id} ({violation.count}/{violation.max_allowed})
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2"
                      onClick={() =>
                        onSelectSentenceRange(violation.start_sentence, violation.end_sentence)
                      }
                    >
                      <LocateFixed className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="h-7"
                      onClick={() =>
                        handleRewriteWindow(violation.start_sentence, violation.end_sentence)
                      }
                    >
                      Rewrite
                    </Button>
                  </div>
                ))}
                {topClusterForLayer && layer.hitCount > 0 ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 self-start"
                    onClick={() => onRewriteCluster(topClusterForLayer)}
                  >
                    Rewrite {patternLabel(topClusterForLayer.type)}
                  </Button>
                ) : null}
              </div>
            );
          })}
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle>Audit checklist</PanelTitle>
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {audit.automatedPassed}/{audit.automatedTotal} auto
          </span>
        </PanelHeader>
        <PanelBody className="space-y-2">
          {audit.checks.map((check) => (
            <AuditCheckRow
              key={check.id}
              check={check}
              profile={profile}
              text={text}
              onRunOpposition={onRunOpposition}
              onGoToSentence={onGoToSentence}
              onSelectSentences={onSelectSentences}
              onRewriteCluster={onRewriteCluster}
              onApplyPlaybookToRewrite={onApplyPlaybookToRewrite}
              clusters={clusters}
            />
          ))}
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle>Playbook patterns</PanelTitle>
        </PanelHeader>
        <PanelBody>
          {clusters.length === 0 ? (
            <p className="text-xs text-muted-foreground">No playbook patterns detected yet.</p>
          ) : (
            <div className="grid gap-2">
              {clusters.slice(0, 8).map((cluster) => {
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
                        {(cluster.type === "binary_contrast" ||
                          cluster.type === "negation_reframe") && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 gap-1.5"
                              onClick={onRunOpposition}
                            >
                              <Sparkles className="h-3.5 w-3.5" />
                              Run opposition rewriter
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 gap-1.5"
                              onClick={onOpenOpposition}
                            >
                              Open opposition rewriter
                            </Button>
                          </>
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </PanelBody>
      </Panel>

      <div className="flex flex-wrap gap-2">
        <Button type="button" className="h-10 gap-2" onClick={onApplyPlaybookToRewrite}>
          <ArrowRight className="size-4" />
          Apply playbook to rewrite
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-10 gap-2"
          onClick={onCopyPlaybookPrompt}
        >
          <Copy className="size-4" />
          Copy playbook prompt
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-10 gap-2"
          disabled={!platform}
          onClick={onApplyPlatformToRewrite}
        >
          Apply platform preset
        </Button>
        {binaryReframeFailed ? (
          <Button
            type="button"
            variant="secondary"
            className="h-10 gap-2"
            onClick={onRunOpposition}
          >
            <Sparkles className="size-4" />
            Run opposition rewriter
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function AuditCheckRow({
  check,
  profile,
  text,
  onRunOpposition,
  onGoToSentence,
  onSelectSentences,
  onRewriteCluster,
  onApplyPlaybookToRewrite,
  clusters,
}: {
  check: PlaybookAuditResult;
  profile: StylometricProfile;
  text: string;
  onRunOpposition: () => void;
  onGoToSentence: (sentenceId: number) => void;
  onSelectSentences: (sentenceIds: number[]) => void;
  onRewriteCluster: (cluster: PatternCluster) => void;
  onApplyPlaybookToRewrite: () => void;
  clusters: PatternCluster[];
}) {
  const actions = auditCheckActions(check, profile, text, clusters, {
    onRunOpposition,
    onGoToSentence,
    onSelectSentences,
    onRewriteCluster,
    onApplyPlaybookToRewrite,
  });
  const showActions = check.status === "fail" || check.status === "warn";

  return (
    <div className="flex items-start gap-2 rounded-md border border-border/70 px-3 py-2">
      <span className="mt-0.5 shrink-0">{AUDIT_ICON[check.status]}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-foreground">{check.label}</p>
        {check.detail ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{check.detail}</p>
        ) : null}
        {check.hint ? (
          <p className="mt-0.5 text-xs italic text-muted-foreground">{check.hint}</p>
        ) : null}
        {showActions && actions.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {actions.map((action) => (
              <Button
                key={action.key}
                type="button"
                size="sm"
                variant="secondary"
                className="h-7"
                onClick={action.run}
              >
                {action.label}
              </Button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function auditCheckActions(
  check: PlaybookAuditResult,
  profile: StylometricProfile,
  text: string,
  clusters: PatternCluster[],
  handlers: {
    onRunOpposition: () => void;
    onGoToSentence: (sentenceId: number) => void;
    onSelectSentences: (sentenceIds: number[]) => void;
    onRewriteCluster: (cluster: PatternCluster) => void;
    onApplyPlaybookToRewrite: () => void;
  },
): Array<{ key: string; label: string; run: () => void }> {
  const {
    onRunOpposition,
    onGoToSentence,
    onSelectSentences,
    onRewriteCluster,
    onApplyPlaybookToRewrite,
  } = handlers;
  const firstId = (ids: number[]) => ids[0] ?? null;

  switch (check.id) {
    case "binary_reframe":
      return check.status === "fail"
        ? [{ key: "opposition", label: "Run opposition rewriter", run: onRunOpposition }]
        : [];
    case "lexicon_scan": {
      const ids = sentenceIdsForLexiconHits(profile, text);
      const first = firstId(ids);
      if (first == null) return [];
      return [
        {
          key: "go",
          label: "Go to hit",
          run: () => onGoToSentence(first),
        },
        {
          key: "rewrite",
          label: "Rewrite hits",
          run: () => {
            onSelectSentences(ids);
            onApplyPlaybookToRewrite();
          },
        },
      ];
    }
    case "worst_words": {
      const ids = profile.sentences
        .filter((s) => {
          const lower = s.text.toLowerCase();
          return COPY_PLAYBOOK.banned_words.some((word) => {
            const re = new RegExp(`\\b${word.replace(/-/g, "[- ]")}\\b`, "i");
            return re.test(lower);
          });
        })
        .map((s) => s.id);
      const first = firstId(ids);
      if (first == null) return [];
      return [
        {
          key: "go",
          label: "Go to word",
          run: () => onGoToSentence(first),
        },
        {
          key: "rewrite",
          label: "Rewrite hits",
          run: () => {
            onSelectSentences(ids);
            onApplyPlaybookToRewrite();
          },
        },
      ];
    }
    case "em_dash": {
      const ids = sentenceIdsMatchingText(profile, /—|--/);
      const first = firstId(ids);
      if (first == null) return [];
      return [
        {
          key: "go",
          label: "Go to dash",
          run: () => onGoToSentence(first),
        },
        {
          key: "rewrite",
          label: "Rewrite",
          run: () => {
            onGoToSentence(first);
            onApplyPlaybookToRewrite();
          },
        },
      ];
    }
    case "formal_transitions": {
      const cluster = clusters.find((c) => c.type === "transition_formulaic");
      if (!cluster) return [];
      return [
        { key: "rewrite", label: "Rewrite transitions", run: () => onRewriteCluster(cluster) },
      ];
    }
    case "meta_commentary": {
      const ids = sentenceIdsMatchingText(
        profile,
        /\b(in this (?:article|post|section)|let's (?:explore|dive|delve)|we will (?:explore|discuss))\b/i,
      );
      if (ids.length === 0) return [];
      return [
        {
          key: "rewrite",
          label: "Rewrite meta",
          run: () => {
            onSelectSentences(ids);
            onApplyPlaybookToRewrite();
          },
        },
      ];
    }
    case "paragraph_opener": {
      const ids = profile.sentences.map((s) => s.id);
      if (ids.length === 0) return [];
      return [
        {
          key: "rewrite",
          label: "Rewrite passage",
          run: () => {
            onSelectSentences(ids.slice(0, Math.min(6, ids.length)));
            onApplyPlaybookToRewrite();
          },
        },
      ];
    }
    case "read_aloud":
    case "so_what":
    case "and_test":
      return check.hint
        ? [
            {
              key: "copy",
              label: "Copy hint",
              run: () => void navigator.clipboard?.writeText(check.hint ?? ""),
            },
          ]
        : [];
    default: {
      const patternIds = sentenceIdsForPattern(profile, check.id);
      const first = firstId(patternIds);
      if (first == null) return [];
      return [
        {
          key: "go",
          label: "Go to issue",
          run: () => onGoToSentence(first),
        },
      ];
    }
  }
}
