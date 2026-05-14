import { useState, type ReactNode } from "react";
import { Protected } from "./protected";
import { BottomNav } from "./bottom-nav";
import { SideNav } from "./side-nav";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <Protected>
      <div className="min-h-screen bg-background pb-24 md:pb-0">
        <SideNav collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />
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