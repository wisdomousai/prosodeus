import { ChevronRight, FolderClosed, Inbox } from "lucide-react";
import * as React from "react";
import type { FolderMeta } from "@/lib/api";
import { cn } from "@/lib/utils";

type Props = {
  folders: FolderMeta[];
  selected: string | null | "all";
  onSelect: (folderId: string | null | "all") => void;
  counts: Map<string | null, number>;
  totalCount: number;
};

type Node = FolderMeta & { children: Node[] };

function buildTree(folders: FolderMeta[]): Node[] {
  const byId = new Map<string, Node>();
  folders.forEach((f) => byId.set(f.id, { ...f, children: [] }));
  const roots: Node[] = [];
  byId.forEach((node) => {
    if (node.parent_id && byId.has(node.parent_id)) {
      byId.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  const sort = (arr: Node[]) => {
    arr.sort((a, b) => a.name.localeCompare(b.name));
    arr.forEach((n) => sort(n.children));
  };
  sort(roots);
  return roots;
}

export function LibraryFolderNav({ folders, selected, onSelect, counts, totalCount }: Props) {
  const tree = React.useMemo(() => buildTree(folders), [folders]);
  const unfiledCount = counts.get(null) ?? 0;

  return (
    <nav className="w-56 shrink-0 border-r border-border bg-card/30 px-2 py-3 overflow-y-auto">
      <p className="px-2 pb-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        Folders
      </p>
      <ul className="space-y-0.5">
        <Row
          label="All documents"
          icon={<Inbox className="h-3.5 w-3.5" strokeWidth={1.75} />}
          count={totalCount}
          active={selected === "all"}
          onClick={() => onSelect("all")}
        />
        <Row
          label="Unfiled"
          icon={<FolderClosed className="h-3.5 w-3.5" strokeWidth={1.75} />}
          count={unfiledCount}
          active={selected === null}
          onClick={() => onSelect(null)}
        />
        {tree.map((node) => (
          <FolderNode
            key={node.id}
            node={node}
            depth={0}
            selected={selected}
            onSelect={onSelect}
            counts={counts}
          />
        ))}
      </ul>
    </nav>
  );
}

function FolderNode({
  node,
  depth,
  selected,
  onSelect,
  counts,
}: {
  node: Node;
  depth: number;
  selected: string | null | "all";
  onSelect: (id: string | null | "all") => void;
  counts: Map<string | null, number>;
}) {
  const [open, setOpen] = React.useState(depth === 0);
  const hasChildren = node.children.length > 0;
  const count = counts.get(node.id) ?? 0;
  return (
    <li>
      <div className="flex items-center">
        {hasChildren ? (
          <button
            type="button"
            aria-label={open ? "Collapse folder" : "Expand folder"}
            onClick={() => setOpen((v) => !v)}
            className="flex h-6 w-4 items-center justify-center text-muted-foreground hover:text-foreground"
            style={{ marginLeft: depth * 12 }}
          >
            <ChevronRight
              className={cn("h-3 w-3 transition-transform", open && "rotate-90")}
              strokeWidth={1.75}
            />
          </button>
        ) : (
          <span className="inline-block" style={{ width: 16, marginLeft: depth * 12 }} />
        )}
        <Row
          label={node.name}
          icon={<FolderClosed className="h-3.5 w-3.5" strokeWidth={1.75} />}
          count={count}
          active={selected === node.id}
          onClick={() => onSelect(node.id)}
          dense
        />
      </div>
      {hasChildren && open ? (
        <ul className="space-y-0.5">
          {node.children.map((c) => (
            <FolderNode
              key={c.id}
              node={c}
              depth={depth + 1}
              selected={selected}
              onSelect={onSelect}
              counts={counts}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function Row({
  label,
  icon,
  count,
  active,
  onClick,
  dense,
}: {
  label: string;
  icon: React.ReactNode;
  count: number;
  active: boolean;
  onClick: () => void;
  dense?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[12px]",
        "hover:bg-accent",
        active && "bg-ink-soft text-foreground",
        !active && "text-foreground/90",
        dense && "flex-1",
      )}
    >
      <span className="text-muted-foreground">{icon}</span>
      <span className="flex-1 truncate font-serif">{label}</span>
      <span className="font-mono text-[10px] text-muted-foreground tabular-nums">{count}</span>
    </button>
  );
}
