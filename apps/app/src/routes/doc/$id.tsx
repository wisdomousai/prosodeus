import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/doc/$id")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/app/doc/$id", params: { id: params.id } });
  },
});
