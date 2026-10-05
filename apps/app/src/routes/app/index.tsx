import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  FileText,
  Loader2,
  MoreHorizontal,
  Pencil,
  PenLine,
  Search,
  SlidersHorizontal,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppRouteShell } from "@/components/shell/AppRouteShell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import type { DocumentMeta } from "@/lib/api";
import { createDocument, deleteDocument, listDocuments, updateDocument } from "@/lib/api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/")({
  component: WritingDesk,
});

function WritingDesk() {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<DocumentMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [renaming, setRenaming] = useState<DocumentMeta | null>(null);
  const [renameTitle, setRenameTitle] = useState("");

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const docs = await listDocuments({ sort: "updated_at", order: "desc" });
      setDocuments(docs);
    } catch (err) {
      setDocuments([]);
      setError(err instanceof Error ? err.message : "Could not load documents.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  const filteredDocuments = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return documents;
    return documents.filter((doc) => {
      const title = (doc.title || "Untitled").toLowerCase();
      const tags = doc.tags.join(" ").toLowerCase();
      return title.includes(query) || tags.includes(query);
    });
  }, [documents, search]);

  const mostRecent = documents[0] ?? null;

  const openDocument = useCallback(
    (id: string) => {
      navigate({ to: "/app/doc/$id", params: { id } });
    },
    [navigate],
  );

  const createDraft = useCallback(async () => {
    if (creating) return;
    setCreating(true);
    setError(null);
    try {
      const { id } = await createDocument("Untitled draft");
      openDocument(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create a document.");
    } finally {
      setCreating(false);
    }
  }, [creating, openDocument]);

  const requestRename = (doc: DocumentMeta) => {
    setRenaming(doc);
    setRenameTitle(doc.title || "Untitled");
  };

  const applyRename = async () => {
    if (!renaming) return;
    const title = renameTitle.trim() || "Untitled";
    await updateDocument(renaming.id, { title });
    setDocuments((prev) => prev.map((doc) => (doc.id === renaming.id ? { ...doc, title } : doc)));
    setRenaming(null);
    setRenameTitle("");
  };

  const removeDocument = async (doc: DocumentMeta) => {
    await deleteDocument(doc.id);
    setDocuments((prev) => prev.filter((item) => item.id !== doc.id));
  };

  return (
    <>
      <AppRouteShell
        title="Writing desk"
        trailing={
          <Button
            type="button"
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => void createDraft()}
            disabled={creating}
          >
            {creating ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <PenLine className="size-3.5" />
            )}
            <span className="hidden sm:inline">New draft</span>
          </Button>
        }
      >
        <div className="min-h-0 flex-1 overflow-y-auto bg-[#f6f8fb]">
          <div className="mx-auto w-full max-w-5xl space-y-5 px-4 py-7 lg:px-6">
            <section className="rounded-lg border border-border bg-white p-6 shadow-[0_18px_48px_rgba(15,33,55,0.06)] md:p-8">
              <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                <div className="max-w-3xl">
                  <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground">
                    Editor first
                  </p>
                  <h1 className="mt-2 max-w-3xl text-3xl font-semibold leading-tight text-foreground md:text-4xl">
                    Open a draft, shape the prose, then tune the rules behind it.
                  </h1>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button
                    type="button"
                    onClick={() => void createDraft()}
                    disabled={creating}
                    className="gap-1.5"
                  >
                    {creating ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <PenLine className="size-4" />
                    )}
                    New draft
                  </Button>
                  <Button asChild variant="outline" className="gap-1.5">
                    <Link to="/app/rules">
                      <SlidersHorizontal className="size-4" />
                      Rules
                    </Link>
                  </Button>
                </div>
              </div>

              <div className="mt-8">
                {mostRecent ? (
                  <button
                    type="button"
                    onClick={() => openDocument(mostRecent.id)}
                    className="group flex w-full min-w-0 items-start justify-between gap-5 rounded-md border border-border bg-[#f9fbfd] p-5 text-left transition-[background,border-color,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:border-primary/25 hover:bg-white"
                  >
                    <div className="min-w-0">
                      <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground">
                        Continue
                      </p>
                      <h2 className="mt-2 truncate text-xl font-semibold leading-tight text-foreground">
                        {mostRecent.title || "Untitled"}
                      </h2>
                      <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                        Last edited {formatRelativeTime(mostRecent.updated_at)}. Open the editor to
                        analyze density, select a passage, and run controlled rewrite alternatives.
                      </p>
                    </div>
                    <span className="mt-1 flex size-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground transition-transform group-hover:translate-x-0.5">
                      <ArrowRight className="size-4" />
                    </span>
                  </button>
                ) : (
                  <div className="rounded-md border border-dashed border-border bg-[#f9fbfd] p-6">
                    <FileText className="size-8 text-muted-foreground/70" />
                    <h2 className="mt-4 text-xl font-semibold text-foreground">
                      Start with a blank draft
                    </h2>
                    <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                      Prosodeus starts in the editor. Analysis and rewriting appear beside the text
                      after you have something to work on.
                    </p>
                    <Button
                      className="mt-5 gap-1.5"
                      onClick={() => void createDraft()}
                      disabled={creating}
                    >
                      {creating ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <PenLine className="size-4" />
                      )}
                      New draft
                    </Button>
                  </div>
                )}
              </div>
            </section>

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_19rem]">
              <main className="min-w-0">
                <section className="overflow-hidden rounded-lg border border-border bg-white">
                  <div className="flex flex-col gap-3 border-b border-border bg-[#fbfcfe] px-4 py-3 sm:flex-row sm:items-center">
                    <div className="relative min-w-0 flex-1">
                      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search drafts"
                        className="h-9 border-border bg-white pl-10 text-sm"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 shrink-0 gap-1.5"
                      onClick={() => void loadDocuments()}
                    >
                      Refresh
                    </Button>
                  </div>

                  {error ? (
                    <div className="border-b border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                      {error}
                    </div>
                  ) : null}

                  {loading ? (
                    <DocumentListSkeleton />
                  ) : filteredDocuments.length === 0 ? (
                    <div className="px-5 py-12 text-center">
                      <p className="text-sm font-semibold text-foreground">
                        {search.trim() ? "No matching drafts" : "No drafts yet"}
                      </p>
                      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                        {search.trim()
                          ? "Clear the search or create a new draft from the toolbar."
                          : "Create one document, then use the editor inspector for analysis, density, rewrite, and versions."}
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {filteredDocuments.map((doc) => (
                        <DocumentRow
                          key={doc.id}
                          doc={doc}
                          onOpen={() => openDocument(doc.id)}
                          onRename={() => requestRename(doc)}
                          onDelete={() => void removeDocument(doc)}
                        />
                      ))}
                    </div>
                  )}
                </section>
              </main>

              <aside className="space-y-5">
                <section className="rounded-lg border border-border bg-white p-4">
                  <div className="flex items-start gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-ink-soft text-primary">
                      <Sparkles className="size-4" />
                    </span>
                    <div>
                      <h2 className="text-sm font-semibold text-foreground">Rewrite flow</h2>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        Analyze first, choose a sentence or passage, then run alternatives from
                        explicit constraints.
                      </p>
                    </div>
                  </div>
                </section>

                <section className="rounded-lg border border-border bg-white p-4">
                  <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground">
                    Master data
                  </p>
                  <div className="mt-3 space-y-2">
                    <SideLink
                      to="/app/rules"
                      title="Patterns"
                      text="Detection hints, examples, false positives, rewrite menus."
                    />
                    <SideLink
                      to="/app/rules?tab=styles"
                      title="Styles"
                      text="Statement force, expression budgets, repetition policy."
                    />
                  </div>
                </section>
              </aside>
            </div>
          </div>
        </div>
      </AppRouteShell>

      <Dialog
        open={!!renaming}
        onOpenChange={(open) => {
          if (!open) {
            setRenaming(null);
            setRenameTitle("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename draft</DialogTitle>
          </DialogHeader>
          <Input
            value={renameTitle}
            onChange={(event) => setRenameTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void applyRename();
            }}
            autoFocus
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRenaming(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void applyRename()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function DocumentRow({
  doc,
  onOpen,
  onRename,
  onDelete,
}: {
  doc: DocumentMeta;
  onOpen: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-[#f8fbfd] md:grid-cols-[minmax(0,1fr)_8rem_8rem_auto]">
      <button type="button" onClick={onOpen} className="min-w-0 text-left">
        <div className="flex min-w-0 items-center gap-2">
          <FileText className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate text-sm font-semibold text-foreground">
            {doc.title || "Untitled"}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 pl-6 text-xs text-muted-foreground">
          <span>{wordLabel(doc.word_count)}</span>
          {doc.tags.slice(0, 2).map((tag) => (
            <span key={tag}>#{tag}</span>
          ))}
        </div>
      </button>

      <span className="hidden text-xs text-muted-foreground md:block">
        {formatRelativeTime(doc.updated_at)}
      </span>
      <span
        className={cn(
          "hidden w-fit rounded px-2 py-1 text-xs font-medium md:block",
          doc.status === "final" && "bg-moss/10 text-moss",
          doc.status === "archived" && "bg-muted text-muted-foreground",
          doc.status !== "final" && doc.status !== "archived" && "bg-ink-soft text-primary",
        )}
      >
        {statusLabel(doc.status)}
      </span>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label="Draft actions"
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onOpen}>
            <ArrowRight className="mr-2 size-3.5" />
            Open
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onRename}>
            <Pencil className="mr-2 size-3.5" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
            <Trash2 className="mr-2 size-3.5" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function SideLink({ to, title, text }: { to: string; title: string; text: string }) {
  return (
    <a
      href={to}
      className="group block rounded-md border border-border bg-[#fbfcfe] p-3 transition-[background,border-color] hover:border-primary/25 hover:bg-white"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{text}</p>
        </div>
        <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </div>
    </a>
  );
}

function DocumentListSkeleton() {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-4 md:grid-cols-[minmax(0,1fr)_8rem_8rem_auto]"
        >
          <div className="space-y-2">
            <div className="h-4 w-2/5 rounded bg-muted" />
            <div className="h-3 w-1/4 rounded bg-muted" />
          </div>
          <div className="hidden h-3 w-20 rounded bg-muted md:block" />
          <div className="hidden h-6 w-16 rounded bg-muted md:block" />
          <div className="size-8 rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

function formatRelativeTime(value: string): string {
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "recently";
  const minutes = Math.max(0, Math.floor((Date.now() - then) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 14) return `${days}d ago`;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(
    new Date(value),
  );
}

function wordLabel(value: number | null): string {
  if (!value) return "No text yet";
  return `${value.toLocaleString()} ${value === 1 ? "word" : "words"}`;
}

function statusLabel(status: string): string {
  if (status === "final") return "Final";
  if (status === "archived") return "Archived";
  return "Draft";
}
