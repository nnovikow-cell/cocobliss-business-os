import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutGrid,
  Receipt,
  Boxes,
  ListChecks,
  CalendarDays,
  FlaskConical,
  TrendingUp,
  CheckSquare,
  Sparkles,
  Users,
  BookOpen,
  KeyRound,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = { to: string; label: string; icon: typeof LayoutGrid; exact?: boolean };
const items: NavItem[] = [
  { to: "/", label: "Hub", icon: LayoutGrid, exact: true },
  { to: "/events", label: "Events", icon: CalendarDays },
  { to: "/tasks", label: "Tasks", icon: CheckSquare },
  { to: "/meetings", label: "Meetings", icon: Users },
  { to: "/sales", label: "Sales", icon: Receipt },
  { to: "/inventory", label: "Inventory", icon: Boxes },
  { to: "/products", label: "Products", icon: FlaskConical },
  { to: "/simulate", label: "Simulate", icon: TrendingUp },
  { to: "/checklist", label: "Pack", icon: ListChecks },
  { to: "/sops", label: "SOPs", icon: BookOpen },
  { to: "/repository", label: "Repository", icon: KeyRound },
  { to: "/ai", label: "Coco", icon: Sparkles },
];

export function SideNav({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 hidden border-r border-border bg-card/95 backdrop-blur-md transition-[width] duration-200 md:flex md:flex-col",
        collapsed ? "w-16" : "w-56",
      )}
    >
      <div
        className={cn(
          "flex h-16 items-center border-b border-border px-3",
          collapsed ? "justify-center" : "justify-between",
        )}
      >
        {!collapsed && (
          <span className="text-sm font-black tracking-tight">CocoBliss</span>
        )}
        <button
          type="button"
          onClick={onToggle}
          className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>
      <ul className="flex-1 space-y-1 p-2">
        {items.map((it) => {
          const isMatch = it.exact ? path === it.to : path === it.to || path.startsWith(it.to + "/");
          // Only highlight the most specific matching nav item
          const moreSpecificMatch = items.some(
            (other) =>
              other.to !== it.to &&
              other.to.startsWith(it.to + "/") &&
              (path === other.to || path.startsWith(other.to + "/")),
          );
          const active = isMatch && !moreSpecificMatch;
          const Icon = it.icon;
          return (
            <li key={it.to}>
              <Link
                to={it.to as "/"}
                title={collapsed ? it.label : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors",
                  collapsed && "justify-center px-2",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {!collapsed && <span>{it.label}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}