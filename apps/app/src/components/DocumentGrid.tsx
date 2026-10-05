import { FileText, Plus } from "lucide-react";
import { LibraryDocumentCard } from "@/components/LibraryDocumentCard";
import { Button } from "@/components/ui/button";
import type { DocumentMeta, FolderMeta } from "@/lib/api";

interface Props {
  documents: DocumentMeta[];
  folders: FolderMeta[];
  onMoveDocument: (docId: string, folderId: string | null) => void;
  onDeleteDocument: (id: string) => void;
  onRequestRename: (doc: DocumentMeta) => void;
  onCreateDocument: () => void;
}

export function DocumentGrid({
  documents,
  folders,
  onMoveDocument,
  onDeleteDocument,
  onRequestRename,
  onCreateDocument,
}: Props) {
  if (documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/50 bg-card/10 px-6 py-16 text-center">
        <FileText className="mb-3 size-10 text-muted-foreground/40" />
        <p className="mb-1 font-display text-lg text-card-foreground">Nothing here yet</p>
        <p className="mb-6 max-w-sm font-serif text-sm text-muted-foreground">
          Documents you add stay in the folder you have open on the left — no menus, just this spot.
        </p>
        <Button
          type="button"
          variant="secondary"
          className="font-mono text-[0.75rem]"
          onClick={onCreateDocument}
        >
          <Plus className="size-4" />
          New document here
        </Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {documents.map((doc) => (
        <LibraryDocumentCard
          key={doc.id}
          doc={doc}
          folders={folders}
          onMove={onMoveDocument}
          onDelete={onDeleteDocument}
          onRequestRename={onRequestRename}
        />
      ))}
    </div>
  );
}
