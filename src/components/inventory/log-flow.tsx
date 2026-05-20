import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { format } from "date-fns";
import { ArrowLeft, ArrowRight, Check, Search } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import {
  CATEGORY_V2_LABEL, type InventoryCategoryV2, type InventoryItem, type WorkflowTag,
} from "@/lib/inventory";
import { EventInstanceSelect } from "./event-instance-select";
import { cn } from "@/lib/utils";

export type LogFlowKind = "production_batch" | "restock" | "event_use";

const TITLES: Record<LogFlowKind, { title: string; verb: string; subtitle: string }> = {
  production_batch: { title: "Log Production Batch", verb: "used", subtitle: "Ingredients consumed in this batch" },
  restock:          { title: "Log Restock", verb: "received", subtitle: "Items received from a supplier" },
  event_use:        { title: "Log Event", verb: "used", subtitle: "Disposables and toppings used at the event" },
};

function workflowFilter(kind: LogFlowKind): WorkflowTag {
  if (kind === "production_batch") return "production_batch";
  if (kind === "event_use") return "log_event";
  return "restock";
}

export function LogFlow({ kind }: { kind: LogFlowKind }) {
  const meta = TITLES[kind];
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [qtyById, setQtyById] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");

  // step 2 fields
  const [eventInstanceId, setEventInstanceId] = useState<string | null>(null);
  const [productionDate, setProductionDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [projectedUseDate, setProjectedUseDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [supplier, setSupplier] = useState("");
  const [restockDate, setRestockDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [eventDate, setEventDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const tag = workflowFilter(kind);
      let q = supabase.from("inventory_items").select("*")
        .is("deleted_at", null).eq("is_archived", false).order("name");
      // Restock shows everything; the others filter by workflow tag.
      if (kind !== "restock") {
        q = q.overlaps("workflow_tags", [tag, "all"]);
      }
      const { data, error } = await q;
      if (error) toast.error(error.message);
      setItems((data ?? []) as InventoryItem[]);
      setLoading(false);
    })();
  }, [kind]);

  const grouped = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = items.filter((i) => !term || i.name.toLowerCase().includes(term));
    const map = new Map<string, InventoryItem[]>();
    for (const it of list) {
      const cat = (it.category_v2 as InventoryCategoryV2) ?? "other";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(it);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [items, search]);

  const selected = useMemo(
    () => items.filter((i) => (qtyById[i.id] ?? 0) > 0),
    [items, qtyById],
  );

  const canStep2 = selected.length > 0;
  const canSave =
    canStep2 &&
    (kind === "production_batch" ? !!eventInstanceId : true) &&
    (kind === "event_use" ? !!eventInstanceId : true) &&
    (kind === "restock" ? supplier.trim().length > 0 : true);

  const save = async () => {
    if (!canSave || saving) return;
    setSaving(true);

    // Create batch header
    const batchInsert: {
      kind: LogFlowKind;
      event_instance_id: string | null;
      production_date: string | null;
      projected_use_date: string | null;
      supplier_name: string | null;
      note: string | null;
      logged_by: string | null;
    } = {
      kind,
      event_instance_id: kind === "restock" ? null : eventInstanceId,
      production_date: kind === "production_batch" ? productionDate : null,
      projected_use_date: kind === "production_batch" ? projectedUseDate : null,
      supplier_name: kind === "restock" ? supplier.trim() : null,
      note: note.trim() || null,
      logged_by: user?.id ?? null,
    };
    const eventDateIso =
      kind === "restock"
        ? new Date(restockDate).toISOString()
        : kind === "event_use"
        ? new Date(eventDate).toISOString()
        : new Date(productionDate).toISOString();
    const { data: batch, error: batchErr } = await supabase
      .from("inventory_log_batches").insert({ ...batchInsert, created_at: eventDateIso }).select("id").single();
    if (batchErr || !batch) { setSaving(false); return toast.error(batchErr?.message ?? "Save failed"); }

    // Process each selected item
    const sign = kind === "restock" ? 1 : -1;
    for (const it of selected) {
      const inputQty = qtyById[it.id]!;
      const pkgSize = it.package_size != null ? Number(it.package_size) : null;
      const cat = it.category_v2;
      const askInUnits =
        (kind === "event_use" || kind === "production_batch") &&
        (cat === "disposable" || cat === "consumable");
      const storedQty = askInUnits
        ? inputQty
        : (pkgSize ? inputQty * pkgSize : inputQty);
      const newQty = Math.max(0, Number(it.current_quantity) + sign * storedQty);
      const itemUpdate: { current_quantity: number; last_restocked_at?: string } = { current_quantity: newQty };
      if (kind === "restock") itemUpdate.last_restocked_at = new Date(restockDate).toISOString();
      const { error: e1 } = await supabase.from("inventory_items").update(itemUpdate).eq("id", it.id);
      if (e1) { setSaving(false); return toast.error(e1.message); }
      const { error: e2 } = await supabase.from("inventory_logs").insert({
        item_id: it.id,
        kind,
        quantity: storedQty,
        quantity_after: newQty,
        note: note.trim() || null,
        logged_by: user?.id ?? null,
        batch_id: batch.id,
        event_instance_id: kind === "restock" ? null : eventInstanceId,
        production_date: kind === "production_batch" ? productionDate : null,
        projected_use_date: kind === "production_batch" ? projectedUseDate : null,
        supplier_name_snapshot: kind === "restock" ? supplier.trim() : null,
        created_at: eventDateIso,
      });
      if (e2) { setSaving(false); return toast.error(e2.message); }
    }

    toast.success(`${meta.title} saved`);
    navigate({ to: "/inventory" });
  };

  return (
    <AppShell>
      <header className="mb-4">
        <Link to="/inventory" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Inventory
        </Link>
        <h1 className="mt-2 text-2xl font-black tracking-tight md:text-3xl">{meta.title}</h1>
        <p className="text-sm text-muted-foreground">{meta.subtitle}</p>
        <Steps current={step} />
      </header>

      {step === 1 && (
        <section>
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search items…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-muted/50" />)}</div>
          ) : grouped.length === 0 ? (
            <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              No items tagged for this workflow yet.
            </p>
          ) : (
            <div className="space-y-5">
              {grouped.map(([cat, list]) => (
                <div key={cat}>
                  <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {CATEGORY_V2_LABEL[cat as InventoryCategoryV2] ?? cat}
                  </h2>
                  <ul className="space-y-2">
                    {list.map((it) => {
                      const q = qtyById[it.id] ?? 0;
                      const pkgSize = it.package_size != null ? Number(it.package_size) : null;
                      const pkgUnit = it.package_size_unit ?? it.unit;
                      const pkgType = it.package_type?.trim() || "units";
                      const cat = it.category_v2;
                      const askInUnits =
                        (kind === "event_use" || kind === "production_batch") &&
                        (cat === "disposable" || cat === "consumable");
                      const total = askInUnits ? q : (pkgSize ? q * pkgSize : q);
                      return (
                        <li key={it.id} className={cn("flex items-center justify-between gap-3 rounded-2xl border bg-card p-3", q > 0 && "ring-2 ring-primary/40")}>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{it.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {(() => {
                                const ps = it.package_size != null ? Number(it.package_size) : 0;
                                const pt = it.package_type?.trim() || null;
                                const cur = Number(it.current_quantity);
                                if (ps > 0 && pt) {
                                  const pkgs = cur / ps;
                                  return (
                                    <>
                                      On hand {(+pkgs.toFixed(2)).toString()} {pt}{pkgs !== 1 ? "s" : ""}
                                      <span className="ml-1">({cur} {it.unit})</span>
                                    </>
                                  );
                                }
                                return <>On hand {cur} {it.unit}</>;
                              })()}
                            </p>
                            {q > 0 && (
                              <p className="mt-0.5 text-[11px] text-muted-foreground">
                                {askInUnits
                                  ? (pkgSize
                                      ? `= ${(q / pkgSize).toFixed(1)} ${pkgType}s`
                                      : "")
                                  : pkgSize
                                  ? `= ${(+total.toFixed(4)).toString()} ${pkgUnit} total`
                                  : "Package size not set — enter total amount."}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              inputMode="decimal"
                              min={0}
                              value={q === 0 ? "" : String(q)}
                              onChange={(e) =>
                                setQtyById((m) => ({ ...m, [it.id]: Math.max(0, Number(e.target.value || 0)) }))
                              }
                              placeholder="0"
                              className="h-9 w-16 rounded-md border bg-background px-2 text-center text-sm font-semibold"
                            />
                            <span className="text-xs text-muted-foreground">
                              {askInUnits
                                ? (it.unit ?? "units")
                                : (
                                  <>
                                    × {pkgType}
                                    {pkgSize ? ` (${pkgSize} ${pkgUnit} each)` : pkgUnit ? ` (${pkgUnit} each)` : ""}
                                  </>
                                )}
                            </span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <Button disabled={!canStep2} onClick={() => setStep(2)}>
              Next <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="grid gap-4">
          {(kind === "production_batch" || kind === "event_use") && (
            <div>
              <Label>Link to event</Label>
              <EventInstanceSelect
                value={eventInstanceId}
                onChange={(id, row) => {
                  setEventInstanceId(id);
                  if (row && kind === "event_use") setEventDate(row.date);
                  if (row && kind === "production_batch") setProjectedUseDate(row.date);
                }}
              />
            </div>
          )}
          {kind === "production_batch" && (
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label>Production date</Label>
                <Input type="date" value={productionDate} onChange={(e) => setProductionDate(e.target.value)} />
              </div>
              <div>
                <Label>Projected use date</Label>
                <Input type="date" value={projectedUseDate} onChange={(e) => setProjectedUseDate(e.target.value)} />
              </div>
            </div>
          )}
          {kind === "restock" && (
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label>Supplier or store</Label>
                <Input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="e.g. Restaurant Depot" />
              </div>
              <div>
                <Label>Date received</Label>
                <Input type="date" value={restockDate} onChange={(e) => setRestockDate(e.target.value)} />
              </div>
            </div>
          )}
          {kind === "event_use" && (
            <div>
              <Label>Date of event</Label>
              <Input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
            </div>
          )}
          <div>
            <Label>Note (optional)</Label>
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep(1)}><ArrowLeft className="h-4 w-4" /> Back</Button>
            <Button disabled={!canSave} onClick={() => setStep(3)}>
              Review <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="grid gap-4">
          <div className="rounded-2xl border bg-card p-4">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">Summary</h2>
            <ul className="divide-y">
              {selected.map((it) => {
                const inputQty = qtyById[it.id]!;
                const pkgSize = it.package_size != null ? Number(it.package_size) : null;
                const cat = it.category_v2;
                const askInUnits =
                  (kind === "event_use" || kind === "production_batch") &&
                  (cat === "disposable" || cat === "consumable");
                const sign = kind === "restock" ? "+" : "−";
                return (
                  <li key={it.id} className="flex items-center justify-between py-2 text-sm">
                    <span className="font-medium">{it.name}</span>
                    <span>
                      <span className="font-semibold">{sign}{inputQty}</span>{" "}
                      <span className="text-muted-foreground">
                        {askInUnits
                          ? `${it.unit}${pkgSize ? ` (= ${(inputQty / pkgSize).toFixed(1)} ${it.package_type?.trim() || "package"}s)` : ""}`
                          : `× ${it.package_type?.trim() || "units"}${pkgSize != null ? ` = ${(+(inputQty * pkgSize).toFixed(4)).toString()} ${it.package_size_unit ?? it.unit}` : ` ${it.unit}`}`}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep(2)}><ArrowLeft className="h-4 w-4" /> Back</Button>
            <Button onClick={save} disabled={saving}>
              <Check className="h-4 w-4" /> {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </section>
      )}
    </AppShell>
  );
}

function Steps({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol className="mt-4 flex items-center gap-2 text-xs font-medium">
      {(["Quantities", "Details", "Review"] as const).map((label, i) => {
        const n = (i + 1) as 1 | 2 | 3;
        const active = n === current;
        const done = n < current;
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex h-6 w-6 items-center justify-center rounded-full border text-[11px]",
                active && "border-primary bg-primary text-primary-foreground",
                done && "border-primary/50 bg-primary/15 text-primary",
                !active && !done && "border-border bg-muted text-muted-foreground",
              )}
            >
              {n}
            </span>
            <span className={cn(active ? "text-foreground" : "text-muted-foreground")}>{label}</span>
            {n < 3 && <span className="mx-1 h-px w-6 bg-border" />}
          </li>
        );
      })}
    </ol>
  );
}