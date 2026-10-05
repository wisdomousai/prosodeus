import { useNavigate } from "@tanstack/react-router";
import { ExternalLink, FolderOpen, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { DocumentMeta, FolderMeta } from "@/lib/api";

function heatColor(heat: number | null): string {
  if (heat === null) return "var(--color-text-dim)";
  if (heat < 2) return "var(--color-olive)";
  if (heat < 4) return "var(--color-bronze)";
  if (heat < 6) return "var(--color-gold)";
  return "var(--color-blood-bright)";
}

function heatLabel(heat: number | null): string {
  if (heat === null) return "Not analyzed";
  if (heat < 1) return "Pure";
  if (heat < 2) return "Trivial";
  if (heat < 3) return "Visible";
  if (heat < 5) return "Grave";
  return "Accursed";
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface Props {
  doc: DocumentMeta;
  folders: FolderMeta[];
  onMove: (id: string, folderId: string | null) => void;
  onDelete: (id: string) => void;
  onRequestRename: (doc: DocumentMeta) => void;
}

export function LibraryDocumentCard({ doc, folders, onMove, onDelete, onRequestRename }: Props) {
  const navigate = useNavigate();

  return (
    <Card className="group relative rounded border-border/60 py-0 transition-all hover:border-gold/20 hover:bg-card">
      <CardContent className="p-5">
        <div className="absolute right-3 top-3 z-10">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 opacity-70 hover:opacity-100"
                aria-label="Document actions"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onClick={() => navigate({ to: "/app/doc/$id", params: { id: doc.id } })}
              >
                <ExternalLink className="size-3.5 mr-2" /> Open
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onRequestRename(doc)}>
                <Pencil className="size-3.5 mr-2" /> Rename…
              </DropdownMenuItem>
              {folders.length > 0 && (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <FolderOpen className="size-3.5 mr-2" /> Move to…
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {doc.folder_id && (
                      <DropdownMenuItem onClick={() => onMove(doc.id, null)}>
                        Library root
                      </DropdownMenuItem>
                    )}
                    {folders
                      .filter((f) => f.id !== doc.folder_id)
                      .map((f) => (
                        <DropdownMenuItem key={f.id} onClick={() => onMove(doc.id, f.id)}>
                          {f.name}
                        </DropdownMenuItem>
                      ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-blood-bright focus:text-blood-bright"
                onClick={() => onDelete(doc.id)}
              >
                <Trash2 className="size-3.5 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <button
          type="button"
          className="w-full cursor-pointer border-none bg-transparent p-0 text-left text-inherit"
          onClick={() => navigate({ to: "/app/doc/$id", params: { id: doc.id } })}
        >
          <div className="mb-3 flex items-start justify-between pr-8">
            <h3 className="font-display text-lg text-card-foreground transition-colors group-hover:text-gold">
              {doc.title || "Untitled"}
            </h3>
            {doc.mean_heat !== null && (
              <span
                className="shrink-0 rounded px-2 py-0.5 font-mono text-[0.6rem] font-bold uppercase tracking-wider"
                style={{
                  color: heatColor(doc.mean_heat),
                  backgroundColor: `color-mix(in srgb, ${heatColor(doc.mean_heat)} 12%, transparent)`,
                }}
              >
                {heatLabel(doc.mean_heat)}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 font-mono text-[0.65rem] text-muted-foreground">
            {doc.word_count ? (
              <span>{doc.word_count.toLocaleString()} words</span>
            ) : (
              <span className="italic">No content</span>
            )}
            {doc.mean_heat !== null && (
              <>
                <span className="text-border">·</span>
                <span style={{ color: heatColor(doc.mean_heat) }}>
                  {doc.mean_heat.toFixed(1)} heat
                </span>
              </>
            )}
            <span className="ml-auto opacity-60">{timeAgo(doc.updated_at)}</span>
          </div>
        </button>
      </CardContent>
    </Card>
  );
}
