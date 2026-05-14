import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Search, ArrowLeft, Pencil } from "lucide-react";
import { z } from "zod";
import { AppShell } from "@/components/app/app-shell";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  CATEGORY_V2_LABEL, CATEGORY_V2_VALUES, WORKFLOW_LABEL,
  statusMeta, statusOf,
  type InventoryCategoryV2, type InventoryItem, type InventoryStatus, type WorkflowTag,
} from "@/lib/inventory";
import { cn } from "@/lib/utils";

const search = z.object({
  status: z.enum(["all", "ok", "low", "out"]).optional(),
  category: z.string().optional(),
  workflow: z.string().optional(),
}).optional();

export const Route = createFileRoute("/inventory/list")({
  component: InventoryList,
  validateSearch: (s) => search.parse(s) ?? {},
});

type Sort = "name" | "stock_asc" | "stock_desc" | "restocked";

function InventoryList() {
  const sp = Route.useSearch();
  const navigate = Route.useNavigate();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("name");

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
  }, []);

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

  return (
    <AppShell>
      <header className="mb-4">
        <Link to="/inventory" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Inventory
        </Link>
        <h1 className="mt-2 text-2xl font-black tracking-tight md:text-3xl">Master Library</h1>
      </header>

      <div className="mb-3 grid gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search items…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Select value={category} onValueChange={(v) => update({ category: v === "all" ? undefined : v })}>
            <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {CATEGORY_V2_VALUES.map((c) => <SelectItem key={c} value={c}>{CATEGORY_V2_LABEL[c]}</SelectItem>)}
            </SelectContent>
          </Select>
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
            return (
              <li key={i.id} className="rounded-2xl border bg-card p-3 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <Link to="/inventory/$itemId" params={{ itemId: i.id }} className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={cn("h-2.5 w-2.5 rounded-full", meta.dot)} />
                      <h3 className="truncate text-base font-semibold">{i.name}</h3>
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
                      <span className="font-semibold">{formatQty(i.current_quantity)} {i.unit}</span>
                      <span className="text-muted-foreground"> / par {formatQty(i.par_level)}</span>
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {i.last_restocked_at ? `Restocked ${new Date(i.last_restocked_at).toLocaleDateString()}` : "Never restocked"}
                    </p>
                  </Link>
                  <div className="flex flex-col items-end gap-1">
                    <Link to="/inventory/$itemId" params={{ itemId: i.id }} className="rounded-full p-2 text-muted-foreground hover:bg-muted" aria-label="Edit">
                      <Pencil className="h-4 w-4" />
                    </Link>
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
    </AppShell>
  );
}

function formatQty(n: number) {
  return Number.isInteger(n) ? n.toString() : n.toFixed(2).replace(/\.?0+$/, "");
}