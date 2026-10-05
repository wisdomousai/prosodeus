import {
  BookOpenText,
  CheckCircle2,
  ClipboardList,
  Copy,
  FileText,
  GitFork,
  History,
  Pencil,
  Power,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { PatternDetail as PatternDetailType } from "@/lib/api";
import { cn } from "@/lib/utils";
import { PatternLevelBadge } from "./PatternLevelBadge";
import { PatternScopeBadge } from "./PatternScopeBadge";

interface Props {
  pattern: PatternDetailType | null;
  loading: boolean;
  onEdit: () => void;
  onFork: () => void;
  onDelete: () => void;
  onToggle: () => void;
  onShowVersions: () => void;
}

const severityClasses: Record<string, string> = {
  critical: "border-blood/40 bg-blood/10 text-blood",
  high: "border-blood/35 bg-blood/8 text-blood",
  medium: "border-amber/35 bg-amber/10 text-amber",
  low: "border-moss/35 bg-moss/10 text-moss",
};

export function PatternDetail({
  pattern,
  loading,
  onEdit,
  onFork,
  onDelete,
  onToggle,
  onShowVersions,
}: Props) {
  const [copied, setCopied] = useState(false);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="size-5 animate-spin rounded-full border-2 border-gold/40 border-t-gold" />
      </div>
    );
  }

  if (!pattern) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="max-w-sm text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-md border border-border bg-muted/40 text-muted-foreground">
            <SlidersHorizontal className="size-5" strokeWidth={1.75} />
          </div>
          <h2 className="text-xl font-semibold text-foreground">Select a rule</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Pick a pattern to inspect its detection evidence, rewrite menu, and prompt contribution.
          </p>
        </div>
      </div>
    );
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(JSON.stringify(pattern, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const examples = pattern.examples ?? [];
  const falsePositives = pattern.false_positives ?? [];
  const rewriteMenu = pattern.rewrite_menu ?? [];
  const substitutions = pattern.substitutions ?? [];
  const falseSubstitutions = pattern.false_substitutions ?? [];
  const toleranceOverrides = pattern.tolerance_overrides ?? {};
  const relatedPatterns = pattern.related_patterns ?? [];
  const isPlatform = pattern.scope === "platform";
  const isSample = pattern.id.startsWith("sample:");
  const severity = pattern.severity ?? "medium";

  return (
    <ScrollArea className="h-full">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 p-5">
        <section className="rounded-lg border border-border bg-card p-5">
          <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-start 2xl:justify-between">
            <div className="min-w-0">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <PatternLevelBadge level={pattern.level} />
                <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  {pattern.taxonomy_id}
                </span>
                <PatternScopeBadge scope={pattern.scope} />
                {isSample ? (
                  <Badge
                    variant="outline"
                    className="rounded-md border-amber/35 bg-amber/10 font-mono text-[10px] uppercase tracking-wider text-amber"
                  >
                    sample
                  </Badge>
                ) : null}
                <Badge
                  variant="outline"
                  className={cn(
                    "rounded-md font-mono text-[10px] uppercase tracking-wider",
                    severityClasses[severity] ?? severityClasses.medium,
                  )}
                >
                  {severity}
                </Badge>
              </div>
              <h2 className="text-3xl font-semibold leading-tight text-card-foreground">
                {pattern.name}
              </h2>
              {pattern.description ? (
                <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-muted-foreground">
                  {pattern.description}
                </p>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-1.5">
                {(pattern.tags ?? []).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-md border border-border bg-background px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 2xl:justify-end">
              <Button
                variant={pattern.is_enabled ? "outline" : "ghost"}
                size="sm"
                onClick={onToggle}
                disabled={isSample}
                className={cn(
                  "h-8 gap-1.5 font-mono text-[11px]",
                  !pattern.is_enabled && "text-muted-foreground",
                )}
              >
                <Power className="size-3.5" />
                {pattern.is_enabled ? "Enabled" : "Disabled"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onEdit}
                disabled={isSample}
                className="h-8 gap-1.5 font-mono text-[11px]"
              >
                <Pencil className="size-3.5" />
                Edit
              </Button>
              {isPlatform ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onFork}
                  disabled={isSample}
                  className="h-8 gap-1.5 font-mono text-[11px]"
                >
                  <GitFork className="size-3.5" />
                  Fork
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onDelete}
                  className="h-8 gap-1.5 font-mono text-[11px] text-destructive hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                  Delete
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="h-8 gap-1.5 font-mono text-[11px]"
              >
                <Copy className="size-3.5" />
                {copied ? "Copied" : "Copy JSON"}
              </Button>
              {!isPlatform ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onShowVersions}
                  className="h-8 gap-1.5 font-mono text-[11px]"
                >
                  <History className="size-3.5" />v{pattern.version}
                </Button>
              ) : null}
            </div>
          </div>
        </section>

        <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_220px]">
          <InfoPanel
            icon={<ClipboardList className="size-4" />}
            title="Detection"
            body={pattern.detection_hint || "No detection hint set."}
          />
          <section className="rounded-lg border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-2 text-muted-foreground">
              <CheckCircle2 className="size-4" />
              <h3 className="font-mono text-[11px] uppercase tracking-wider">Density weight</h3>
            </div>
            <dl className="space-y-2 text-sm">
              <Metric label="Weight" value={String(pattern.heat_weight)} />
              <Metric label="Amplification" value={pattern.self_amplification ?? "-"} />
              <Metric label="Level" value={pattern.level} />
            </dl>
          </section>
        </div>

        <div className="grid gap-4 2xl:grid-cols-2">
          <ExamplePanel
            title={`Positive examples (${examples.length})`}
            empty="No positive examples yet."
            items={examples.map((ex) => ({
              text: ex.text,
              note: ex.explanation || ex.source,
            }))}
          />
          <ExamplePanel
            title={`False positives (${falsePositives.length})`}
            empty="No false-positive examples yet."
            items={falsePositives.map((ex) => ({
              text: ex.text,
              note: ex.explanation,
            }))}
            muted
          />
        </div>

        <section className="rounded-lg border border-border bg-card">
          <SectionHeader icon={<BookOpenText className="size-4" />} title="Rewrite menu" />
          <div className="grid gap-2 p-4">
            {rewriteMenu.length > 0 ? (
              rewriteMenu.map((opt, index) => (
                <div
                  key={opt.id ?? index}
                  className="flex gap-3 rounded-md border border-border bg-background px-3 py-2.5"
                >
                  <span className="flex size-6 shrink-0 items-center justify-center rounded bg-ink-soft font-mono text-[11px] text-foreground">
                    {index + 1}
                  </span>
                  <p className="text-sm leading-relaxed text-foreground/85">{opt.instruction}</p>
                </div>
              ))
            ) : (
              <EmptyLine>No rewrite options defined.</EmptyLine>
            )}
          </div>
        </section>

        <div className="grid gap-4 2xl:grid-cols-2">
          <InfoPanel
            icon={<FileText className="size-4" />}
            title="Prompt directive"
            body={pattern.pce_directive || "No directive set."}
            mono
          />
          <section className="rounded-lg border border-border bg-card">
            <SectionHeader icon={<SlidersHorizontal className="size-4" />} title="Policy edges" />
            <div className="space-y-3 p-4">
              {Object.keys(toleranceOverrides).length > 0 ? (
                <div className="grid gap-2">
                  {Object.entries(toleranceOverrides).map(([genre, value]) => (
                    <div
                      key={genre}
                      className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-sm"
                    >
                      <span className="text-muted-foreground">{genre}</span>
                      <span className="font-mono text-xs text-foreground">{value}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyLine>No style-specific tolerance overrides.</EmptyLine>
              )}
              {relatedPatterns.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {relatedPatterns.map((related) => (
                    <span
                      key={related}
                      className="rounded-md border border-border bg-background px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground"
                    >
                      {related}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </section>
        </div>

        {substitutions.length > 0 || falseSubstitutions.length > 0 ? (
          <section className="rounded-lg border border-border bg-card">
            <SectionHeader icon={<ClipboardList className="size-4" />} title="Substitution rules" />
            <div className="grid gap-3 p-4 2xl:grid-cols-2">
              <SubstitutionList
                title="Allowed"
                items={substitutions.map((s) => ({
                  from: s.from,
                  to: s.to,
                  note: s.context,
                }))}
              />
              <SubstitutionList
                title="Blocked"
                items={falseSubstitutions.map((s) => ({
                  from: s.from,
                  to: s.to,
                  note: s.why_wrong,
                }))}
              />
            </div>
          </section>
        ) : null}
      </div>
    </ScrollArea>
  );
}

function SectionHeader({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 border-b border-border px-4 py-3 text-muted-foreground">
      {icon}
      <h3 className="font-mono text-[11px] uppercase tracking-wider">{title}</h3>
    </div>
  );
}

function InfoPanel({
  icon,
  title,
  body,
  mono,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  mono?: boolean;
}) {
  return (
    <section className="rounded-lg border border-border bg-card">
      <SectionHeader icon={icon} title={title} />
      <div className="p-4">
        <p
          className={cn(
            "text-sm leading-relaxed text-foreground/85",
            mono && "font-mono text-[12px]",
          )}
        >
          {body}
        </p>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-mono text-xs text-foreground">{value}</dd>
    </div>
  );
}

function ExamplePanel({
  title,
  items,
  empty,
  muted,
}: {
  title: string;
  items: Array<{ text: string; note?: string }>;
  empty: string;
  muted?: boolean;
}) {
  return (
    <section className="rounded-lg border border-border bg-card">
      <SectionHeader
        icon={muted ? <CheckCircle2 className="size-4" /> : <BookOpenText className="size-4" />}
        title={title}
      />
      <div className="grid gap-2 p-4">
        {items.length > 0 ? (
          items.map((item, index) => (
            <div
              key={`${item.text}-${index}`}
              className={cn(
                "rounded-md border border-border bg-background px-3 py-2.5",
                muted && "bg-muted/30",
              )}
            >
              <p className="font-serif text-[15px] leading-relaxed text-foreground">
                "{item.text}"
              </p>
              {item.note ? (
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.note}</p>
              ) : null}
            </div>
          ))
        ) : (
          <EmptyLine>{empty}</EmptyLine>
        )}
      </div>
    </section>
  );
}

function SubstitutionList({
  title,
  items,
}: {
  title: string;
  items: Array<{ from: string; to: string; note?: string }>;
}) {
  return (
    <div>
      <p className="mb-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      <div className="space-y-2">
        {items.length > 0 ? (
          items.map((item, index) => (
            <div
              key={`${item.from}-${item.to}-${index}`}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              <div className="flex flex-wrap items-center gap-2 font-mono text-[12px]">
                <span className="text-destructive line-through">{item.from}</span>
                <span className="text-muted-foreground">-&gt;</span>
                <span className="text-moss">{item.to}</span>
              </div>
              {item.note ? <p className="mt-1 text-xs text-muted-foreground">{item.note}</p> : null}
            </div>
          ))
        ) : (
          <EmptyLine>None defined.</EmptyLine>
        )}
      </div>
    </div>
  );
}

function EmptyLine({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}
