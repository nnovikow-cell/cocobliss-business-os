import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Search, ArrowLeft, Pencil, Plus, RotateCcw } from "lucide-react";
import { z } from "zod";
import { AppShell } from "@/components/app/app-shell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { useAuth } from "@/hooks/use-auth";
import {
  CATEGORY_V2_LABEL, CATEGORY_V2_VALUES, WORKFLOW_LABEL,
  statusMeta, statusOf,
  type InventoryCategoryV2, type InventoryItem, type InventoryStatus, type WorkflowTag,
} from "@/lib/inventory";
import { cn } from "@/lib/utils";
import { InventoryItemDrawer } from "@/components/inventory/item-drawer";

const search = z.object({
  status: z.enum(["all", "ok", "low", "out"]).optional(),
  category: z.string().optional(),
  workflow: z.string().optional(),
  new: z.string().optional(),
}).optional();

export const Route = createFileRoute("/inventory/list")({
  component: InventoryList,
  validateSearch: (s) => search.parse(s) ?? {},
});

type Sort = "name" | "stock_asc" | "stock_desc" | "restocked";

function InventoryList() {
  const sp = Route.useSearch();
  const navigate = Route.useNavigate();
  const { user } = useAuth();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("name");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerItemId, setDrawerItemId] = useState<string | null>(null);
  const [historyItem, setHistoryItem] = useState<InventoryItem | null>(null);
  const [historyLogs, setHistoryLogs] = useState<LogRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [confirmLog, setConfirmLog] = useState<LogRow | null>(null);

  const status = (sp?.status ?? "all") as "all" | InventoryStatus;
  const category = (sp?.category ?? "all") as "all" | InventoryCategoryV2;
  const workflow = (sp?.workflow ?? "all") as "all" | WorkflowTag;

  const update = (patch: Partial<typeof sp>) => navigate({ search: { ...(sp ?? {}), ...patch } as never });

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("inventory_items").select("*")
        .is("deleted_at", null).eq("is_archived", false).order("name");
      if (error) toast.error(error.message);
      setItems((data ?? []) as InventoryItem[]);
      setLoading(false);
    })();
  }, [drawerOpen]);

  useEffect(() => {
    if (sp?.new === "1" && !drawerOpen) {
      setDrawerItemId(null);
      setDrawerOpen(true);
      navigate({ search: { ...(sp ?? {}), new: undefined } as never, replace: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp?.new]);

  const enriched = useMemo(() => items.map((i) => ({
    ...i,
    current_quantity: Number(i.current_quantity),
    par_level: Number(i.par_level),
    status: statusOf(Number(i.current_quantity), Number(i.par_level)),
  })), [items]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    let r = enriched.filter((i) => {
      if (status !== "all" && i.status !== status) return false;
      if (category !== "all" && (i.category_v2 ?? "other") !== category) return false;
      if (workflow !== "all" && !(i.workflow_tags ?? []).includes(workflow) && !(i.workflow_tags ?? []).includes("all")) return false;
      if (term && !i.name.toLowerCase().includes(term)) return false;
      return true;
    });
    if (sort === "name") r = r.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "stock_asc") r = r.sort((a, b) => a.current_quantity / (a.par_level || 1) - b.current_quantity / (b.par_level || 1));
    if (sort === "stock_desc") r = r.sort((a, b) => b.current_quantity / (b.par_level || 1) - a.current_quantity / (a.par_level || 1));
    if (sort === "restocked") r = r.sort((a, b) => (b.last_restocked_at ?? "").localeCompare(a.last_restocked_at ?? ""));
    return r;
  }, [enriched, q, status, category, workflow, sort]);

  const openHistory = async (it: InventoryItem) => {
    setHistoryItem(it);
    setHistoryLoading(true);
    const { data, error } = await supabase
      .from("inventory_logs")
      .select("*")
      .eq("item_id", it.id)
      .is("reverted_at", null)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setHistoryLogs((data ?? []) as LogRow[]);
    setHistoryLoading(false);
  };

  const doRevert = async (log: LogRow) => {
    if (!historyItem) return;
    const curItem = items.find((i) => i.id === historyItem.id);
    if (!curItem) return;
    const qty = Number(log.quantity);
    const cur = Number(curItem.current_quantity);
    const newQty =
      log.kind === "restock" ? cur - qty : cur + qty;
    const { error: e1 } = await supabase
      .from("inventory_logs")
      .update({ reverted_at: new Date().toISOString(), reverted_by: user?.id ?? null })
      .eq("id", log.id);
    if (e1) return toast.error(e1.message);
    const { error: e2 } = await supabase
      .from("inventory_items")
      .update({ current_quantity: Math.max(0, newQty) })
      .eq("id", historyItem.id);
    if (e2) return toast.error(e2.message);
    setHistoryLogs((prev) => prev.filter((l) => l.id !== log.id));
    setItems((prev) => prev.map((i) =>
      i.id === historyItem.id ? { ...i, current_quantity: Math.max(0, newQty) } : i,
    ));
    setConfirmLog(null);
    toast.success("Log reverted — quantity adjusted");
  };

  return (
    <AppShell>
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <Link to="/inventory" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Inventory
          </Link>
          <h1 className="mt-2 text-2xl font-black tracking-tight md:text-3xl">Master Library</h1>
        </div>
        <Button size="sm" className="rounded-full" onClick={() => { setDrawerItemId(null); setDrawerOpen(true); }}>
          <Plus className="h-4 w-4" /> New item
        </Button>
      </header>

      <div className="mb-3 grid gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search items…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {(["all", ...CATEGORY_V2_VALUES] as const).map((c) => {
            const active = category === c;
            const label = c === "all" ? "All" : CATEGORY_V2_LABEL[c as InventoryCategoryV2];
            return (
              <button
                key={c}
                type="button"
                onClick={() => update({ category: c === "all" ? undefined : c })}
                className={cn(
                  "shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Select value={workflow} onValueChange={(v) => update({ workflow: v === "all" ? undefined : v })}>
            <SelectTrigger><SelectValue placeholder="Workflow" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All workflows</SelectItem>
              <SelectItem value="production_batch">{WORKFLOW_LABEL.production_batch}</SelectItem>
              <SelectItem value="log_event">{WORKFLOW_LABEL.log_event}</SelectItem>
              <SelectItem value="restock">{WORKFLOW_LABEL.restock}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(v) => update({ status: v === "all" ? undefined : (v as InventoryStatus) })}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any status</SelectItem>
              <SelectItem value="ok">In stock</SelectItem>
              <SelectItem value="low">Low stock</SelectItem>
              <SelectItem value="out">Below par</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
            <SelectTrigger><SelectValue placeholder="Sort" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Name (A–Z)</SelectItem>
              <SelectItem value="stock_asc">Stock: lowest first</SelectItem>
              <SelectItem value="stock_desc">Stock: highest first</SelectItem>
              <SelectItem value="restocked">Last restocked</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted/50" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          No items match. Try a different filter.
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((i) => {
            const meta = statusMeta[i.status];
            const code = (i as unknown as { library_code: string | null }).library_code;
            return (
              <li key={i.id} className="rounded-2xl border bg-card p-3 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => openHistory(i)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span className={cn("h-2.5 w-2.5 rounded-full", meta.dot)} />
                      <h3 className="truncate text-base font-semibold">{i.name}</h3>
                      <span className="ml-1 truncate font-mono text-xs text-muted-foreground">
                        {code || "—"}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="rounded-full bg-secondary px-2 py-0.5 font-medium text-foreground">
                        {CATEGORY_V2_LABEL[(i.category_v2 ?? "other") as InventoryCategoryV2]}
                      </span>
                      {(i.workflow_tags ?? []).filter((t) => t !== "all").map((t) => (
                        <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                          {WORKFLOW_LABEL[t as WorkflowTag]}
                        </span>
                      ))}
                      <span className={cn("rounded-full border px-2 py-0.5 font-medium", meta.classes)}>{meta.label}</span>
                    </div>
                    <p className="mt-1.5 text-sm">
                      {(() => {
                        const pkg = toPackages(i);
                        const par = toPackages(i, i.par_level);
                        return (
                          <>
                            <span className="font-semibold">{pkg.display}</span>
                            {pkg.isPackage && (
                              <span className="text-muted-foreground text-xs"> ({formatQty(Number(i.current_quantity))} {i.unit})</span>
                            )}
                            <span className="text-muted-foreground"> / par {par.display}</span>
                            {par.isPackage && (
                              <span className="text-muted-foreground text-xs"> ({formatQty(Number(i.par_level))} {i.unit})</span>
                            )}
                          </>
                        );
                      })()}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {i.last_restocked_at ? `Restocked ${new Date(i.last_restocked_at).toLocaleDateString()}` : "Never restocked"}
                    </p>
                  </button>
                  <div className="flex flex-col items-end gap-1">
                    <button
                      type="button"
                      onClick={() => { setDrawerItemId(i.id); setDrawerOpen(true); }}
                      className="rounded-full p-2 text-muted-foreground hover:bg-muted"
                      aria-label="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <Link to="/inventory/$itemId" params={{ itemId: i.id }} className="rounded-full p-2 text-muted-foreground hover:bg-muted" aria-label="Open">
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <InventoryItemDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        itemId={drawerItemId}
      />

      <Sheet open={!!historyItem} onOpenChange={(v) => !v && setHistoryItem(null)}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{historyItem?.name} — History</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-2">
            {historyLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-20 animate-pulse rounded-xl bg-muted/50" />
                ))}
              </div>
            ) : historyLogs.length === 0 ? (
              <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                No log entries yet.
              </p>
            ) : (
              historyLogs.map((log) => {
                const kindMeta = LOG_KIND_META[log.kind] ?? LOG_KIND_META.use;
                const isRestock = log.kind === "restock";
                const sign = isRestock ? "+" : "−";
                const unit = historyItem?.unit ?? "";
                const pkgSize = Number(historyItem?.package_size);
                const pkgType = historyItem?.package_type?.trim() || null;
                const hasPkg = !!pkgSize && !!pkgType;
                const qtyPkgs = hasPkg ? Number(log.quantity) / pkgSize : null;
                const qtyAfterPkgs = hasPkg ? Number(log.quantity_after) / pkgSize : null;
                return (
                  <div key={log.id} className="flex items-start justify-between gap-3 rounded-xl border bg-card p-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-semibold", kindMeta.classes)}>
                          {kindMeta.label}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(log.created_at), "MMM d, yyyy · h:mm a")}
                        </span>
                      </div>
                      <p className="mt-1.5 text-sm font-semibold">
                        {hasPkg ? (
                          <>
                            {sign}{qtyPkgs!.toFixed(2)} {pkgType}{qtyPkgs !== 1 ? "s" : ""}
                            <span className="ml-1 text-xs font-normal text-muted-foreground">
                              ({Number(log.quantity)} {unit})
                            </span>
                          </>
                        ) : (
                          <>{sign}{Number(log.quantity)} {unit}</>
                        )}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        On hand after: {hasPkg
                          ? `${qtyAfterPkgs!.toFixed(2)} ${pkgType}${qtyAfterPkgs !== 1 ? "s" : ""} (${Number(log.quantity_after)} ${unit})`
                          : `${Number(log.quantity_after)} ${unit}`}
                      </p>
                      {log.note && (
                        <p className="mt-1 text-xs text-muted-foreground">{log.note}</p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setConfirmLog(log)}
                      aria-label="Revert"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        </SheetContent>
      </Sheet>

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

function formatQty(n: number) {
  return Number.isInteger(n) ? n.toString() : n.toFixed(2).replace(/\.?0+$/, "");
}

function toPackages(item: InventoryItem, qty?: number) {
  const raw = qty !== undefined ? Number(qty) : Number(item.current_quantity);
  const pkgSize = Number(item.package_size);
  const pkgType = item.package_type?.trim() || null;
  if (!pkgSize || !pkgType) {
    return { display: `${formatQty(raw)} ${item.unit}`, isPackage: false };
  }
  const pkgs = raw / pkgSize;
  return { display: `${formatQty(pkgs)} ${pkgType}${pkgs !== 1 ? "s" : ""}`, isPackage: true };
}

type LogRow = {
  id: string;
  item_id: string;
  kind: "use" | "restock" | "production_batch" | "event_use";
  quantity: number;
  quantity_after: number;
  note: string | null;
  created_at: string;
};

const LOG_KIND_META: Record<LogRow["kind"], { label: string; classes: string }> = {
  restock: { label: "Restock", classes: "border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  event_use: { label: "Event use", classes: "border-orange-500/30 bg-orange-500/15 text-orange-700 dark:text-orange-300" },
  production_batch: { label: "Production batch", classes: "border-teal-500/30 bg-teal-500/15 text-teal-700 dark:text-teal-300" },
  use: { label: "Manual use", classes: "border-muted-foreground/30 bg-muted text-muted-foreground" },
};