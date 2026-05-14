import { createFileRoute } from "@tanstack/react-router";
import { LogFlow } from "@/components/inventory/log-flow";

export const Route = createFileRoute("/inventory/log/event")({
  component: () => <LogFlow kind="event_use" />,
});