import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import {
  ArrowLeft, Trash2, Pencil, Minus, ArrowUp, Factory, PartyPopper, PackagePlus,
} from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import {
  CATEGORY_V2_LABEL, LOG_KIND_LABEL, WORKFLOW_LABEL, statusMeta, statusOf,
  type InventoryCategoryV2, type InventoryItem, type LogKind, type WorkflowTag,
} from "@/lib/inventory";
import { cn } from "@/lib/utils";
import { InventoryItemDrawer } from "@/components/inventory/item-drawer";

export const Route = createFileRoute("/inventory/$itemId")({ component: InventoryDetail });

type LogRow = {
  id: string;
  kind: LogKind;
  quantity: number;
  quantity_after: number;
  note: string | null;
  created_at: string;
  logged_by: string | null;
  event_instance_id: string | null;
  production_date: string | null;
  projected_use_date: string | null;
  supplier_name_snapshot: string | null;
};

type EventVM = { id: string; date: string; series: { name: string; location: string | null } | null };
type PriceRow = { id: string; price: number | null; package_size: number | null; package_size_unit: string | null; cost_per_unit: number | null; changed_at: string };

function InventoryDetail() {
  const { itemId } = Route.useParams();
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [item, setItem] = useState<InventoryItem | null>(null);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [events, setEvents] = useState<Record<string, EventVM>>({});
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [prices, setPrices] = useState<PriceRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState(false);

  const [action, setAction] = useState<"use" | "restock" | null>(null);
  const [actionQty, setActionQty] = useState("");
  const [actionNote, setActionNote] = useState("");

  const load = async () => {
    setLoading(true);
    const [{ data: it }, { data: lg }, { data: ps }, { data: ph }] = await Promise.all([
      supabase.from("inventory_items").select("*").eq("id", itemId).maybeSingle(),
      supabase.from("inventory_logs").select("*").eq("item_id", itemId).order("created_at", { ascending: false }).limit(200),
      supabase.from("profiles").select("user_id,display_name"),
      supabase.from("inventory_price_history").select("id,price,package_size,package_size_unit,cost_per_unit,changed_at").eq("item_id", itemId).order("changed_at", { ascending: false }).limit(20),
    ]);
    const itm = it as InventoryItem | null;
    setItem(itm);
    const logRows = (lg ?? []) as LogRow[];
    setLogs(logRows);
    const map: Record<string, string> = {};
    (ps ?? []).forEach((p) => { if (p.user_id) map[p.user_id] = p.display_name ?? ""; });
    setProfiles(map);
    setPrices((ph ?? []) as PriceRow[]);

    const eventIds = Array.from(new Set(logRows.map((l) => l.event_instance_id).filter(Boolean) as string[]));
    if (eventIds.length) {
      const { data: evs } = await supabase
        .from("event_instances")
        .select("id,date,series:event_series(name,location)")
        .in("id", eventIds);
      const em: Record<string, EventVM> = {};
      (evs ?? []).forEach((e) => { em[e.id] = e as unknown as EventVM; });
      setEvents(em);
    } else setEvents({});

    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [itemId]);

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
    const { error } = await supabase.from("inventory_logs").delete().eq("id", log.id);
    if (error) return toast.error(error.message);
    toast.success("History entry deleted");
    load();
  };

  const status = useMemo(() => item ? statusOf(Number(item.current_quantity), Number(item.par_level)) : "ok", [item]);

  if (loading || !item) {
    return <AppShell><div className="h-32 animate-pulse rounded-2xl bg-muted/50" /></AppShell>;
  }

  const meta = statusMeta[status];
  const qty = Number(item.current_quantity);
  const par = Number(item.par_level);
  const pct = par > 0 ? Math.min(150, (qty / par) * 100) : qty > 0 ? 100 : 0;

  return (
    <AppShell>
      <div className="mb-3 flex items-center justify-between">
        <Link to="/inventory/list" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Inventory
        </Link>
        {isAdmin && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this item?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently removes {item.name} and its log history. This cannot be undone.
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
              <h1 className="truncate text-2xl font-black md:text-3xl">{item.name}</h1>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
              <span className="rounded-full bg-secondary px-2 py-0.5 font-medium">
                {CATEGORY_V2_LABEL[(item.category_v2 ?? "other") as InventoryCategoryV2]}
              </span>
              {(item.workflow_tags ?? []).filter((t) => t !== "all").map((t) => (
                <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                  {WORKFLOW_LABEL[t as WorkflowTag]}
                </span>
              ))}
              <span className={cn("rounded-full border px-2 py-0.5 font-medium", meta.classes)}>{meta.label}</span>
            </div>
          </div>
          <Button variant="outline" size="icon" onClick={() => setEditing(true)} aria-label="Edit">
            <Pencil className="h-4 w-4" />
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

        <div className="mt-5 grid gap-2 border-t pt-4 text-sm md:grid-cols-2">
            {item.supplier_name && <Field label="Supplier" value={item.supplier_name} />}
            {item.physical_location && <Field label="Stored at" value={item.physical_location} />}
            {item.package_type && <Field label="Package" value={item.package_type} />}
            {item.price != null && <Field label="Price" value={`$${Number(item.price).toFixed(2)}${item.package_size ? ` / ${item.package_size}${item.package_size_unit ?? ""}` : ""}`} />}
            {item.cost_per_unit != null && <Field label="Cost / unit" value={`$${Number(item.cost_per_unit).toFixed(4)}`} />}
            {item.purchase_url && (
              <Field label="Purchase" value={
                <a href={item.purchase_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">{item.purchase_url}</a>
              } />
            )}
        </div>

        {item.notes && (
          <p className="mt-4 whitespace-pre-wrap rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">{item.notes}</p>
        )}

      </div>
      <InventoryItemDrawer
        open={editing}
        onOpenChange={setEditing}
        itemId={item.id}
        onSaved={() => load()}
      />

      {prices.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">Price history</h2>
          <ul className="space-y-1.5 text-sm">
            {prices.map((p) => (
              <li key={p.id} className="flex items-center justify-between rounded-xl border bg-card px-3 py-2">
                <span>${p.price?.toFixed(2) ?? "—"} {p.package_size ? `/ ${p.package_size}${p.package_size_unit ?? ""}` : ""}</span>
                <span className="text-xs text-muted-foreground">{format(parseISO(p.changed_at), "MMM d, yyyy")}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">Activity history</h2>
        {logs.length === 0 ? (
          <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">No activity yet.</p>
        ) : (
          <ul className="space-y-2">
            {logs.map((l) => {
              const ev = l.event_instance_id ? events[l.event_instance_id] : null;
              const isAdd = l.kind === "restock";
              const Icon = l.kind === "production_batch" ? Factory : l.kind === "event_use" ? PartyPopper : isAdd ? PackagePlus : Minus;
              return (
                <li key={l.id} className="rounded-xl border bg-card p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className={cn(
                        "inline-flex h-8 w-8 items-center justify-center rounded-full",
                        isAdd ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300" : "bg-amber-500/15 text-amber-600 dark:text-amber-300",
                      )}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">
                          {isAdd ? "+" : "−"}{formatQty(Number(l.quantity))} {item.unit}
                          <span className="ml-2 text-xs font-normal text-muted-foreground">→ {formatQty(Number(l.quantity_after))} {item.unit}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium">{LOG_KIND_LABEL[l.kind]}</span>
                          {" · "}{new Date(l.created_at).toLocaleString()}
                          {l.logged_by && profiles[l.logged_by] ? ` · ${profiles[l.logged_by]}` : ""}
                        </p>
                        {ev && (
                          <p className="text-xs text-muted-foreground">
                            Event: <span className="font-medium text-foreground">{ev.series?.name ?? "—"}</span>
                            {" · "}{format(parseISO(ev.date), "MMM d, yyyy")}
                            {ev.series?.location ? ` · ${ev.series.location}` : ""}
                          </p>
                        )}
                        {l.supplier_name_snapshot && (
                          <p className="text-xs text-muted-foreground">Supplier: {l.supplier_name_snapshot}</p>
                        )}
                        {(l.production_date || l.projected_use_date) && (
                          <p className="text-xs text-muted-foreground">
                            {l.production_date && `Made ${l.production_date}`}
                            {l.production_date && l.projected_use_date && " · "}
                            {l.projected_use_date && `For ${l.projected_use_date}`}
                          </p>
                        )}
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
                            Removes the {LOG_KIND_LABEL[l.kind]} of {formatQty(Number(l.quantity))} {item.unit}. Current stock won't change.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteLog(l)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                  {l.note && <p className="mt-1.5 pl-11 text-xs text-muted-foreground">{l.note}</p>}
                </li>
              );
            })}
          </ul>
        )}
      </section>

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

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-muted/40 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  );
}

function formatQty(n: number) {
  return Number.isInteger(n) ? n.toString() : n.toFixed(2).replace(/\.?0+$/, "");
}