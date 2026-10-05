import { Copy, History, Link2, Plus, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { DocumentMeta, DocumentStatus, FolderMeta, WorkspaceMeta } from "@/lib/api";
import {
  addDocumentTags,
  createShareLink,
  deleteShareLink,
  listShareLinks,
  removeDocumentTag,
  updateDocument,
} from "@/lib/api";
import { folderLabelPath } from "@/lib/document-tree";

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

const STATUS_OPTIONS: { value: DocumentStatus; label: string; color: string }[] = [
  { value: "draft", label: "Draft", color: "bg-muted-foreground" },
  { value: "review", label: "In Review", color: "bg-gold" },
  { value: "final", label: "Final", color: "bg-emerald-500" },
  { value: "archived", label: "Archived", color: "bg-muted-foreground/50" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: DocumentMeta | null;
  folders: FolderMeta[];
  workspaces?: WorkspaceMeta[];
  onRefresh: () => void;
  onSaveTitle: (title: string) => Promise<void>;
  onMoveToFolder: (folderId: string | null) => Promise<void>;
  onOpenHistory: () => void;
  hasAnalysisProfile: boolean;
}

export function DocumentMetadataSheet({
  open,
  onOpenChange,
  document,
  folders,
  workspaces,
  onRefresh,
  onSaveTitle,
  onMoveToFolder,
  onOpenHistory,
  hasAnalysisProfile,
}: Props) {
  const [titleDraft, setTitleDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [localTags, setLocalTags] = useState<string[]>([]);
  const [dueDateDraft, setDueDateDraft] = useState("");
  const [shareLinks, setShareLinks] = useState<
    Array<{ id: string; token: string; expires_at: string | null; created_at: string }>
  >([]);
  const [shareCreating, setShareCreating] = useState(false);

  useEffect(() => {
    if (document) {
      setTitleDraft(document.title || "Untitled");
      setLocalTags(document.tags ?? []);
      setDueDateDraft(document.due_date ?? "");
    }
  }, [document]);

  useEffect(() => {
    if (open) {
      onRefresh();
      if (document) {
        listShareLinks(document.id)
          .then(setShareLinks)
          .catch(() => setShareLinks([]));
      }
    }
  }, [open, onRefresh, document?.id]);

  const handleSaveTitle = async () => {
    if (!document) return;
    const t = titleDraft.trim();
    if (!t || t === (document.title || "Untitled")) return;
    setSaving(true);
    try {
      await onSaveTitle(t);
    } finally {
      setSaving(false);
    }
  };

  const handleFolderChange = async (value: string) => {
    if (!document) return;
    const folderId = value === "__root__" ? null : value;
    if (folderId === document.folder_id || (folderId === null && document.folder_id === null))
      return;
    setSaving(true);
    try {
      await onMoveToFolder(folderId);
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (value: string) => {
    if (!document || value === document.status) return;
    setSaving(true);
    try {
      await updateDocument(document.id, { status: value as DocumentStatus });
      onRefresh();
    } finally {
      setSaving(false);
    }
  };

  const handleWorkspaceChange = async (value: string) => {
    if (!document) return;
    const wsId = value === "__none__" ? null : value;
    setSaving(true);
    try {
      await updateDocument(document.id, { workspace_id: wsId });
      onRefresh();
    } finally {
      setSaving(false);
    }
  };

  const handleAddTag = async () => {
    if (!document || !tagInput.trim()) return;
    const tag = tagInput.trim().slice(0, 50);
    if (localTags.includes(tag)) {
      setTagInput("");
      return;
    }
    try {
      await addDocumentTags(document.id, [tag]);
      setLocalTags((prev) => [...prev, tag]);
      setTagInput("");
    } catch {
      /* */
    }
  };

  const handleRemoveTag = async (tag: string) => {
    if (!document) return;
    try {
      await removeDocumentTag(document.id, tag);
      setLocalTags((prev) => prev.filter((t) => t !== tag));
    } catch {
      /* */
    }
  };

  const handleDueDateChange = async (value: string) => {
    if (!document) return;
    setDueDateDraft(value);
    setSaving(true);
    try {
      await updateDocument(document.id, { due_date: value || null });
      onRefresh();
    } finally {
      setSaving(false);
    }
  };

  const handleCreateShareLink = async () => {
    if (!document) return;
    setShareCreating(true);
    try {
      const link = await createShareLink(document.id, { expires_in_days: 30 });
      setShareLinks((prev) => [
        ...prev,
        { id: link.id, token: link.token, expires_at: null, created_at: new Date().toISOString() },
      ]);
    } catch {
      /* */
    } finally {
      setShareCreating(false);
    }
  };

  const handleDeleteShareLink = async (shareId: string) => {
    try {
      await deleteShareLink(shareId);
      setShareLinks((prev) => prev.filter((l) => l.id !== shareId));
    } catch {
      /* */
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-display">Document details</SheetTitle>
          <SheetDescription className="font-mono text-xs">
            Metadata, organization, and status for this document.
          </SheetDescription>
        </SheetHeader>

        {!document ? (
          <p className="px-4 font-mono text-sm text-muted-foreground">Loading document...</p>
        ) : (
          <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-4 pb-4">
            {/* Title */}
            <div className="space-y-2">
              <label
                htmlFor="doc-sheet-title"
                className="font-mono text-[0.65rem] uppercase tracking-wider text-muted-foreground"
              >
                Title
              </label>
              <div className="flex gap-2">
                <Input
                  id="doc-sheet-title"
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  className="font-serif text-sm"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={
                    saving ||
                    !titleDraft.trim() ||
                    titleDraft.trim() === (document.title || "Untitled")
                  }
                  className="shrink-0 font-mono text-xs"
                  onClick={handleSaveTitle}
                >
                  Save
                </Button>
              </div>
            </div>

            {/* Status */}
            <div className="space-y-2">
              <span className="block font-mono text-[0.65rem] uppercase tracking-wider text-muted-foreground">
                Status
              </span>
              <Select
                value={document.status || "draft"}
                onValueChange={handleStatusChange}
                disabled={saving}
              >
                <SelectTrigger className="font-mono text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <span className="flex items-center gap-2">
                        <span className={`size-2 rounded-full ${opt.color}`} />
                        {opt.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Folder */}
            <div className="space-y-2">
              <span className="block font-mono text-[0.65rem] uppercase tracking-wider text-muted-foreground">
                Folder
              </span>
              <Select
                value={document.folder_id ?? "__root__"}
                onValueChange={handleFolderChange}
                disabled={saving}
              >
                <SelectTrigger className="font-mono text-xs">
                  <SelectValue placeholder="Choose folder" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__root__">Library root</SelectItem>
                  {folders.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {folderLabelPath(f.id, folders)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Workspace */}
            {workspaces && workspaces.length > 0 && (
              <div className="space-y-2">
                <span className="block font-mono text-[0.65rem] uppercase tracking-wider text-muted-foreground">
                  Workspace
                </span>
                <Select
                  value={document.workspace_id ?? "__none__"}
                  onValueChange={handleWorkspaceChange}
                  disabled={saving}
                >
                  <SelectTrigger className="font-mono text-xs">
                    <SelectValue placeholder="No workspace" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No workspace</SelectItem>
                    {workspaces.map((ws) => (
                      <SelectItem key={ws.id} value={ws.id}>
                        {ws.icon ? `${ws.icon} ` : ""}
                        {ws.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Due Date */}
            <div className="space-y-2">
              <span className="block font-mono text-[0.65rem] uppercase tracking-wider text-muted-foreground">
                Due date
              </span>
              <Input
                type="date"
                value={dueDateDraft}
                onChange={(e) => handleDueDateChange(e.target.value)}
                className="font-mono text-xs"
                disabled={saving}
              />
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <span className="block font-mono text-[0.65rem] uppercase tracking-wider text-muted-foreground">
                Tags
              </span>
              <div className="flex flex-wrap gap-1.5">
                {localTags.map((tag) => (
                  <span
                    key={tag}
                    className="flex items-center gap-1 rounded-sm bg-secondary px-2 py-0.5 font-mono text-[0.6rem] text-secondary-foreground"
                  >
                    {tag}
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      className="hover:text-destructive cursor-pointer"
                    >
                      <X className="size-2.5" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-1.5">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddTag()}
                  placeholder="Add tag..."
                  className="font-mono text-xs"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={handleAddTag}
                  disabled={!tagInput.trim()}
                  className="shrink-0"
                >
                  <Plus className="size-3.5" />
                </Button>
              </div>
            </div>

            {/* Share Links */}
            <div className="space-y-2">
              <span className="block font-mono text-[0.65rem] uppercase tracking-wider text-muted-foreground">
                Share
              </span>
              {shareLinks.map((link) => (
                <div
                  key={link.id}
                  className="flex items-center gap-2 rounded-md bg-secondary/50 px-2 py-1.5"
                >
                  <Link2 className="size-3 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate font-mono text-[0.6rem] text-muted-foreground">
                    .../{link.token.slice(-8)}
                  </span>
                  <button
                    onClick={() =>
                      navigator.clipboard.writeText(
                        `${window.location.origin}/shared/${link.token}`,
                      )
                    }
                    className="hover:text-foreground text-muted-foreground cursor-pointer"
                    title="Copy link"
                  >
                    <Copy className="size-3" />
                  </button>
                  <button
                    onClick={() => handleDeleteShareLink(link.id)}
                    className="hover:text-destructive text-muted-foreground cursor-pointer"
                    title="Revoke"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full font-mono text-xs"
                onClick={handleCreateShareLink}
                disabled={shareCreating}
              >
                <Link2 className="size-3.5 mr-1.5" />
                {shareCreating ? "Creating..." : "Create Share Link"}
              </Button>
            </div>

            <Separator />

            {/* Catalog metadata (read-only) */}
            <div className="space-y-3 font-mono text-[0.7rem]">
              <h4 className="text-[0.6rem] uppercase tracking-widest text-muted-foreground">
                Catalog metadata
              </h4>
              <dl className="grid grid-cols-[7rem_1fr] gap-x-2 gap-y-2">
                <dt className="text-muted-foreground">Created</dt>
                <dd className="text-card-foreground">{formatWhen(document.created_at)}</dd>
                <dt className="text-muted-foreground">Updated</dt>
                <dd className="text-card-foreground">{formatWhen(document.updated_at)}</dd>
                <dt className="text-muted-foreground">Words</dt>
                <dd className="text-card-foreground">{document.word_count ?? "\u2014"}</dd>
                <dt className="text-muted-foreground">Sentences</dt>
                <dd className="text-card-foreground">{document.sentence_count ?? "\u2014"}</dd>
                <dt className="text-muted-foreground">Mean heat</dt>
                <dd className="text-card-foreground">
                  {document.mean_heat != null ? document.mean_heat.toFixed(2) : "\u2014"}
                </dd>
                <dt className="text-muted-foreground">ID</dt>
                <dd className="break-all text-[0.6rem] text-muted-foreground">{document.id}</dd>
              </dl>
            </div>

            <Separator />

            {/* Text history */}
            <div className="space-y-2">
              <h4 className="font-mono text-[0.6rem] uppercase tracking-widest text-muted-foreground">
                Text history
              </h4>
              <p className="font-serif text-sm text-muted-foreground leading-relaxed">
                Revisions and per-run analysis logs live in the right sidebar under{" "}
                <span className="font-mono text-card-foreground">History</span>.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full font-mono text-xs"
                disabled={!hasAnalysisProfile}
                onClick={() => {
                  onOpenHistory();
                  onOpenChange(false);
                }}
              >
                <History className="size-3.5 mr-2" />
                Open History tab
              </Button>
              {!hasAnalysisProfile && (
                <p className="font-mono text-[0.6rem] text-muted-foreground italic">
                  Run Analyze once to use the analysis sidebar tabs.
                </p>
              )}
            </div>
          </div>
        )}

        <SheetFooter className="border-t border-border">
          <Button
            type="button"
            variant="outline"
            className="font-mono text-xs"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
