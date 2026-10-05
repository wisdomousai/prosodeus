import type { StyleInfo } from "@prosodeus/shared/browser";
import { useCallback, useEffect, useState } from "react";
import type { DocumentMeta, FolderMeta, ModelInfo, WorkspaceMeta } from "@/lib/api";
import {
  fetchModels as fetchModelsWeb,
  fetchStyles,
  getDocument,
  listFolders,
  listWorkspaces,
} from "@/lib/api";
import { desktopApi, isDesktop } from "@/lib/desktop-bridge";

export interface UseDocumentLoaderReturn {
  docMeta: DocumentMeta | null;
  docTitle: string;
  setDocTitle: (title: string) => void;
  folders: FolderMeta[];
  workspaces: WorkspaceMeta[];
  availableModels: ModelInfo[];
  availableStyles: StyleInfo[];
  usingLocalSample: boolean;
  refreshDocMeta: () => Promise<void>;
}

/**
 * Fetches document meta, models, styles, folders, and workspaces on mount.
 * Handles fallback to local sample mode when the API is unavailable.
 */
export function useDocumentLoader(id: string | undefined): UseDocumentLoaderReturn {
  const [docMeta, setDocMeta] = useState<DocumentMeta | null>(null);
  const [docTitle, setDocTitle] = useState("Untitled");
  const [folders, setFolders] = useState<FolderMeta[]>([]);
  const [workspaces, setWsOptions] = useState<WorkspaceMeta[]>([]);
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);
  const [availableStyles, setAvailableStyles] = useState<StyleInfo[]>([]);
  const [usingLocalSample, setUsingLocalSample] = useState(false);

  const refreshDocMeta = useCallback(async () => {
    if (!id) return;
    try {
      const d = await getDocument(id);
      setDocMeta(d);
      setDocTitle(d.title || "Untitled");
      setUsingLocalSample(false);
    } catch {
      setDocMeta(null);
      setDocTitle("Statistical AI writing note");
      setUsingLocalSample(true);
    }
  }, [id]);

  useEffect(() => {
    void refreshDocMeta();
    listFolders()
      .then(setFolders)
      .catch(() => setFolders([]));
    listWorkspaces()
      .then(setWsOptions)
      .catch(() => setWsOptions([]));
    const loadModels = isDesktop() ? () => desktopApi().fetchModels() : () => fetchModelsWeb();
    loadModels()
      .then(setAvailableModels)
      .catch(() => {});
    fetchStyles()
      .then(setAvailableStyles)
      .catch(() => {});
  }, [id, refreshDocMeta]);

  return {
    docMeta,
    docTitle,
    setDocTitle,
    folders,
    workspaces,
    availableModels,
    availableStyles,
    usingLocalSample,
    refreshDocMeta,
  };
}
