import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, PackageX, CheckCircle2, ListChecks, Factory, PackagePlus, PartyPopper, ChevronRight, Plus, History,
} from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { statusOf, type InventoryItem, type InventoryStatus } from "@/lib/inventory";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/inventory/")({ component: InventoryHome });

function InventoryHome() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("inventory_items").select("*")
        .is("deleted_at", null).eq("is_archived", false).eq("is_active", true).order("name");
      if (error) toast.error(error.message);
      setItems((data ?? []) as InventoryItem[]);
      setLoading(false);
    })();
  }, []);

  const counts = useMemo(() => {
    const out = { ok: 0, low: 0, out: 0 };
    for (const i of items) out[statusOf(Number(i.current_quantity), Number(i.par_level)) as InventoryStatus]++;
    return out;
  }, [items]);

  return (
    <AppShell>
      <header className="mb-5 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Module</p>
          <h1 className="text-3xl font-black tracking-tight md:text-4xl">Inventory</h1>
          <p className="mt-1 text-sm text-muted-foreground">Command center for stock, batches & restocks.</p>
        </div>
        <Button asChild size="sm" className="rounded-full">
          <Link to="/inventory/new"><Plus className="h-4 w-4" /> New item</Link>
        </Button>
      </header>

      <section className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatusCard
          to="/inventory/list"
          search={{ status: "out" }}
          icon={PackageX}
          tone="danger"
          label="Reorder Now"
          subtitle="Below par"
          value={loading ? "—" : counts.out}
        />
        <StatusCard
          to="/inventory/list"
          search={{ status: "low" }}
          icon={AlertTriangle}
          tone="warn"
          label="Low Stock"
          subtitle="Within 20% of par"
          value={loading ? "—" : counts.low}
        />
        <StatusCard
          to="/inventory/list"
          search={{ status: "ok" }}
          icon={CheckCircle2}
          tone="ok"
          label="Good to Go"
          subtitle="Above par"
          value={loading ? "—" : counts.ok}
        />
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ActionCard to="/inventory/list" icon={ListChecks} title="View Inventory" desc="Full master library." />
        <ActionCard to="/inventory/log/batch" icon={Factory} title="Log Production Batch" desc="Ingredients used in a batch." />
        <ActionCard to="/inventory/log/restock" icon={PackagePlus} title="Log Restock" desc="Items received from supplier." />
        <ActionCard to="/inventory/log/event" icon={PartyPopper} title="Log Event" desc="Disposables & toppings used." />
        <ActionCard to="/inventory/history" icon={History} title="History" desc="All logs across items." />
      </section>
    </AppShell>
  );
}

function StatusCard({
  to, search, icon: Icon, tone, label, subtitle, value,
}: {
  to: string;
  search?: Record<string, string>;
  icon: typeof AlertTriangle;
  tone: "ok" | "warn" | "danger";
  label: string;
  subtitle: string;
  value: number | string;
}) {
  const toneCls =
    tone === "warn" ? "from-amber-500/15 to-amber-500/0 text-amber-600 dark:text-amber-300"
    : tone === "danger" ? "from-red-500/15 to-red-500/0 text-red-600 dark:text-red-300"
    : "from-emerald-500/15 to-emerald-500/0 text-emerald-600 dark:text-emerald-300";
  const dot =
    tone === "warn" ? "bg-amber-500" : tone === "danger" ? "bg-red-500" : "bg-emerald-500";
  return (
    <Link
      to={to}
      search={search as never}
      className={cn(
        "group rounded-3xl border bg-gradient-to-br p-4 shadow-sm transition-all hover:shadow-md active:scale-[0.99]",
        toneCls,
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn("h-2.5 w-2.5 rounded-full", dot)} />
          <Icon className="h-4 w-4" />
        </div>
        <ChevronRight className="h-4 w-4 opacity-50 transition-transform group-hover:translate-x-0.5" />
      </div>
      <p className="mt-3 text-3xl font-black text-foreground">{value}</p>
      <p className="text-sm font-bold text-foreground">{label}</p>
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{subtitle}</p>
    </Link>
  );
}

function ActionCard({
  to, icon: Icon, title, desc,
}: {
  to: string;
  icon: typeof ListChecks;
  title: string;
  desc: string;
}) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-3 rounded-3xl border bg-card p-4 shadow-sm transition-all hover:border-primary/40 hover:shadow-md active:scale-[0.99]"
    >
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-base font-bold">{title}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}