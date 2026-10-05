import type { MutableRefObject } from "react";
import { useCallback, useEffect, useRef } from "react";

const AUTO_VERSION_DEBOUNCE_MS = 15_000;

export interface UseAutoVersioningReturn {
  /** Note that a rewrite/suggestion was applied; schedules a debounced auto-version. */
  recordApply: () => void;
  /** Drop any pending auto-version (a manual pin supersedes it). */
  cancelPending: () => void;
}

/**
 * Turns applied rewrites into iteration checkpoints: each apply (re)starts a
 * trailing debounce, so a burst of applies collapses into one `"rewrite"`-
 * sourced version. A pending version is flushed when the document unmounts or
 * changes, and skipped when the text hasn't changed since the last one.
 */
export function useAutoVersioning({
  documentId,
  textRef,
  createVersion,
}: {
  documentId: string;
  textRef: MutableRefObject<string>;
  createVersion: (content: string, name?: string, source?: string) => void;
}): UseAutoVersioningReturn {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef(false);
  const lastVersionedTextRef = useRef<string | null>(null);

  const createVersionRef = useRef(createVersion);
  createVersionRef.current = createVersion;

  const flush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!pendingRef.current) return;
    pendingRef.current = false;
    const text = textRef.current;
    if (!text?.trim() || text === lastVersionedTextRef.current) return;
    lastVersionedTextRef.current = text;
    createVersionRef.current(text, undefined, "rewrite");
  }, [textRef]);

  const recordApply = useCallback(() => {
    pendingRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flush, AUTO_VERSION_DEBOUNCE_MS);
  }, [flush]);

  const cancelPending = useCallback(() => {
    pendingRef.current = false;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    // The manual pin captures the current text; don't re-version it later.
    lastVersionedTextRef.current = textRef.current;
  }, [textRef]);

  // Flush a pending auto-version when the document changes or unmounts.
  useEffect(() => {
    lastVersionedTextRef.current = null;
    return flush;
  }, [documentId, flush]);

  return { recordApply, cancelPending };
}
