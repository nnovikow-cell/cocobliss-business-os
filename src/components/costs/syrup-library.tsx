import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from "@/components/ui/sheet";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { fmtUSD } from "@/lib/ingredients";
import { Section } from "./section";

export type Syrup = {
  id: string;
  name: string;
  description: string | null;
  bottle_size: number;
  bottle_price: number;
  supplier_name: string | null;
  source_url: string | null;
  source_address: string | null;
};

function syrupCostPerFlOz(s: Pick<Syrup, "bottle_price" | "bottle_size">): number | null {
  if (!s.bottle_size || s.bottle_size <= 0) return null;
  return s.bottle_price / s.bottle_size;
}

export function SyrupLibrary() {
  const [rows, setRows] = useState<Syrup[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Syrup | null>(null);
  const [open, setOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("syrups")
      .select("*")
      .is("deleted_at", null)
      .order("name");
    if (error) toast.error(error.message);
    setRows((data ?? []) as Syrup[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Syrups added per cup at pour time.</p>
        <Button onClick={() => { setEditing(null); setOpen(true); }} size="sm">
          <Plus className="mr-1 h-4 w-4" />Add Syrup
        </Button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {loading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-semibold">No syrups yet.</p>
            <p className="mt-1 text-sm text-muted-foreground">Add your first one to get started.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="text-right">Bottle Size</TableHead>
                <TableHead className="text-right">Bottle Price</TableHead>
                <TableHead className="text-right">Cost/fl oz</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead className="w-[1%]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const cpf = syrupCostPerFlOz(r);
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-semibold">{r.name}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{r.bottle_size} fl oz</TableCell>
                    <TableCell className="text-right">{fmtUSD(r.bottle_price)}</TableCell>
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

      <SyrupSheet open={open} onOpenChange={setOpen} editing={editing}
        onSaved={() => { setOpen(false); load(); }} />
    </div>
  );
}

type FormState = {
  name: string; description: string;
  bottle_size: string; bottle_price: string;
  supplier_name: string; source_url: string; source_address: string;
};

const emptyForm: FormState = {
  name: "", description: "", bottle_size: "", bottle_price: "",
  supplier_name: "", source_url: "", source_address: "",
};

function fromSyrup(s: Syrup): FormState {
  return {
    name: s.name, description: s.description ?? "",
    bottle_size: String(s.bottle_size), bottle_price: String(s.bottle_price),
    supplier_name: s.supplier_name ?? "",
    source_url: s.source_url ?? "",
    source_address: s.source_address ?? "",
  };
}

function SyrupSheet({
  open, onOpenChange, editing, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Syrup | null;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(editing ? fromSyrup(editing) : emptyForm);
  }, [open, editing]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const cpf = useMemo(() => {
    const size = Number(form.bottle_size);
    const price = Number(form.bottle_price);
    return syrupCostPerFlOz({ bottle_size: size, bottle_price: price });
  }, [form.bottle_size, form.bottle_price]);

  const save = async () => {
    if (!form.name.trim()) return toast.error("Name is required");
    const size = Number(form.bottle_size);
    const price = Number(form.bottle_price);
    if (!size || size <= 0) return toast.error("Bottle size must be > 0");
    if (!price || price < 0) return toast.error("Bottle price required");

    setSaving(true);
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      bottle_size: size, bottle_price: price,
      supplier_name: form.supplier_name.trim() || null,
      source_url: form.source_url.trim() || null,
      source_address: form.source_address.trim() || null,
    };
    const { error } = editing
      ? await supabase.from("syrups").update(payload).eq("id", editing.id)
      : await supabase.from("syrups").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Syrup updated" : "Syrup added");
    onSaved();
  };

  const remove = async () => {
    if (!editing) return;
    if (!confirm(`Delete "${editing.name}"? This cannot be undone.`)) return;
    const { error } = await supabase.from("syrups")
      .update({ deleted_at: new Date().toISOString() }).eq("id", editing.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted"); onSaved();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{editing ? "Edit syrup" : "Add syrup"}</SheetTitle>
          <SheetDescription>
            {editing ? "Update the details below." : "Add a syrup to the library."}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex-1 space-y-5">
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Biscoff" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} />
            </div>
          </div>

          <Section title="Bottle">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Bottle size (fl oz)</Label>
                <Input type="number" inputMode="decimal" value={form.bottle_size}
                  onChange={(e) => set("bottle_size", e.target.value)} placeholder="e.g. 33.8" />
              </div>
              <div>
                <Label>Bottle price ($)</Label>
                <Input type="number" inputMode="decimal" value={form.bottle_price}
                  onChange={(e) => set("bottle_price", e.target.value)} placeholder="0.00" />
              </div>
            </div>

            <div className="rounded-lg bg-muted/60 p-3 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cost per fl oz</span>
                <span className="font-semibold">{fmtUSD(cpf, 4)}</span>
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