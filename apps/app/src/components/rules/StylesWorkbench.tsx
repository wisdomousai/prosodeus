import type { RewriteConstraints } from "@prosodeus/shared/browser";
import { DEFAULT_REWRITE_CONSTRAINTS } from "@prosodeus/shared/browser";
import * as React from "react";
import {
  createUserStyle,
  deleteUserStyle,
  listUserStyles,
  type UserStyle,
  updateUserStyle,
} from "@/lib/api";
import { StyleLibraryPane } from "./styles/StyleLibraryPane";
import { StylePolicyEditor } from "./styles/StylePolicyEditor";
import { StylePolicyPreview } from "./styles/StylePolicyPreview";

function policyFromStyle(style: UserStyle | null): RewriteConstraints {
  if (!style) return { ...DEFAULT_REWRITE_CONSTRAINTS };
  return { ...DEFAULT_REWRITE_CONSTRAINTS, ...(style.policy as Partial<RewriteConstraints>) };
}

const SAMPLE_STYLES: UserStyle[] = [
  {
    id: "sample:academic",
    name: "Academic evidence-first",
    description:
      "Lead with verifiable evidence and clear reasoning. Qualify claims, limit superlatives, prefer concrete over abstract.",
    is_default: true,
    policy: {
      statement_force: "measured",
      claim_certainty: "qualify",
      expression_budget: "one",
      superlative_ceiling: "one_per_section",
      binary_contrast: "sparingly",
      abstraction_level: "balanced",
      rhythm_policy: "vary_openings",
    },
    version: 1,
    created_at: "2026-05-01T00:00:00.000Z",
    updated_at: "2026-05-01T00:00:00.000Z",
  },
  {
    id: "sample:editorial",
    name: "Editorial confident",
    description:
      "Direct, confident prose. Allow stronger claims when evidence earns them. Break mirrored rhythms.",
    is_default: false,
    policy: {
      statement_force: "firm",
      claim_certainty: "preserve",
      expression_budget: "few",
      superlative_ceiling: "preserve_if_evidence",
      binary_contrast: "preserve_if_central",
      abstraction_level: "balanced",
      rhythm_policy: "break_mirrored",
    },
    version: 1,
    created_at: "2026-05-01T00:00:00.000Z",
    updated_at: "2026-05-01T00:00:00.000Z",
  },
  {
    id: "sample:technical",
    name: "Technical precise",
    description:
      "Concrete, specific language. No superlatives, no binary rhetoric. Preserve cadence where deliberate.",
    is_default: false,
    policy: {
      statement_force: "measured",
      claim_certainty: "reduce",
      expression_budget: "none",
      superlative_ceiling: "none",
      binary_contrast: "avoid",
      abstraction_level: "concrete",
      rhythm_policy: "preserve_cadence",
    },
    version: 1,
    created_at: "2026-05-01T00:00:00.000Z",
    updated_at: "2026-05-01T00:00:00.000Z",
  },
];

export function StylesWorkbench() {
  const [styles, setStyles] = React.useState<UserStyle[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [policy, setPolicy] = React.useState<RewriteConstraints>(DEFAULT_REWRITE_CONSTRAINTS);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [isEditing, setIsEditing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [styleSearch, setStyleSearch] = React.useState("");
  const [draftOpen, setDraftOpen] = React.useState(false);
  const [draftName, setDraftName] = React.useState("");
  const [draftDescription, setDraftDescription] = React.useState("");
  const draftNameRef = React.useRef<HTMLInputElement | null>(null);

  const [usingSamples, setUsingSamples] = React.useState(false);

  const refresh = React.useCallback(async () => {
    try {
      const items = await listUserStyles();
      setStyles(items);
      setUsingSamples(false);
      setError(null);
      setSelectedId((prev) => {
        if (prev && items.some((s) => s.id === prev)) return prev;
        return items[0]?.id ?? null;
      });
    } catch {
      setStyles(SAMPLE_STYLES);
      setUsingSamples(true);
      setError("API unavailable");
      setSelectedId((prev) => {
        if (prev && SAMPLE_STYLES.some((s) => s.id === prev)) return prev;
        return SAMPLE_STYLES[0]?.id ?? null;
      });
    }
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const selected = React.useMemo(
    () => styles.find((s) => s.id === selectedId) ?? null,
    [styles, selectedId],
  );

  // Reset local edit buffers whenever the selected style changes.
  React.useEffect(() => {
    setPolicy(policyFromStyle(selected));
    setName(selected?.name ?? "");
    setDescription(selected?.description ?? "");
    setIsEditing(false);
  }, [selected]);

  const visibleStyles = React.useMemo(() => {
    const q = styleSearch.trim().toLowerCase();
    if (!q) return styles;
    return styles.filter((style) =>
      [style.name, style.description].join(" ").toLowerCase().includes(q),
    );
  }, [styles, styleSearch]);

  const updatePolicy = React.useCallback(
    <K extends keyof RewriteConstraints>(key: K, value: RewriteConstraints[K]) => {
      if (!isEditing) return;
      setPolicy((prev) => ({ ...prev, [key]: value }));
    },
    [isEditing],
  );

  const patchPolicy = React.useCallback(
    (patch: Partial<RewriteConstraints>) => {
      if (!isEditing) return;
      setPolicy((prev) => ({ ...prev, ...patch }));
    },
    [isEditing],
  );

  const openDraft = React.useCallback(() => {
    if (usingSamples) return;
    setDraftOpen(true);
    setDraftName("");
    setDraftDescription("");
    window.setTimeout(() => draftNameRef.current?.focus(), 0);
  }, [usingSamples]);

  const addDraft = React.useCallback(async () => {
    const trimmed = draftName.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      const { id } = await createUserStyle({
        name: trimmed,
        description: draftDescription.trim() || "Custom style draft.",
        policy: { ...DEFAULT_REWRITE_CONSTRAINTS } as unknown as Record<string, unknown>,
      });
      setDraftOpen(false);
      setDraftName("");
      setDraftDescription("");
      await refresh();
      setSelectedId(id);
      setIsEditing(true);
    } catch (err) {
      setError((err as Error)?.message ?? "Failed to create style");
    } finally {
      setSaving(false);
    }
  }, [draftName, draftDescription, refresh]);

  const handleStartEdit = React.useCallback(() => {
    if (usingSamples) return;
    setIsEditing(true);
  }, [usingSamples]);

  const handleCancelEdit = React.useCallback(() => {
    setPolicy(policyFromStyle(selected));
    setName(selected?.name ?? "");
    setDescription(selected?.description ?? "");
    setIsEditing(false);
  }, [selected]);

  const handleSave = React.useCallback(async () => {
    if (!selected) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Name cannot be empty.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateUserStyle(selected.id, {
        name: trimmedName,
        description: description.trim(),
        policy: policy as unknown as Record<string, unknown>,
      });
      await refresh();
      setIsEditing(false);
    } catch (err) {
      setError((err as Error)?.message ?? "Failed to save style");
    } finally {
      setSaving(false);
    }
  }, [selected, name, description, policy, refresh]);

  const handleDelete = React.useCallback(async () => {
    if (!selected) return;
    if (!window.confirm(`Delete style "${selected.name}"? This cannot be undone.`)) return;
    setSaving(true);
    try {
      await deleteUserStyle(selected.id);
      await refresh();
    } catch (err) {
      setError((err as Error)?.message ?? "Failed to delete style");
    } finally {
      setSaving(false);
    }
  }, [selected, refresh]);

  const apiUnavailable = usingSamples;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      {apiUnavailable ? (
        <div className="border-b border-amber/40 bg-amber/5 px-5 py-2.5 flex items-center gap-3">
          <span className="rounded-md border border-amber/40 bg-amber/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-amber">
            Offline
          </span>
          <span className="text-xs text-muted-foreground">
            Style API unavailable. Connect the worker to create and edit styles.
          </span>
        </div>
      ) : error ? (
        <div className="border-b border-destructive/40 bg-destructive/10 px-5 py-2 text-xs text-destructive">
          {error}
        </div>
      ) : null}
      <div className="flex min-h-0 flex-1 gap-4 overflow-hidden p-5">
        <StyleLibraryPane
          styles={styles}
          visibleStyles={visibleStyles}
          selectedId={selectedId}
          search={styleSearch}
          onSearchChange={setStyleSearch}
          onSelect={setSelectedId}
          draftOpen={draftOpen}
          draftName={draftName}
          draftDescription={draftDescription}
          draftNameRef={draftNameRef}
          onDraftNameChange={setDraftName}
          onDraftDescriptionChange={setDraftDescription}
          onAddDraft={addDraft}
          onOpenDraft={openDraft}
          onCloseDraft={() => setDraftOpen(false)}
          savingDraft={saving && draftOpen}
          readOnly={usingSamples}
        />
        <StylePolicyEditor
          selected={selected}
          name={name}
          description={description}
          policy={policy}
          isEditing={isEditing}
          saving={saving}
          onNameChange={setName}
          onDescriptionChange={setDescription}
          onPolicyChange={updatePolicy}
          onPatchPolicy={patchPolicy}
          onStartEdit={handleStartEdit}
          onCancelEdit={handleCancelEdit}
          onSave={handleSave}
          onDelete={handleDelete}
          readOnly={usingSamples}
        />
        <StylePolicyPreview policy={policy} />
      </div>
    </div>
  );
}
