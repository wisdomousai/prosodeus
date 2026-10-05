import { PenLine, Settings, SlidersHorizontal } from "lucide-react";
import type * as React from "react";
import { EditorialShell } from "./EditorialShell";
import { LeftRail, type LeftRailEntry } from "./LeftRail";
import { type NavEntry, TopToolbar } from "./TopToolbar";

const APP_RAIL_ENTRIES: LeftRailEntry[] = [
  { id: "writing", label: "Writing", icon: PenLine, to: "/app" },
  { id: "rules", label: "Rules", icon: SlidersHorizontal, to: "/app/rules" },
  { id: "settings", label: "Settings", icon: Settings, to: "/app/account" },
];

const APP_NAV: NavEntry[] = [
  { label: "Writing", icon: PenLine, to: "/app" },
  { label: "Rules", icon: SlidersHorizontal, to: "/app/rules" },
  { label: "Settings", icon: Settings, to: "/app/account" },
];

/**
 * Slim shell used by non-document routes (Writing, Rules, Account, etc.).
 * Provides the LeftRail + a title-only TopToolbar; no inspector.
 */
export function AppRouteShell({
  title,
  trailing,
  breadcrumb,
  children,
}: {
  title: string;
  trailing?: React.ReactNode;
  breadcrumb?: Array<{ label: string; to?: string }>;
  children: React.ReactNode;
}) {
  return (
    <EditorialShell
      leftRail={<LeftRail entries={APP_RAIL_ENTRIES} variant="labeled" />}
      toolbar={
        <TopToolbar
          navEntries={APP_NAV}
          breadcrumb={
            breadcrumb && breadcrumb.length > 0 ? breadcrumb : [{ label: "Prosodeus", to: "/app" }]
          }
          title={title}
          trailing={trailing}
        />
      }
    >
      {children}
    </EditorialShell>
  );
}
