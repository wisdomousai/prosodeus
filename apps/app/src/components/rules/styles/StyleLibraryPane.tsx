import { Plus, Search, ShieldCheck } from "lucide-react";
import type * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { UserStyle } from "@/lib/api";
import { cn } from "@/lib/utils";

type StyleLibraryPaneProps = {
  styles: UserStyle[];
  visibleStyles: UserStyle[];
  selectedId: string | null;
  search: string;
  onSearchChange: (next: string) => void;
  onSelect: (id: string) => void;
  draftOpen: boolean;
  draftName: string;
  draftDescription: string;
  draftNameRef: React.RefObject<HTMLInputElement | null>;
  onDraftNameChange: (next: string) => void;
  onDraftDescriptionChange: (next: string) => void;
  onAddDraft: () => void;
  onOpenDraft: () => void;
  onCloseDraft: () => void;
  savingDraft?: boolean;
  readOnly?: boolean;
};

export function StyleLibraryPane({
  styles,
  visibleStyles,
  selectedId,
  search,
  onSearchChange,
  onSelect,
  draftOpen,
  draftName,
  draftDescription,
  draftNameRef,
  onDraftNameChange,
  onDraftDescriptionChange,
  onAddDraft,
  onOpenDraft,
  onCloseDraft,
  savingDraft,
  readOnly,
}: StyleLibraryPaneProps) {
  return (
    <aside className="flex w-[18rem] shrink-0 flex-col overflow-hidden rounded-md border border-border bg-card shadow-sm">
      <div className="space-y-3 border-b border-border px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Style library
            </p>
            <p className="text-xs text-muted-foreground">{styles.length} styles</p>
          </div>
          <Button
            type="button"
            size="sm"
            className="h-8 shrink-0 gap-1.5"
            onClick={onOpenDraft}
            disabled={draftOpen || readOnly}
          >
            <Plus className="size-3.5" />
            New
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search styles"
            className="h-9 rounded-md border-border bg-background pl-9 text-sm"
          />
        </div>
      </div>

      {visibleStyles.length > 0 ? (
        <ul className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          {visibleStyles.map((style) => {
            const active = style.id === selectedId;
            return (
              <li key={style.id}>
                <button
                  type="button"
                  onClick={() => onSelect(style.id)}
                  className={cn(
                    "grid w-full grid-cols-[1fr_auto] gap-3 rounded-md px-4 py-3 text-left transition-colors",
                    active ? "bg-ink-soft text-foreground" : "text-foreground hover:bg-muted",
                  )}
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold leading-snug">{style.name}</span>
                    <span className="mt-1 block line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                      {style.description || "No description yet."}
                    </span>
                  </span>
                  {active ? (
                    <ShieldCheck className="mt-0.5 size-4 text-primary" strokeWidth={1.8} />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-6 py-10 text-center">
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            No styles yet
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Create your first style to encode the structural defaults you want rewrites to follow.
          </p>
        </div>
      )}

      {draftOpen ? (
        <div className="space-y-2 border-t border-border bg-background p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            New style
          </p>
          <input
            ref={draftNameRef}
            value={draftName}
            onChange={(event) => onDraftNameChange(event.target.value)}
            placeholder="Style name"
            className="h-9 w-full rounded-md border border-border bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <input
            value={draftDescription}
            onChange={(event) => onDraftDescriptionChange(event.target.value)}
            placeholder="Short description"
            className="h-9 w-full rounded-md border border-border bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              className="h-8 flex-1 gap-1.5"
              disabled={!draftName.trim() || savingDraft}
              onClick={onAddDraft}
            >
              <Plus className="h-3.5 w-3.5" />
              {savingDraft ? "Creating…" : "Create"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8"
              onClick={onCloseDraft}
              disabled={savingDraft}
            >
              Close
            </Button>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
