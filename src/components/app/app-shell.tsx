import { useState, type ReactNode } from "react";
import { Protected } from "./protected";
import { BottomNav } from "./bottom-nav";
import { SideNav } from "./side-nav";
import { ThemeToggle } from "./theme-toggle";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <Protected>
      <div className="min-h-screen bg-background pb-24 md:pb-0">
        <SideNav collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />
        <div className="fixed right-3 top-3 z-50 md:hidden">
          <ThemeToggle className="rounded-full bg-card/90 shadow-sm backdrop-blur-md" />
        </div>
        <div
          className={cn(
            "transition-[padding] duration-200",
            collapsed ? "md:pl-16" : "md:pl-56",
          )}
        >
          <div data-app-shell className="mx-auto max-w-3xl px-4 pt-4">{children}</div>
        </div>
        <BottomNav />
      </div>
    </Protected>
  );
}