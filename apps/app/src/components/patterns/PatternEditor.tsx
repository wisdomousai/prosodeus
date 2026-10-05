import { Plus, Save, Sparkles, X, XCircle } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PatternCreateRequest, PatternLevel, PatternSeverity } from "@/lib/api";
import { cn } from "@/lib/utils";

export type EditorMode = "create" | "edit" | "fork";

interface Props {
  mode: EditorMode;
  draft: PatternCreateRequest;
  saving?: boolean;
  /** If set, badge under the title shows the AI source hint. */
  seededFromAi?: boolean;
  onChange: (next: PatternCreateRequest) => void;
  onSave: () => Promise<void> | void;
  onCancel: () => void;
}

/** Empty starter draft for new patterns. */
export function emptyPatternDraft(): PatternCreateRequest {
  return {
    pattern_id: "",
    name: "",
    level: "sentence",
    detection_hint: "",
    description: "",
    pce_directive: "",
    heat_weight: 1.0,
    self_amplification: "med",
    severity: "medium",
    examples: [],
    false_positives: [],
    rewrite_menu: [],
    substitutions: [],
    false_substitutions: [],
    related_patterns: [],
    research_sources: [],
    tolerance_overrides: {},
    tags: [],
  };
}

/** Seed an edit/fork draft from an existing PatternDetail. */
export function patternToDraft(
  pattern: {
    pattern_id: string;
    name: string;
    level: PatternLevel;
    taxonomy_id?: string;
    heat_weight: number;
    self_amplification: PatternCreateRequest["self_amplification"];
    severity?: PatternSeverity;
    description: string;
    detection_hint: string;
    pce_directive: string;
    detection_notes?: string | null;
    examples?: PatternCreateRequest["examples"];
    false_positives?: PatternCreateRequest["false_positives"];
    substitutions?: PatternCreateRequest["substitutions"];
    false_substitutions?: PatternCreateRequest["false_substitutions"];
    rewrite_menu?: PatternCreateRequest["rewrite_menu"];
    tolerance_overrides?: PatternCreateRequest["tolerance_overrides"];
    related_patterns?: string[];
    research_sources?: PatternCreateRequest["research_sources"];
    tags?: string[];
  },
  mode: EditorMode,
): PatternCreateRequest {
  const isFork = mode === "fork";
  return {
    pattern_id: isFork ? `${pattern.pattern_id}_custom` : pattern.pattern_id,
    name: isFork ? `${pattern.name} (Custom)` : pattern.name,
    level: pattern.level,
    detection_hint: pattern.detection_hint,
    taxonomy_id: pattern.taxonomy_id,
    heat_weight: pattern.heat_weight,
    self_amplification: pattern.self_amplification,
    rewrite_menu: pattern.rewrite_menu ?? [],
    pce_directive: pattern.pce_directive,
    tolerance_overrides: pattern.tolerance_overrides ?? {},
    description: pattern.description,
    examples: pattern.examples ?? [],
    false_positives: pattern.false_positives ?? [],
    substitutions: pattern.substitutions ?? [],
    false_substitutions: pattern.false_substitutions ?? [],
    tags: pattern.tags ?? [],
    severity: pattern.severity,
    related_patterns: pattern.related_patterns ?? [],
    detection_notes: pattern.detection_notes ?? undefined,
    research_sources: pattern.research_sources ?? [],
  };
}

export function PatternEditor({
  mode,
  draft,
  saving,
  seededFromAi,
  onChange,
  onSave,
  onCancel,
}: Props) {
  const title =
    mode === "create" ? "New pattern" : mode === "fork" ? "Fork pattern" : "Edit pattern";

  const canSave = !!draft.pattern_id && !!draft.name && !!draft.detection_hint;

  const update = <K extends keyof PatternCreateRequest>(key: K, value: PatternCreateRequest[K]) =>
    onChange({ ...draft, [key]: value });

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-background/70 px-5 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate font-mono text-xs uppercase tracking-widest text-muted-foreground">
              {title}
            </h2>
            {seededFromAi ? (
              <Badge
                variant="outline"
                className="gap-1 rounded-md border-primary/40 bg-primary/10 font-mono text-[10px] uppercase tracking-wider text-primary"
              >
                <Sparkles className="size-3" />
                AI draft
              </Badge>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={saving}
            className="h-8 gap-1.5 font-mono text-[11px]"
          >
            <XCircle className="size-3.5" />
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => onSave()}
            disabled={saving || !canSave}
            className="h-8 gap-1.5 font-mono text-[11px]"
          >
            <Save className="size-3.5" />
            {saving ? "Saving…" : mode === "create" ? "Create" : mode === "fork" ? "Fork" : "Save"}
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="mx-auto flex max-w-4xl flex-col gap-4 p-5">
          <Section title="Identity">
            <FieldRow>
              <Field label="Pattern ID" hint="lowercase, underscores">
                <Input
                  value={draft.pattern_id}
                  onChange={(e) =>
                    update("pattern_id", e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))
                  }
                  disabled={mode === "edit"}
                  placeholder="my_custom_pattern"
                  className="h-8 font-mono text-xs"
                />
              </Field>
              <Field label="Name">
                <Input
                  value={draft.name}
                  onChange={(e) => update("name", e.target.value)}
                  placeholder="Human-Readable Name"
                  className="h-8 text-sm"
                />
              </Field>
            </FieldRow>
            <FieldRow>
              <Field label="Level">
                <Select
                  value={draft.level}
                  onValueChange={(v) => update("level", v as PatternLevel)}
                >
                  <SelectTrigger className="h-8 font-mono text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lexical">Lexical</SelectItem>
                    <SelectItem value="sentence">Sentence</SelectItem>
                    <SelectItem value="paragraph">Paragraph</SelectItem>
                    <SelectItem value="document">Document</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Severity">
                <Select
                  value={draft.severity ?? "medium"}
                  onValueChange={(v) => update("severity", v as PatternSeverity)}
                >
                  <SelectTrigger className="h-8 font-mono text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Heat weight">
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="2"
                  value={draft.heat_weight ?? 1.0}
                  onChange={(e) => update("heat_weight", parseFloat(e.target.value) || 1.0)}
                  className="h-8 font-mono text-xs"
                />
              </Field>
              <Field label="Amplification">
                <Select
                  value={draft.self_amplification ?? "med"}
                  onValueChange={(v) =>
                    update("self_amplification", v as PatternCreateRequest["self_amplification"])
                  }
                >
                  <SelectTrigger className="h-8 font-mono text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="med">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </FieldRow>
          </Section>

          <Section title="Content">
            <Field label="Description">
              <Textarea
                value={draft.description ?? ""}
                onChange={(v) => update("description", v)}
                placeholder="One or two sentences on what this pattern is and why it matters."
                rows={3}
              />
            </Field>
            <Field label="Detection hint" hint="The classifier reads this. Be specific.">
              <Textarea
                value={draft.detection_hint}
                onChange={(v) => update("detection_hint", v)}
                placeholder="A sentence that begins with a self-referential phrase such as 'It is important to note…'"
                rows={3}
              />
            </Field>
            <Field label="PCE directive" hint="One-line instruction for the rewriter LLM.">
              <Textarea
                value={draft.pce_directive ?? ""}
                onChange={(v) => update("pce_directive", v)}
                placeholder="Rewrite the sentence to state the observation directly…"
                rows={2}
              />
            </Field>
            <Field label="Detection notes" hint="Optional. Hints for tuning the classifier.">
              <Textarea
                value={draft.detection_notes ?? ""}
                onChange={(v) => update("detection_notes", v)}
                rows={2}
              />
            </Field>
          </Section>

          <Section title={`Examples (${(draft.examples ?? []).length})`}>
            <ExamplesEditor
              items={draft.examples ?? []}
              onChange={(items) => update("examples", items as PatternCreateRequest["examples"])}
              placeholder="A sentence that triggers this rule…"
              addLabel="Add example"
            />
          </Section>

          <Section title={`False positives (${(draft.false_positives ?? []).length})`}>
            <ExamplesEditor
              items={draft.false_positives ?? []}
              onChange={(items) =>
                update("false_positives", items as PatternCreateRequest["false_positives"])
              }
              placeholder="A sentence that LOOKS similar but is fine…"
              addLabel="Add false positive"
            />
          </Section>

          <Section title={`Rewrite menu (${(draft.rewrite_menu ?? []).length})`}>
            <RewriteMenuEditor
              items={draft.rewrite_menu ?? []}
              onChange={(items) =>
                update("rewrite_menu", items as PatternCreateRequest["rewrite_menu"])
              }
            />
          </Section>

          <Section title="Tags">
            <TagInput tags={draft.tags ?? []} onChange={(tags) => update("tags", tags)} />
          </Section>
        </div>
      </ScrollArea>
    </div>
  );
}

// ─── Form atoms ─────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card">
      <header className="border-b border-border px-4 py-2.5">
        <h3 className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          {title}
        </h3>
      </header>
      <div className="space-y-3 p-4">{children}</div>
    </section>
  );
}

function FieldRow({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2">{children}</div>;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
        {hint ? (
          <span className="ml-2 font-sans normal-case tracking-normal opacity-70">{hint}</span>
        ) : null}
      </label>
      {children}
    </div>
  );
}

function Textarea({
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className={cn(
        "w-full resize-y rounded border border-input bg-background px-3 py-2 text-sm leading-relaxed",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
      )}
    />
  );
}

function TagInput({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [input, setInput] = useState("");
  const add = () => {
    const t = input.trim().toLowerCase();
    if (t && !tags.includes(t)) onChange([...tags, t]);
    setInput("");
  };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <Badge key={tag} variant="secondary" className="gap-1 font-mono text-[10px]">
            {tag}
            <button
              onClick={() => onChange(tags.filter((t) => t !== tag))}
              aria-label={`Remove ${tag}`}
            >
              <X className="size-2.5" />
            </button>
          </Badge>
        ))}
        {tags.length === 0 ? (
          <span className="font-mono text-[11px] text-muted-foreground">No tags yet.</span>
        ) : null}
      </div>
      <div className="flex gap-1.5">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Add tag…"
          className="h-7 flex-1 font-mono text-xs"
        />
        <Button variant="outline" size="sm" onClick={add} className="h-7 px-2">
          <Plus className="size-3" />
        </Button>
      </div>
    </div>
  );
}

type ExampleItem = { text: string; explanation?: string; source?: string };

function ExamplesEditor({
  items,
  onChange,
  placeholder,
  addLabel,
}: {
  items: ExampleItem[];
  onChange: (items: ExampleItem[]) => void;
  placeholder: string;
  addLabel: string;
}) {
  const updateAt = (i: number, patch: Partial<ExampleItem>) => {
    onChange(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  };
  const removeAt = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  const add = () => onChange([...items, { text: "" }]);

  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="rounded-md border border-border bg-background p-3">
          <div className="flex items-start gap-2">
            <span className="mt-1.5 font-mono text-[10px] text-muted-foreground">{i + 1}.</span>
            <div className="flex-1 space-y-2">
              <Textarea
                value={item.text}
                onChange={(v) => updateAt(i, { text: v })}
                placeholder={placeholder}
                rows={2}
              />
              <Input
                value={item.explanation ?? ""}
                onChange={(e) => updateAt(i, { explanation: e.target.value })}
                placeholder="Why this matches (optional)"
                className="h-7 text-xs"
              />
            </div>
            <button
              type="button"
              onClick={() => removeAt(i)}
              aria-label="Remove example"
              className="mt-1 text-muted-foreground hover:text-destructive"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        onClick={add}
        className="h-7 gap-1.5 font-mono text-[11px]"
      >
        <Plus className="size-3" />
        {addLabel}
      </Button>
    </div>
  );
}

type RewriteItem = { id: number; instruction: string };

function RewriteMenuEditor({
  items,
  onChange,
}: {
  items: RewriteItem[];
  onChange: (items: RewriteItem[]) => void;
}) {
  const updateAt = (i: number, instruction: string) =>
    onChange(items.map((it, idx) => (idx === i ? { ...it, instruction } : it)));
  const removeAt = (i: number) =>
    onChange(items.filter((_, idx) => idx !== i).map((it, idx) => ({ ...it, id: idx + 1 })));
  const add = () => onChange([...items, { id: items.length + 1, instruction: "" }]);

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div
          key={i}
          className="flex items-start gap-2 rounded-md border border-border bg-background p-2"
        >
          <span className="mt-2 font-mono text-[10px] text-muted-foreground">{item.id}.</span>
          <Textarea
            value={item.instruction}
            onChange={(v) => updateAt(i, v)}
            placeholder="Specific rewrite directive…"
            rows={2}
          />
          <button
            type="button"
            onClick={() => removeAt(i)}
            aria-label="Remove rewrite option"
            className="mt-2 text-muted-foreground hover:text-destructive"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        onClick={add}
        className="h-7 gap-1.5 font-mono text-[11px]"
      >
        <Plus className="size-3" />
        Add option
      </Button>
    </div>
  );
}
