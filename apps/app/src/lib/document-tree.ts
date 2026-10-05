import type { DocumentMeta, FolderMeta } from "@/lib/api";

export interface FolderNode {
  folder: FolderMeta;
  children: FolderNode[];
  documents: DocumentMeta[];
}

export function buildTree(
  folders: FolderMeta[],
  documents: DocumentMeta[],
): { roots: FolderNode[]; rootDocs: DocumentMeta[] } {
  const map = new Map<string, FolderNode>();
  for (const f of folders) {
    map.set(f.id, { folder: f, children: [], documents: [] });
  }

  const roots: FolderNode[] = [];
  for (const node of map.values()) {
    if (node.folder.parent_id && map.has(node.folder.parent_id)) {
      map.get(node.folder.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const rootDocs: DocumentMeta[] = [];
  for (const doc of documents) {
    if (doc.folder_id && map.has(doc.folder_id)) {
      map.get(doc.folder_id)!.documents.push(doc);
    } else {
      rootDocs.push(doc);
    }
  }

  return { roots, rootDocs };
}

/** Collect folder id and all ancestor folder ids. */
export function folderAncestorIds(folderId: string, folders: FolderMeta[]): Set<string> {
  const byId = new Map(folders.map((f) => [f.id, f] as const));
  const out = new Set<string>();
  let cur: string | null = folderId;
  while (cur) {
    out.add(cur);
    cur = byId.get(cur)?.parent_id ?? null;
  }
  return out;
}

/**
 * For search: keep documents matching query, folders on path to those docs or matching name.
 */
export function filterLibraryData(
  folders: FolderMeta[],
  documents: DocumentMeta[],
  query: string,
): { folders: FolderMeta[]; documents: DocumentMeta[] } {
  const q = query.trim().toLowerCase();
  if (!q) return { folders, documents };

  const matchingDocs = documents.filter((d) => (d.title || "Untitled").toLowerCase().includes(q));
  const matchingFolderIds = new Set<string>();
  for (const f of folders) {
    if (f.name.toLowerCase().includes(q)) matchingFolderIds.add(f.id);
  }
  for (const d of matchingDocs) {
    if (d.folder_id) {
      for (const id of folderAncestorIds(d.folder_id, folders)) matchingFolderIds.add(id);
    }
  }

  const keepFolders = folders.filter((f) => matchingFolderIds.has(f.id));
  return { folders: keepFolders, documents: matchingDocs };
}

/** Segments from library root to a folder (inclusive), for breadcrumbs. */
export type FolderBreadcrumbSeg = { id: string | null; label: string };

export function folderBreadcrumbTrail(
  folderId: string | null,
  folders: FolderMeta[],
): FolderBreadcrumbSeg[] {
  const parts: FolderBreadcrumbSeg[] = [{ id: null, label: "Library" }];
  if (!folderId) return parts;
  const byId = new Map(folders.map((f) => [f.id, f] as const));
  const chain: FolderMeta[] = [];
  let cur: string | null = folderId;
  const guard = new Set<string>();
  while (cur && !guard.has(cur)) {
    guard.add(cur);
    const f = byId.get(cur);
    if (!f) break;
    chain.unshift(f);
    cur = f.parent_id;
  }
  for (const f of chain) {
    parts.push({ id: f.id, label: f.name });
  }
  return parts;
}

/** Human-readable folder path for metadata display. */
export function folderLabelPath(folderId: string | null, folders: FolderMeta[]): string {
  if (!folderId) return "Library root";
  const byId = new Map(folders.map((f) => [f.id, f] as const));
  const parts: string[] = [];
  let cur: string | null = folderId;
  const guard = new Set<string>();
  while (cur && !guard.has(cur)) {
    guard.add(cur);
    const f = byId.get(cur);
    if (!f) break;
    parts.unshift(f.name);
    cur = f.parent_id;
  }
  return parts.length ? parts.join(" / ") : "Library root";
}
