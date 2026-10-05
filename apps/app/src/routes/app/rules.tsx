import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import { PatternsWorkbench } from "@/components/rules/PatternsWorkbench";
import { StylesWorkbench } from "@/components/rules/StylesWorkbench";
import { AppRouteShell } from "@/components/shell/AppRouteShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/app/rules")({
  component: RulesPage,
});

function RulesPage() {
  const [tab, setTab] = React.useState<"patterns" | "styles">(() => {
    if (typeof window === "undefined") return "patterns";
    return new URLSearchParams(window.location.search).get("tab") === "styles"
      ? "styles"
      : "patterns";
  });

  return (
    <AppRouteShell title="Rules">
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as "patterns" | "styles")}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="border-b border-border bg-background px-5">
          <TabsList variant="line" className="h-10 gap-6 rounded-none bg-transparent p-0">
            <TabsTrigger
              value="patterns"
              className="h-10 rounded-none border-b-2 border-transparent bg-transparent px-0 font-mono text-[11px] uppercase tracking-wider text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
            >
              Patterns
            </TabsTrigger>
            <TabsTrigger
              value="styles"
              className="h-10 rounded-none border-b-2 border-transparent bg-transparent px-0 font-mono text-[11px] uppercase tracking-wider text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
            >
              Styles
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="patterns" className="m-0 flex-1 min-h-0 flex flex-col">
          <PatternsWorkbench />
        </TabsContent>
        <TabsContent value="styles" className="m-0 flex-1 min-h-0 flex flex-col">
          <StylesWorkbench />
        </TabsContent>
      </Tabs>
    </AppRouteShell>
  );
}
