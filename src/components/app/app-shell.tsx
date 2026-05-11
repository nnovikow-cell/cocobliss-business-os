import type { ReactNode } from "react";
import { Protected } from "./protected";
import { BottomNav } from "./bottom-nav";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <Protected>
      <div className="min-h-screen bg-background pb-24">
        <div className="mx-auto max-w-3xl px-4 pt-4">{children}</div>
        <BottomNav />
      </div>
    </Protected>
  );
}