import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Boxes, AlertTriangle, PackageX, Minus, ArrowUp, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { categoryLabel, statusMeta, statusOf, type InventoryCategory, type InventoryItem, type InventoryStatus } from "@/lib/inventory";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/inventory/")({ component: InventoryIndex });

type Filter = "all" | InventoryCategory;
type StatusFilter = "all" | InventoryStatus;
type Sort = "name" | "stock_asc" | "stock_desc";

function InventoryIndex() {
  const { user } = useAuth();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<Filter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<Sort>("name");

  // Create dialog
  const [openNew, setOpenNew] = useState(false);
  const [form, setForm] = useState({
    name: "",
    category: "consumable" as InventoryCategory,
    subcategory: "",
    unit: "unit",
    current_quantity: "0",
    par_level: "0",
    notes: "",
  });

  // Quick action dialog
  const [action, setAction] = useState<{ kind: "use" | "restock"; item: InventoryItem } | null>(null);
  const [actionQty, setActionQty] = useState("");
  const [actionNote, setActionNote] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("inventory_items")
      .select("*")
      .is("deleted_at", null)
      .eq("is_archived", false)
      .order("name");
    if (error) toast.error(error.message);
    setItems((data ?? []) as InventoryItem[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const enriched = useMemo(() => items.map((i) => ({
    ...i,
    current_quantity: Number(i.current_quantity),
    par_level: Number(i.par_level),
    status: statusOf(Number(i.current_quantity), Number(i.par_level)),
  })), [items]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    let r = enriched.filter((i) => {
      if (cat !== "all" && i.category !== cat) return false;
      if (status !== "all" && i.status !== status) return false;
      if (term && !i.name.toLowerCase().includes(term) && !(i.subcategory ?? "").toLowerCase().includes(term)) return false;
      return true;
    });
    if (sort === "name") r = r.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "stock_asc") r = r.sort((a, b) => a.current_quantity / (a.par_level || 1) - b.current_quantity / (b.par_level || 1));
    if (sort === "stock_desc") r = r.sort((a, b) => b.current_quantity / (b.par_level || 1) - a.current_quantity / (a.par_level || 1));
    return r;
  }, [enriched, q, cat, status, sort]);

  const totals = useMemo(() => ({
    total: enriched.length,
    low: enriched.filter((i) => i.status === "low").length,
    out: enriched.filter((i) => i.status === "out").length,
  }), [enriched]);

  const createItem = async () => {
    if (!form.name.trim()) return toast.error("Name required");
    const { error } = await supabase.from("inventory_items").insert({
      name: form.name.trim(),
      category: form.category,
      subcategory: form.subcategory.trim() || null,
      unit: form.unit.trim() || "unit",
      current_quantity: Number(form.current_quantity || 0),
      par_level: Number(form.par_level || 0),
      notes: form.notes.trim() || null,
      created_by: user?.id ?? null,
      last_restocked_at: Number(form.current_quantity) > 0 ? new Date().toISOString() : null,
    });
    if (error) return toast.error(error.message);
    toast.success("Item added");
    setOpenNew(false);
    setForm({ name: "", category: "consumable", subcategory: "", unit: "unit", current_quantity: "0", par_level: "0", notes: "" });
    load();
  };

  const submitAction = async () => {
    if (!action) return;
    const qty = Number(actionQty);
    if (!qty || qty <= 0) return toast.error("Enter a positive amount");
    const item = action.item;
    const newQty =
      action.kind === "use"
        ? Math.max(0, Number(item.current_quantity) - qty)
        : Number(item.current_quantity) + qty;
    const update: Record<string, unknown> = { current_quantity: newQty };
    if (action.kind === "restock") update.last_restocked_at = new Date().toISOString();
    const { error: e1 } = await supabase.from("inventory_items").update(update).eq("id", item.id);
    if (e1) return toast.error(e1.message);
    const { error: e2 } = await supabase.from("inventory_logs").insert({
      item_id: item.id,
      kind: action.kind,
      quantity: qty,
      quantity_after: newQty,
      note: actionNote.trim() || null,
      logged_by: user?.id ?? null,
    });
    if (e2) return toast.error(e2.message);
    toast.success(action.kind === "use" ? `Used ${qty} ${item.unit}` : `Restocked +${qty} ${item.unit}`);
    setAction(null);
    setActionQty("");
    setActionNote("");
    load();
  };

  return (
    <AppShell>
      <header className="mb-5 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Module</p>
          <h1 className="text-3xl font-black tracking-tight">Inventory</h1>
          <p className="mt-1 text-sm text-muted-foreground">Consumables and disposables on hand.</p>
        </div>
        <Dialog open={openNew} onOpenChange={setOpenNew}>
          <DialogTrigger asChild>
            <Button size="sm" className="rounded-full"><Plus className="h-4 w-4" /> New item</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>New inventory item</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div>
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Biscoff cookies" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Category</Label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as InventoryCategory })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="consumable">Consumables</SelectItem>
                      <SelectItem value="disposable">Disposables</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Subcategory</Label>
                  <Input value={form.subcategory} onChange={(e) => setForm({ ...form, subcategory: e.target.value })} placeholder="optional" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Unit</Label>
                  <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="kg, pcs, oz" />
                </div>
                <div>
                  <Label>Current</Label>
                  <Input type="number" inputMode="decimal" value={form.current_quantity} onChange={(e) => setForm({ ...form, current_quantity: e.target.value })} />
                </div>
                <div>
                  <Label>Par level</Label>
                  <Input type="number" inputMode="decimal" value={form.par_level} onChange={(e) => setForm({ ...form, par_level: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpenNew(false)}>Cancel</Button>
              <Button onClick={createItem}>Add item</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      {/* Summary cards */}
      <div className="mb-5 grid grid-cols-3 gap-3">
        <SummaryCard icon={Boxes} tone="default" label="Total items" value={totals.total} />
        <SummaryCard icon={AlertTriangle} tone="warn" label="Low on stock" value={totals.low} />
        <SummaryCard icon={PackageX} tone="danger" label="Below par" value={totals.out} />
      </div>

      {/* Search + filters */}
      <div className="mb-3 grid gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search items…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Select value={cat} onValueChange={(v) => setCat(v as Filter)}>
            <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              <SelectItem value="consumable">Consumables</SelectItem>
              <SelectItem value="disposable">Disposables</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
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
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted/50" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          No items match. Try a different filter or add a new item.
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((i) => {
            const meta = statusMeta[i.status];
            return (
              <li key={i.id} className="rounded-2xl border bg-card p-3 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <Link
                    to="/inventory/$itemId"
                    params={{ itemId: i.id }}
                    className="min-w-0 flex-1"
                  >
                    <div className="flex items-center gap-2">
                      <span className={cn("h-2.5 w-2.5 rounded-full", meta.dot)} />
                      <h3 className="truncate text-base font-semibold">{i.name}</h3>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="rounded-full bg-secondary px-2 py-0.5 font-medium text-foreground">
                        {categoryLabel[i.category]}
                      </span>
                      {i.subcategory && (
                        <span className="rounded-full bg-muted px-2 py-0.5">{i.subcategory}</span>
                      )}
                      <span className={cn("rounded-full border px-2 py-0.5 font-medium", meta.classes)}>
                        {meta.label}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm">
                      <span className="font-semibold">{formatQty(i.current_quantity)} {i.unit}</span>
                      <span className="text-muted-foreground"> / par {formatQty(i.par_level)}</span>
                    </p>
                  </Link>
                  <Link
                    to="/inventory/$itemId"
                    params={{ itemId: i.id }}
                    className="rounded-full p-2 text-muted-foreground hover:bg-muted"
                    aria-label="Open item"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setAction({ kind: "use", item: i }); setActionQty(""); setActionNote(""); }}
                  >
                    <Minus className="h-4 w-4" /> Use
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => { setAction({ kind: "restock", item: i }); setActionQty(""); setActionNote(""); }}
                  >
                    <ArrowUp className="h-4 w-4" /> Restock
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Quick action dialog */}
      <Dialog open={!!action} onOpenChange={(o) => { if (!o) setAction(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {action?.kind === "use" ? "Use" : "Restock"} {action?.item.name}
            </DialogTitle>
          </DialogHeader>
          {action && (
            <div className="grid gap-3">
              <p className="text-xs text-muted-foreground">
                Current: <span className="font-semibold text-foreground">{formatQty(Number(action.item.current_quantity))} {action.item.unit}</span> · Par {formatQty(Number(action.item.par_level))}
              </p>
              <div>
                <Label>Amount ({action.item.unit})</Label>
                <Input autoFocus type="number" inputMode="decimal" value={actionQty} onChange={(e) => setActionQty(e.target.value)} placeholder="0" />
              </div>
              <div>
                <Label>Note (optional)</Label>
                <Input value={actionNote} onChange={(e) => setActionNote(e.target.value)} placeholder="e.g. delivery from supplier" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAction(null)}>Cancel</Button>
            <Button onClick={submitAction}>
              {action?.kind === "use" ? "Subtract" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function SummaryCard({ icon: Icon, label, value, tone }: { icon: typeof Boxes; label: string; value: number; tone: "default" | "warn" | "danger" }) {
  const toneCls =
    tone === "warn" ? "from-amber-500/15 to-amber-500/0 text-amber-600 dark:text-amber-300"
    : tone === "danger" ? "from-red-500/15 to-red-500/0 text-red-600 dark:text-red-300"
    : "from-primary/15 to-primary/0 text-primary";
  return (
    <div className={cn("rounded-2xl border bg-gradient-to-br p-3", toneCls)}>
      <div className="flex items-center justify-between">
        <Icon className="h-4 w-4" />
      </div>
      <p className="mt-2 text-2xl font-black text-foreground">{value}</p>
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}

function formatQty(n: number) {
  return Number.isInteger(n) ? n.toString() : n.toFixed(2).replace(/\.?0+$/, "");
}