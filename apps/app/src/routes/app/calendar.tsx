import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppRouteShell } from "@/components/shell/AppRouteShell";
import { Button } from "@/components/ui/button";
import type { DocumentMeta } from "@/lib/api";
import { listDocuments } from "@/lib/api";

export const Route = createFileRoute("/app/calendar")({
  component: CalendarPage,
});

function heatDot(heat: number | null) {
  if (heat === null) return "bg-muted-foreground/30";
  if (heat < 2) return "bg-olive";
  if (heat < 4) return "bg-bronze";
  if (heat < 6) return "bg-gold";
  return "bg-blood-bright";
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function CalendarPage() {
  const [documents, setDocuments] = useState<DocumentMeta[]>([]);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  useEffect(() => {
    listDocuments({ has_due_date: true })
      .then(setDocuments)
      .catch(() => setDocuments([]));
  }, []);

  const today = useMemo(() => new Date(), []);

  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days: Array<{ date: Date | null; docs: DocumentMeta[] }> = [];

    for (let i = 0; i < firstDay; i++) {
      days.push({ date: null, docs: [] });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const docs = documents.filter((doc) => {
        if (!doc.due_date) return false;
        return isSameDay(new Date(doc.due_date), date);
      });
      days.push({ date, docs });
    }

    while (days.length % 7 !== 0) {
      days.push({ date: null, docs: [] });
    }

    return days;
  }, [currentMonth, documents]);

  const monthLabel = currentMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const prevMonth = () =>
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  const nextMonth = () =>
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  const goToday = () => setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));

  return (
    <AppRouteShell
      title="Calendar"
      trailing={
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="sm" onClick={prevMonth} className="h-7 w-7 p-0">
            <ChevronLeft className="size-4" />
          </Button>
          <button
            onClick={goToday}
            className="font-mono text-xs text-muted-foreground hover:text-foreground cursor-pointer min-w-[10rem] text-center"
          >
            {monthLabel}
          </button>
          <Button variant="ghost" size="sm" onClick={nextMonth} className="h-7 w-7 p-0">
            <ChevronRight className="size-4" />
          </Button>
        </div>
      }
    >
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-5xl">
          <div className="grid grid-cols-7 gap-px mb-px">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div
                key={day}
                className="px-2 py-1.5 font-mono text-[0.6rem] uppercase tracking-widest text-muted-foreground text-center"
              >
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-px rounded-lg border border-border overflow-hidden bg-border">
            {calendarDays.map((cell, i) => {
              const isToday = cell.date && isSameDay(cell.date, today);
              return (
                <div
                  key={i}
                  className={`min-h-[5rem] bg-background p-1.5 ${cell.date ? "" : "bg-muted/30"}`}
                >
                  {cell.date && (
                    <>
                      <span
                        className={`inline-flex size-6 items-center justify-center rounded-full font-mono text-[0.65rem] ${
                          isToday
                            ? "bg-primary text-primary-foreground font-bold"
                            : "text-muted-foreground"
                        }`}
                      >
                        {cell.date.getDate()}
                      </span>
                      <div className="mt-0.5 space-y-0.5">
                        {cell.docs.slice(0, 3).map((doc) => (
                          <Link
                            key={doc.id}
                            to="/app/doc/$id"
                            params={{ id: doc.id }}
                            className="flex items-center gap-1 rounded px-1 py-0.5 hover:bg-secondary transition-colors no-underline"
                          >
                            <span
                              className={`size-1.5 rounded-full shrink-0 ${heatDot(doc.mean_heat)}`}
                            />
                            <span className="truncate font-mono text-[0.55rem] text-foreground">
                              {doc.title || "Untitled"}
                            </span>
                          </Link>
                        ))}
                        {cell.docs.length > 3 && (
                          <span className="px-1 font-mono text-[0.5rem] text-muted-foreground">
                            +{cell.docs.length - 3} more
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AppRouteShell>
  );
}
