import type {
  RewriteAlternativesEvent,
  Version,
  VersionCompareEvent,
  VersionContentEvent,
} from "@prosodeus/shared/browser";
import { desktopApi } from "@/lib/desktop-bridge";
import type {
  AnalysisEvent,
  AnalysisTransport,
  AnalyzeRequest,
  OppositionRequest,
  RewriteAlternativesRequest,
  SuggestRequest,
} from "./events";

const OPPOSITION_RUN_TIMEOUT_MS = 90_000;

/**
 * Desktop transport: routes all actions through window.prosodeus IPC and maps
 * promise resolutions / main-process pushes onto AnalysisEvents. Desktop-only
 * error copy (Kimi key hints, "no patterns" → empty suggestions) lives here so
 * the session hook stays transport-agnostic.
 */
export function createDesktopTransport(documentId: string): AnalysisTransport {
  let emit: (event: AnalysisEvent) => void = () => {};
  let oppositionRunSeq = 0;

  return {
    connect(onEvent) {
      emit = onEvent;

      // Pre-computed suggestions arrive after the analyze result on a heavier
      // model; main pushes them as an event.
      const offSuggestions = desktopApi().onAnalyzeSuggestions(
        ({ documentId: docId, suggestions }) => {
          if (docId !== documentId) return;
          emit({ type: "batch_suggestions", suggestions });
        },
      );
      const offPartial = desktopApi().onAnalyzePartial?.(({ documentId: docId, profile, done }) => {
        if (docId !== documentId) return;
        emit({ type: "profile_partial", profile, done });
      });

      return () => {
        offSuggestions();
        offPartial?.();
        emit = () => {};
      };
    },

    analyze(req: AnalyzeRequest) {
      // IPC has no streaming progress counter; show an indeterminate state.
      emit({
        type: "progress",
        progress: { type: "progress", total: 0, cached: 0, classifying: 0 },
      });
      desktopApi()
        .analyze({
          documentId,
          text: req.text,
          style: req.style,
          model: req.model,
          topSuggestions: req.topSuggestions,
          analyzeMode: req.opts?.analyzeMode,
          changedSentenceIds: req.opts?.changedSentenceIds,
          suggestMode: req.suggestMode,
          aiSlopMode: req.opts?.aiSlopMode,
        })
        .then((result) => {
          emit({ type: "profile", profile: result.profile });
        })
        .catch((err: unknown) => {
          emit({
            type: "analyze_error",
            message: err instanceof Error ? err.message : "Analyze failed",
          });
        });
    },

    rewriteAlternatives(req: RewriteAlternativesRequest) {
      desktopApi()
        .rewriteAlternatives({
          text: req.text,
          passageStart: req.passageStart,
          passageEnd: req.passageEnd,
          constraints: req.constraints,
          n: req.n,
          style: req.style,
          model: req.model,
        })
        .then((result) => {
          emit({
            type: "rewrite_alternatives",
            data: result as RewriteAlternativesEvent["data"],
          });
        })
        .catch((err: unknown) => {
          emit({
            type: "rewrite_error",
            message: err instanceof Error ? err.message : "Rewrite alternatives failed",
          });
        });
    },

    suggest(req: SuggestRequest) {
      desktopApi()
        .suggest({
          text: req.documentText,
          sentenceId: req.sentenceId,
          model: req.config?.models?.[0],
          models: req.config?.models,
          mode: req.config?.mode,
          level: req.config?.level,
          numAlternatives: req.config?.num_alternatives ?? 3,
          customInstruction: req.config?.custom_instruction,
          profileSentence: req.profileSentence,
        })
        .then((result) => {
          emit({
            type: "sentence_suggestions",
            suggestions: result.suggestions,
            notice: result.notice,
          });
        })
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : "Suggestions failed";
          if (/no patterns on this sentence/i.test(msg)) {
            emit({ type: "suggest_error", sentenceId: req.sentenceId, message: msg, empty: true });
            return;
          }
          const message = /invalid authentication|401|403|unauthorized/i.test(msg)
            ? `${msg} — Kimi key rejected. sk-kimi-* keys need the Kimi Code plan (kimi.com); developer keys come from platform.moonshot.ai or platform.moonshot.cn.`
            : msg;
          emit({ type: "suggest_error", sentenceId: req.sentenceId, message, empty: false });
        });
    },

    save(content: string) {
      void desktopApi()
        .documents.updateContent({ id: documentId, content, contentFormat: "plaintext" })
        .then(() => emit({ type: "saved" }))
        .catch(() => {});
    },

    listVersions() {
      void desktopApi()
        .versions.list({ documentId })
        .then((rows) => emit({ type: "versions", versions: rows as Version[] }));
    },

    createVersion(content: string, name?: string, source?: string) {
      void desktopApi()
        .versions.create({ documentId, content, name, ...(source ? { source } : {}) })
        .then(() =>
          desktopApi()
            .versions.list({ documentId })
            .then((rows) => emit({ type: "versions", versions: rows as Version[] })),
        );
    },

    getVersion(versionId: number) {
      void desktopApi()
        .versions.get(versionId)
        .then((row) => {
          if (row) emit({ type: "version_content", data: row as VersionContentEvent["data"] });
        });
    },

    compareVersions(a: number, b: number) {
      void desktopApi()
        .versions.compare({ versionA: a, versionB: b })
        .then((result) =>
          emit({ type: "version_compare", data: result as VersionCompareEvent["data"] }),
        )
        .catch((err: unknown) => {
          emit({
            type: "error",
            message: err instanceof Error ? err.message : "Version compare failed",
          });
        });
    },

    runOpposition(req: OppositionRequest) {
      const runId = ++oppositionRunSeq;
      let settled = false;
      const offProgress = desktopApi().onOppositionProgress(({ step }) => {
        if (runId !== oppositionRunSeq || settled) return;
        emit({ type: "opposition_progress", step });
      });
      let cleanup = () => {};
      const timeout = window.setTimeout(() => {
        if (runId !== oppositionRunSeq || settled) return;
        settled = true;
        cleanup();
        emit({
          type: "opposition_error",
          message: `Opposition rewriter timed out after ${OPPOSITION_RUN_TIMEOUT_MS / 1000}s. Try again or choose a faster model.`,
        });
      }, OPPOSITION_RUN_TIMEOUT_MS);
      cleanup = () => {
        clearTimeout(timeout);
        offProgress();
        cleanup = () => {};
      };

      desktopApi()
        .runOpposition({
          text: req.text,
          style: req.style,
          model: req.model,
          maxPasses: req.maxPasses,
        })
        .then((data) => {
          if (runId !== oppositionRunSeq || settled) return;
          settled = true;
          cleanup();
          emit({ type: "opposition_result", data });
        })
        .catch((err: unknown) => {
          if (runId !== oppositionRunSeq || settled) return;
          settled = true;
          cleanup();
          emit({
            type: "opposition_error",
            message: err instanceof Error ? err.message : "Opposition rewriter failed",
          });
        })
        .finally(() => {
          cleanup();
        });
    },
  };
}
