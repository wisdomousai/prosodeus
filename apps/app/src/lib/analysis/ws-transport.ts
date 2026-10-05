import type { RewriteSuggestion, StylometricProfile } from "@prosodeus/core/browser";
import type {
  Iteration,
  OppositionResultEvent,
  ProgressEvent,
  RewriteAlternativesEvent,
  Version,
  VersionCompareEvent,
  VersionContentEvent,
} from "@prosodeus/shared/browser";
import { WSClient } from "@prosodeus/shared/browser";
import { buildLocalProfile, buildLocalRewriteAlternatives } from "@/lib/local-analysis";
import type {
  AnalysisEvent,
  AnalysisTransport,
  AnalyzeRequest,
  OppositionRequest,
  RewriteAlternativesRequest,
  SuggestRequest,
} from "./events";

export type { Iteration };

/**
 * Cloud transport: maps the document WebSocket message stream onto
 * AnalysisEvents. When the socket is unavailable it falls back to local,
 * heuristic-only analysis so the demo/offline path keeps working.
 */
export function createWsTransport(documentId: string): AnalysisTransport {
  let client: WSClient | null = null;
  let emit: (event: AnalysisEvent) => void = () => {};

  const isConnected = () => Boolean(client?.isConnected);

  return {
    connect(onEvent) {
      emit = onEvent;

      const apiBase = import.meta.env.VITE_API_URL || window.location.origin;
      const finalUrl = apiBase.startsWith("http")
        ? `${apiBase.replace(/^http/, "ws")}/api/documents/${documentId}/ws`
        : `ws://${window.location.host}/api/documents/${documentId}/ws`;

      const ws = new WSClient(
        finalUrl,
        (data) => {
          const msg = data as Record<string, unknown>;
          switch (msg.type) {
            case "progress":
              emit({ type: "progress", progress: msg as unknown as ProgressEvent });
              break;
            case "profile_partial":
              emit({
                type: "profile_partial",
                profile: msg.data as StylometricProfile,
                done: Boolean(msg.done),
              });
              break;
            case "profile":
              emit({ type: "profile", profile: msg.data as StylometricProfile });
              break;
            case "suggestions":
              emit({ type: "batch_suggestions", suggestions: msg.data as RewriteSuggestion[] });
              break;
            case "rewrite_progress":
              emit({ type: "rewrite_progress", step: msg.step as string });
              break;
            case "rewrite_alternatives":
              emit({
                type: "rewrite_alternatives",
                data: msg.data as RewriteAlternativesEvent["data"],
              });
              break;
            case "opposition_progress":
              emit({ type: "opposition_progress", step: msg.step as string });
              break;
            case "opposition_result":
              emit({ type: "opposition_result", data: msg.data as OppositionResultEvent["data"] });
              break;
            case "versions":
              emit({ type: "versions", versions: msg.data as Version[] });
              break;
            case "version_content":
              emit({ type: "version_content", data: msg.data as VersionContentEvent["data"] });
              break;
            case "version_compare":
              emit({ type: "version_compare", data: msg.data as VersionCompareEvent["data"] });
              break;
            case "rewrite_suggestions":
              emit({
                type: "sentence_suggestions",
                suggestions: msg.data as RewriteSuggestion[],
              });
              break;
            case "saved":
              emit({ type: "saved" });
              break;
            case "error":
              emit({ type: "error", message: msg.message as string });
              break;
            // Legacy messages (rewrite_result, equilibrium_*, reverse_guide_result,
            // iterations) are no longer surfaced.
          }
        },
        (wsStatus) => {
          emit({ type: "connection", status: wsStatus });
        },
      );

      ws.connect();
      client = ws;

      return () => {
        ws.destroy();
        client = null;
        emit = () => {};
      };
    },

    analyze(req: AnalyzeRequest) {
      if (!isConnected()) {
        // Offline fallback: emit a synthetic profile from local heuristics.
        emit({
          type: "progress",
          progress: { type: "progress", total: 0, cached: 0, classifying: 0 },
        });
        window.setTimeout(() => {
          emit({ type: "profile", profile: buildLocalProfile(req.text) });
          // No server batch will follow a local profile.
          emit({ type: "batch_suggestions", suggestions: [] });
        }, 80);
        return;
      }
      client?.send({
        type: "analyze",
        text: req.text,
        style: req.style,
        model: req.model,
        analyze_mode: req.opts?.analyzeMode ?? "full",
        top_suggestions: req.topSuggestions,
        suggest_mode: req.suggestMode,
        ai_slop_mode: req.opts?.aiSlopMode,
        ...(req.opts?.changedSentenceIds?.length
          ? { changed_sentence_ids: req.opts.changedSentenceIds }
          : {}),
        ...(req.opts?.scope ? { scope: req.opts.scope } : {}),
        ...(req.disabledPatterns?.length ? { disabled_patterns: req.disabledPatterns } : {}),
      });
    },

    rewriteAlternatives(req: RewriteAlternativesRequest) {
      if (!isConnected()) {
        window.setTimeout(() => {
          emit({
            type: "rewrite_alternatives",
            data: buildLocalRewriteAlternatives(
              req.text,
              req.passageStart,
              req.passageEnd,
              req.constraints,
              req.n,
            ),
          });
        }, 120);
        return;
      }
      client?.send({
        type: "rewrite",
        text: req.text,
        passage_start: req.passageStart,
        passage_end: req.passageEnd,
        style: req.style,
        model: req.model,
        n: req.n,
        constraints: req.constraints,
      });
    },

    suggest(req: SuggestRequest) {
      client?.send({
        type: "suggest_rewrites",
        sentence_id: req.sentenceId,
        text: req.documentText,
        models: req.config?.models?.length ? req.config.models : undefined,
        mode: req.config?.mode,
        level: req.config?.level,
        custom_instruction: req.config?.custom_instruction,
        num_alternatives: req.config?.num_alternatives,
      });
    },

    runOpposition(req: OppositionRequest) {
      client?.send({
        type: "opposition_run",
        text: req.text,
        style: req.style,
        model: req.model,
        max_passes: req.maxPasses,
      });
    },

    save(content: string) {
      if (!isConnected()) {
        emit({ type: "saved" });
        return;
      }
      client?.send({ type: "save", content });
    },

    listVersions() {
      client?.send({ type: "list_versions" });
    },

    createVersion(content: string, name?: string, source?: string) {
      client?.send({
        type: "create_version",
        content,
        name,
        ...(source ? { source } : {}),
      });
    },

    getVersion(versionId: number) {
      client?.send({ type: "get_version", version_id: versionId });
    },

    compareVersions(a: number, b: number) {
      client?.send({ type: "compare_versions", version_a: a, version_b: b });
    },
  };
}
