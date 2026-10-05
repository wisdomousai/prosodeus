import { useCallback, useEffect, useRef, useState } from "react";
import { PatternDetail } from "@/components/patterns/PatternDetail";
import {
  type EditorMode,
  emptyPatternDraft,
  PatternEditor,
  patternToDraft,
} from "@/components/patterns/PatternEditor";
import type { PatternFilterState } from "@/components/patterns/PatternFilters";
import { PatternFilters } from "@/components/patterns/PatternFilters";
import { PatternVersionHistory } from "@/components/patterns/PatternVersionHistory";
import type {
  PatternCreateRequest,
  PatternDetail as PatternDetailType,
  PatternListItem,
} from "@/lib/api";
import {
  createPattern,
  deletePattern as deletePatternApi,
  forkPattern,
  getPattern,
  listPatterns,
  togglePattern,
  updatePattern,
} from "@/lib/api";
import { PatternCalibration } from "./PatternCalibration";
import { PatternImportExport } from "./PatternImportExport";
import { PatternListPanel } from "./PatternListPanel";
import { filterSamplePatterns, SAMPLE_PATTERN_DETAILS, sampleListItems } from "./patternSamples";

/**
 * Three-column patterns workbench. Layout coordinator that delegates
 * list, detail/editor, and calibration panels to child components.
 */
export function PatternsWorkbench() {
  const [patterns, setPatterns] = useState<PatternListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<PatternDetailType | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [filters, setFilters] = useState<PatternFilterState>({
    search: "",
    level: "all",
    scope: "all",
  });
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const [editMode, setEditMode] = useState<EditorMode>("create");
  const [draft, setDraft] = useState<PatternCreateRequest | null>(null);
  const [draftFromAi, setDraftFromAi] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [usingSamples, setUsingSamples] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filters.level !== "all") params.level = filters.level;
      if (filters.scope !== "all") params.scope = filters.scope;
      if (filters.search) params.search = filters.search;
      const data = await listPatterns(params);
      setPatterns(data.patterns);
      setUsingSamples(false);
      setSelectedId((prev) => {
        if (prev && data.patterns.some((p) => p.id === prev)) return prev;
        return data.patterns[0]?.id ?? null;
      });
    } catch {
      const samples = filterSamplePatterns(sampleListItems(), filters);
      setPatterns(samples);
      setUsingSamples(true);
      setSelectedId((prev) => {
        if (prev && samples.some((p) => p.id === prev)) return prev;
        return samples[0]?.id ?? null;
      });
    } finally {
      setLoading(false);
    }
  }, [filters.level, filters.scope, filters.search]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleFiltersChange = useCallback(
    (next: PatternFilterState) => {
      if (next.level !== filters.level || next.scope !== filters.scope) {
        setFilters(next);
        return;
      }
      setFilters((prev) => ({ ...prev, search: next.search }));
      clearTimeout(searchTimer.current);
      searchTimer.current = setTimeout(() => {
        setFilters(next);
      }, 300);
    },
    [filters.level, filters.scope],
  );

  // Detail loading
  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    setDetailLoading(true);
    const sample = SAMPLE_PATTERN_DETAILS.find((p) => p.id === selectedId);
    if (sample) {
      setDetail(sample);
      setDetailLoading(false);
      return;
    }
    getPattern(selectedId)
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setDetailLoading(false));
  }, [selectedId]);

  // Editor actions
  const handleCreate = () => {
    setEditMode("create");
    setDraft(emptyPatternDraft());
    setDraftFromAi(false);
  };
  const handleAiSuggested = (suggested: PatternCreateRequest) => {
    setEditMode("create");
    setDraft(suggested);
    setDraftFromAi(true);
  };
  const handleEdit = async () => {
    if (!detail) return;
    // Platform patterns: auto-fork first, then edit the user copy
    if (detail.scope === "platform") {
      setSaving(true);
      try {
        const { id } = await forkPattern(detail.id);
        await refresh();
        setSelectedId(id);
        const forked = await getPattern(id);
        setDetail(forked);
        setEditMode("edit");
        setDraft(patternToDraft(forked, "edit"));
        setDraftFromAi(false);
      } finally {
        setSaving(false);
      }
      return;
    }
    setEditMode("edit");
    setDraft(patternToDraft(detail, "edit"));
    setDraftFromAi(false);
  };
  const handleFork = () => {
    if (!detail || selectedId?.startsWith("sample:")) return;
    setEditMode("fork");
    setDraft(patternToDraft(detail, "fork"));
    setDraftFromAi(false);
  };
  const handleCancelEdit = () => {
    setDraft(null);
    setDraftFromAi(false);
  };

  const handleDelete = async () => {
    if (!selectedId || selectedId.startsWith("platform:") || selectedId.startsWith("sample:"))
      return;
    await deletePatternApi(selectedId);
    setSelectedId(null);
    setDetail(null);
    refresh();
  };

  const handleToggle = async () => {
    if (!selectedId || selectedId.startsWith("sample:")) return;
    try {
      const { is_enabled } = await togglePattern(selectedId);
      // Update list item in place
      setPatterns((prev) => prev.map((p) => (p.id === selectedId ? { ...p, is_enabled } : p)));
      // Update detail in place
      if (detail && detail.id === selectedId) setDetail({ ...detail, is_enabled });
    } catch {
      /* ignore – offline */
    }
  };

  const handleSave = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      if (editMode === "create") {
        const { id } = await createPattern(draft);
        await refresh();
        setSelectedId(id);
      } else if (editMode === "edit" && selectedId) {
        await updatePattern(selectedId, draft);
        await refresh();
        const updated = await getPattern(selectedId);
        setDetail(updated);
      } else if (editMode === "fork" && detail) {
        const { id } = await forkPattern(detail.id, draft);
        await refresh();
        setSelectedId(id);
      }
      setDraft(null);
      setDraftFromAi(false);
    } finally {
      setSaving(false);
    }
  };

  const handleImported = () => refresh();
  const handleReverted = async () => {
    await refresh();
    if (selectedId) {
      const updated = await getPattern(selectedId);
      setDetail(updated);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 border-b border-border bg-background/70 px-4 py-3">
        <PatternFilters filters={filters} onFiltersChange={handleFiltersChange} />
        <PatternImportExport
          importOpen={importOpen}
          onImportOpenChange={setImportOpen}
          onImported={handleImported}
          currentScope={filters.scope}
          onSuggested={handleAiSuggested}
          onCreate={handleCreate}
          usingSamples={usingSamples}
        />
      </div>

      {/* Three-column layout */}
      <div className="flex flex-1 min-h-0">
        <PatternListPanel
          patterns={patterns}
          selectedId={selectedId}
          onSelect={setSelectedId}
          loading={loading}
        />

        {/* Center: detail or editor */}
        <div className="flex-1 min-w-0 border-r border-border overflow-hidden">
          {draft ? (
            <PatternEditor
              mode={editMode}
              draft={draft}
              saving={saving}
              seededFromAi={draftFromAi}
              onChange={setDraft}
              onSave={handleSave}
              onCancel={handleCancelEdit}
            />
          ) : (
            <PatternDetail
              pattern={detail}
              loading={detailLoading}
              onEdit={handleEdit}
              onFork={handleFork}
              onDelete={handleDelete}
              onToggle={handleToggle}
              onShowVersions={() => setVersionsOpen(true)}
            />
          )}
        </div>

        {/* Right: calibration */}
        <div className="w-[22rem] shrink-0 overflow-y-auto bg-background p-4">
          <PatternCalibration pattern={detail} loading={detailLoading} />
        </div>
      </div>

      {selectedId && (
        <PatternVersionHistory
          open={versionsOpen}
          onOpenChange={setVersionsOpen}
          patternId={selectedId}
          onReverted={handleReverted}
        />
      )}
    </div>
  );
}
