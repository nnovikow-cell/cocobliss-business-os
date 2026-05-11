import { AppShell } from "./app-shell";
import type { LucideIcon } from "lucide-react";

export function PlaceholderModule({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
}) {
  return (
    <AppShell>
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <div className="rounded-3xl bg-secondary p-6">
          <Icon className="h-10 w-10 text-primary" />
        </div>
        <h1 className="mt-6 text-2xl font-bold">{title}</h1>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">{description}</p>
        <span className="mt-6 rounded-full bg-accent px-4 py-2 text-xs font-bold uppercase tracking-wider text-accent-foreground">
          Coming soon
        </span>
      </div>
    </AppShell>
  );
}