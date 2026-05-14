import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from "@/components/ui/sheet";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  type Ingredient, type IngredientUnit, INGREDIENT_UNITS, WEIGHT_UNITS,
  costPerItem, costPerFlOz, fmtUSD, lookupDensity,
} from "@/lib/ingredients";
import { Section } from "./section";

export function IngredientLibrary() {
  const [rows, setRows] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Ingredient | null>(null);
  const [open, setOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("ingredients")
      .select("*")
      .is("deleted_at", null)
      .order("name");
    if (error) toast.error(error.message);
    setRows((data ?? []) as Ingredient[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Every raw ingredient used in product formulas.</p>
        <Button onClick={() => { setEditing(null); setOpen(true); }} size="sm">
          <Plus className="mr-1 h-4 w-4" />Add Ingredient
        </Button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {loading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-semibold">No ingredients yet.</p>
            <p className="mt-1 text-sm text-muted-foreground">Add your first one to get started.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Package</TableHead>
                <TableHead className="text-right">Pkg Price</TableHead>
                <TableHead className="text-right">Cost/Item</TableHead>
                <TableHead className="text-right">Cost/fl oz</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead className="w-[1%]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const cpi = costPerItem(r.package_price, r.package_qty);
                const cpf = costPerFlOz(r);
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-semibold">{r.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {r.package_qty} × {r.item_size} {r.unit}
                    </TableCell>
                    <TableCell className="text-right">{fmtUSD(r.package_price)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{fmtUSD(cpi)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{fmtUSD(cpf, 4)}</TableCell>
                    <TableCell className="text-muted-foreground">{r.supplier_name ?? "—"}</TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" onClick={() => { setEditing(r); setOpen(true); }} aria-label="Edit">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <IngredientSheet open={open} onOpenChange={setOpen} editing={editing}
        onSaved={() => { setOpen(false); load(); }} />
    </div>
  );
}

type FormState = {
  name: string; description: string;
  package_qty: string; package_price: string; item_size: string;
  unit: IngredientUnit;
  density: string; density_source: "table" | "manual" | "";
  supplier_name: string; source_url: string; source_address: string;
};

const emptyForm: FormState = {
  name: "", description: "", package_qty: "", package_price: "", item_size: "",
  unit: "fl oz", density: "", density_source: "",
  supplier_name: "", source_url: "", source_address: "",
};

function fromIngredient(i: Ingredient): FormState {
  return {
    name: i.name, description: i.description ?? "",
    package_qty: String(i.package_qty), package_price: String(i.package_price),
    item_size: String(i.item_size), unit: i.unit,
    density: i.density != null ? String(i.density) : "",
    density_source: i.density_source ?? "",
    supplier_name: i.supplier_name ?? "", source_url: i.source_url ?? "",
    source_address: i.source_address ?? "",
  };
}

function IngredientSheet({
  open, onOpenChange, editing, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Ingredient | null;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(editing ? fromIngredient(editing) : emptyForm);
  }, [open, editing]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const isWeight = WEIGHT_UNITS.includes(form.unit);

  useEffect(() => {
    if (!isWeight) return;
    if (form.density_source === "manual" && form.density) return;
    const auto = lookupDensity(form.name);
    if (auto != null) {
      setForm((f) => ({ ...f, density: String(auto), density_source: "table" }));
    } else if (form.density_source === "table") {
      setForm((f) => ({ ...f, density: "", density_source: "" }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.name, form.unit]);

  const preview = useMemo(() => {
    const qty = Number(form.package_qty);
    const price = Number(form.package_price);
    const size = Number(form.item_size);
    const dens = form.density ? Number(form.density) : null;
    return {
      cpi: costPerItem(price, qty),
      cpf: costPerFlOz({ package_price: price, package_qty: qty, item_size: size, unit: form.unit, density: dens }),
    };
  }, [form]);

  const save = async () => {
    if (!form.name.trim()) return toast.error("Name is required");
    const qty = Number(form.package_qty);
    const price = Number(form.package_price);
    const size = Number(form.item_size);
    if (!qty || qty <= 0) return toast.error("Package qty must be > 0");
    if (!price || price < 0) return toast.error("Package price required");
    if (!size || size <= 0) return toast.error("Item size must be > 0");
    if (WEIGHT_UNITS.includes(form.unit) && (!form.density || Number(form.density) <= 0)) {
      return toast.error("Density is required for weight units");
    }

    setSaving(true);
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      package_qty: qty, package_price: price, item_size: size, unit: form.unit,
      density: form.density ? Number(form.density) : null,
      density_source: form.density ? (form.density_source || "manual") : null,
      supplier_name: form.supplier_name.trim() || null,
      source_url: form.source_url.trim() || null,
      source_address: form.source_address.trim() || null,
    };

    const { error } = editing
      ? await supabase.from("ingredients").update(payload).eq("id", editing.id)
      : await supabase.from("ingredients").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Ingredient updated" : "Ingredient added");
    onSaved();
  };

  const remove = async () => {
    if (!editing) return;
    if (!confirm(`Delete "${editing.name}"? This cannot be undone.`)) return;
    const { error } = await supabase.from("ingredients")
      .update({ deleted_at: new Date().toISOString() }).eq("id", editing.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted"); onSaved();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{editing ? "Edit ingredient" : "Add ingredient"}</SheetTitle>
          <SheetDescription>
            {editing ? "Update the details below." : "Add a raw ingredient to the library."}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex-1 space-y-5">
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Coconut Milk" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} />
            </div>
          </div>

          <Section title="Package">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Package qty</Label>
                <Input type="number" inputMode="decimal" value={form.package_qty}
                  onChange={(e) => set("package_qty", e.target.value)} placeholder="e.g. 12" />
              </div>
              <div>
                <Label>Package price ($)</Label>
                <Input type="number" inputMode="decimal" value={form.package_price}
                  onChange={(e) => set("package_price", e.target.value)} placeholder="0.00" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Item size</Label>
                <Input type="number" inputMode="decimal" value={form.item_size}
                  onChange={(e) => set("item_size", e.target.value)} placeholder="e.g. 13.5" />
              </div>
              <div>
                <Label>Unit</Label>
                <Select value={form.unit} onValueChange={(v) => set("unit", v as IngredientUnit)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {INGREDIENT_UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {isWeight && (
              <div>
                <div className="flex items-center justify-between">
                  <Label>Density (g/ml)</Label>
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {form.density_source === "table" ? "Auto-filled" : form.density ? "Manual" : "Enter manually"}
                  </span>
                </div>
                <Input type="number" inputMode="decimal" value={form.density}
                  onChange={(e) => setForm((f) => ({ ...f, density: e.target.value, density_source: "manual" }))}
                  placeholder="e.g. 1.03" />
              </div>
            )}

            <div className="rounded-lg bg-muted/60 p-3 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cost / item</span>
                <span className="font-semibold">{fmtUSD(preview.cpi)}</span>
              </div>
              <div className="mt-1 flex justify-between">
                <span className="text-muted-foreground">Cost / fl oz</span>
                <span className="font-semibold">{fmtUSD(preview.cpf, 4)}</span>
              </div>
            </div>
          </Section>

          <Section title="Where to find it">
            <div>
              <Label>Supplier name</Label>
              <Input value={form.supplier_name} onChange={(e) => set("supplier_name", e.target.value)} />
            </div>
            <div>
              <Label>Source URL</Label>
              <Input value={form.source_url} onChange={(e) => set("source_url", e.target.value)} placeholder="https://…" />
            </div>
            <div>
              <Label>Source address</Label>
              <Input value={form.source_address} onChange={(e) => set("source_address", e.target.value)} />
            </div>
          </Section>
        </div>

        <SheetFooter className="mt-6 flex flex-row gap-2 sm:justify-between">
          {editing ? (
            <Button variant="ghost" onClick={remove} className="text-destructive">
              <Trash2 className="mr-1 h-4 w-4" />Delete
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}