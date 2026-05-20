import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, RotateCcw, Search, BarChart2, List as ListIcon } from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";
import { AppShell } from "@/components/app/app-shell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, subDays } from "date-fns";
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

type ItemMeta = {
  id: string;
  name: string;
  unit: string;
  package_size: number | null;
  package_type: string | null;
  current_quantity: number;
};

type GraphRange = "30d" | "90d" | "all";
const GRAPH_RANGES: { value: GraphRange; label: string }[] = [
  { value: "30d", label: "30d" },
  { value: "90d", label: "90d" },
  { value: "all", label: "All" },
];
const SERIES_COLORS = ["#0d9488", "#f97316", "#8b5cf6", "#ec4899", "#eab308"];

function InventoryHistory() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<KindFilter>("all");
  const [confirmLog, setConfirmLog] = useState<LogRow | null>(null);
  const [view, setView] = useState<"list" | "graph">("list");
  const [items, setItems] = useState<ItemMeta[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [range, setRange] = useState<GraphRange>("90d");
  const [graphLogs, setGraphLogs] = useState<Array<{ item_id: string; quantity_after: number; created_at: string }>>([]);
  const [graphLoading, setGraphLoading] = useState(false);

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

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("id, name, unit, package_size, package_type, current_quantity")
        .is("deleted_at", null)
        .order("name");
      if (error) return toast.error(error.message);
      const list = (data ?? []) as unknown as ItemMeta[];
      setItems(list);
      setSelectedIds((prev) => (prev.length === 0 && list[0] ? [list[0].id] : prev));
    })();
  }, []);

  useEffect(() => {
    if (view !== "graph" || selectedIds.length === 0) return;
    (async () => {
      setGraphLoading(true);
      const cutoff = range === "30d"
        ? subDays(new Date(), 30).toISOString()
        : range === "90d"
        ? subDays(new Date(), 90).toISOString()
        : null;
      let q2 = supabase
        .from("inventory_logs")
        .select("item_id, quantity_after, created_at")
        .in("item_id", selectedIds)
        .is("reverted_at", null)
        .order("created_at", { ascending: true });
      if (cutoff) q2 = q2.gte("created_at", cutoff);
      const { data, error } = await q2;
      if (error) toast.error(error.message);
      setGraphLogs((data ?? []) as Array<{ item_id: string; quantity_after: number; created_at: string }>);
      setGraphLoading(false);
    })();
  }, [view, selectedIds, range]);

  const selectedItems = useMemo(
    () => selectedIds.map((id) => items.find((i) => i.id === id)).filter(Boolean) as ItemMeta[],
    [selectedIds, items],
  );

  const toPkgs = (item: ItemMeta, raw: number) => {
    const ps = Number(item.package_size);
    if (!ps) return Math.round(raw * 100) / 100;
    return Math.round((raw / ps) * 100) / 100;
  };

  const chartData = useMemo(() => {
    if (selectedItems.length === 0) return [];
    // group logs by item
    const byItem = new Map<string, Array<{ ts: number; date: string; value: number; raw: number }>>();
    for (const item of selectedItems) byItem.set(item.id, []);
    for (const log of graphLogs) {
      const item = selectedItems.find((i) => i.id === log.item_id);
      if (!item) continue;
      const ts = new Date(log.created_at).getTime();
      byItem.get(item.id)!.push({
        ts,
        date: format(new Date(log.created_at), "MMM d"),
        value: toPkgs(item, Number(log.quantity_after)),
        raw: Number(log.quantity_after),
      });
    }
    // fallback flat line for empty series
    const allTs = new Set<number>();
    for (const arr of byItem.values()) arr.forEach((p) => allTs.add(p.ts));
    if (allTs.size === 0) {
      const now = Date.now();
      allTs.add(now);
    }
    const sortedTs = Array.from(allTs).sort((a, b) => a - b);
    return sortedTs.map((ts) => {
      const row: Record<string, string | number> = {
        ts,
        date: format(new Date(ts), "MMM d"),
      };
      for (const item of selectedItems) {
        const points = byItem.get(item.id)!;
        // find latest point at or before ts
        let val: number | null = null;
        let raw: number | null = null;
        for (const p of points) {
          if (p.ts <= ts) { val = p.value; raw = p.raw; } else break;
        }
        if (val === null) {
          // no logs yet — use current_quantity as flat baseline
          val = toPkgs(item, Number(item.current_quantity));
          raw = Number(item.current_quantity);
        }
        row[item.id] = val;
        row[`${item.id}__raw`] = raw!;
      }
      return row;
    });
  }, [selectedItems, graphLogs]);

  const toggleItem = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 5) {
        toast.error("Max 5 items at once");
        return prev;
      }
      return [...prev, id];
    });
  };

  const yLabel = selectedItems[0]?.package_type
    ? `${selectedItems[0].package_type}s on hand`
    : "On hand";

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
        <div className="mt-2 flex items-center justify-between gap-3">
          <h1 className="text-2xl font-black tracking-tight md:text-3xl">Inventory History</h1>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setView((v) => (v === "list" ? "graph" : "list"))}
            aria-label={view === "list" ? "Switch to graph view" : "Switch to list view"}
          >
            {view === "list" ? <><BarChart2 className="h-4 w-4" /> Graph</> : <><ListIcon className="h-4 w-4" /> List</>}
          </Button>
        </div>
      </header>

      {view === "list" ? (
        <>
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
        </>
      ) : (
        <div className="space-y-3">
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {items.map((it) => {
              const idx = selectedIds.indexOf(it.id);
              const active = idx >= 0;
              const color = active ? SERIES_COLORS[idx % SERIES_COLORS.length] : undefined;
              return (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => toggleItem(it.id)}
                  className={cn(
                    "shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                    active
                      ? "text-white border-transparent"
                      : "border-border bg-card text-muted-foreground hover:text-foreground",
                  )}
                  style={active ? { backgroundColor: color, borderColor: color } : undefined}
                >
                  {it.name}
                </button>
              );
            })}
          </div>
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {GRAPH_RANGES.map((r) => {
              const active = range === r.value;
              return (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setRange(r.value)}
                  className={cn(
                    "shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:text-foreground",
                  )}
                >
                  {r.label}
                </button>
              );
            })}
          </div>

          {selectedItems.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
              Select at least one item to view its stock history.
            </div>
          ) : (
            <div className="rounded-2xl border bg-card p-3">
              <div className="overflow-x-auto">
                <div className="min-w-[320px]" style={{ height: 320 }}>
                  {graphLoading ? (
                    <div className="h-full animate-pulse rounded-xl bg-muted/50" />
                  ) : (
                    <ResponsiveContainer width="100%" height={320}>
                      <LineChart data={chartData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis
                          tick={{ fontSize: 11 }}
                          label={{ value: yLabel, angle: -90, position: "insideLeft", style: { fontSize: 11, fill: "hsl(var(--muted-foreground))" } }}
                        />
                        <Tooltip
                          content={({ active, payload, label }) => {
                            if (!active || !payload || payload.length === 0) return null;
                            return (
                              <div className="rounded-lg border bg-popover p-2 text-xs shadow">
                                <div className="mb-1 font-semibold">{label}</div>
                                {payload.map((p) => {
                                  const item = selectedItems.find((i) => i.id === p.dataKey);
                                  if (!item) return null;
                                  const raw = (p.payload as Record<string, number>)[`${item.id}__raw`];
                                  const pkgType = item.package_type?.trim() || item.unit;
                                  return (
                                    <div key={item.id} className="flex items-center gap-2">
                                      <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: p.color as string }} />
                                      <span>{item.name}: <strong>{fmt(Number(p.value))} {pkgType}</strong>
                                        <span className="text-muted-foreground"> ({fmt(Number(raw))} {item.unit})</span>
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        {selectedItems.map((item, idx) => (
                          <Line
                            key={item.id}
                            type="stepAfter"
                            dataKey={item.id}
                            name={item.name}
                            stroke={SERIES_COLORS[idx % SERIES_COLORS.length]}
                            strokeWidth={2}
                            dot={{ r: 3 }}
                            connectNulls
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
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