import { Link, useParams } from "@tanstack/react-router";
import {
  ArrowRight,
  ChevronRight,
  FileText,
  FolderClosed,
  FolderOpen,
  FolderPlus,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { FolderTreeDialogs } from "@/components/FolderTreeDialogs";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useFolderOps } from "@/hooks/useFolderOps";
import type { DocumentMeta, FolderMeta } from "@/lib/api";
import { buildTree, type FolderNode } from "@/lib/document-tree";
import { cn } from "@/lib/utils";

function heatDot(heat: number | null) {
  if (heat === null) return "bg-muted-foreground/30";
  if (heat < 2) return "bg-olive";
  if (heat < 4) return "bg-bronze";
  if (heat < 6) return "bg-gold";
  return "bg-blood-bright";
}

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

interface Props {
  folders: FolderMeta[];
  documents: DocumentMeta[];
  onCreateFolder: (name: string, parentId?: string) => void;
  onRenameFolder: (id: string, name: string) => void;
  onDeleteFolder: (id: string) => void;
  onDeleteDocument: (id: string) => void;
  onMoveDocument?: (docId: string, folderId: string | null) => void;
  onCreateDocumentInFolder?: (folderId: string) => void;
  onNewDocumentAtRoot?: () => void;
  onRenameDocument?: (id: string, title: string) => void;
  onMoveFolder?: (folderId: string, parentId: string | null) => void;
  variant?: "sidebar" | "library";
}

export function FolderTree({
  folders,
  documents,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onDeleteDocument,
  onMoveDocument,
  onCreateDocumentInFolder,
  onNewDocumentAtRoot,
  onRenameDocument,
  onMoveFolder,
  variant = "library",
}: Props) {
  const { id: activeDocId } = useParams({ strict: false });

  const ops = useFolderOps({ onCreateFolder, onRenameFolder, onRenameDocument });

  const { roots, rootDocs } = buildTree(folders, documents);
  const isLib = variant === "library";

  const rootSection = (
    <>
      {roots.map((node) => (
        <FolderItem
          key={node.folder.id}
          node={node}
          variant={variant}
          allFolders={folders}
          activeDocId={activeDocId}
          onRename={ops.openRenameFolder}
          onDelete={onDeleteFolder}
          onDeleteDocument={onDeleteDocument}
          onMoveDocument={onMoveDocument}
          onCreateDocumentInFolder={onCreateDocumentInFolder}
          onNewSubfolder={ops.openNewFolder}
          onMoveFolder={onMoveFolder}
          onRenameDocument={onRenameDocument ? ops.openRenameDoc : undefined}
        />
      ))}

      {isLib ? (
        <div className="rounded-lg border border-border/60 bg-card/30 p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-mono text-[0.65rem] uppercase tracking-widest text-muted-foreground">
              Root documents
            </h3>
            <div className="flex flex-wrap items-center gap-1">
              {onNewDocumentAtRoot && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 font-mono text-[0.6rem] text-gold hover:text-gold"
                  onClick={() => onNewDocumentAtRoot()}
                  title="New document at library root"
                >
                  <FileText className="size-3.5" />
                  Document
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 font-mono text-[0.6rem]"
                onClick={() => ops.openNewFolder(undefined)}
                title="New folder at root"
              >
                <Plus className="size-3.5" />
                Folder
              </Button>
            </div>
          </div>
          <div className="space-y-0.5">
            {rootDocs.map((doc) => (
              <DocRow
                key={doc.id}
                variant={variant}
                doc={doc}
                active={doc.id === activeDocId}
                allFolders={folders}
                onDelete={onDeleteDocument}
                onMove={onMoveDocument}
                onRenameDocument={onRenameDocument ? ops.openRenameDoc : undefined}
              />
            ))}
            {rootDocs.length === 0 && folders.length === 0 && (
              <p className="py-3 text-center font-mono text-[0.65rem] text-muted-foreground italic">
                No documents yet — create a folder or new document
              </p>
            )}
          </div>
        </div>
      ) : (
        <SidebarGroup>
          <SidebarGroupLabel className="font-mono text-[0.6rem] uppercase tracking-widest">
            Documents
          </SidebarGroupLabel>
          <SidebarGroupAction onClick={() => ops.openNewFolder(undefined)} title="New folder">
            <Plus className="size-4" />
          </SidebarGroupAction>
          <SidebarMenu>
            {rootDocs.map((doc) => (
              <DocRow
                key={doc.id}
                variant={variant}
                doc={doc}
                active={doc.id === activeDocId}
                allFolders={folders}
                onDelete={onDeleteDocument}
                onMove={onMoveDocument}
                onRenameDocument={onRenameDocument ? ops.openRenameDoc : undefined}
              />
            ))}
            {rootDocs.length === 0 && folders.length === 0 && (
              <p className="px-3 py-2 font-mono text-[0.65rem] text-muted-foreground italic">
                No documents yet
              </p>
            )}
          </SidebarMenu>
        </SidebarGroup>
      )}
    </>
  );

  return (
    <>
      {rootSection}
      <FolderTreeDialogs
        state={ops.dialogState}
        onNewFolderNameChange={ops.handleNewFolderNameChange}
        onNewFolderSubmit={ops.handleNewFolderSubmit}
        onNewFolderClose={ops.handleNewFolderClose}
        onRenameChange={ops.handleRenameChange}
        onRenameSubmit={ops.handleRenameSubmit}
        onRenameClose={ops.handleRenameClose}
        onRenameDocChange={ops.handleRenameDocChange}
        onRenameDocSubmit={ops.handleRenameDocSubmit}
        onRenameDocClose={ops.handleRenameDocClose}
      />
    </>
  );
}

function FolderItem({
  node,
  variant,
  allFolders,
  activeDocId,
  onRename,
  onDelete,
  onDeleteDocument,
  onMoveDocument,
  onCreateDocumentInFolder,
  onNewSubfolder,
  onMoveFolder,
  onRenameDocument,
}: {
  node: FolderNode;
  variant: "sidebar" | "library";
  allFolders: FolderMeta[];
  activeDocId?: string;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onDeleteDocument: (id: string) => void;
  onMoveDocument?: (docId: string, folderId: string | null) => void;
  onCreateDocumentInFolder?: (folderId: string) => void;
  onNewSubfolder: (folderId?: string) => void;
  onMoveFolder?: (folderId: string, parentId: string | null) => void;
  onRenameDocument?: (id: string, title: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const fid = node.folder.id;

  const moveTargets = onMoveFolder
    ? allFolders.filter((f) => f.id !== fid && !cannotUseAsParent(f.id, fid, allFolders))
    : [];

  const triggerClass = cn(
    "flex w-full items-center gap-1 text-left font-mono text-[0.6rem] uppercase tracking-widest",
    variant === "library" && "rounded-md px-2 py-1.5 hover:bg-accent/60",
    variant === "sidebar" && "cursor-pointer",
  );

  const inner = (
    <Collapsible open={open} onOpenChange={setOpen}>
      {variant === "library" ? (
        <div className="flex items-center gap-1 border-b border-border/40 px-2 py-2">
          <CollapsibleTrigger className={cn(triggerClass, "min-w-0 flex-1")}>
            <ChevronRight
              className={`size-3 shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
            />
            {open ? (
              <FolderOpen className="size-3 shrink-0" />
            ) : (
              <FolderClosed className="size-3 shrink-0" />
            )}
            <span className="truncate">{node.folder.name}</span>
          </CollapsibleTrigger>
          {onCreateDocumentInFolder && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 shrink-0 px-2 font-mono text-[0.55rem] text-gold hover:text-gold"
              title="New document in this folder"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onCreateDocumentInFolder(fid);
              }}
            >
              <FileText className="size-3.5 sm:mr-1" />
              <span className="hidden sm:inline">New doc</span>
            </Button>
          )}
        </div>
      ) : (
        <SidebarGroupLabel asChild className="cursor-pointer">
          <CollapsibleTrigger className={triggerClass}>
            <ChevronRight
              className={`size-3 shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
            />
            {open ? (
              <FolderOpen className="size-3 shrink-0" />
            ) : (
              <FolderClosed className="size-3 shrink-0" />
            )}
            <span className="truncate">{node.folder.name}</span>
          </CollapsibleTrigger>
        </SidebarGroupLabel>
      )}
      <CollapsibleContent>
        {variant === "library" ? (
          <div className="space-y-1 border-l border-border/30 py-2 pl-3">
            {node.documents.map((doc) => (
              <DocRow
                key={doc.id}
                variant={variant}
                doc={doc}
                active={doc.id === activeDocId}
                allFolders={allFolders}
                onDelete={onDeleteDocument}
                onMove={onMoveDocument}
                onRenameDocument={onRenameDocument}
              />
            ))}
            {node.children.map((child) => (
              <FolderItem
                key={child.folder.id}
                node={child}
                variant={variant}
                allFolders={allFolders}
                activeDocId={activeDocId}
                onRename={onRename}
                onDelete={onDelete}
                onDeleteDocument={onDeleteDocument}
                onMoveDocument={onMoveDocument}
                onCreateDocumentInFolder={onCreateDocumentInFolder}
                onNewSubfolder={onNewSubfolder}
                onMoveFolder={onMoveFolder}
                onRenameDocument={onRenameDocument}
              />
            ))}
            {node.documents.length === 0 && node.children.length === 0 && (
              <div className="space-y-2 px-2 py-2">
                <p className="font-mono text-[0.55rem] text-muted-foreground/70">
                  Nothing in this folder yet.
                </p>
                {onCreateDocumentInFolder && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 font-mono text-[0.6rem]"
                    onClick={() => onCreateDocumentInFolder(fid)}
                  >
                    <FileText className="size-3.5 mr-1.5" />
                    New document here
                  </Button>
                )}
              </div>
            )}
          </div>
        ) : (
          <SidebarMenu>
            {node.documents.map((doc) => (
              <DocRow
                key={doc.id}
                variant={variant}
                doc={doc}
                active={doc.id === activeDocId}
                allFolders={allFolders}
                onDelete={onDeleteDocument}
                onMove={onMoveDocument}
                onRenameDocument={onRenameDocument}
              />
            ))}
            {node.children.map((child) => (
              <FolderItem
                key={child.folder.id}
                node={child}
                variant={variant}
                allFolders={allFolders}
                activeDocId={activeDocId}
                onRename={onRename}
                onDelete={onDelete}
                onDeleteDocument={onDeleteDocument}
                onMoveDocument={onMoveDocument}
                onCreateDocumentInFolder={onCreateDocumentInFolder}
                onNewSubfolder={onNewSubfolder}
                onMoveFolder={onMoveFolder}
                onRenameDocument={onRenameDocument}
              />
            ))}
            {node.documents.length === 0 && node.children.length === 0 && (
              <p className="px-3 py-1 font-mono text-[0.55rem] text-muted-foreground/30 italic">
                No documents
              </p>
            )}
          </SidebarMenu>
        )}
      </CollapsibleContent>
    </Collapsible>
  );

  return variant === "library" ? (
    <div className="rounded-lg border border-border/60 bg-card/20">
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div>{inner}</div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          {onCreateDocumentInFolder && (
            <ContextMenuItem onClick={() => onCreateDocumentInFolder(fid)}>
              <FileText className="size-3 mr-2" /> New document here
            </ContextMenuItem>
          )}
          <ContextMenuItem onClick={() => onNewSubfolder(fid)}>
            <FolderPlus className="size-3 mr-2" /> New subfolder
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onRename(fid, node.folder.name)}>
            <Pencil className="size-3 mr-2" /> Rename
          </ContextMenuItem>
          {onMoveFolder && (
            <ContextMenuSub>
              <ContextMenuSubTrigger>
                <ArrowRight className="size-3 mr-2" /> Move folder to
              </ContextMenuSubTrigger>
              <ContextMenuSubContent>
                {node.folder.parent_id !== null && node.folder.parent_id !== undefined && (
                  <ContextMenuItem onClick={() => onMoveFolder(fid, null)}>Root</ContextMenuItem>
                )}
                {moveTargets.map((f) => (
                  <ContextMenuItem key={f.id} onClick={() => onMoveFolder(fid, f.id)}>
                    {f.name}
                  </ContextMenuItem>
                ))}
              </ContextMenuSubContent>
            </ContextMenuSub>
          )}
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => onDelete(fid)} className="text-blood-bright">
            <Trash2 className="size-3 mr-2" /> Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </div>
  ) : (
    <SidebarGroup>
      <ContextMenu>
        <ContextMenuTrigger asChild>{inner}</ContextMenuTrigger>
        <ContextMenuContent>
          {onCreateDocumentInFolder && (
            <ContextMenuItem onClick={() => onCreateDocumentInFolder(fid)}>
              <FileText className="size-3 mr-2" /> New document here
            </ContextMenuItem>
          )}
          <ContextMenuItem onClick={() => onNewSubfolder(fid)}>
            <FolderPlus className="size-3 mr-2" /> New subfolder
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onRename(fid, node.folder.name)}>
            <Pencil className="size-3 mr-2" /> Rename
          </ContextMenuItem>
          {onMoveFolder && (
            <ContextMenuSub>
              <ContextMenuSubTrigger>
                <ArrowRight className="size-3 mr-2" /> Move folder to
              </ContextMenuSubTrigger>
              <ContextMenuSubContent>
                {node.folder.parent_id != null && (
                  <ContextMenuItem onClick={() => onMoveFolder(fid, null)}>Root</ContextMenuItem>
                )}
                {moveTargets.map((f) => (
                  <ContextMenuItem key={f.id} onClick={() => onMoveFolder(fid, f.id)}>
                    {f.name}
                  </ContextMenuItem>
                ))}
              </ContextMenuSubContent>
            </ContextMenuSub>
          )}
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => onDelete(fid)} className="text-blood-bright">
            <Trash2 className="size-3 mr-2" /> Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </SidebarGroup>
  );
}

function DocRow({
  doc,
  active,
  variant,
  allFolders,
  onDelete,
  onMove,
  onRenameDocument,
}: {
  doc: DocumentMeta;
  active: boolean;
  variant: "sidebar" | "library";
  allFolders?: FolderMeta[];
  onDelete: (id: string) => void;
  onMove?: (docId: string, folderId: string | null) => void;
  onRenameDocument?: (id: string, title: string) => void;
}) {
  const linkClass = cn(
    "flex min-w-0 items-center gap-2 no-underline",
    variant === "library"
      ? cn(
          "rounded-md px-3 py-2 font-serif text-sm transition-colors hover:bg-accent/80",
          active ? "bg-gold-dim/40 text-card-foreground" : "text-card-foreground",
        )
      : "",
  );

  const buttonWrap = (child: ReactNode) =>
    variant === "sidebar" ? (
      <SidebarMenuItem>
        <SidebarMenuButton asChild isActive={active} className="font-serif text-sm">
          {child}
        </SidebarMenuButton>
      </SidebarMenuItem>
    ) : (
      <div>{child}</div>
    );

  return buttonWrap(
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <Link to="/app/doc/$id" params={{ id: doc.id }} className={linkClass}>
          <span className={`size-2 shrink-0 rounded-full ${heatDot(doc.mean_heat)}`} />
          <span className="truncate">{doc.title || "Untitled"}</span>
        </Link>
      </ContextMenuTrigger>
      <ContextMenuContent>
        {onRenameDocument && (
          <ContextMenuItem onClick={() => onRenameDocument(doc.id, doc.title || "Untitled")}>
            <Pencil className="size-3 mr-2" /> Rename
          </ContextMenuItem>
        )}
        {onMove && allFolders && allFolders.length > 0 && (
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <ArrowRight className="size-3 mr-2" /> Move to
            </ContextMenuSubTrigger>
            <ContextMenuSubContent>
              {doc.folder_id && (
                <ContextMenuItem onClick={() => onMove(doc.id, null)}>
                  Root (no folder)
                </ContextMenuItem>
              )}
              {allFolders
                .filter((f) => f.id !== doc.folder_id)
                .map((f) => (
                  <ContextMenuItem key={f.id} onClick={() => onMove(doc.id, f.id)}>
                    {f.name}
                  </ContextMenuItem>
                ))}
            </ContextMenuSubContent>
          </ContextMenuSub>
        )}
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => onDelete(doc.id)} className="text-blood-bright">
          <Trash2 className="size-3 mr-2" /> Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>,
  );
}
