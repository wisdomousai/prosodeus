import { QueryClientProvider } from "@tanstack/react-query";
import { createHashHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { isDesktop } from "./lib/desktop-bridge";
import { queryClient } from "./queries/query-client";
import { routeTree } from "./routeTree.gen";
import "./index.css";

// Electron loads index.html via file:// — browser history would treat the
// absolute file path as the route and 404 every match. Hash history puts the
// route after `#`, leaving the URL path alone. We also boot straight into the
// app shell (`/app`) since the marketing landing page is web-only.
if (isDesktop() && (window.location.hash === "" || window.location.hash === "#/")) {
  window.location.hash = "/app";
}

const router = createRouter({
  routeTree,
  context: { auth: undefined! },
  defaultPreload: "intent",
  history: isDesktop() ? createHashHistory() : undefined,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

function InnerApp() {
  const { user, loading } = useAuth();
  return <RouterProvider router={router} context={{ auth: { user, loading } }} />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <InnerApp />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
