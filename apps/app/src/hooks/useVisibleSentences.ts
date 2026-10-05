import type { StylometricProfile } from "@prosodeus/core/browser";
import { useEffect, useRef, useState } from "react";

/**
 * Tracks which `[data-sentence-id]` elements are visible within the editor
 * scroll container using IntersectionObserver. Debounced at 100ms.
 */
export function useVisibleSentences(
  containerRef: React.RefObject<HTMLElement | null>,
  profile: StylometricProfile | null,
): Set<number> {
  const [visible, setVisible] = useState<Set<number>>(new Set());
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !profile || profile.sentences.length === 0) {
      setVisible(new Set());
      return;
    }

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const currentlyVisible = new Set<number>();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const el = entry.target as HTMLElement;
          const id = Number(el.getAttribute("data-sentence-id"));
          if (isNaN(id)) continue;
          if (entry.isIntersecting) {
            currentlyVisible.add(id);
          } else {
            currentlyVisible.delete(id);
          }
        }
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          setVisible(new Set(currentlyVisible));
        }, 100);
      },
      {
        root: container,
        threshold: 0,
      },
    );

    // Observe all sentence-decorated elements
    const elements = container.querySelectorAll("[data-sentence-id]");
    for (const el of elements) {
      observerRef.current.observe(el);
    }

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, [containerRef, profile]);

  return visible;
}
