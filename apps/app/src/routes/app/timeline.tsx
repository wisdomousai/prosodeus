import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Calendar, Clock } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppRouteShell } from "@/components/shell/AppRouteShell";
import type { DocumentMeta, WorkspaceMeta } from "@/lib/api";
import { listDocuments, listWorkspaces } from "@/lib/api";

export const Route = createFileRoute("/app/timeline")({
  component: TimelinePage,
});

function heatDot(heat: number | null) {
  if (heat === null) return "bg-muted-foreground/30";
  if (heat < 2) return "bg-olive";
  if (heat < 4) return "bg-bronze";
  if (heat < 6) return "bg-gold";
  return "bg-blood-bright";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function TimelinePage() {
  const [documents, setDocuments] = useState<DocumentMeta[]>([]);
  const [workspaces, setWorkspaces] = useState<WorkspaceMeta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      listDocuments({ has_due_date: true, sort: "due_date", order: "asc" }),
      listWorkspaces(),
    ])
      .then(([docs, ws]) => {
        setDocuments(docs);
        setWorkspaces(ws);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const wsMap = useMemo(() => {
    const map = new Map<string, WorkspaceMeta>();
    for (const ws of workspaces) map.set(ws.id, ws);
    return map;
  }, [workspaces]);

  const grouped = useMemo(() => {
    const groups = new Map<string, DocumentMeta[]>();
    for (const doc of documents) {
      if (!doc.due_date) continue;
      const key = doc.due_date.slice(0, 10);
      const arr = groups.get(key) ?? [];
      arr.push(doc);
      groups.set(key, arr);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [documents]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <AppRouteShell
      title="Timeline"
      trailing={
        <span className="font-mono text-[0.6rem] text-muted-foreground">
          {documents.length} documents with deadlines
        </span>
      }
    >
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-3xl">
          {loading ? (
            <div className="flex items-center gap-2 py-12 font-mono text-[0.8rem] text-muted-foreground">
              <div className="size-3 animate-spin rounded-full border-2 border-gold/40 border-t-gold" />
              Loading...
            </div>
          ) : grouped.length === 0 ? (
            <div className="py-12 text-center">
              <Clock className="mx-auto size-8 text-muted-foreground/30" />
              <p className="mt-3 font-serif text-sm text-muted-foreground">
                No documents with due dates yet.
              </p>
              <p className="mt-1 font-mono text-[0.65rem] text-muted-foreground/60">
                Set due dates in the document details panel.
              </p>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute left-[1.1rem] top-2 bottom-2 w-px bg-border" />

              <div className="space-y-6">
                {grouped.map(([date, docs]) => {
                  const days = daysUntil(date);
                  const isPast = days < 0;
                  const isToday = date === today;

                  return (
                    <div key={date} className="relative pl-10">
                      <div
                        className={`absolute left-[0.65rem] top-1 size-3 rounded-full border-2 ${
                          isToday
                            ? "border-primary bg-primary"
                            : isPast
                              ? "border-muted-foreground/40 bg-muted"
                              : days <= 3
                                ? "border-destructive bg-destructive/20"
                                : "border-border bg-background"
                        }`}
                      />

                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className={`font-mono text-[0.7rem] font-bold ${
                            isToday
                              ? "text-primary"
                              : isPast
                                ? "text-muted-foreground"
                                : "text-card-foreground"
                          }`}
                        >
                          {isToday ? "Today" : formatDate(date)}
                        </span>
                        {!isToday && (
                          <span
                            className={`font-mono text-[0.55rem] ${
                              isPast
                                ? "text-muted-foreground"
                                : days <= 3
                                  ? "text-destructive"
                                  : "text-muted-foreground"
                            }`}
                          >
                            {isPast
                              ? `${Math.abs(days)}d overdue`
                              : days === 1
                                ? "tomorrow"
                                : `in ${days}d`}
                          </span>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        {docs.map((doc) => {
                          const ws = doc.workspace_id ? wsMap.get(doc.workspace_id) : null;
                          return (
                            <Link
                              key={doc.id}
                              to="/app/doc/$id"
                              params={{ id: doc.id }}
                              className="flex items-center gap-2.5 rounded-md border border-border/60 bg-card/40 px-3 py-2 hover:bg-secondary transition-colors no-underline group"
                            >
                              <span
                                className={`size-2 rounded-full shrink-0 ${heatDot(doc.mean_heat)}`}
                              />
                              <span className="flex-1 truncate font-serif text-sm text-foreground">
                                {doc.title || "Untitled"}
                              </span>
                              {ws && (
                                <span className="font-mono text-[0.5rem] text-muted-foreground/60 shrink-0">
                                  {ws.icon ? `${ws.icon} ` : ""}
                                  {ws.name}
                                </span>
                              )}
                              <span
                                className={`shrink-0 rounded-full px-1.5 py-0.5 font-mono text-[0.5rem] ${
                                  doc.status === "draft"
                                    ? "bg-muted text-muted-foreground"
                                    : doc.status === "review"
                                      ? "bg-gold/10 text-gold"
                                      : doc.status === "final"
                                        ? "bg-olive/10 text-olive"
                                        : "bg-muted/50 text-muted-foreground/50"
                                }`}
                              >
                                {doc.status}
                              </span>
                              <ArrowRight className="size-3 text-muted-foreground/0 group-hover:text-muted-foreground transition-colors shrink-0" />
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </AppRouteShell>
  );
}
