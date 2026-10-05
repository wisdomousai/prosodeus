import type {
  OppositionParagraphHit,
  OppositionSectionHit,
  OppositionSentenceHit,
  PatternType,
  StylometricProfile,
} from "@prosodeus/core/browser";
import { scanOppositions } from "@prosodeus/core/browser";
import { type ReactNode, useMemo } from "react";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/shell/Panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { patternLabel } from "./types";

export function OppositionMapPanel({
  profile,
  onSelectSentence,
}: {
  profile: StylometricProfile | null;
  onSelectSentence?: (sentenceId: number) => void;
}) {
  const scan = useMemo(() => (profile ? scanOppositions(profile) : null), [profile]);

  if (!profile) {
    return (
      <Panel>
        <PanelHeader>
          <PanelTitle>Opposition map</PanelTitle>
        </PanelHeader>
        <PanelBody>
          <p className="text-sm text-muted-foreground">
            Run analysis to see binary contrasts at sentence, paragraph, and section level.
          </p>
        </PanelBody>
      </Panel>
    );
  }

  if (!scan || scan.totalSentenceHits === 0) {
    return (
      <Panel>
        <PanelHeader>
          <PanelTitle>Opposition map</PanelTitle>
        </PanelHeader>
        <PanelBody>
          <p className="text-sm text-muted-foreground">
            No binary contrasts detected in the current analysis.
          </p>
        </PanelBody>
      </Panel>
    );
  }

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>Opposition map</PanelTitle>
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {scan.totalSentenceHits} sentence{scan.totalSentenceHits === 1 ? "" : "s"}
        </span>
      </PanelHeader>
      <PanelBody className="space-y-4">
        {scan.sections.length > 0 ? (
          <OppositionLevelSection title="Section">
            {scan.sections.slice(0, 6).map((section) => (
              <SectionRow
                key={`${section.windowSize}-${section.startSentence}-${section.endSentence}`}
                section={section}
                onSelectSentence={onSelectSentence}
              />
            ))}
          </OppositionLevelSection>
        ) : null}

        {scan.paragraphs.length > 0 ? (
          <OppositionLevelSection title="Paragraph">
            {scan.paragraphs.map((paragraph) => (
              <ParagraphRow
                key={paragraph.paragraphId}
                paragraph={paragraph}
                onSelectSentence={onSelectSentence}
              />
            ))}
          </OppositionLevelSection>
        ) : null}

        <OppositionLevelSection title="Sentence">
          {scan.sentences.map((sentence) => (
            <SentenceRow
              key={sentence.sentenceId}
              sentence={sentence}
              onSelect={onSelectSentence}
            />
          ))}
        </OppositionLevelSection>
      </PanelBody>
    </Panel>
  );
}

function OppositionLevelSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <h4 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {title}
      </h4>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function PatternBadges({ patterns }: { patterns: PatternType[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {patterns.map((type) => (
        <Badge key={type} variant="secondary" className="font-mono text-[9px]">
          {patternLabel(type)}
        </Badge>
      ))}
    </div>
  );
}

function SectionRow({
  section,
  onSelectSentence,
}: {
  section: OppositionSectionHit;
  onSelectSentence?: (id: number) => void;
}) {
  const firstSentenceId = section.sentenceIds[0];
  const label =
    section.windowSize === "wide"
      ? `Wide window · s${section.startSentence + 1}–${section.endSentence + 1}`
      : `Medium window · s${section.startSentence + 1}–${section.endSentence + 1}`;

  return (
    <div className="rounded-md border border-border bg-card px-3 py-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <PatternBadges patterns={section.patterns} />
          <p className="text-xs text-muted-foreground">
            {section.sentenceIds.length} hit{section.sentenceIds.length === 1 ? "" : "s"} ·{" "}
            {section.oppositionDensity.toFixed(1)} per 1k words · ~{section.wordCount} words
          </p>
        </div>
        {onSelectSentence && firstSentenceId != null ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 shrink-0 text-xs"
            onClick={() => onSelectSentence(firstSentenceId)}
          >
            Show in draft
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function ParagraphRow({
  paragraph,
  onSelectSentence,
}: {
  paragraph: OppositionParagraphHit;
  onSelectSentence?: (id: number) => void;
}) {
  const firstSentenceId = paragraph.sentenceIds[0];

  return (
    <div className="rounded-md border border-border bg-card px-3 py-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Paragraph {paragraph.paragraphId + 1}
          </p>
          <PatternBadges patterns={paragraph.patterns} />
          <p className="line-clamp-2 text-sm text-foreground">{paragraph.excerpt}</p>
          <p className="text-xs text-muted-foreground">
            {paragraph.hitCount} pattern{paragraph.hitCount === 1 ? "" : "s"} across{" "}
            {paragraph.sentenceIds.length} sentence
            {paragraph.sentenceIds.length === 1 ? "" : "s"}
          </p>
        </div>
        {onSelectSentence && firstSentenceId != null ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 shrink-0 text-xs"
            onClick={() => onSelectSentence(firstSentenceId)}
          >
            Show in draft
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function SentenceRow({
  sentence,
  onSelect,
}: {
  sentence: OppositionSentenceHit;
  onSelect?: (id: number) => void;
}) {
  const body = (
    <>
      <div className="mb-1.5 flex items-center gap-2">
        <span className="font-mono text-[10px] text-muted-foreground">
          s{sentence.sentenceId + 1} · p{sentence.paragraphId + 1}
        </span>
      </div>
      <PatternBadges patterns={sentence.patterns.map((p) => p.type)} />
      <p className="mt-2 text-sm leading-relaxed text-foreground">{sentence.text}</p>
      {sentence.patterns.some((p) => p.evidence && p.evidence !== sentence.text) ? (
        <p className="mt-1 text-xs text-muted-foreground">
          Evidence: {sentence.patterns.map((p) => p.evidence).join("; ")}
        </p>
      ) : null}
    </>
  );

  if (!onSelect) {
    return (
      <div className="w-full rounded-md border border-border bg-background px-3 py-2 text-left">
        {body}
      </div>
    );
  }

  return (
    <button
      type="button"
      className="w-full rounded-md border border-border bg-background px-3 py-2 text-left transition-colors hover:border-primary/30 hover:bg-ink-soft"
      onClick={() => onSelect(sentence.sentenceId)}
    >
      {body}
    </button>
  );
}
