import { useCallback, useEffect, useRef } from "react";
import { updateDocument } from "@/lib/api";

export interface UseDocumentTitleReturn {
  /** Persist a title immediately (used by explicit save actions). */
  persistTitle: (next: string) => Promise<void>;
}

/**
 * Single title-persistence path: debounces toolbar edits and backs explicit
 * saves (metadata sheet) with the same write.
 */
export function useDocumentTitle(id: string | undefined, title: string): UseDocumentTitleReturn {
  const persistTitle = useCallback(
    async (next: string) => {
      const trimmed = next.trim();
      if (!id || !trimmed) return;
      try {
        await updateDocument(id, { title: trimmed });
      } catch {
        /* ignore */
      }
    },
    [id],
  );

  // Debounced persist as the user types in the toolbar title input.
  const lastCommitted = useRef(title);
  useEffect(() => {
    if (title === lastCommitted.current) return;
    const handle = window.setTimeout(() => {
      lastCommitted.current = title;
      void persistTitle(title);
    }, 1500);
    return () => window.clearTimeout(handle);
  }, [title, persistTitle]);

  return { persistTitle };
}
