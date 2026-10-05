import { type Dispatch, type SetStateAction, useCallback, useState } from "react";
import type { InspectorTabId } from "@/components/shell/RightInspector";

export interface UseInspectorStateReturn {
  activeTab: InspectorTabId;
  setActiveTab: (tab: InspectorTabId) => void;
  outlineOpen: boolean;
  setOutlineOpen: Dispatch<SetStateAction<boolean>>;
  mobileInspectorSignal: number;
  bumpMobileInspector: () => void;
  inspectorExpanded: boolean;
  setInspectorExpanded: Dispatch<SetStateAction<boolean>>;
  metaSheetOpen: boolean;
  setMetaSheetOpen: (open: boolean) => void;
}

/**
 * Manages inspector panel state: active tab, outline drawer, mobile signal,
 * and metadata sheet visibility.
 */
export function useInspectorState(): UseInspectorStateReturn {
  const [activeTab, setActiveTab] = useState<InspectorTabId>("analyze");
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [mobileInspectorSignal, setMobileInspectorSignal] = useState(0);
  const [inspectorExpanded, setInspectorExpanded] = useState(false);
  const [metaSheetOpen, setMetaSheetOpen] = useState(false);

  const bumpMobileInspector = useCallback(() => {
    setMobileInspectorSignal((n) => n + 1);
  }, []);

  return {
    activeTab,
    setActiveTab,
    outlineOpen,
    setOutlineOpen,
    mobileInspectorSignal,
    bumpMobileInspector,
    inspectorExpanded,
    setInspectorExpanded,
    metaSheetOpen,
    setMetaSheetOpen,
  };
}
