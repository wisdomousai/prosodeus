import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { AppRouteShell } from "@/components/shell/AppRouteShell";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { to: "/app/account" as const, label: "Profile", activeOptions: { exact: true } },
  { to: "/app/account/byok" as const, label: "External Keys", activeOptions: {} },
];

export const Route = createFileRoute("/app/account")({
  component: AccountLayout,
});

function AccountLayout() {
  return (
    <AppRouteShell title="Account">
      <div className="flex min-h-0 flex-1">
        <nav className="w-48 shrink-0 border-r border-border p-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={item.activeOptions}
              className={cn(
                "block px-3 py-2 rounded font-mono text-xs tracking-wider no-underline transition-colors",
                "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50",
              )}
              activeProps={{
                className: "bg-sidebar-accent text-card-foreground",
              }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <main className="min-h-0 flex-1 overflow-y-auto p-8 max-w-2xl">
          <Outlet />
        </main>
      </div>
    </AppRouteShell>
  );
}
