import { createFileRoute, Link } from "@tanstack/react-router";
import { Receipt, Boxes, Calculator, Users, LogOut, Settings as SettingsIcon, ListChecks, CalendarDays } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({ component: Index });

const modules = [
  { to: "/events", title: "Events", desc: "Schedule, history, and recurring series.", icon: CalendarDays, active: true },
  { to: "/sales", title: "Sales Tracker", desc: "Live market sessions, fast logging, real-time revenue.", icon: Receipt, active: true },
  { to: "/checklist", title: "Event Checklist", desc: "Pack the van. Track who has what.", icon: ListChecks, active: true },
  { to: "/inventory", title: "Inventory", desc: "Consumables and disposables, par-level tracking.", icon: Boxes, active: true },
  { to: "/costs", title: "Cost Calculator", desc: "Ingredients, recipes, COGS, margins.", icon: Calculator, active: true },
  { to: "/meetings", title: "Meetings & Decisions", desc: "Notes and action items.", icon: Users, active: false },
];

function Index() {
  const { user, signOut } = useAuth();
  return (
    <AppShell>
      <header className="mb-6 flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Welcome back</p>
          <h1 className="text-3xl font-black tracking-tight text-foreground mx-0">CocoBliss OS</h1>
          <p className="mt-1 text-sm text-muted-foreground">{user?.email}</p>
        </div>
        <div className="flex items-center gap-1">
          <Link to="/settings" className="rounded-full p-2 hover:bg-muted" aria-label="Settings">
            <SettingsIcon className="h-5 w-5" />
          </Link>
          <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out">
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <div
        className="mb-6 rounded-3xl p-6 text-white shadow-xl"
        style={{ background: "var(--gradient-hero)" }}
      >
        <p className="text-xs font-semibold uppercase tracking-wider opacity-90">Module Hub</p>
        <h2 className="mt-1 text-2xl font-bold">Pick a module to get to work.</h2>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {modules.map((m) => {
          const Icon = m.icon;
          const card = (
            <div
              className={`group relative aspect-square h-full rounded-2xl border-2 border-border bg-card p-3 transition-all ${
                m.active ? "hover:-translate-y-0.5 hover:border-primary hover:shadow-xl" : "opacity-60"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="rounded-xl bg-secondary p-2">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                {!m.active && (
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                    Soon
                  </span>
                )}
              </div>
              <h3 className="mt-2 text-sm font-bold leading-tight text-foreground">{m.title}</h3>
              <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">{m.desc}</p>
            </div>
          );
          return m.active ? (
            <Link key={m.to} to={m.to as "/sales"} className="block">{card}</Link>
          ) : (
            <div key={m.to}>{card}</div>
          );
        })}
      </div>
    </AppShell>
  );
}
