import { Maximize2, Minimize2, PanelRight } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";

export type InspectorTabId = "analyze" | "playbook" | "rewrite" | "operations" | "versions";

type RightInspectorProps = {
  active: InspectorTabId;
  onActiveChange: (next: InspectorTabId) => void;
  analyze: React.ReactNode;
  playbook: React.ReactNode;
  rewrite: React.ReactNode;
  operations: React.ReactNode;
  versions: React.ReactNode;
  /** Desktop inspector width mode. */
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  /** Optional header trailing slot (e.g. close, expand). */
  trailing?: React.ReactNode;
  className?: string;
  /** When this counter changes on narrow viewports, the bottom sheet opens (e.g. left-rail tab switch). */
  mobileAutoOpenSignal?: number;
};

const TABS: { id: InspectorTabId; label: string }[] = [
  { id: "analyze", label: "Analyze" },
  { id: "playbook", label: "Playbook" },
  { id: "rewrite", label: "Rewrite" },
  { id: "operations", label: "Operations" },
  { id: "versions", label: "Versions" },
];

function TabStrip({
  active,
  onActiveChange,
  trailing,
}: Pick<RightInspectorProps, "active" | "onActiveChange" | "trailing">) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-2 border-b border-border bg-card px-3">
      <div
        className="flex h-11 min-w-0 items-end gap-4 overflow-x-auto pr-2"
        role="tablist"
        aria-label="Inspector modes"
      >
        {TABS.map((t) => {
          const isActive = active === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onActiveChange(t.id)}
              className={cn(
                "shrink-0 border-b-2 px-0 pb-2 pt-3 text-sm font-medium transition-colors",
                isActive
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      {trailing ? <div className="flex shrink-0 items-center gap-1">{trailing}</div> : null}
    </div>
  );
}

function TabPanels({
  active,
  analyze,
  playbook,
  rewrite,
  operations,
  versions,
}: Pick<
  RightInspectorProps,
  "active" | "analyze" | "playbook" | "rewrite" | "operations" | "versions"
>) {
  return (
    <>
      <div
        role="tabpanel"
        id="inspector-panel-analyze"
        aria-hidden={active !== "analyze"}
        className={cn("p-4", active !== "analyze" && "hidden")}
      >
        {analyze}
      </div>
      <div
        role="tabpanel"
        id="inspector-panel-playbook"
        aria-hidden={active !== "playbook"}
        className={cn("p-4", active !== "playbook" && "hidden")}
      >
        {playbook}
      </div>
      <div
        role="tabpanel"
        id="inspector-panel-rewrite"
        aria-hidden={active !== "rewrite"}
        className={cn("p-4", active !== "rewrite" && "hidden")}
      >
        {rewrite}
      </div>
      <div
        role="tabpanel"
        id="inspector-panel-operations"
        aria-hidden={active !== "operations"}
        className={cn("p-4", active !== "operations" && "hidden")}
      >
        {operations}
      </div>
      <div
        role="tabpanel"
        id="inspector-panel-versions"
        aria-hidden={active !== "versions"}
        className={cn("p-4", active !== "versions" && "hidden")}
      >
        {versions}
      </div>
    </>
  );
}

export function RightInspector({
  active,
  onActiveChange,
  analyze,
  playbook,
  rewrite,
  operations,
  versions,
  expanded = false,
  onExpandedChange,
  trailing,
  className,
  mobileAutoOpenSignal = 0,
}: RightInspectorProps) {
  const isMdUp = useMediaQuery("(min-width: 768px)");
  const [mobileOpen, setMobileOpen] = React.useState(false);

  React.useEffect(() => {
    if (isMdUp) setMobileOpen(false);
  }, [isMdUp]);

  React.useEffect(() => {
    if (isMdUp || mobileAutoOpenSignal === 0) return;
    setMobileOpen(true);
  }, [mobileAutoOpenSignal, isMdUp]);

  const openMobileInspector = React.useCallback(() => {
    setMobileOpen(true);
  }, []);

  const expandControl = onExpandedChange ? (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      className="hidden h-8 w-8 md:inline-flex"
      aria-label={expanded ? "Collapse inspector" : "Expand inspector"}
      title={expanded ? "Collapse inspector" : "Expand inspector"}
      onClick={() => onExpandedChange(!expanded)}
    >
      {expanded ? (
        <Minimize2 className="size-4" strokeWidth={1.75} />
      ) : (
        <Maximize2 className="size-4" strokeWidth={1.75} />
      )}
    </Button>
  ) : null;

  const desktopTrailing =
    trailing || expandControl ? (
      <>
        {trailing}
        {expandControl}
      </>
    ) : null;

  return (
    <>
      {/* Desktop / tablet: fixed-width aside */}
      <aside
        className={cn(
          "hidden shrink-0 flex-col border-l border-border bg-card transition-[width] duration-200 ease-out md:flex",
          expanded ? "w-[min(880px,64vw)] 2xl:w-[920px]" : "w-[460px] 2xl:w-[500px]",
          className,
        )}
        aria-label="Inspector"
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <TabStrip active={active} onActiveChange={onActiveChange} trailing={desktopTrailing} />
          <ScrollArea className="min-h-0 flex-1">
            <TabPanels
              active={active}
              analyze={analyze}
              playbook={playbook}
              rewrite={rewrite}
              operations={operations}
              versions={versions}
            />
          </ScrollArea>
        </div>
      </aside>

      {/* Narrow: floating open + bottom sheet */}
      <div className="md:hidden">
        <Button
          type="button"
          size="icon"
          variant="secondary"
          className="fixed bottom-4 right-4 z-40 h-11 w-11 rounded-full border border-border shadow-md"
          aria-label="Open inspector"
          onClick={openMobileInspector}
        >
          <PanelRight className="size-5" strokeWidth={1.75} />
        </Button>
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent
            side="bottom"
            showCloseButton
            className="flex max-h-[78vh] flex-col gap-0 overflow-hidden p-0"
          >
            <div className="flex min-h-0 flex-1 flex-col">
              <TabStrip active={active} onActiveChange={onActiveChange} trailing={trailing} />
              <ScrollArea className="min-h-0 flex-1">
                <TabPanels
                  active={active}
                  analyze={analyze}
                  playbook={playbook}
                  rewrite={rewrite}
                  operations={operations}
                  versions={versions}
                />
              </ScrollArea>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
