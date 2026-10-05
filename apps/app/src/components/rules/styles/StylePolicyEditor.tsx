import type { RewriteConstraints } from "@prosodeus/shared/browser";
import {
  AlertTriangle,
  CircleHelp,
  GraduationCap,
  Pencil,
  Save,
  Trash2,
  XCircle,
} from "lucide-react";
import * as React from "react";
import {
  ABSTRACTION_OPTIONS,
  BINARY_CONTRAST_OPTIONS,
  CLAIM_CERTAINTY_OPTIONS,
  EXPRESSION_BUDGET_OPTIONS,
  RHYTHM_OPTIONS,
  STATEMENT_FORCE_OPTIONS,
  SUPERLATIVE_OPTIONS,
} from "@/components/policy/rewrite-policy";
import { SegmentedControl } from "@/components/policy/SegmentedControl";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { UserStyle } from "@/lib/api";
import { cn } from "@/lib/utils";

type StylePolicyEditorProps = {
  selected: UserStyle | null;
  name: string;
  description: string;
  policy: RewriteConstraints;
  isEditing: boolean;
  saving: boolean;
  readOnly?: boolean;
  onNameChange: (next: string) => void;
  onDescriptionChange: (next: string) => void;
  onPolicyChange: <K extends keyof RewriteConstraints>(
    key: K,
    value: RewriteConstraints[K],
  ) => void;
  onPatchPolicy: (patch: Partial<RewriteConstraints>) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: () => void | Promise<void>;
  onDelete: () => void | Promise<void>;
};

export function StylePolicyEditor({
  selected,
  name,
  description,
  policy,
  isEditing,
  saving,
  onNameChange,
  onDescriptionChange,
  onPolicyChange,
  onPatchPolicy,
  onStartEdit,
  onCancelEdit,
  onSave,
  onDelete,
  readOnly,
}: StylePolicyEditorProps) {
  const conflict = React.useMemo(() => detectStylePolicyConflict(policy), [policy]);

  return (
    <section className="min-w-0 flex-1 overflow-y-auto rounded-md border border-border bg-card shadow-sm">
      <div className="border-b border-border px-6 py-5">
        {selected ? (
          <div className="flex items-start justify-between gap-4">
            <div className="grid min-w-0 grid-cols-[auto_1fr] gap-4">
              <span className="mt-1 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
                <GraduationCap className="size-7" strokeWidth={1.6} />
              </span>
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    Style policy
                  </p>
                  <Badge variant="secondary" className="bg-moss/12 text-foreground">
                    {isEditing ? "Editing" : "Active"}
                  </Badge>
                  {selected.is_default ? (
                    <Badge variant="outline" className="border-primary/40 text-primary">
                      Default
                    </Badge>
                  ) : null}
                </div>
                {isEditing ? (
                  <div className="space-y-2">
                    <Input
                      value={name}
                      onChange={(e) => onNameChange(e.target.value)}
                      placeholder="Style name"
                      className="h-9 text-lg font-semibold"
                      maxLength={80}
                    />
                    <textarea
                      value={description}
                      onChange={(e) => onDescriptionChange(e.target.value)}
                      placeholder="Short description of when to use this style…"
                      rows={2}
                      maxLength={1000}
                      className="w-full resize-y rounded border border-input bg-background px-3 py-2 text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                  </div>
                ) : (
                  <>
                    <h2 className="text-2xl font-semibold leading-tight text-foreground">
                      {selected.name}
                    </h2>
                    <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                      {selected.description || "No description yet."}
                    </p>
                  </>
                )}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {isEditing ? (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={onCancelEdit}
                    disabled={saving}
                    className="h-8 gap-1.5 font-mono text-[11px]"
                  >
                    <XCircle className="size-3.5" />
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={onSave}
                    disabled={saving || !name.trim()}
                    className="h-8 gap-1.5 font-mono text-[11px]"
                  >
                    <Save className="size-3.5" />
                    {saving ? "Saving…" : "Save"}
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onStartEdit}
                    disabled={readOnly}
                    className="h-8 gap-1.5 font-mono text-[11px]"
                  >
                    <Pencil className="size-3.5" />
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={onDelete}
                    disabled={saving || readOnly}
                    className="h-8 gap-1.5 font-mono text-[11px] text-destructive hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                    Delete
                  </Button>
                </>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Select a style to inspect, or create a new one to begin.
          </p>
        )}
      </div>

      {selected ? (
        <div className="px-6 py-5">
          <div
            className={cn(
              "overflow-hidden rounded-md border border-border bg-background",
              !isEditing && "opacity-90",
            )}
            aria-disabled={!isEditing}
          >
            <StyleControlRow label="How strong should claims sound?">
              <SegmentedControl
                value={policy.statement_force}
                onChange={(value) => onPolicyChange("statement_force", value)}
                aria-label="Style statement force"
                options={STATEMENT_FORCE_OPTIONS}
                size="sm"
                disabled={!isEditing}
              />
            </StyleControlRow>
            <StyleControlRow label="Claim certainty">
              <SegmentedControl
                value={policy.claim_certainty}
                onChange={(value) => onPolicyChange("claim_certainty", value)}
                aria-label="Style claim certainty"
                options={CLAIM_CERTAINTY_OPTIONS}
                size="sm"
                disabled={!isEditing}
              />
            </StyleControlRow>
            <StyleControlRow label="Allowed strongest expressions">
              <SegmentedControl
                value={policy.expression_budget}
                onChange={(value) => onPolicyChange("expression_budget", value)}
                aria-label="Style strongest expression budget"
                options={EXPRESSION_BUDGET_OPTIONS}
                size="sm"
                disabled={!isEditing}
              />
            </StyleControlRow>
            <StyleControlRow label="Superlative allowance">
              <SegmentedControl
                value={policy.superlative_ceiling}
                onChange={(value) => onPolicyChange("superlative_ceiling", value)}
                aria-label="Style superlative allowance"
                options={SUPERLATIVE_OPTIONS}
                size="sm"
                disabled={!isEditing}
              />
            </StyleControlRow>
            <StyleControlRow label="Binary contrast">
              <SegmentedControl
                value={policy.binary_contrast}
                onChange={(value) => onPolicyChange("binary_contrast", value)}
                aria-label="Style binary contrast policy"
                options={BINARY_CONTRAST_OPTIONS}
                size="sm"
                disabled={!isEditing}
              />
            </StyleControlRow>
            <StyleControlRow label="Abstraction">
              <SegmentedControl
                value={policy.abstraction_level}
                onChange={(value) => onPolicyChange("abstraction_level", value)}
                aria-label="Style abstraction policy"
                options={ABSTRACTION_OPTIONS}
                size="sm"
                disabled={!isEditing}
              />
            </StyleControlRow>
            <StyleControlRow label="Rhythm" isLast>
              <SegmentedControl
                value={policy.rhythm_policy}
                onChange={(value) => onPolicyChange("rhythm_policy", value)}
                aria-label="Style rhythm policy"
                options={RHYTHM_OPTIONS}
                size="sm"
                disabled={!isEditing}
              />
            </StyleControlRow>
          </div>

          {conflict ? (
            <Alert variant="destructive" className="mt-4 border-destructive/40">
              <AlertTriangle className="size-4" />
              <AlertTitle className="text-sm">Policy tension</AlertTitle>
              <AlertDescription className="space-y-2 text-xs">
                <p>{conflict.message}</p>
                {isEditing ? (
                  <div className="flex flex-wrap gap-2">
                    {conflict.resolutions.map((resolution) => (
                      <Button
                        key={resolution.label}
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 text-[11px]"
                        onClick={() => onPatchPolicy(resolution.patch)}
                      >
                        {resolution.label}
                      </Button>
                    ))}
                  </div>
                ) : null}
              </AlertDescription>
            </Alert>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function StyleControlRow({
  label,
  children,
  isLast,
}: {
  label: string;
  children: React.ReactNode;
  isLast?: boolean;
}) {
  return (
    <div
      className={`grid grid-cols-[10rem_1fr] items-center gap-4 px-4 py-2 ${isLast ? "" : "border-b border-border"}`}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="text-xs font-semibold leading-snug text-foreground">{label}</span>
        <CircleHelp className="size-3 shrink-0 text-muted-foreground" strokeWidth={1.8} />
      </div>
      <div className="min-w-0 max-w-sm">{children}</div>
    </div>
  );
}

type PolicyConflict = {
  message: string;
  resolutions: Array<{ label: string; patch: Partial<RewriteConstraints> }>;
};

function detectStylePolicyConflict(policy: RewriteConstraints): PolicyConflict | null {
  if (policy.expression_budget === "none" && policy.binary_contrast === "preserve_if_central") {
    return {
      message:
        "Expression budget is 0 but binary contrasts may be preserved when central. Pick an explicit default.",
      resolutions: [
        {
          label: "Allow one contrast",
          patch: { expression_budget: "one", binary_contrast: "preserve_if_central" },
        },
        {
          label: "Keep strict budget",
          patch: { expression_budget: "none", binary_contrast: "avoid" },
        },
        {
          label: "Use contrasts sparingly",
          patch: { expression_budget: "none", binary_contrast: "sparingly" },
        },
      ],
    };
  }
  if (policy.superlative_ceiling === "none" && policy.statement_force === "emphatic") {
    return {
      message: "No superlatives with forceful claims can make the style fight itself.",
      resolutions: [
        {
          label: "Allow one per section",
          patch: { superlative_ceiling: "one_per_section", statement_force: "emphatic" },
        },
        {
          label: "Soften force",
          patch: { superlative_ceiling: "none", statement_force: "firm" },
        },
      ],
    };
  }
  return null;
}
