import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export interface FolderDialogState {
  showNewFolder: boolean;
  newFolderParentId: string | undefined;
  newFolderName: string;
  renaming: { id: string; name: string } | null;
  renamingDoc: { id: string; title: string } | null;
}

interface Props {
  state: FolderDialogState;
  onNewFolderNameChange: (name: string) => void;
  onNewFolderSubmit: () => void;
  onNewFolderClose: () => void;
  onRenameChange: (name: string) => void;
  onRenameSubmit: () => void;
  onRenameClose: () => void;
  onRenameDocChange: (title: string) => void;
  onRenameDocSubmit: () => void;
  onRenameDocClose: () => void;
}

export function FolderTreeDialogs({
  state,
  onNewFolderNameChange,
  onNewFolderSubmit,
  onNewFolderClose,
  onRenameChange,
  onRenameSubmit,
  onRenameClose,
  onRenameDocChange,
  onRenameDocSubmit,
  onRenameDocClose,
}: Props) {
  return (
    <>
      <Dialog
        open={state.showNewFolder}
        onOpenChange={(o) => {
          if (!o) onNewFolderClose();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">
              {state.newFolderParentId ? "New subfolder" : "New folder"}
            </DialogTitle>
          </DialogHeader>
          <Input
            value={state.newFolderName}
            onChange={(e) => onNewFolderNameChange(e.target.value)}
            placeholder="Folder name"
            className="font-mono text-sm"
            onKeyDown={(e) => e.key === "Enter" && onNewFolderSubmit()}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={onNewFolderClose} className="font-mono text-xs">
              Cancel
            </Button>
            <Button onClick={onNewFolderSubmit} className="font-mono text-xs">
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!state.renaming} onOpenChange={() => onRenameClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Rename Folder</DialogTitle>
          </DialogHeader>
          <Input
            value={state.renaming?.name ?? ""}
            onChange={(e) => onRenameChange(e.target.value)}
            className="font-mono text-sm"
            onKeyDown={(e) => e.key === "Enter" && onRenameSubmit()}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={onRenameClose} className="font-mono text-xs">
              Cancel
            </Button>
            <Button onClick={onRenameSubmit} className="font-mono text-xs">
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!state.renamingDoc} onOpenChange={() => onRenameDocClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Rename Document</DialogTitle>
          </DialogHeader>
          <Input
            value={state.renamingDoc?.title ?? ""}
            onChange={(e) => onRenameDocChange(e.target.value)}
            className="font-mono text-sm"
            onKeyDown={(e) => e.key === "Enter" && onRenameDocSubmit()}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={onRenameDocClose} className="font-mono text-xs">
              Cancel
            </Button>
            <Button onClick={onRenameDocSubmit} className="font-mono text-xs">
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
