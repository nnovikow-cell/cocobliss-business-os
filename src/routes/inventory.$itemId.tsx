import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Minus, ArrowUp, Trash2, Pencil, Check, X } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { categoryLabel, statusMeta, statusOf, type InventoryCategory, type InventoryItem } from "@/lib/inventory";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/inventory/$itemId")({ component: InventoryDetail });

type LogRow = {
  id: string;
  kind: "use" | "restock";
  quantity: number;
  quantity_after: number;
  note: string | null;
  created_at: string;
  logged_by: string | null;
};

function InventoryDetail() {
  const { itemId } = Route.useParams();
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [item, setItem] = useState<InventoryItem | null>(null);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<{ name: string; category: InventoryCategory; subcategory: string; unit: string; par_level: string; notes: string }>(
    { name: "", category: "consumable", subcategory: "", unit: "unit", par_level: "0", notes: "" },
  );

  const [action, setAction] = useState<"use" | "restock" | null>(null);
  const [actionQty, setActionQty] = useState("");
  const [actionNote, setActionNote] = useState("");

  const load = async () => {
    setLoading(true);
    const [{ data: it }, { data: lg }, { data: ps }] = await Promise.all([
      supabase.from("inventory_items").select("*").eq("id", itemId).maybeSingle(),
      supabase.from("inventory_logs").select("*").eq("item_id", itemId).order("created_at", { ascending: false }).limit(100),
      supabase.from("profiles").select("user_id,display_name"),
    ]);
    setItem(it as InventoryItem | null);
    setLogs((lg ?? []) as LogRow[]);
    const map: Record<string, string> = {};
    (ps ?? []).forEach((p) => { if (p.user_id) map[p.user_id] = p.display_name ?? ""; });
    setProfiles(map);
    if (it) {
      setForm({
        name: it.name,
        category: it.category as InventoryCategory,
        subcategory: it.subcategory ?? "",
        unit: it.unit,
        par_level: String(it.par_level),
        notes: it.notes ?? "",
      });
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, [itemId]);

  const saveEdit = async () => {
    if (!item) return;
    if (!form.name.trim()) return toast.error("Name required");
    const { error } = await supabase.from("inventory_items").update({
      name: form.name.trim(),
      category: form.category,
      subcategory: form.subcategory.trim() || null,
      unit: form.unit.trim() || "unit",
      par_level: Number(form.par_level || 0),
      notes: form.notes.trim() || null,
    }).eq("id", item.id);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    setEditing(false);
    load();
  };

  const submitAction = async () => {
    if (!item || !action) return;
    const qty = Number(actionQty);
    if (!qty || qty <= 0) return toast.error("Enter a positive amount");
    const newQty = action === "use" ? Math.max(0, Number(item.current_quantity) - qty) : Number(item.current_quantity) + qty;
    const update: { current_quantity: number; last_restocked_at?: string } = { current_quantity: newQty };
    if (action === "restock") update.last_restocked_at = new Date().toISOString();
    const { error: e1 } = await supabase.from("inventory_items").update(update).eq("id", item.id);
    if (e1) return toast.error(e1.message);
    const { error: e2 } = await supabase.from("inventory_logs").insert({
      item_id: item.id,
      kind: action,
      quantity: qty,
      quantity_after: newQty,
      note: actionNote.trim() || null,
      logged_by: user?.id ?? null,
    });
    if (e2) return toast.error(e2.message);
    toast.success(action === "use" ? `Used ${qty} ${item.unit}` : `Restocked +${qty} ${item.unit}`);
    setAction(null);
    setActionQty("");
    setActionNote("");
    load();
  };

  const deleteItem = async () => {
    if (!item) return;
    const { error } = await supabase.from("inventory_items").delete().eq("id", item.id);
    if (error) return toast.error(error.message);
    toast.success("Item deleted");
    navigate({ to: "/inventory" });
  };

  const deleteLog = async (log: LogRow) => {
    if (!item) return;
    const { error } = await supabase.from("inventory_logs").delete().eq("id", log.id);
    if (error) return toast.error(error.message);
    toast.success("History entry deleted");
    load();
  };

  if (loading) {
    return <AppShell><div className="h-32 animate-pulse rounded-2xl bg-muted/50" /></AppShell>;
  }
  if (!item) {
    return (
      <AppShell>
        <p className="text-sm text-muted-foreground">Item not found.</p>
        <Link to="/inventory" className="mt-2 inline-flex items-center gap-1 text-sm text-primary"><ArrowLeft className="h-4 w-4" /> Back</Link>
      </AppShell>
    );
  }

  const qty = Number(item.current_quantity);
  const par = Number(item.par_level);
  const status = statusOf(qty, par);
  const meta = statusMeta[status];
  const pct = par > 0 ? Math.min(150, (qty / par) * 100) : qty > 0 ? 100 : 0;

  return (
    <AppShell>
      <div className="mb-3 flex items-center justify-between">
        <Link to="/inventory" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Inventory
        </Link>
        {isAdmin && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this item?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently removes {item.name} and its restock history. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={deleteItem} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete forever</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <div className="rounded-3xl border bg-card p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn("h-2.5 w-2.5 rounded-full", meta.dot)} />
              <h1 className="truncate text-2xl font-black">{item.name}</h1>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
              <span className="rounded-full bg-secondary px-2 py-0.5 font-medium">{categoryLabel[item.category as InventoryCategory]}</span>
              {item.subcategory && <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">{item.subcategory}</span>}
              <span className={cn("rounded-full border px-2 py-0.5 font-medium", meta.classes)}>{meta.label}</span>
            </div>
          </div>
          <Button variant="outline" size="icon" onClick={() => setEditing((v) => !v)} aria-label="Edit">
            {editing ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
          </Button>
        </div>

        <div className="mt-5 flex items-end justify-between">
          <div>
            <p className="text-4xl font-black tracking-tight">
              {formatQty(qty)} <span className="text-base font-semibold text-muted-foreground">{item.unit}</span>
            </p>
            <p className="text-xs text-muted-foreground">Par level: {formatQty(par)} {item.unit}</p>
          </div>
          <p className="text-xs text-muted-foreground">
            {item.last_restocked_at ? `Restocked ${new Date(item.last_restocked_at).toLocaleDateString()}` : "Never restocked"}
          </p>
        </div>

        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
          <div className={cn("h-full rounded-full transition-all", status === "ok" ? "bg-emerald-500" : status === "low" ? "bg-amber-500" : "bg-red-500")} style={{ width: `${Math.min(100, pct)}%` }} />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => { setAction("use"); setActionQty(""); setActionNote(""); }}>
            <Minus className="h-4 w-4" /> Use
          </Button>
          <Button onClick={() => { setAction("restock"); setActionQty(""); setActionNote(""); }}>
            <ArrowUp className="h-4 w-4" /> Restock
          </Button>
        </div>

        {item.notes && !editing && (
          <p className="mt-4 whitespace-pre-wrap rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">{item.notes}</p>
        )}

        {editing && (
          <div className="mt-5 grid gap-3 border-t pt-4">
            <div>
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
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
                <Input value={form.subcategory} onChange={(e) => setForm({ ...form, subcategory: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Unit</Label>
                <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
              </div>
              <div>
                <Label>Par level</Label>
                <Input type="number" inputMode="decimal" value={form.par_level} onChange={(e) => setForm({ ...form, par_level: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
              <Button onClick={saveEdit}><Check className="h-4 w-4" /> Save</Button>
            </div>
          </div>
        )}
      </div>

      {/* History */}
      <section className="mt-6">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">Restock & usage history</h2>
        {logs.length === 0 ? (
          <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">No activity yet.</p>
        ) : (
          <ul className="space-y-2">
            {logs.map((l) => (
              <li key={l.id} className="rounded-xl border bg-card p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className={cn("inline-flex h-7 w-7 items-center justify-center rounded-full",
                      l.kind === "restock" ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300" : "bg-amber-500/15 text-amber-600 dark:text-amber-300")}>
                      {l.kind === "restock" ? <ArrowUp className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
                    </span>
                    <div>
                      <p className="text-sm font-semibold">
                        {l.kind === "restock" ? "+" : "−"}{formatQty(Number(l.quantity))} {item.unit}
                        <span className="ml-2 text-xs font-normal text-muted-foreground">→ {formatQty(Number(l.quantity_after))} {item.unit}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(l.created_at).toLocaleString()}
                        {l.logged_by && profiles[l.logged_by] ? ` · ${profiles[l.logged_by]}` : ""}
                      </p>
                    </div>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" aria-label="Delete entry">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete this history entry?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This removes the {l.kind === "restock" ? "restock" : "usage"} of {formatQty(Number(l.quantity))} {item.unit} from history. The current stock quantity will not change.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteLog(l)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
                {l.note && <p className="mt-1.5 pl-9 text-xs text-muted-foreground">{l.note}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Quick action dialog */}
      <Dialog open={!!action} onOpenChange={(o) => { if (!o) setAction(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{action === "use" ? "Use" : "Restock"} {item.name}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <p className="text-xs text-muted-foreground">
              Current: <span className="font-semibold text-foreground">{formatQty(qty)} {item.unit}</span> · Par {formatQty(par)}
            </p>
            <div>
              <Label>Amount ({item.unit})</Label>
              <Input autoFocus type="number" inputMode="decimal" value={actionQty} onChange={(e) => setActionQty(e.target.value)} placeholder="0" />
            </div>
            <div>
              <Label>Note (optional)</Label>
              <Input value={actionNote} onChange={(e) => setActionNote(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAction(null)}>Cancel</Button>
            <Button onClick={submitAction}>{action === "use" ? "Subtract" : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function formatQty(n: number) {
  return Number.isInteger(n) ? n.toString() : n.toFixed(2).replace(/\.?0+$/, "");
}