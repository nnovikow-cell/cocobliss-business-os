import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/events")({ component: EventsLayout });

const tabs = [
  { to: "/events/schedule", label: "Schedule" },
  { to: "/events/history", label: "History" },
  { to: "/events/series", label: "Series" },
] as const;

function EventsLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <AppShell>
      <div data-sticky-header>
        <header className="mb-4 flex items-center gap-2">
          <Link to="/" className="rounded-full p-2 hover:bg-muted" aria-label="Back to hub">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-black tracking-tight">Events</h1>
            <p className="text-sm text-muted-foreground">Schedule, history, and recurring series.</p>
          </div>
        </header>
        <nav className="mb-1 flex gap-1 rounded-2xl border-2 border-border bg-card p-1">
        {tabs.map((t) => {
          const active = path === t.to || path.startsWith(t.to + "/");
          return (
            <Link
              key={t.to}
              to={t.to}
              className={cn(
                "flex-1 rounded-xl px-3 py-2 text-center text-sm font-bold transition-colors",
                active
                  ? "bg-primary text-primary-foreground shadow"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {t.label}
            </Link>
          );
        })}
        </nav>
      </div>

      <div className="mt-4"><Outlet /></div>
    </AppShell>
  );
}