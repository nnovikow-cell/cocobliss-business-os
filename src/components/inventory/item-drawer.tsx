import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  CATEGORY_V2_LABEL, WORKFLOW_LABEL,
  type InventoryCategoryV2, type InventoryItem, type WorkflowTag,
} from "@/lib/inventory";
import {
  INGREDIENT_UNITS, WEIGHT_UNITS, UNIT_LABELS, lookupDensity, itemToFlOz,
  type IngredientUnit,
} from "@/lib/ingredients";

type Cat = "ingredient" | "consumable" | "disposable" | "equipment" | "other";
const CAT_ORDER: Cat[] = ["ingredient", "consumable", "disposable", "equipment", "other"];

const TAGS_BY_CAT: Record<Cat, WorkflowTag[]> = {
  ingredient: ["production_batch", "restock", "log_event", "all"],
  consumable: ["production_batch", "restock", "log_event", "all"],
  disposable: ["restock", "log_event", "all"],
  equipment: ["all"],
  other: ["all"],
};

type FormState = {
  name: string;
  library_code: string;
  category: Cat;
  package_type: string;
  package_qty: string;        // units per case
  unit_size: string;          // size of one unit (=> inventory_items.package_size)
  unit: string;               // (=> inventory_items.package_size_unit)
  density: string;
  density_source: string;
  workflow_tags: WorkflowTag[];
  price: string;              // case price (=> inventory_items.price)
  current_quantity: string;   // for equipment = quantity owned
  par_level: string;
  notes: string;
  description: string;
  supplier_name: string;
  purchase_url: string;
  physical_location: string;
};

const empty: FormState = {
  name: "", library_code: "", category: "ingredient",
  package_type: "", package_qty: "", unit_size: "", unit: "fl oz",
  density: "", density_source: "",
  workflow_tags: ["restock"],
  price: "", current_quantity: "0", par_level: "0",
  notes: "", description: "",
  supplier_name: "", purchase_url: "", physical_location: "",
};

function fromItem(it: InventoryItem): FormState {
  const cat = (CAT_ORDER as string[]).includes(it.category_v2 ?? "")
    ? (it.category_v2 as Cat) : "other";
  return {
    name: it.name,
    library_code: (it as unknown as { library_code: string | null }).library_code ?? "",
    category: cat,
    package_type: it.package_type ?? "",
    package_qty: (it as unknown as { package_qty: number | null }).package_qty != null
      ? String((it as unknown as { package_qty: number | null }).package_qty) : "",
    unit_size: it.package_size != null ? String(it.package_size) : "",
    unit: it.package_size_unit ?? "fl oz",
    density: (it as unknown as { density: number | null }).density != null
      ? String((it as unknown as { density: number | null }).density) : "",
    density_source: (it as unknown as { density_source: string | null }).density_source ?? "",
    workflow_tags: (it.workflow_tags as WorkflowTag[]) ?? ["restock"],
    price: it.price != null ? String(it.price) : "",
    current_quantity: String(it.current_quantity ?? 0),
    par_level: String(it.par_level ?? 0),
    notes: it.notes ?? "",
    description: it.notes ?? "",
    supplier_name: it.supplier_name ?? "",
    purchase_url: it.purchase_url ?? "",
    physical_location: it.physical_location ?? "",
  };
}

type PriceRow = {
  id: string;
  price: number | null;
  package_size: number | null;
  package_size_unit: string | null;
  cost_per_unit: number | null;
  changed_at: string;
  changed_by: string | null;
  note: string | null;
};

export function InventoryItemDrawer({
  open, onOpenChange, itemId, onSaved, defaultCategory,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  itemId: string | null; // null = create
  onSaved?: (id: string) => void;
  defaultCategory?: Cat;
}) {
  const { user } = useAuth();
  const isEdit = !!itemId;
  const [form, setForm] = useState<FormState>(empty);
  const [tab, setTab] = useState("details");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [originalPrice, setOriginalPrice] = useState<number | null>(null);
  const [priceMode, setPriceMode] = useState<"view" | "update">("view");
  const [newPrice, setNewPrice] = useState("");
  const [reason, setReason] = useState("");
  const [history, setHistory] = useState<PriceRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  // Load on open
  useEffect(() => {
    if (!open) return;
    setTab("details");
    setPriceMode("view");
    setReason("");
    if (!itemId) {
      setForm({ ...empty, category: defaultCategory ?? empty.category });
      setOriginalPrice(null);
      setHistory([]);
      return;
    }
    (async () => {
      setLoading(true);
      const [{ data: it }, { data: ph }, { data: ps }] = await Promise.all([
        supabase.from("inventory_items").select("*").eq("id", itemId).maybeSingle(),
        supabase.from("inventory_price_history")
          .select("id,price,package_size,package_size_unit,cost_per_unit,changed_at,changed_by,note")
          .eq("item_id", itemId).order("changed_at", { ascending: false }),
        supabase.from("profiles").select("user_id,display_name"),
      ]);
      if (it) {
        const f = fromItem(it as unknown as InventoryItem);
        setForm(f);
        setOriginalPrice(it.price != null ? Number(it.price) : null);
        setNewPrice(it.price != null ? String(it.price) : "");
      }
      setHistory((ph ?? []) as PriceRow[]);
      const map: Record<string, string> = {};
      (ps ?? []).forEach((p) => { if (p.user_id) map[p.user_id] = p.display_name ?? ""; });
      setProfiles(map);
      setLoading(false);
    })();
  }, [open, itemId, defaultCategory]);

  // Density auto-fill for ingredients with weight units
  useEffect(() => {
    if (form.category !== "ingredient") return;
    if (!(WEIGHT_UNITS as string[]).includes(form.unit)) return;
    if (form.density_source === "manual") return;
    const d = lookupDensity(form.name);
    if (d != null) {
      setForm((f) => ({ ...f, density: String(d), density_source: "table" }));
    } else if (form.density_source === "table") {
      setForm((f) => ({ ...f, density: "", density_source: "" }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.name, form.unit, form.category]);

  // Reset workflow tags when changing category
  const setCategory = (c: Cat) => {
    setForm((f) => {
      const allowed = TAGS_BY_CAT[c];
      const next = f.workflow_tags.filter((t) => allowed.includes(t));
      return { ...f, category: c, workflow_tags: next.length ? next : [allowed[0]] };
    });
  };

  const requiredOk = useMemo(() => {
    if (!form.name.trim()) return false;
    if (form.category === "ingredient") {
      return !!(form.package_qty && form.unit_size && form.unit);
    }
    if (form.category === "consumable" || form.category === "disposable") {
      return !!form.package_qty;
    }
    return true;
  }, [form]);

  const priceForCalc = isEdit ? originalPrice : (form.price ? Number(form.price) : null);
  const costPerUnit = useMemo(() => {
    const p = priceForCalc;
    const q = Number(form.package_qty);
    if (!p || !q) return null;
    return p / q;
  }, [priceForCalc, form.package_qty]);
  const costPerFlOz = useMemo(() => {
    if (form.category !== "ingredient") return null;
    const cpu = costPerUnit;
    if (cpu == null) return null;
    const sz = Number(form.unit_size);
    if (!sz) return null;
    const flOz = itemToFlOz(sz, form.unit as IngredientUnit, form.density ? Number(form.density) : null);
    if (!flOz) return null;
    return cpu / flOz;
  }, [costPerUnit, form.unit_size, form.unit, form.density, form.category]);

  const toggleTag = (t: WorkflowTag) => {
    setForm((f) => ({
      ...f,
      workflow_tags: f.workflow_tags.includes(t)
        ? f.workflow_tags.filter((x) => x !== t)
        : [...f.workflow_tags, t],
    }));
  };

  const save = async () => {
    if (!requiredOk) return toast.error("Fill required fields");
    setSaving(true);
    const cat = form.category;
    const legacy: "consumable" | "disposable" = cat === "disposable" ? "disposable" : "consumable";
    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      library_code: form.library_code.trim() || null,
      category: legacy,
      category_v2: cat,
      workflow_tags: form.workflow_tags.length ? form.workflow_tags : ["all"],
      package_type: form.package_type.trim() || null,
      package_qty: form.package_qty ? Number(form.package_qty) : null,
      package_size: form.unit_size ? Number(form.unit_size) : null,
      package_size_unit: form.unit || null,
      unit: form.unit || "units",
      density: form.density ? Number(form.density) : null,
      density_source: form.density_source || null,
      supplier_name: form.supplier_name.trim() || null,
      purchase_url: form.purchase_url.trim() || null,
      physical_location: form.physical_location.trim() || null,
      notes: (form.description || form.notes).trim() || null,
      par_level: Number(form.par_level || 0),
      current_quantity: Number(form.current_quantity || 0),
    };
    if (!isEdit) {
      payload.price = form.price ? Number(form.price) : null;
      payload.created_by = user?.id ?? null;
      const { data, error } = await supabase.from("inventory_items")
        .insert(payload as never).select("id").single();
      setSaving(false);
      if (error) return toast.error(error.message);
      toast.success("Item added");
      onSaved?.(data!.id);
      onOpenChange(false);
    } else {
      const { error } = await supabase.from("inventory_items")
        .update(payload as never).eq("id", itemId!);
      setSaving(false);
      if (error) return toast.error(error.message);
      toast.success("Saved");
      onSaved?.(itemId!);
      onOpenChange(false);
    }
  };

  const confirmPriceUpdate = async () => {
    const np = Number(newPrice);
    if (!np || np <= 0) return toast.error("Enter a valid price");
    if (!itemId) return;
    const sz = form.unit_size ? Number(form.unit_size) : null;
    const cpu = form.package_qty ? np / Number(form.package_qty) : null;
    const { error: e1 } = await supabase.from("inventory_items")
      .update({ price: np, price_updated_at: new Date().toISOString() })
      .eq("id", itemId);
    if (e1) return toast.error(e1.message);
    const { error: e2 } = await supabase.from("inventory_price_history").insert({
      item_id: itemId,
      price: np,
      package_size: sz,
      package_size_unit: form.unit || null,
      cost_per_unit: cpu,
      note: reason.trim() || null,
      changed_by: user?.id ?? null,
    } as never);
    if (e2) return toast.error(e2.message);
    setOriginalPrice(np);
    setForm((f) => ({ ...f, price: String(np) }));
    setPriceMode("view");
    setReason("");
    toast.success("Price updated");
    const { data: ph } = await supabase.from("inventory_price_history")
      .select("id,price,package_size,package_size_unit,cost_per_unit,changed_at,changed_by,note")
      .eq("item_id", itemId).order("changed_at", { ascending: false });
    setHistory((ph ?? []) as PriceRow[]);
  };

  const tagsAllowed = TAGS_BY_CAT[form.category];
  const isWeight = (WEIGHT_UNITS as string[]).includes(form.unit);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:max-w-xl">
        <div className="sticky top-0 z-10 border-b bg-background px-5 pb-4 pt-5">
          <SheetHeader className="text-left">
            <SheetTitle>{isEdit ? "Edit item" : "New inventory item"}</SheetTitle>
          </SheetHeader>

          <div className="mt-4 grid gap-3">
            <div>
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="e.g. Coconut Milk"
              />
            </div>
            <div>
              <Label>Catalog / SKU code</Label>
              <Input
                value={form.library_code}
                onChange={(e) => set("library_code", e.target.value)}
                placeholder="e.g. GY1457"
              />
            </div>
            <div>
              <Label className="mb-1.5 block">Category</Label>
              <div className="grid grid-cols-5 gap-1 rounded-xl border bg-muted/40 p-1">
                {CAT_ORDER.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategory(c)}
                    className={cn(
                      "rounded-lg px-2 py-2 text-xs font-semibold transition-colors",
                      form.category === c
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {CATEGORY_V2_LABEL[c as InventoryCategoryV2]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="px-5 py-4">
          {loading ? (
            <div className="h-32 animate-pulse rounded-xl bg-muted/50" />
          ) : (
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="info">Info</TabsTrigger>
                <TabsTrigger value="history" disabled={!isEdit}>Price History</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="mt-4 grid gap-4">
                {(form.category === "ingredient" || form.category === "consumable" || form.category === "disposable") && (
                  <>
                    <div>
                      <Label>Package type</Label>
                      <Input
                        value={form.package_type}
                        onChange={(e) => set("package_type", e.target.value)}
                        placeholder={form.category === "disposable" ? 'e.g. "Sleeve", "Case"' : 'e.g. "Can", "Bag", "Bottle"'}
                      />
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <Label>Package qty</Label>
                        <Input
                          type="number" inputMode="decimal"
                          value={form.package_qty}
                          onChange={(e) => set("package_qty", e.target.value)}
                          placeholder="units per case"
                        />
                      </div>
                      {form.category !== "disposable" && (
                        <div>
                          <Label>Unit size{form.category === "consumable" ? " (optional)" : ""}</Label>
                          <Input
                            type="number" inputMode="decimal"
                            value={form.unit_size}
                            onChange={(e) => set("unit_size", e.target.value)}
                            placeholder="e.g. 13.5"
                          />
                        </div>
                      )}
                    </div>
                    {form.category !== "disposable" && (
                      <div>
                        <Label>Unit</Label>
                        <Select value={form.unit} onValueChange={(v) => set("unit", v)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {INGREDIENT_UNITS.map((u) => (
                              <SelectItem key={u} value={u}>{UNIT_LABELS[u]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {form.category === "ingredient" && isWeight && (
                      <div className="rounded-xl border bg-muted/30 p-3">
                        <Label>Density (g/ml)</Label>
                        <Input
                          type="number" inputMode="decimal"
                          value={form.density}
                          onChange={(e) => setForm((f) => ({
                            ...f, density: e.target.value, density_source: "manual",
                          }))}
                          placeholder="e.g. 1.03"
                        />
                        <p className="mt-1 text-xs text-muted-foreground">
                          {form.density_source === "table" ? "Auto-filled" :
                            form.density_source === "manual" ? "Manual" :
                            "Enter manually."}
                        </p>
                      </div>
                    )}

                    <div>
                      <Label className="mb-1.5 block">Workflow tags</Label>
                      <div className="flex flex-wrap gap-2">
                        {tagsAllowed.map((t) => {
                          const active = form.workflow_tags.includes(t);
                          return (
                            <button
                              key={t} type="button" onClick={() => toggleTag(t)}
                              className={cn(
                                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                                active
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-border bg-muted/50 text-muted-foreground hover:bg-muted",
                              )}
                            >
                              {WORKFLOW_LABEL[t]}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <PriceField
                      isEdit={isEdit}
                      form={form}
                      set={set}
                      originalPrice={originalPrice}
                      priceMode={priceMode}
                      setPriceMode={setPriceMode}
                      newPrice={newPrice}
                      setNewPrice={setNewPrice}
                      reason={reason}
                      setReason={setReason}
                      onConfirm={confirmPriceUpdate}
                    />

                    <div className="rounded-xl border bg-muted/40 p-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Cost per unit:</span>
                        <span className="font-semibold">
                          {costPerUnit != null ? `$${costPerUnit.toFixed(4)}` : "—"}
                        </span>
                      </div>
                      {form.category === "ingredient" && (
                        <div className="mt-1 flex justify-between">
                          <span className="text-muted-foreground">Cost per fl oz:</span>
                          <span className="font-semibold">
                            {costPerFlOz != null ? `$${costPerFlOz.toFixed(4)}` : "—"}
                          </span>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {form.category === "equipment" && (
                  <>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <Label>Unit price ($)</Label>
                        <Input
                          type="number" inputMode="decimal"
                          value={form.price}
                          onChange={(e) => set("price", e.target.value)}
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <Label>Quantity owned</Label>
                        <Input
                          type="number" inputMode="decimal"
                          value={form.current_quantity}
                          onChange={(e) => set("current_quantity", e.target.value)}
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="mb-1.5 block">Workflow tags</Label>
                      <div className="flex flex-wrap gap-2">
                        {tagsAllowed.map((t) => (
                          <button
                            key={t} type="button" onClick={() => toggleTag(t)}
                            className={cn(
                              "rounded-full border px-3 py-1.5 text-xs font-medium",
                              form.workflow_tags.includes(t)
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border bg-muted/50 text-muted-foreground",
                            )}
                          >
                            {WORKFLOW_LABEL[t]}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <Label>Notes</Label>
                      <Textarea
                        rows={3}
                        value={form.notes}
                        onChange={(e) => set("notes", e.target.value)}
                      />
                    </div>
                  </>
                )}

                {form.category === "other" && (
                  <>
                    <div>
                      <Label>Price ($)</Label>
                      <Input
                        type="number" inputMode="decimal"
                        value={form.price}
                        onChange={(e) => set("price", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="mb-1.5 block">Workflow tags</Label>
                      <div className="flex flex-wrap gap-2">
                        {tagsAllowed.map((t) => (
                          <button
                            key={t} type="button" onClick={() => toggleTag(t)}
                            className={cn(
                              "rounded-full border px-3 py-1.5 text-xs font-medium",
                              form.workflow_tags.includes(t)
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border bg-muted/50 text-muted-foreground",
                            )}
                          >
                            {WORKFLOW_LABEL[t]}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <Label>Notes</Label>
                      <Textarea
                        rows={3}
                        value={form.notes}
                        onChange={(e) => set("notes", e.target.value)}
                      />
                    </div>
                  </>
                )}
              </TabsContent>

              <TabsContent value="info" className="mt-4 grid gap-4">
                <div>
                  <Label>Description</Label>
                  <Textarea
                    rows={3}
                    value={form.description}
                    onChange={(e) => set("description", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Supplier / Company</Label>
                  <Input
                    value={form.supplier_name}
                    onChange={(e) => set("supplier_name", e.target.value)}
                    placeholder="e.g. Azure Standard"
                  />
                </div>
                <div>
                  <Label>Purchase URL</Label>
                  <Input
                    value={form.purchase_url}
                    onChange={(e) => set("purchase_url", e.target.value)}
                    placeholder="https://…"
                  />
                </div>
                <div>
                  <Label>Physical location</Label>
                  <Input
                    value={form.physical_location}
                    onChange={(e) => set("physical_location", e.target.value)}
                    placeholder="aisle, warehouse, or address"
                  />
                </div>
              </TabsContent>

              <TabsContent value="history" className="mt-4">
                {history.length === 0 ? (
                  <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                    No price changes recorded yet.
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/40 text-left text-muted-foreground">
                        <tr>
                          <th className="p-2">Date &amp; Time</th>
                          <th className="p-2">Case Price</th>
                          <th className="p-2">Unit Size</th>
                          <th className="p-2">Cost/Unit</th>
                          <th className="p-2">Reason</th>
                          <th className="p-2">Changed By</th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.map((h) => (
                          <tr key={h.id} className="border-t">
                            <td className="p-2">{format(parseISO(h.changed_at), "MMM d, yyyy 'at' h:mm a")}</td>
                            <td className="p-2">{h.price != null ? `$${Number(h.price).toFixed(2)}` : "—"}</td>
                            <td className="p-2">{h.package_size != null ? `${h.package_size}${h.package_size_unit ?? ""}` : "—"}</td>
                            <td className="p-2">{h.cost_per_unit != null ? `$${Number(h.cost_per_unit).toFixed(4)}` : "—"}</td>
                            <td className="p-2">{h.note || "—"}</td>
                            <td className="p-2">{h.changed_by ? (profiles[h.changed_by] || "—") : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </div>

        <div className="sticky bottom-0 z-10 flex justify-end gap-2 border-t bg-background px-5 py-3">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={!requiredOk || saving}>
            {saving ? "Saving…" : isEdit ? "Save changes" : "Save item"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function PriceField({
  isEdit, form, set, originalPrice, priceMode, setPriceMode,
  newPrice, setNewPrice, reason, setReason, onConfirm,
}: {
  isEdit: boolean;
  form: FormState;
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  originalPrice: number | null;
  priceMode: "view" | "update";
  setPriceMode: (m: "view" | "update") => void;
  newPrice: string;
  setNewPrice: (v: string) => void;
  reason: string;
  setReason: (v: string) => void;
  onConfirm: () => void;
}) {
  if (!isEdit) {
    return (
      <div>
        <Label>Case price ($)</Label>
        <Input
          type="number" inputMode="decimal"
          value={form.price}
          onChange={(e) => set("price", e.target.value)}
          placeholder="0.00"
        />
      </div>
    );
  }
  return (
    <div className="grid gap-2">
      <Label>Case price</Label>
      <div className="flex items-center gap-2">
        <div className="flex-1 rounded-md border bg-muted/30 px-3 py-2 text-sm font-semibold">
          {originalPrice != null ? `$${originalPrice.toFixed(2)}` : "—"}
        </div>
        {priceMode === "view" && (
          <Button type="button" variant="outline" size="sm" onClick={() => setPriceMode("update")}>
            Update price
          </Button>
        )}
      </div>
      {priceMode === "update" && (
        <div className="grid gap-2 rounded-xl border bg-muted/30 p-3">
          <div>
            <Label className="text-xs">New price ($)</Label>
            <Input
              type="number" inputMode="decimal"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">Reason (optional)</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Supplier raised prices"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => setPriceMode("view")}>
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={onConfirm}>
              Confirm price update
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}