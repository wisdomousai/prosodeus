import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import type { UserProfile } from "@/lib/api";

export interface RouterContext {
  auth: {
    user: UserProfile | null;
    loading: boolean;
  };
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: function RootComponent() {
    return (
      <ErrorBoundary>
        <Outlet />
      </ErrorBoundary>
    );
  },
  notFoundComponent: () => (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="space-y-4 text-center">
        <h1 className="font-display text-2xl text-card-foreground">404</h1>
        <p className="font-mono text-sm text-muted-foreground">Page not found</p>
        <a href="/" className="font-mono text-xs text-gold hover:underline">
          Go home
        </a>
      </div>
    </div>
  ),
});
