import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  CATEGORY_V2_LABEL, CATEGORY_V2_VALUES, UNIT_OPTIONS, WORKFLOW_LABEL,
  type InventoryCategoryV2, type WorkflowTag,
} from "@/lib/inventory";

export type ItemFormState = {
  name: string;
  category_v2: InventoryCategoryV2;
  workflow_tags: WorkflowTag[];
  unit: string;
  package_type: string;
  supplier_name: string;
  purchase_url: string;
  physical_location: string;
  price: string;
  package_size: string;
  package_size_unit: string;
  current_quantity: string;
  par_level: string;
  notes: string;
};

export const emptyItemForm: ItemFormState = {
  name: "", category_v2: "ingredient", workflow_tags: ["production_batch", "restock"],
  unit: "units", package_type: "", supplier_name: "", purchase_url: "", physical_location: "",
  price: "", package_size: "", package_size_unit: "",
  current_quantity: "0", par_level: "0", notes: "",
};

export function ItemForm({
  value, onChange,
}: {
  value: ItemFormState;
  onChange: (v: ItemFormState) => void;
}) {
  const set = <K extends keyof ItemFormState>(k: K, v: ItemFormState[K]) => onChange({ ...value, [k]: v });
  const costPerUnit = useMemo(() => {
    const p = Number(value.price); const s = Number(value.package_size);
    if (!p || !s) return null;
    return p / s;
  }, [value.price, value.package_size]);

  const toggleTag = (t: WorkflowTag) => {
    const has = value.workflow_tags.includes(t);
    set("workflow_tags", has ? value.workflow_tags.filter((x) => x !== t) : [...value.workflow_tags, t]);
  };

  return (
    <div className="grid gap-6">
      <Section title="Identity">
        <div>
          <Label>Name</Label>
          <Input value={value.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Biscoff cookies" />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label>Category</Label>
            <Select value={value.category_v2} onValueChange={(v) => set("category_v2", v as InventoryCategoryV2)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORY_V2_VALUES.map((c) => <SelectItem key={c} value={c}>{CATEGORY_V2_LABEL[c]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Unit of measurement</Label>
            <Select value={value.unit} onValueChange={(v) => set("unit", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {UNIT_OPTIONS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label>Workflow tags</Label>
          <div className="mt-1 flex flex-wrap gap-3 rounded-xl border p-3">
            {(["production_batch", "log_event", "restock", "all"] as WorkflowTag[]).map((t) => (
              <label key={t} className="flex items-center gap-2 text-sm">
                <Checkbox checked={value.workflow_tags.includes(t)} onCheckedChange={() => toggleTag(t)} />
                {WORKFLOW_LABEL[t]}
              </label>
            ))}
          </div>
        </div>
        <div>
          <Label>Package type</Label>
          <Input value={value.package_type} onChange={(e) => set("package_type", e.target.value)} placeholder="bag, bottle, case, box…" />
        </div>
      </Section>

      <Section title="Purchasing">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label>Supplier or store</Label>
            <Input value={value.supplier_name} onChange={(e) => set("supplier_name", e.target.value)} />
          </div>
          <div>
            <Label>Purchase URL or location</Label>
            <Input value={value.purchase_url} onChange={(e) => set("purchase_url", e.target.value)} placeholder="https://… or store address" />
          </div>
        </div>
        <div>
          <Label>Physical location (in storage)</Label>
          <Input value={value.physical_location} onChange={(e) => set("physical_location", e.target.value)} placeholder="e.g. dry storage shelf 2" />
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <Label>Price ($)</Label>
            <Input type="number" inputMode="decimal" value={value.price} onChange={(e) => set("price", e.target.value)} placeholder="0.00" />
          </div>
          <div>
            <Label>Package size</Label>
            <Input type="number" inputMode="decimal" value={value.package_size} onChange={(e) => set("package_size", e.target.value)} placeholder="e.g. 400" />
          </div>
          <div>
            <Label>Size unit</Label>
            <Select value={value.package_size_unit || ""} onValueChange={(v) => set("package_size_unit", v)}>
              <SelectTrigger><SelectValue placeholder="unit" /></SelectTrigger>
              <SelectContent>
                {UNIT_OPTIONS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="rounded-xl bg-muted/60 p-3 text-sm">
          <span className="text-muted-foreground">Cost per unit: </span>
          <span className="font-semibold">
            {costPerUnit !== null ? `$${costPerUnit.toFixed(4)}` : "—"}
          </span>
          <span className="ml-2 text-xs text-muted-foreground">(auto · updates with price)</span>
        </div>
      </Section>

      <Section title="Stock">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label>Current quantity</Label>
            <Input type="number" inputMode="decimal" value={value.current_quantity} onChange={(e) => set("current_quantity", e.target.value)} />
          </div>
          <div>
            <Label>Par level</Label>
            <Input type="number" inputMode="decimal" value={value.par_level} onChange={(e) => set("par_level", e.target.value)} />
          </div>
        </div>
      </Section>

      <Section title="Notes">
        <Textarea rows={3} value={value.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Observations, prep notes…" />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-3">
      <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}