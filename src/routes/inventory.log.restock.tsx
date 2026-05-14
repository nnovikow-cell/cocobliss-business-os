import { createFileRoute } from "@tanstack/react-router";
import { LogFlow } from "@/components/inventory/log-flow";

export const Route = createFileRoute("/inventory/log/restock")({
  component: () => <LogFlow kind="restock" />,
});