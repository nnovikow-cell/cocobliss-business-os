import type { ReactNode } from "react";

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}