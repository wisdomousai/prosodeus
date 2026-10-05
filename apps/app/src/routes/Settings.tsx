import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/Settings")({
  beforeLoad: () => {
    throw redirect({ to: "/app/account" });
  },
});
