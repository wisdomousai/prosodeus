import { useCallback, useState } from "react";
import type { FolderDialogState } from "@/components/FolderTreeDialogs";

interface FolderOpsCallbacks {
  onCreateFolder: (name: string, parentId?: string) => void;
  onRenameFolder: (id: string, name: string) => void;
  onRenameDocument?: (id: string, title: string) => void;
}

export interface UseFolderOpsReturn {
  dialogState: FolderDialogState;
  openNewFolder: (parentId?: string) => void;
  openRenameFolder: (id: string, name: string) => void;
  openRenameDoc: (id: string, title: string) => void;
  handleNewFolderNameChange: (name: string) => void;
  handleNewFolderSubmit: () => void;
  handleNewFolderClose: () => void;
  handleRenameChange: (name: string) => void;
  handleRenameSubmit: () => void;
  handleRenameClose: () => void;
  handleRenameDocChange: (title: string) => void;
  handleRenameDocSubmit: () => void;
  handleRenameDocClose: () => void;
}

/**
 * Manages dialog open/close state and form logic for folder CRUD operations.
 */
export function useFolderOps(callbacks: FolderOpsCallbacks): UseFolderOpsReturn {
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderParentId, setNewFolderParentId] = useState<string | undefined>(undefined);
  const [newFolderName, setNewFolderName] = useState("");
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [renamingDoc, setRenamingDoc] = useState<{ id: string; title: string } | null>(null);

  const openNewFolder = useCallback((parentId?: string) => {
    setNewFolderParentId(parentId);
    setNewFolderName("");
    setShowNewFolder(true);
  }, []);

  const openRenameFolder = useCallback((id: string, name: string) => {
    setRenaming({ id, name });
  }, []);

  const openRenameDoc = useCallback((id: string, title: string) => {
    setRenamingDoc({ id, title });
  }, []);

  const handleNewFolderNameChange = useCallback((name: string) => {
    setNewFolderName(name);
  }, []);

  const handleNewFolderSubmit = useCallback(() => {
    if (newFolderName.trim()) {
      callbacks.onCreateFolder(newFolderName.trim(), newFolderParentId);
      setNewFolderName("");
      setShowNewFolder(false);
      setNewFolderParentId(undefined);
    }
  }, [newFolderName, newFolderParentId, callbacks]);

  const handleNewFolderClose = useCallback(() => {
    setShowNewFolder(false);
    setNewFolderParentId(undefined);
  }, []);

  const handleRenameChange = useCallback((name: string) => {
    setRenaming((prev) => (prev ? { ...prev, name } : null));
  }, []);

  const handleRenameSubmit = useCallback(() => {
    if (renaming && renaming.name.trim()) {
      callbacks.onRenameFolder(renaming.id, renaming.name.trim());
      setRenaming(null);
    }
  }, [renaming, callbacks]);

  const handleRenameClose = useCallback(() => {
    setRenaming(null);
  }, []);

  const handleRenameDocChange = useCallback((title: string) => {
    setRenamingDoc((prev) => (prev ? { ...prev, title } : null));
  }, []);

  const handleRenameDocSubmit = useCallback(() => {
    if (renamingDoc && renamingDoc.title.trim() && callbacks.onRenameDocument) {
      callbacks.onRenameDocument(renamingDoc.id, renamingDoc.title.trim());
      setRenamingDoc(null);
    }
  }, [renamingDoc, callbacks]);

  const handleRenameDocClose = useCallback(() => {
    setRenamingDoc(null);
  }, []);

  return {
    dialogState: { showNewFolder, newFolderParentId, newFolderName, renaming, renamingDoc },
    openNewFolder,
    openRenameFolder,
    openRenameDoc,
    handleNewFolderNameChange,
    handleNewFolderSubmit,
    handleNewFolderClose,
    handleRenameChange,
    handleRenameSubmit,
    handleRenameClose,
    handleRenameDocChange,
    handleRenameDocSubmit,
    handleRenameDocClose,
  };
}
