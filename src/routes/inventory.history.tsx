import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, RotateCcw, Search } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/inventory/history")({ component: InventoryHistory });

type LogKind = "use" | "restock" | "production_batch" | "event_use";

type LogRow = {
  id: string;
  item_id: string;
  kind: LogKind;
  quantity: number;
  quantity_after: number;
  note: string | null;
  created_at: string;
  inventory_items: {
    name: string;
    unit: string;
    package_size: number | null;
    package_type: string | null;
    library_code: string | null;
  } | null;
};

const KIND_META: Record<LogKind, { label: string; classes: string }> = {
  restock: { label: "Restock", classes: "border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  event_use: { label: "Event Use", classes: "border-orange-500/30 bg-orange-500/15 text-orange-700 dark:text-orange-300" },
  production_batch: { label: "Production Batch", classes: "border-teal-500/30 bg-teal-500/15 text-teal-700 dark:text-teal-300" },
  use: { label: "Manual Use", classes: "border-muted-foreground/30 bg-muted text-muted-foreground" },
};

type KindFilter = "all" | LogKind;
const KIND_FILTERS: { value: KindFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "restock", label: "Restock" },
  { value: "event_use", label: "Event Use" },
  { value: "production_batch", label: "Production Batch" },
];

function fmt(n: number) {
  return Number.isInteger(n) ? n.toString() : n.toFixed(2).replace(/\.?0+$/, "");
}

function InventoryHistory() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<KindFilter>("all");
  const [confirmLog, setConfirmLog] = useState<LogRow | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("inventory_logs")
        .select("*, inventory_items(name, unit, package_size, package_type, library_code)")
        .is("reverted_at", null)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) toast.error(error.message);
      setLogs((data ?? []) as unknown as LogRow[]);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return logs.filter((l) => {
      if (kind !== "all" && l.kind !== kind) return false;
      if (term && !(l.inventory_items?.name ?? "").toLowerCase().includes(term)) return false;
      return true;
    });
  }, [logs, q, kind]);

  const doRevert = async (log: LogRow) => {
    // fetch latest item qty
    const { data: item, error: e0 } = await supabase
      .from("inventory_items")
      .select("current_quantity")
      .eq("id", log.item_id)
      .single();
    if (e0 || !item) return toast.error(e0?.message ?? "Item not found");
    const cur = Number(item.current_quantity);
    const qty = Number(log.quantity);
    const newQty = log.kind === "restock" ? cur - qty : cur + qty;
    const { error: e1 } = await supabase
      .from("inventory_logs")
      .update({ reverted_at: new Date().toISOString(), reverted_by: user?.id ?? null })
      .eq("id", log.id);
    if (e1) return toast.error(e1.message);
    const { error: e2 } = await supabase
      .from("inventory_items")
      .update({ current_quantity: Math.max(0, newQty) })
      .eq("id", log.item_id);
    if (e2) return toast.error(e2.message);
    setLogs((prev) => prev.filter((l) => l.id !== log.id));
    setConfirmLog(null);
    toast.success("Log reverted — quantity adjusted");
  };

  return (
    <AppShell>
      <header className="mb-4">
        <Link to="/inventory" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Inventory
        </Link>
        <h1 className="mt-2 text-2xl font-black tracking-tight md:text-3xl">Inventory History</h1>
      </header>

      <div className="mb-3 grid gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search by item…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {KIND_FILTERS.map((k) => {
            const active = kind === k.value;
            return (
              <button
                key={k.value}
                type="button"
                onClick={() => setKind(k.value)}
                className={cn(
                  "shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                {k.label}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted/50" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          No logs yet.
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((log) => {
            const meta = KIND_META[log.kind] ?? KIND_META.use;
            const item = log.inventory_items;
            const unit = item?.unit ?? "";
            const pkgSize = Number(item?.package_size);
            const pkgType = item?.package_type?.trim() || null;
            const hasPkg = !!pkgSize && !!pkgType;
            const sign = log.kind === "restock" ? "+" : "−";
            const qty = Number(log.quantity);
            const qtyPkgs = hasPkg ? qty / pkgSize : null;
            return (
              <li key={log.id} className="flex items-start justify-between gap-3 rounded-2xl border bg-card p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-bold">{item?.name ?? "—"}</span>
                    <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-semibold", meta.classes)}>
                      {meta.label}
                    </span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {format(new Date(log.created_at), "MMM d, yyyy · h:mm a")}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm font-semibold">
                    {hasPkg ? (
                      <>
                        {sign}{fmt(qtyPkgs!)} {pkgType}{qtyPkgs !== 1 ? "s" : ""}
                        <span className="ml-1 text-xs font-normal text-muted-foreground">
                          ({qty} {unit})
                        </span>
                      </>
                    ) : (
                      <>{sign}{qty} {unit}</>
                    )}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    On hand after: {Number(log.quantity_after)} {unit}
                    {log.note ? ` · ${log.note}` : ""}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setConfirmLog(log)}
                  aria-label="Revert"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <AlertDialog open={!!confirmLog} onOpenChange={(v) => !v && setConfirmLog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revert this log entry?</AlertDialogTitle>
            <AlertDialogDescription>
              The quantity on hand will be adjusted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmLog && doRevert(confirmLog)}>
              Revert
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}