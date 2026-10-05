import {
  ArrowRight,
  ChevronRight,
  FileText,
  FolderClosed,
  FolderOpen,
  FolderPlus,
  Library,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { DocumentGrid } from "@/components/DocumentGrid";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { DocumentMeta, FolderMeta } from "@/lib/api";
import { buildTree, type FolderNode, folderBreadcrumbTrail } from "@/lib/document-tree";
import { cn } from "@/lib/utils";

function folderIsDescendantOf(
  folderId: string,
  ancestorId: string,
  folders: FolderMeta[],
): boolean {
  const byId = new Map(folders.map((f) => [f.id, f] as const));
  let cur: FolderMeta | undefined = byId.get(folderId);
  while (cur?.parent_id) {
    if (cur.parent_id === ancestorId) return true;
    cur = byId.get(cur.parent_id);
  }
  return false;
}

function cannotUseAsParent(
  candidateParent: string | null,
  movingId: string,
  folders: FolderMeta[],
): boolean {
  if (candidateParent === null) return false;
  if (candidateParent === movingId) return true;
  return folderIsDescendantOf(candidateParent, movingId, folders);
}

function ancestorFolderIds(folderId: string, folders: FolderMeta[]): string[] {
  const byId = new Map(folders.map((f) => [f.id, f] as const));
  const ids: string[] = [];
  let cur = byId.get(folderId)?.parent_id ?? null;
  while (cur) {
    ids.push(cur);
    cur = byId.get(cur)?.parent_id ?? null;
  }
  return ids;
}

interface Props {
  folders: FolderMeta[];
  documents: DocumentMeta[];
  onCreateFolder: (name: string, parentId?: string) => void;
  onRenameFolder: (id: string, name: string) => void;
  onDeleteFolder: (id: string) => void;
  onDeleteDocument: (id: string) => void;
  onMoveDocument: (docId: string, folderId: string | null) => void;
  onRenameDocument: (id: string, title: string) => void;
  onMoveFolder: (folderId: string, parentId: string | null) => void;
  onNewDocumentAtRoot: () => void;
  onNewDocumentInFolder: (folderId: string) => void;
  onRequestGridRename: (doc: DocumentMeta) => void;
}

export function LibraryBrowseView({
  folders,
  documents,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onDeleteDocument,
  onMoveDocument,
  onRenameDocument,
  onMoveFolder,
  onNewDocumentAtRoot,
  onNewDocumentInFolder,
  onRequestGridRename,
}: Props) {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderParentId, setNewFolderParentId] = useState<string | undefined>(undefined);
  const [newFolderName, setNewFolderName] = useState("");
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);

  const { roots } = useMemo(() => buildTree(folders, []), [folders]);

  useEffect(() => {
    setExpanded((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const f of folders) {
        if (!next.has(f.id)) {
          next.add(f.id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [folders]);

  useEffect(() => {
    if (selectedFolderId && !folders.some((f) => f.id === selectedFolderId)) {
      setSelectedFolderId(null);
    }
  }, [folders, selectedFolderId]);

  const docsHere = useMemo(
    () =>
      documents.filter((d) =>
        selectedFolderId === null
          ? d.folder_id == null || d.folder_id === ""
          : d.folder_id === selectedFolderId,
      ),
    [documents, selectedFolderId],
  );

  const breadcrumb = useMemo(
    () => folderBreadcrumbTrail(selectedFolderId, folders),
    [selectedFolderId, folders],
  );

  const selectFolder = useCallback(
    (id: string | null) => {
      setSelectedFolderId(id);
      if (id) {
        const anc = ancestorFolderIds(id, folders);
        setExpanded((prev) => new Set([...prev, ...anc, id]));
      }
    },
    [folders],
  );

  const openNewFolder = (parentId?: string) => {
    setNewFolderParentId(parentId);
    setNewFolderName("");
    setShowNewFolder(true);
  };

  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      onCreateFolder(newFolderName.trim(), newFolderParentId);
      setNewFolderName("");
      setShowNewFolder(false);
      setNewFolderParentId(undefined);
    }
  };

  const handleRename = () => {
    if (renaming && renaming.name.trim()) {
      onRenameFolder(renaming.id, renaming.name.trim());
      setRenaming(null);
    }
  };

  const newFolderParentForToolbar = selectedFolderId === null ? undefined : selectedFolderId;

  const createDocumentHere = () => {
    if (selectedFolderId === null) onNewDocumentAtRoot();
    else onNewDocumentInFolder(selectedFolderId);
  };

  return (
    <>
      <div className="flex min-h-[min(70vh,720px)] flex-col gap-4 md:flex-row md:gap-0 md:rounded-lg md:border md:border-border/60 md:bg-card/20 md:overflow-hidden">
        {/* Folder sidebar */}
        <aside className="flex w-full shrink-0 flex-col border-b border-border/60 md:w-[min(100%,280px)] md:border-b-0 md:border-r md:border-border/60">
          <div className="flex items-center justify-between gap-2 border-b border-border/40 bg-card/30 px-3 py-2.5">
            <span className="font-mono text-[0.65rem] uppercase tracking-widest text-muted-foreground">
              Folders
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 shrink-0 gap-1 font-mono text-[0.6rem] text-gold hover:text-gold"
              title={
                selectedFolderId === null
                  ? "New folder at library root"
                  : "New folder inside selected folder"
              }
              onClick={() => openNewFolder(newFolderParentForToolbar)}
            >
              <FolderPlus className="size-3.5" />
              New folder
            </Button>
          </div>
          <nav className="min-h-[120px] max-h-[40vh] overflow-y-auto p-2 md:max-h-none md:flex-1">
            <button
              type="button"
              onClick={() => selectFolder(null)}
              className={cn(
                "mb-1 flex w-full items-center gap-2 rounded-md px-2 py-2 text-left font-mono text-[0.7rem] transition-colors",
                selectedFolderId === null
                  ? "bg-gold-dim/45 text-card-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-card-foreground",
              )}
            >
              <Library className="size-3.5 shrink-0 opacity-80" />
              <span className="truncate">Library root</span>
            </button>
            <div className="space-y-0.5">
              {roots.map((node) => (
                <FolderNavBranch
                  key={node.folder.id}
                  node={node}
                  depth={0}
                  folders={folders}
                  selectedFolderId={selectedFolderId}
                  expanded={expanded}
                  setExpanded={setExpanded}
                  onSelectFolder={selectFolder}
                  onRename={(id, name) => setRenaming({ id, name })}
                  onDeleteFolder={onDeleteFolder}
                  onNewSubfolder={(folderId) => openNewFolder(folderId)}
                  onMoveFolder={onMoveFolder}
                  onCreateDocumentInFolder={onNewDocumentInFolder}
                />
              ))}
            </div>
            {roots.length === 0 && (
              <p className="px-2 py-4 text-center font-mono text-[0.65rem] text-muted-foreground">
                No folders yet — use New folder to add one.
              </p>
            )}
          </nav>
        </aside>

        {/* Main area */}
        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex flex-col gap-3 border-b border-border/40 bg-card/15 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex flex-wrap items-center gap-x-1 gap-y-1 font-mono text-[0.7rem] text-muted-foreground">
              {breadcrumb.map((seg, i) => {
                const last = i === breadcrumb.length - 1;
                return (
                  <span key={seg.id ?? "root"} className="flex min-w-0 items-center gap-1">
                    {i > 0 && <ChevronRight className="size-3 shrink-0 opacity-50" />}
                    {last ? (
                      <span className="truncate font-medium text-card-foreground">{seg.label}</span>
                    ) : (
                      <button
                        type="button"
                        className="truncate rounded px-1 py-0.5 hover:bg-accent/60 hover:text-card-foreground"
                        onClick={() => selectFolder(seg.id)}
                      >
                        {seg.label}
                      </button>
                    )}
                  </span>
                );
              })}
            </div>
            <Button
              type="button"
              size="sm"
              className="shrink-0 font-mono text-[0.7rem] tracking-wider"
              onClick={() => void createDocumentHere()}
            >
              <Plus className="size-4" />
              New document here
            </Button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <DocumentGrid
              documents={docsHere}
              folders={folders}
              onMoveDocument={onMoveDocument}
              onDeleteDocument={onDeleteDocument}
              onRequestRename={onRequestGridRename}
              onCreateDocument={createDocumentHere}
            />
          </div>
        </section>
      </div>

      {/* Dialogs */}
      <Dialog
        open={showNewFolder}
        onOpenChange={(o) => {
          setShowNewFolder(o);
          if (!o) setNewFolderParentId(undefined);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">
              {newFolderParentId ? "New subfolder" : "New folder"}
            </DialogTitle>
          </DialogHeader>
          <Input
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Folder name"
            className="font-mono text-sm"
            onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
            autoFocus
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowNewFolder(false);
                setNewFolderParentId(undefined);
              }}
              className="font-mono text-xs"
            >
              Cancel
            </Button>
            <Button onClick={handleCreateFolder} className="font-mono text-xs">
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!renaming} onOpenChange={() => setRenaming(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Rename folder</DialogTitle>
          </DialogHeader>
          <Input
            value={renaming?.name ?? ""}
            onChange={(e) => renaming && setRenaming({ ...renaming, name: e.target.value })}
            className="font-mono text-sm"
            onKeyDown={(e) => e.key === "Enter" && handleRename()}
            autoFocus
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRenaming(null)}
              className="font-mono text-xs"
            >
              Cancel
            </Button>
            <Button onClick={handleRename} className="font-mono text-xs">
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function FolderNavBranch({
  node,
  depth,
  folders,
  selectedFolderId,
  expanded,
  setExpanded,
  onSelectFolder,
  onRename,
  onDeleteFolder,
  onNewSubfolder,
  onMoveFolder,
  onCreateDocumentInFolder,
}: {
  node: FolderNode;
  depth: number;
  folders: FolderMeta[];
  selectedFolderId: string | null;
  expanded: Set<string>;
  setExpanded: Dispatch<SetStateAction<Set<string>>>;
  onSelectFolder: (id: string | null) => void;
  onRename: (id: string, name: string) => void;
  onDeleteFolder: (id: string) => void;
  onNewSubfolder: (folderId: string) => void;
  onMoveFolder: (folderId: string, parentId: string | null) => void;
  onCreateDocumentInFolder: (folderId: string) => void;
}) {
  const fid = node.folder.id;
  const hasChildren = node.children.length > 0;
  const open = expanded.has(fid);
  const selected = selectedFolderId === fid;

  const moveTargets = folders.filter((f) => f.id !== fid && !cannotUseAsParent(f.id, fid, folders));

  const toggle = () => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(fid)) next.delete(fid);
      else next.add(fid);
      return next;
    });
  };

  const row = (
    <div className="flex items-stretch gap-0.5 rounded-md" style={{ paddingLeft: depth * 14 }}>
      <button
        type="button"
        className={cn(
          "flex w-6 shrink-0 items-center justify-center rounded hover:bg-accent/50",
          !hasChildren && "invisible pointer-events-none",
        )}
        aria-label={open ? "Collapse" : "Expand"}
        onClick={(e) => {
          e.stopPropagation();
          toggle();
        }}
      >
        <ChevronRight
          className={cn("size-3.5 text-muted-foreground transition-transform", open && "rotate-90")}
        />
      </button>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <button
            type="button"
            onClick={() => onSelectFolder(fid)}
            className={cn(
              "flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left font-mono text-[0.7rem] transition-colors",
              selected
                ? "bg-gold-dim/45 text-card-foreground"
                : "text-card-foreground hover:bg-accent/50",
            )}
          >
            {open ? (
              <FolderOpen className="size-3.5 shrink-0 opacity-90" />
            ) : (
              <FolderClosed className="size-3.5 shrink-0 opacity-90" />
            )}
            <span className="truncate">{node.folder.name}</span>
          </button>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={() => onCreateDocumentInFolder(fid)}>
            <FileText className="size-3 mr-2" /> New document here
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onNewSubfolder(fid)}>
            <FolderPlus className="size-3 mr-2" /> New subfolder
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onRename(fid, node.folder.name)}>
            <Pencil className="size-3 mr-2" /> Rename
          </ContextMenuItem>
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <ArrowRight className="size-3 mr-2" /> Move folder to
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="max-h-64 overflow-y-auto">
              {node.folder.parent_id != null && (
                <ContextMenuItem onClick={() => onMoveFolder(fid, null)}>
                  Library root
                </ContextMenuItem>
              )}
              {moveTargets.map((f) => (
                <ContextMenuItem key={f.id} onClick={() => onMoveFolder(fid, f.id)}>
                  {f.name}
                </ContextMenuItem>
              ))}
            </ContextMenuSubContent>
          </ContextMenuSub>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => onDeleteFolder(fid)} className="text-blood-bright">
            <Trash2 className="size-3 mr-2" /> Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </div>
  );

  return (
    <div className="space-y-0.5">
      {row}
      {hasChildren && open && (
        <div className="ml-1 border-l border-border/25 pl-2">
          {node.children.map((child) => (
            <FolderNavBranch
              key={child.folder.id}
              node={child}
              depth={depth + 1}
              folders={folders}
              selectedFolderId={selectedFolderId}
              expanded={expanded}
              setExpanded={setExpanded}
              onSelectFolder={onSelectFolder}
              onRename={onRename}
              onDeleteFolder={onDeleteFolder}
              onNewSubfolder={onNewSubfolder}
              onMoveFolder={onMoveFolder}
              onCreateDocumentInFolder={onCreateDocumentInFolder}
            />
          ))}
        </div>
      )}
    </div>
  );
}
