import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/inventory/new")({
  component: () => <Navigate to="/inventory/list" search={{ new: "1" } as never} replace />,
});