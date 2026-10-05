import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/app")({
  component: AppShellLayout,
});

/**
 * Each child route renders its own shell — see `components/shell/EditorialShell.tsx`
 * for the editor cockpit and `AppRouteShell.tsx` for the slim variant used elsewhere.
 */
function AppShellLayout() {
  return <Outlet />;
}
