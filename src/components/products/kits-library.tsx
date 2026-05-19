import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from "@/components/ui/sheet";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { fmtUSD, inventoryItemToDispItem, formatIngredientLabel } from "@/lib/ingredients";
import type { DispItemFromInventory } from "@/lib/ingredients";

type Item = DispItemFromInventory;
type KitItem = { id?: string; disposable_item_id: string; qty: number };
type Kit = {
  id: string;
  name: string;
  target_size: number;
  items: KitItem[];
};

const costPerUnit = (i: Pick<Item, "package_qty" | "package_price">) =>
  i.package_qty > 0 ? i.package_price / i.package_qty : null;

const kitCost = (kit: Pick<Kit, "items">, items: Item[]) =>
  kit.items.reduce((sum, ki) => {
    const it = items.find((i) => i.id === ki.disposable_item_id);
    if (!it) return sum;
    const cpu = costPerUnit(it);
    return cpu == null ? sum : sum + cpu * (Number(ki.qty) || 0);
  }, 0);

export function KitsLibrary() {
  const [items, setItems] = useState<Item[]>([]);
  const [kits, setKits] = useState<Kit[]>([]);
  const [loading, setLoading] = useState(true);
  const [kitEditing, setKitEditing] = useState<Kit | null>(null);
  const [kitOpen, setKitOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: itemRows, error: e1 }, { data: kitRows, error: e2 }, { data: kiRows, error: e3 }] =
      await Promise.all([
        supabase.from("inventory_items").select("*")
          .eq("category_v2", "disposable").is("deleted_at", null).order("name"),
        supabase.from("disposable_kits").select("*").is("deleted_at", null).order("target_size"),
        supabase.from("disposable_kit_items").select("*"),
      ]);
    if (e1 || e2 || e3) toast.error((e1 ?? e2 ?? e3)!.message);
    const its = (itemRows ?? []).map((r) => inventoryItemToDispItem(r as never)) as Item[];
    const ks = (kitRows ?? []) as Omit<Kit, "items">[];
    const kis = (kiRows ?? []) as (KitItem & { kit_id: string })[];
    setItems(its);
    setKits(ks.map((k) => ({ ...k, items: kis.filter((x) => x.kit_id === k.id) })));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Bundles of disposable items per serving size. Items pulled from Inventory → Disposables.
        </p>
        <Button onClick={() => { setKitEditing(null); setKitOpen(true); }} size="sm" disabled={items.length === 0}>
          <Plus className="mr-1 h-4 w-4" />Add Kit
        </Button>
      </div>
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {loading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Loading…</div>
        ) : kits.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-semibold">No kits yet.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {items.length === 0
                ? "Add disposable items in Inventory first, then build a kit."
                : "Build a kit to get started."}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kit Name</TableHead>
                <TableHead className="text-right">Target Size</TableHead>
                <TableHead>Items Included</TableHead>
                <TableHead className="text-right">Kit Cost</TableHead>
                <TableHead className="w-[1%]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {kits.map((k) => {
                const summary = k.items
                  .map((ki) => {
                    const it = items.find((i) => i.id === ki.disposable_item_id);
                    return it ? `${ki.qty}× ${it.name}` : null;
                  })
                  .filter(Boolean)
                  .join(", ");
                return (
                  <TableRow key={k.id} className="cursor-pointer" onClick={() => { setKitEditing(k); setKitOpen(true); }}>
                    <TableCell className="font-semibold">{k.name}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{k.target_size} fl oz</TableCell>
                    <TableCell className="text-muted-foreground">{summary || "—"}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{fmtUSD(kitCost(k, items), 4)}</TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); setKitEditing(k); setKitOpen(true); }} aria-label="Edit">
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

      <KitSheet open={kitOpen} onOpenChange={setKitOpen} editing={kitEditing} items={items}
        onSaved={() => { setKitOpen(false); load(); }} />
    </div>
  );
}

function KitSheet({
  open, onOpenChange, editing, items, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Kit | null;
  items: Item[];
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [targetSize, setTargetSize] = useState("");
  const [rows, setRows] = useState<KitItem[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? "");
    setTargetSize(editing ? String(editing.target_size) : "");
    setRows(editing ? editing.items.map((i) => ({ disposable_item_id: i.disposable_item_id, qty: Number(i.qty) })) : []);
  }, [open, editing]);

  const liveCost = useMemo(() => kitCost({ items: rows }, items), [rows, items]);

  const addRow = () => setRows((r) => [...r, { disposable_item_id: "", qty: 1 }]);
  const updateRow = (idx: number, patch: Partial<KitItem>) =>
    setRows((r) => r.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
  const removeRow = (idx: number) => setRows((r) => r.filter((_, i) => i !== idx));

  const save = async () => {
    if (!name.trim()) return toast.error("Name is required");
    const ts = Number(targetSize);
    if (!ts || ts <= 0) return toast.error("Target size must be > 0");
    const cleaned = rows.filter((r) => r.disposable_item_id && Number(r.qty) > 0);
    if (cleaned.length === 0) return toast.error("Add at least one item");

    setSaving(true);
    const kitPayload = { name: name.trim(), target_size: ts };
    let kitId = editing?.id;
    if (editing) {
      const { error } = await supabase.from("disposable_kits").update(kitPayload).eq("id", editing.id);
      if (error) { setSaving(false); return toast.error(error.message); }
      await supabase.from("disposable_kit_items").delete().eq("kit_id", editing.id);
    } else {
      const { data, error } = await supabase.from("disposable_kits").insert(kitPayload).select("id").single();
      if (error || !data) { setSaving(false); return toast.error(error?.message ?? "Insert failed"); }
      kitId = data.id;
    }
    const { error: e2 } = await supabase.from("disposable_kit_items").insert(
      cleaned.map((r) => ({ kit_id: kitId!, disposable_item_id: r.disposable_item_id, qty: Number(r.qty) }))
    );
    setSaving(false);
    if (e2) return toast.error(e2.message);
    toast.success(editing ? "Kit updated" : "Kit added");
    onSaved();
  };

  const remove = async () => {
    if (!editing) return;
    if (!confirm(`Delete "${editing.name}"? This cannot be undone.`)) return;
    const { error } = await supabase.from("disposable_kits")
      .update({ deleted_at: new Date().toISOString() }).eq("id", editing.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted"); onSaved();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{editing ? "Edit kit" : "Add kit"}</SheetTitle>
          <SheetDescription>
            {editing ? "Update the kit details below." : "Bundle disposables for a serving size."}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex-1 space-y-5">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Kit name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. 12oz Kit" />
            </div>
            <div>
              <Label>Target size (fl oz)</Label>
              <Input type="number" inputMode="decimal" value={targetSize}
                onChange={(e) => setTargetSize(e.target.value)} placeholder="12" />
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Items</h3>
            <div className="space-y-2">
              {rows.length === 0 ? (
                <p className="text-xs text-muted-foreground">No items yet.</p>
              ) : (
                rows.map((row, idx) => (
                  <div key={idx} className="flex items-end gap-2">
                    <div className="flex-1 min-w-0">
                      <Label className="text-xs">Item</Label>
                      <Select value={row.disposable_item_id || undefined}
                        onValueChange={(v) => updateRow(idx, { disposable_item_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                        <SelectContent>
                          {items.map((it) => (
                            <SelectItem key={it.id} value={it.id}>
                              {formatIngredientLabel(it as never)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-20">
                      <Label className="text-xs">Qty</Label>
                      <Input type="number" inputMode="decimal" value={row.qty}
                        onChange={(e) => updateRow(idx, { qty: Number(e.target.value) })} />
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => removeRow(idx)} aria-label="Remove">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
              <Button type="button" variant="link" size="sm" className="px-0" onClick={addRow}>
                + Add item
              </Button>
            </div>

            <div className="rounded-lg bg-muted/60 p-3 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Kit Cost</span>
                <span className="font-semibold">{fmtUSD(liveCost, 4)}</span>
              </div>
            </div>
          </div>
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