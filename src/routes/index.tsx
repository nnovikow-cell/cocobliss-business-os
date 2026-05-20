import { createFileRoute, Link } from "@tanstack/react-router";
import { Receipt, Boxes, LogOut, Settings as SettingsIcon, ListChecks, CalendarDays, FlaskConical, TrendingUp, CheckSquare, Sparkles, Users, BookOpen, KeyRound, LayoutGrid, List as ListIcon, FileText } from "lucide-react";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app/app-shell";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({ component: Index });

const modules = [
  { to: "/events", title: "Events", desc: "Schedule, history, and recurring series.", icon: CalendarDays, active: true, primary: true },
  { to: "/tasks", title: "Tasks", desc: "Weekly to-dos by day, owner, and category.", icon: CheckSquare, active: true, primary: true },
  { to: "/meetings", title: "Meetings", desc: "Decisions, action items, and meeting history.", icon: Users, active: true, primary: false },
  { to: "/invoices", title: "Invoices", desc: "Track invoices and payment status.", icon: FileText, active: true, primary: false },
  { to: "/sales", title: "Sales Tracker", desc: "Live market sessions, fast logging, real-time revenue.", icon: Receipt, active: true, primary: true },
  { to: "/inventory", title: "Inventory", desc: "Consumables and disposables, par-level tracking.", icon: Boxes, active: true, primary: true },
  { to: "/checklist", title: "Event Checklist", desc: "Pack the van. Track who has what.", icon: ListChecks, active: true, primary: true },
  { to: "/sops", title: "SOPs", desc: "Standard procedures for production, events, and ops.", icon: BookOpen, active: true, primary: false },
  { to: "/repository", title: "Repository", desc: "Accounts, passwords, and credentials by category.", icon: KeyRound, active: true, primary: false },
  { to: "/products", title: "Products", desc: "Build formulas, version recipes, cost per serving.", icon: FlaskConical, active: true, primary: false },
  { to: "/simulate", title: "Simulate", desc: "What-if profit, margin, and break-even scenarios.", icon: TrendingUp, active: true, primary: false },
  { to: "/ai", title: "Coco", desc: "Ask questions, get insights across your business.", icon: Sparkles, active: false, primary: false },
];

function Index() {
  const { user, signOut } = useAuth();
  const [view, setView] = useState<"cards" | "list">("cards");

  useEffect(() => {
    const saved = localStorage.getItem("cocobliss_hub_view");
    if (saved === "cards" || saved === "list") setView(saved);
  }, []);

  const toggleView = () => {
    const next = view === "cards" ? "list" : "cards";
    setView(next);
    localStorage.setItem("cocobliss_hub_view", next);
  };
  return (
    <AppShell>
      <header className="mb-6 flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Welcome back</p>
          <h1 className="text-3xl font-black tracking-tight text-foreground mx-0">CocoBliss OS</h1>
          <p className="mt-1 text-sm text-muted-foreground">{user?.email}</p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={toggleView} aria-label="Toggle view">
            {view === "cards" ? <ListIcon className="h-5 w-5" /> : <LayoutGrid className="h-5 w-5" />}
          </Button>
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
         <h2 className="mt-1 text-2xl font-bold">Hey! Let's fucking make the greatest beverage brand today.</h2>
      </div>

      {view === "cards" ? (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {modules.map((m) => {
          const Icon = m.icon;
          const card = (
            <div
              className={`group relative aspect-square h-full rounded-2xl border-2 bg-card p-3 transition-all ${
                m.primary ? "border-primary/30 bg-primary/5 shadow-md" : "border-border"
              } ${
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
      ) : (
        <div className="flex flex-col gap-2">
          {modules.map((m) => {
            const Icon = m.icon;
            const row = (
              <div
                className={`flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-all ${
                  m.active ? "hover:border-primary" : "opacity-60"
                }`}
              >
                <div className="rounded-lg bg-secondary p-2">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-foreground">{m.title}</h3>
                    {!m.active && (
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                        Soon
                      </span>
                    )}
                  </div>
                  <p className="truncate text-[11px] leading-snug text-muted-foreground">{m.desc}</p>
                </div>
              </div>
            );
            return m.active ? (
              <Link key={m.to} to={m.to as "/sales"} className="block">{row}</Link>
            ) : (
              <div key={m.to}>{row}</div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
