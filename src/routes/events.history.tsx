import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/events/history")({ component: HistoryTab });

function HistoryTab() {
  return (
    <div className="rounded-2xl border-2 border-dashed border-border bg-muted/30 p-10 text-center">
      <p className="text-sm font-semibold text-muted-foreground">History view coming next.</p>
      <p className="mt-1 text-xs text-muted-foreground">Phase 3: list + revenue heatmap + detail drawer.</p>
    </div>
  );
}