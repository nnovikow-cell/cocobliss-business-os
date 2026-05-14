import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutGrid, Receipt, Boxes, ListChecks, CheckSquare } from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = { to: string; label: string; icon: typeof LayoutGrid; exact?: boolean };
const items: NavItem[] = [
  { to: "/", label: "Hub", icon: LayoutGrid, exact: true },
  { to: "/tasks", label: "Tasks", icon: CheckSquare },
  { to: "/sales", label: "Sales", icon: Receipt },
  { to: "/inventory", label: "Inventory", icon: Boxes },
  { to: "/checklist", label: "Pack", icon: ListChecks },
];

export function BottomNav() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)] md:hidden">
      <ul className="mx-auto flex max-w-3xl items-stretch justify-around">
        {items.map((it) => {
          const active = it.exact ? path === it.to : path.startsWith(it.to);
          const Icon = it.icon;
          return (
            <li key={it.to} className="flex-1">
              <Link
                to={it.to as "/"}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 py-3 text-xs font-semibold transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className={cn("h-6 w-6", active && "scale-110")} />
                <span>{it.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}