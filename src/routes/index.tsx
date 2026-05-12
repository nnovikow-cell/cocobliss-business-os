import { createFileRoute, Link } from "@tanstack/react-router";
import { Receipt, Boxes, Calculator, Users, LogOut, Settings as SettingsIcon, ListChecks } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({ component: Index });

const modules = [
  { to: "/sales", title: "Sales Tracker", desc: "Live market sessions, fast logging, real-time revenue.", icon: Receipt, active: true },
  { to: "/checklist", title: "Event Checklist", desc: "Pack the van. Track who has what.", icon: ListChecks, active: true },
  { to: "/inventory", title: "Inventory", desc: "Track stock for shakes, paletas, and supplies.", icon: Boxes, active: false },
  { to: "/costs", title: "Cost Calculator", desc: "Recipes, COGS, margins.", icon: Calculator, active: false },
  { to: "/meetings", title: "Meetings & Decisions", desc: "Notes and action items.", icon: Users, active: false },
];

function Index() {
  const { user, signOut } = useAuth();
  return (
    <AppShell>
      <header className="mb-6 flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Welcome back</p>
          <h1 className="text-3xl font-black tracking-tight text-foreground">CocoBLiss OS</h1>
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {modules.map((m) => {
          const Icon = m.icon;
          const card = (
            <div
              className={`group relative h-full rounded-3xl border-2 border-border bg-card p-5 transition-all ${
                m.active ? "hover:-translate-y-0.5 hover:border-primary hover:shadow-xl" : "opacity-60"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="rounded-2xl bg-secondary p-3">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                {!m.active && (
                  <span className="rounded-full bg-muted px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Soon
                  </span>
                )}
              </div>
              <h3 className="mt-4 text-lg font-bold text-foreground">{m.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{m.desc}</p>
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
