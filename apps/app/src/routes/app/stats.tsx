import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, FileText, Flame, TrendingDown, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppRouteShell } from "@/components/shell/AppRouteShell";
import { Card, CardContent } from "@/components/ui/card";
import type { DocumentMeta } from "@/lib/api";
import { listDocuments } from "@/lib/api";

export const Route = createFileRoute("/app/stats")({
  component: WritingStats,
});

function StatCard({
  label,
  value,
  icon,
  sub,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  sub?: string;
}) {
  return (
    <Card className="gap-0 py-0 rounded">
      <CardContent className="p-4 flex items-start gap-3">
        <span className="text-muted-foreground mt-0.5">{icon}</span>
        <div>
          <p className="font-mono text-[0.6rem] uppercase tracking-widest text-muted-foreground">
            {label}
          </p>
          <p className="font-display text-2xl font-bold text-card-foreground">{value}</p>
          {sub && <p className="font-mono text-[0.55rem] text-muted-foreground">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function WritingStats() {
  const [documents, setDocuments] = useState<DocumentMeta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listDocuments()
      .then(setDocuments)
      .catch(() => setDocuments([]))
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    const totalDocs = documents.length;
    const totalWords = documents.reduce((sum, d) => sum + (d.word_count ?? 0), 0);
    const analyzed = documents.filter((d) => d.mean_heat !== null);
    const avgHeat =
      analyzed.length > 0
        ? analyzed.reduce((sum, d) => sum + d.mean_heat!, 0) / analyzed.length
        : null;

    const cool = analyzed.filter((d) => d.mean_heat! < 3).length;
    const warm = analyzed.filter((d) => d.mean_heat! >= 3 && d.mean_heat! < 6).length;
    const hot = analyzed.filter((d) => d.mean_heat! >= 6).length;

    const statusCounts: Record<string, number> = {};
    for (const d of documents) {
      statusCounts[d.status] = (statusCounts[d.status] ?? 0) + 1;
    }

    const sorted = [...analyzed].sort((a, b) => a.mean_heat! - b.mean_heat!);
    const bestDoc = sorted[0] ?? null;
    const worstDoc = sorted[sorted.length - 1] ?? null;

    const monthlyWords: Array<{ month: string; words: number }> = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const month = d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
      const words = documents
        .filter((doc) => {
          const created = new Date(doc.created_at);
          return created.getMonth() === d.getMonth() && created.getFullYear() === d.getFullYear();
        })
        .reduce((sum, doc) => sum + (doc.word_count ?? 0), 0);
      monthlyWords.push({ month, words });
    }

    return {
      totalDocs,
      totalWords,
      avgHeat,
      cool,
      warm,
      hot,
      statusCounts,
      bestDoc,
      worstDoc,
      monthlyWords,
    };
  }, [documents]);

  if (loading) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center">
        <div className="size-4 animate-spin rounded-full border-2 border-gold/40 border-t-gold" />
      </div>
    );
  }

  return (
    <AppRouteShell title="Writing Stats">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              label="Documents"
              value={String(stats.totalDocs)}
              icon={<FileText className="size-5" />}
            />
            <StatCard
              label="Total Words"
              value={
                stats.totalWords >= 1000
                  ? `${(stats.totalWords / 1000).toFixed(1)}k`
                  : String(stats.totalWords)
              }
              icon={<BookOpen className="size-5" />}
            />
            <StatCard
              label="Avg Heat"
              value={stats.avgHeat !== null ? stats.avgHeat.toFixed(1) : "—"}
              icon={<Flame className="size-5" />}
              sub={
                stats.avgHeat !== null
                  ? stats.avgHeat < 3
                    ? "Cool — clean writing"
                    : stats.avgHeat < 6
                      ? "Warm — some patterns"
                      : "Hot — needs work"
                  : "No analyzed docs"
              }
            />
            <StatCard
              label="Heat Split"
              value={`${stats.cool}/${stats.warm}/${stats.hot}`}
              icon={<TrendingDown className="size-5" />}
              sub="cool / warm / hot"
            />
          </div>

          <Card className="gap-0 py-0 rounded">
            <CardContent className="p-4 space-y-3">
              <p className="font-mono text-[0.6rem] uppercase tracking-widest text-muted-foreground">
                Monthly Output (words)
              </p>
              <div className="flex items-end gap-1.5 h-24">
                {stats.monthlyWords.map((m) => {
                  const maxWords = Math.max(...stats.monthlyWords.map((x) => x.words), 1);
                  const height = Math.max((m.words / maxWords) * 100, 2);
                  return (
                    <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className="w-full rounded-t bg-gold/40 transition-all"
                        style={{ height: `${height}%` }}
                        title={`${m.words.toLocaleString()} words`}
                      />
                      <span className="font-mono text-[0.45rem] text-muted-foreground">
                        {m.month}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {stats.bestDoc && (
              <Card className="gap-0 py-0 rounded">
                <CardContent className="p-4">
                  <p className="font-mono text-[0.6rem] uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                    <TrendingDown className="size-3 text-olive" /> Cleanest Document
                  </p>
                  <p className="font-serif text-sm mt-1">{stats.bestDoc.title || "Untitled"}</p>
                  <p className="font-mono text-[0.6rem] text-muted-foreground">
                    Heat: {stats.bestDoc.mean_heat?.toFixed(1)} · {stats.bestDoc.word_count ?? 0}{" "}
                    words
                  </p>
                </CardContent>
              </Card>
            )}
            {stats.worstDoc && stats.worstDoc.id !== stats.bestDoc?.id && (
              <Card className="gap-0 py-0 rounded">
                <CardContent className="p-4">
                  <p className="font-mono text-[0.6rem] uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                    <TrendingUp className="size-3 text-blood-bright" /> Highest Heat
                  </p>
                  <p className="font-serif text-sm mt-1">{stats.worstDoc.title || "Untitled"}</p>
                  <p className="font-mono text-[0.6rem] text-muted-foreground">
                    Heat: {stats.worstDoc.mean_heat?.toFixed(1)} · {stats.worstDoc.word_count ?? 0}{" "}
                    words
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          <Card className="gap-0 py-0 rounded">
            <CardContent className="p-4 space-y-2">
              <p className="font-mono text-[0.6rem] uppercase tracking-widest text-muted-foreground">
                Status Breakdown
              </p>
              <div className="flex gap-4 font-mono text-[0.7rem]">
                {Object.entries(stats.statusCounts).map(([status, count]) => (
                  <span key={status} className="text-muted-foreground">
                    <span className="text-card-foreground font-bold">{count}</span> {status}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppRouteShell>
  );
}
