import type * as React from "react";
import { cn } from "@/lib/utils";

type EditorialShellProps = {
  /** Left rail (icon nav) — pass <LeftRail/>. */
  leftRail?: React.ReactNode;
  /** Top toolbar — pass <TopToolbar/>. */
  toolbar?: React.ReactNode;
  /** Center content (the editor, library table, rules workbench, etc.). */
  children: React.ReactNode;
  /** Optional right inspector — pass <RightInspector/>. */
  inspector?: React.ReactNode;
  /** Optional bottom status bar (word count, last analyzed, etc.). */
  statusBar?: React.ReactNode;
  /** Optional left subnav (e.g. outline tree) between the rail and the center. */
  leftSubnav?: React.ReactNode;
  className?: string;
};

export function EditorialShell({
  leftRail,
  toolbar,
  children,
  inspector,
  statusBar,
  leftSubnav,
  className,
}: EditorialShellProps) {
  return (
    <div
      className={cn(
        "flex h-svh min-h-0 w-full overflow-hidden bg-background text-foreground",
        className,
      )}
    >
      {leftRail}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {toolbar}
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {leftSubnav}
          <main className="flex min-w-0 flex-1 flex-col overflow-hidden">{children}</main>
          {inspector}
        </div>
        {statusBar}
      </div>
    </div>
  );
}
