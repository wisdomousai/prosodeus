import { runPlaybookAudit } from "@prosodeus/core/browser";
import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  ListTree,
  PanelRight,
  PenLine,
  Settings as SettingsIcon,
  SlidersHorizontal,
} from "lucide-react";
import { useCallback, useMemo, useRef } from "react";
import { DiffView } from "@/components/DiffView";
import { DocumentMetadataSheet } from "@/components/DocumentMetadataSheet";
import { AnalyzeTab } from "@/components/inspector/AnalyzeTab";
import { HotSpotsNav, inspectStateForSentence } from "@/components/inspector/HotSpotsNav";
import { OppositionRewriterTab } from "@/components/inspector/OppositionRewriterTab";
import { PlaybookTab } from "@/components/inspector/PlaybookTab";
import { RewriteTab } from "@/components/inspector/RewriteTab";
import { selectedSentenceOf } from "@/components/inspector/types";
import { VersionsTab } from "@/components/inspector/VersionsTab";
import { DocumentOutlineNav } from "@/components/shell/DocumentOutlineNav";
import { EditorialShell } from "@/components/shell/EditorialShell";
import { LeftRail, type LeftRailEntry } from "@/components/shell/LeftRail";
import { RightInspector } from "@/components/shell/RightInspector";
import { type NavEntry, TopToolbar } from "@/components/shell/TopToolbar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TiptapEditor } from "@/editor/TiptapEditor";
import {
  applyOppositionSentenceReplacement,
  type OppositionSentenceReplacementRequest,
} from "@/hooks/doc/sentence-replacement";
import { useAutoVersioning } from "@/hooks/doc/useAutoVersioning";
import { useDocumentTitle } from "@/hooks/doc/useDocumentTitle";
import { useDocumentWorkflow } from "@/hooks/doc/useDocumentWorkflow";
import { useFragmentNavigation } from "@/hooks/doc/useFragmentNavigation";
import { usePlaybookState } from "@/hooks/doc/usePlaybookState";
import { useRewriteRun } from "@/hooks/doc/useRewriteRun";
import { useSuggestionFlow } from "@/hooks/doc/useSuggestionFlow";
import { useAnalysisSession } from "@/hooks/useAnalysisSession";
import { useDocumentLoader } from "@/hooks/useDocumentLoader";
import { useEditorState } from "@/hooks/useEditorState";
import { useInspectorState } from "@/hooks/useInspectorState";
import { useVisibleSentences } from "@/hooks/useVisibleSentences";
import { updateDocument } from "@/lib/api";
import { copyToClipboard, exportMarkdown, exportTxt } from "@/lib/export";
import {
  buildSuggestionReadyIds,
  buildSuggestQueuedIds,
  type SentenceInspectContext,
} from "@/lib/sentence-inspect-state";
import { styleDisplayName } from "@/lib/style-labels";

const DOC_NAV: NavEntry[] = [
  { label: "Writing", icon: PenLine, to: "/app" },
  { label: "Rules", icon: SlidersHorizontal, to: "/app/rules" },
  { label: "Settings", icon: SettingsIcon, to: "/app/account" },
];

export const Route = createFileRoute("/app/doc/$id")({
  component: DocumentPage,
});

function DocumentPage() {
  const { id } = Route.useParams();

  // Domain hooks
  const analysis = useAnalysisSession(id);
  const {
    profile,
    status,
    progress,
    error,
    rewriteStatus,
    rewriteStep,
    rewriteAlternatives,
    rewriteSuggestions,
    batchTargetIds,
    batchInFlight,
    suggestionsLoading,
    suggestionsEmptyIds,
    suggestNotice,
    versions,
    requestVersions,
    createVersion,
    getVersion,
    compareVersions,
    versionCompare,
    clearVersionCompare,
    oppositionStatus,
    oppositionStep,
    oppositionResult,
    runOpposition,
    clearOppositionResult,
    save,
  } = analysis;

  const loader = useDocumentLoader(id);
  const {
    docMeta,
    docTitle,
    setDocTitle,
    folders,
    workspaces,
    availableModels,
    availableStyles,
    usingLocalSample,
    refreshDocMeta,
  } = loader;

  const editor = useEditorState();
  const {
    textRef,
    editorText,
    setEditorText,
    forcedEditorContent,
    tiptapEditor,
    setTiptapEditor,
    selectionContext,
    setSelectionContext,
    focalSentenceId,
    highlightClusterType,
    setHighlightClusterType,
  } = editor;

  const inspector = useInspectorState();
  const {
    activeTab,
    setActiveTab,
    outlineOpen,
    setOutlineOpen,
    mobileInspectorSignal,
    inspectorExpanded,
    setInspectorExpanded,
    metaSheetOpen,
    setMetaSheetOpen,
  } = inspector;

  // Editor container ref for viewport tracking
  const editorContainerRef = useRef<HTMLElement | null>(null);
  const visibleSentenceIds = useVisibleSentences(editorContainerRef, profile);

  const modelOptions = useMemo(
    () => availableModels.map((m) => ({ id: m.id, name: m.name })),
    [availableModels],
  );

  const handleDocumentChange = useCallback(() => {
    setMetaSheetOpen(false);
  }, [setMetaSheetOpen]);

  const workflow = useDocumentWorkflow({
    id,
    analysis,
    editor,
    usingLocalSample,
    availableModels: modelOptions,
    visibleSentenceIds,
    onDocumentChange: handleDocumentChange,
  });
  const {
    styleId,
    setStyleId,
    modelId,
    setModelId,
    aiSlopMode,
    setAiSlopMode,
    backgroundSuggest,
    setBackgroundSuggest,
    staleSentenceIds,
    runFullAnalyze,
    handleEditorTextChange,
    reAnalyzeStale,
    saveState,
  } = workflow;

  const analysisReady = status === "ready";

  const inspectCtx: SentenceInspectContext = useMemo(
    () => ({
      profile,
      analysisReady,
      staleSentenceIds,
      batchTargetIds,
      batchInFlight,
      suggestions: rewriteSuggestions,
      suggestionsLoading,
    }),
    [
      profile,
      analysisReady,
      staleSentenceIds,
      batchTargetIds,
      batchInFlight,
      rewriteSuggestions,
      suggestionsLoading,
    ],
  );

  const focalInspectState = inspectStateForSentence(focalSentenceId, inspectCtx);

  const suggestionReadyIds = useMemo(
    () => buildSuggestionReadyIds(rewriteSuggestions),
    [rewriteSuggestions],
  );
  const suggestQueuedIds = useMemo(() => buildSuggestQueuedIds(inspectCtx), [inspectCtx]);

  const outlineInspectCtx = useMemo(
    () => ({
      analysisReady,
      staleSentenceIds,
      batchTargetIds,
      batchInFlight,
      suggestions: rewriteSuggestions,
      suggestionsLoading,
    }),
    [
      analysisReady,
      staleSentenceIds,
      batchTargetIds,
      batchInFlight,
      rewriteSuggestions,
      suggestionsLoading,
    ],
  );

  const fragmentNav = useFragmentNavigation(profile, tiptapEditor, focalSentenceId);
  const { hotSentenceIds } = fragmentNav;

  const autoVersioning = useAutoVersioning({
    documentId: id,
    textRef,
    createVersion,
  });

  const suggestions = useSuggestionFlow({
    analysis,
    workflow,
    editor,
    inspectCtx,
    visibleSentenceIds,
    modelOptions,
    onApplied: autoVersioning.recordApply,
  });

  const { persistTitle } = useDocumentTitle(id, docTitle);

  const rewriteRun = useRewriteRun({
    analysis,
    workflow,
    editor,
    fragmentNav,
    inspector,
    onApplied: autoVersioning.recordApply,
  });

  const activeWorkspace = useMemo(() => {
    if (!docMeta?.workspace_id) return workspaces[0] ?? null;
    return workspaces.find((w) => w.id === docMeta.workspace_id) ?? workspaces[0] ?? null;
  }, [docMeta?.workspace_id, workspaces]);

  const playbookState = usePlaybookState({
    text: editorText,
    profile,
    constraints: rewriteRun.constraints,
    onApplyConstraints: rewriteRun.replaceConstraints,
    setActiveTab,
    bumpMobileInspector: inspector.bumpMobileInspector,
    voiceDna: activeWorkspace?.settings?.voice_dna,
    defaultPlatform: activeWorkspace?.settings?.default_playbook_platform ?? null,
    voiceStyleGuideId: activeWorkspace?.settings?.voice_style_guide_id,
  });

  const handlePinCurrent = useCallback(
    (content?: string, name?: string) => {
      const text = content ?? textRef.current;
      if (!text) return;
      autoVersioning.cancelPending();
      createVersion(text, name);
    },
    [createVersion, textRef, autoVersioning],
  );

  const handleRunOpposition = useCallback(() => {
    const text = textRef.current;
    if (!text.trim()) return;
    runOpposition(text, styleId ?? undefined, modelId ?? undefined, 1);
  }, [runOpposition, styleId, modelId, textRef]);

  const handleInspectorTabChange = useCallback(
    (tab: typeof activeTab) => {
      setActiveTab(tab);
      if (tab === "operations") setInspectorExpanded(true);
    },
    [setActiveTab, setInspectorExpanded],
  );

  const handleApplyOppositionSentence = useCallback(
    (args: OppositionSentenceReplacementRequest) =>
      applyOppositionSentenceReplacement({
        ...args,
        tiptapEditor,
        textRef,
        setEditorText,
        suppressEditorSideEffectsRef: workflow.suppressEditorSideEffectsRef,
        markApplied: workflow.markApplied,
        patchProfileSentenceText: analysis.patchProfileSentenceText,
        onApplied: autoVersioning.recordApply,
      }),
    [
      analysis.patchProfileSentenceText,
      autoVersioning,
      setEditorText,
      textRef,
      tiptapEditor,
      workflow,
    ],
  );

  // Derived from selectionContext for heat decoration
  const selectedSentenceIds = selectionContext.sentenceIds;

  const exportBasename = useMemo(() => slugExportBasename(docTitle), [docTitle]);

  const handleExportPlain = useCallback(() => {
    exportTxt(textRef.current, `${exportBasename}.txt`);
  }, [exportBasename, textRef]);

  const handleExportMarkdown = useCallback(() => {
    exportMarkdown(textRef.current, `${exportBasename}.md`);
  }, [exportBasename, textRef]);

  const handleCopyPlain = useCallback(() => {
    void copyToClipboard(textRef.current);
  }, [textRef]);

  const toolbarBreadcrumb = useMemo(() => {
    const crumbs: Array<{ label: string; to?: string }> = [{ label: "Writing", to: "/app" }];
    if (docMeta?.folder_id) {
      const folder = folders.find((f) => f.id === docMeta.folder_id);
      if (folder?.name) crumbs.push({ label: folder.name });
    } else if (docMeta?.workspace_id) {
      const ws = workspaces.find((w) => w.id === docMeta.workspace_id);
      if (ws?.name) crumbs.push({ label: ws.name });
    }
    return crumbs;
  }, [docMeta?.folder_id, docMeta?.workspace_id, folders, workspaces]);

  const styleOptions = availableStyles.map((s) => ({
    id: s.name,
    name: styleDisplayName(s.name),
  }));

  const railEntries: LeftRailEntry[] = [
    { id: "writing", label: "Writing", icon: PenLine, to: "/app" },
    {
      id: "outline",
      label: "Outline",
      icon: ListTree,
      onClick: () => setOutlineOpen((o) => !o),
      active: outlineOpen,
    },
    { id: "rules", label: "Rules", icon: SlidersHorizontal, to: "/app/rules" },
    { id: "settings", label: "Settings", icon: SettingsIcon, to: "/app/account" },
  ];

  // Capture editorContainerRef from TipTap's wrapper via a callback
  const handleEditorReady = useCallback(
    (ed: import("@tiptap/core").Editor | null) => {
      setTiptapEditor(ed);
      // The TipTap editor's scroll container is the parent of the ProseMirror element
      if (ed) {
        const pmEl = ed.view.dom;
        const container = pmEl.closest("[class*='overflow-y-auto']") as HTMLElement | null;
        editorContainerRef.current = container;
      } else {
        editorContainerRef.current = null;
      }
    },
    [setTiptapEditor],
  );

  return (
    <EditorialShell
      leftRail={<LeftRail entries={railEntries} />}
      leftSubnav={
        outlineOpen ? (
          <DocumentOutlineNav
            editor={tiptapEditor}
            profile={profile}
            focalSentenceId={focalSentenceId}
            inspectCtx={outlineInspectCtx}
            onNavigateToSentence={fragmentNav.goTo}
            onClose={() => setOutlineOpen(false)}
          />
        ) : null
      }
      toolbar={
        <TopToolbar
          navEntries={DOC_NAV}
          breadcrumb={toolbarBreadcrumb}
          title={docTitle}
          onTitleChange={setDocTitle}
          saveState={saveState}
          styles={styleOptions}
          styleId={styleId}
          onStyleChange={setStyleId}
          models={modelOptions}
          modelId={modelId}
          onModelChange={setModelId}
          aiSlopMode={aiSlopMode}
          onAiSlopModeChange={setAiSlopMode}
          backgroundSuggest={backgroundSuggest}
          onBackgroundSuggestChange={setBackgroundSuggest}
          onAnalyze={runFullAnalyze}
          analyzing={status === "analyzing"}
          onExportPlain={handleExportPlain}
          onExportMarkdown={handleExportMarkdown}
          onCopyPlain={handleCopyPlain}
          trailing={
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="hidden h-8 sm:inline-flex"
              onClick={() => setMetaSheetOpen(true)}
            >
              <PanelRight className="size-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline">Details</span>
            </Button>
          }
        />
      }
      inspector={
        <RightInspector
          active={activeTab}
          onActiveChange={handleInspectorTabChange}
          expanded={inspectorExpanded}
          onExpandedChange={setInspectorExpanded}
          mobileAutoOpenSignal={mobileInspectorSignal}
          analyze={
            <div className="flex flex-col gap-4">
              <HotSpotsNav
                profile={profile}
                focalSentenceId={focalSentenceId}
                inspectCtx={outlineInspectCtx}
                onNavigate={fragmentNav.goTo}
              />
              <AnalyzeTab
                profile={profile}
                focalSentenceId={focalSentenceId}
                styleLabel={styleId ? styleDisplayName(styleId) : undefined}
                onNavigate={(direction) =>
                  direction === "prev" ? fragmentNav.goPrev() : fragmentNav.goNext()
                }
                onRewriteSentence={(sentenceId) => rewriteRun.openSetup({ sentenceId })}
                onPinVersion={() => handlePinCurrent()}
                onCopyConstraints={rewriteRun.copyConstraints}
                selectedClusterType={highlightClusterType}
                onSelectClusterType={setHighlightClusterType}
                onRewriteCluster={(cluster) => rewriteRun.openSetup({ cluster })}
                onCopyClusterConstraints={rewriteRun.copyClusterConstraints}
                isAnalyzing={status === "analyzing"}
                analysisProgress={progress}
                visibleSentenceIds={visibleSentenceIds}
              />
            </div>
          }
          playbook={
            <PlaybookTab
              profile={profile}
              text={editorText}
              platform={playbookState.platform}
              onPlatformChange={playbookState.setPlatform}
              useVoice={playbookState.useVoice}
              onUseVoiceChange={playbookState.setUseVoice}
              hasVoiceDna={Boolean(activeWorkspace?.settings?.voice_dna?.trim())}
              useStyleGuide={playbookState.useStyleGuide}
              onUseStyleGuideChange={playbookState.setUseStyleGuide}
              hasStyleGuide={Boolean(activeWorkspace?.settings?.voice_style_guide_id)}
              onCopyPlaybookPrompt={playbookState.copyPlaybookPrompt}
              onApplyPlatformToRewrite={playbookState.applyPlatformToRewrite}
              onApplyPlaybookToRewrite={playbookState.applyPlaybookToRewrite}
              onCopyAuditFailures={() => {
                if (!profile) return;
                const audit = runPlaybookAudit(editorText, profile);
                playbookState.copyAuditFailures(
                  audit.checks.filter((c) => c.status === "fail" || c.status === "warn"),
                );
              }}
              onRewriteCluster={(cluster) => rewriteRun.openSetup({ cluster })}
              onCopyClusterConstraints={rewriteRun.copyClusterConstraints}
              onRunOpposition={() => {
                handleRunOpposition();
                setActiveTab("operations");
                setInspectorExpanded(true);
                inspector.bumpMobileInspector();
              }}
              onOpenOpposition={() => {
                setActiveTab("operations");
                setInspectorExpanded(true);
                inspector.bumpMobileInspector();
              }}
              onGoToSentence={(id) => fragmentNav.goTo(id)}
              onSelectSentenceRange={(startId, endId) => {
                const ids: number[] = [];
                for (let id = startId; id <= endId; id++) ids.push(id);
                fragmentNav.selectSentences(ids);
              }}
              onSelectSentences={(ids) => fragmentNav.selectSentences(ids)}
              selectedClusterType={highlightClusterType}
              onSelectClusterType={setHighlightClusterType}
              isAnalyzing={status === "analyzing"}
              analysisProgress={progress}
            />
          }
          rewrite={
            <RewriteTab
              sentence={selectedSentenceOf(profile, focalSentenceId)}
              inspectState={focalInspectState}
              selectedSpan={rewriteRun.selectedSpan}
              scope={rewriteRun.scope}
              onScopeChange={rewriteRun.setScope}
              constraints={rewriteRun.constraints}
              onConstraintChange={rewriteRun.setConstraint}
              alternativesCount={rewriteRun.alternativesCount}
              onAlternativesCountChange={rewriteRun.setAlternativesCount}
              isRewriting={rewriteStatus !== "idle"}
              rewriteStatus={rewriteStatus}
              rewriteStep={rewriteStep}
              onRun={rewriteRun.run}
              alternativesData={rewriteAlternatives}
              onApply={rewriteRun.apply}
              onCopyAlternative={rewriteRun.copyAlternative}
              onPinVersion={() => handlePinCurrent()}
              onReject={rewriteRun.reject}
              quickSuggestions={
                focalSentenceId != null ? (rewriteSuggestions.get(focalSentenceId) ?? []) : []
              }
              onRequestSuggestions={suggestions.requestFocalSuggestions}
              onApplySuggestion={(text) => {
                if (focalSentenceId !== null) suggestions.applySuggestion(focalSentenceId, text);
              }}
              suggestCouncil={suggestions.suggestCouncil}
              onSuggestCouncilChange={suggestions.setSuggestCouncil}
              councilModels={modelOptions}
              selectedCouncilModelIds={suggestions.orderedCouncilModelIds}
              onCouncilModelToggle={suggestions.handleCouncilModelToggle}
              onCouncilSelectAll={suggestions.handleCouncilSelectAll}
              onCouncilClear={suggestions.handleCouncilClear}
              suggestReturnedEmpty={
                focalSentenceId != null && suggestionsEmptyIds.has(focalSentenceId)
              }
              suggestNotice={suggestNotice}
              onReAnalyze={() => {
                if (focalSentenceId !== null) reAnalyzeStale(focalSentenceId);
              }}
            />
          }
          operations={
            <OppositionRewriterTab
              text={textRef.current}
              profile={profile}
              onSelectSentence={(id) => {
                fragmentNav.goTo(id);
              }}
              status={oppositionStatus}
              step={oppositionStep}
              result={oppositionResult}
              expanded={inspectorExpanded}
              onRun={handleRunOpposition}
              onApplySentenceReplacement={handleApplyOppositionSentence}
              onClear={clearOppositionResult}
            />
          }
          versions={
            <VersionsTab
              versions={versions}
              currentText={editorText}
              onLoadVersions={requestVersions}
              onPinVersion={handlePinCurrent}
              onLoadVersion={getVersion}
              onCompareVersions={compareVersions}
            />
          }
        />
      }
    >
      {error ? (
        <Alert variant="destructive" className="rounded-none border-x-0 border-t-0">
          <AlertTriangle className="size-4" />
          <AlertDescription className="font-mono text-xs">{error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {versionCompare ? (
          <DiffView
            before={versionCompare.a.content as string}
            after={versionCompare.b.content as string}
            profileA={versionCompare.a.profile}
            profileB={versionCompare.b.profile}
            onClose={clearVersionCompare}
          />
        ) : (
          <TiptapEditor
            key={id}
            onEditorReady={handleEditorReady}
            onNavigateToSentence={fragmentNav.goTo}
            profile={profile}
            selectedSentenceIds={selectedSentenceIds}
            focalSentenceId={focalSentenceId}
            onSelectionChange={setSelectionContext}
            onSave={save}
            forcedContent={forcedEditorContent}
            clusterHighlightPatternType={highlightClusterType}
            staleSentenceIds={staleSentenceIds}
            hotSentenceIds={hotSentenceIds}
            suggestionReadyIds={suggestionReadyIds}
            suggestQueuedIds={suggestQueuedIds}
            rewriteSuggestions={rewriteSuggestions}
            onApplySuggestion={suggestions.applySuggestion}
            onDismissSuggestion={suggestions.dismissSuggestion}
            onTextChange={handleEditorTextChange}
          />
        )}
      </div>

      <DocumentMetadataSheet
        open={metaSheetOpen}
        onOpenChange={setMetaSheetOpen}
        document={docMeta}
        folders={folders}
        workspaces={workspaces}
        onRefresh={refreshDocMeta}
        onSaveTitle={async (title: string) => {
          await persistTitle(title);
          setDocTitle(title);
        }}
        onMoveToFolder={async (folderId: string | null) => {
          if (!id) return;
          await updateDocument(id, { folder_id: folderId });
        }}
        onOpenHistory={() => setActiveTab("versions")}
        hasAnalysisProfile={!!profile}
      />
    </EditorialShell>
  );
}

function slugExportBasename(title: string): string {
  const t = title.trim() || "document";
  const slug = t
    .replace(/[^\p{L}\p{N}\s-]+/gu, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 48);
  return slug || "document";
}
