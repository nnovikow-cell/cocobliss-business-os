import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Pencil, Trash2, X, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { fmtUSD } from "@/lib/ingredients";
import type { Ingredient } from "@/lib/ingredients";
import {
  totalCOGS, formulaCostForServing, syrupCostForServing, kitCostForServing,
  type RecipeProduct, type RecipeFormula, type RecipeServingSize,
  type DispItem, type DispKit, type SyrupLite,
} from "@/lib/products";

export const Route = createFileRoute("/costs/products/")({ component: ProductDetailPage });

type FormulaWithIngs = RecipeFormula & { ingredients: { id: string; ingredient_id: string; ratio: number }[] };

function ProductDetailPage() {
  const { id } = Route.useParams();
  const [product, setProduct] = useState<RecipeProduct | null>(null);
  const [formulas, setFormulas] = useState<FormulaWithIngs[]>([]);
  const [sizes, setSizes] = useState<RecipeServingSize[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [kits, setKits] = useState<DispKit[]>([]);
  const [dispItems, setDispItems] = useState<DispItem[]>([]);
  const [syrups, setSyrups] = useState<SyrupLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFormulaId, setSelectedFormulaId] = useState<string | null>(null);

  const [newVersionOpen, setNewVersionOpen] = useState(false);
  const [sizeOpen, setSizeOpen] = useState(false);
  const [editingSize, setEditingSize] = useState<RecipeServingSize | null>(null);

  const load = async () => {
    setLoading(true);
    const [
      { data: pRow, error: pErr },
      { data: fRows },
      { data: fiRows },
      { data: sRows },
      { data: ingRows },
      { data: kitRows },
      { data: kiRows },
      { data: diRows },
      { data: syRows },
    ] = await Promise.all([
      supabase.from("recipe_products").select("*").eq("id", id).maybeSingle(),
      supabase.from("recipe_formulas").select("*").eq("product_id", id).is("deleted_at", null).order("created_at"),
      supabase.from("recipe_formula_ingredients").select("*"),
      supabase.from("recipe_serving_sizes").select("*").eq("product_id", id).order("size_fl_oz"),
      supabase.from("ingredients").select("*").is("deleted_at", null).order("name"),
      supabase.from("disposable_kits").select("*").is("deleted_at", null).order("target_size"),
      supabase.from("disposable_kit_items").select("*"),
      supabase.from("disposable_items").select("*").is("deleted_at", null),
      supabase.from("syrups").select("*").is("deleted_at", null).order("name"),
    ]);
    if (pErr) toast.error(pErr.message);
    const p = (pRow ?? null) as RecipeProduct | null;
    setProduct(p);
    const allFingreds = (fiRows ?? []) as { id: string; formula_id: string; ingredient_id: string; ratio: number }[];
    const fs: FormulaWithIngs[] = ((fRows ?? []) as RecipeFormula[]).map((f) => ({
      ...f,
      batch_size: Number(f.batch_size),
      ingredients: allFingreds
        .filter((x) => x.formula_id === f.id)
        .map((x) => ({ id: x.id, ingredient_id: x.ingredient_id, ratio: Number(x.ratio) })),
    }));
    setFormulas(fs);
    setSizes(((sRows ?? []) as RecipeServingSize[]).map((s) => ({ ...s, size_fl_oz: Number(s.size_fl_oz) })));
    setIngredients((ingRows ?? []) as Ingredient[]);
    setDispItems((diRows ?? []) as DispItem[]);
    const dkRaw = (kitRows ?? []) as Omit<DispKit, "items">[];
    const kis = (kiRows ?? []) as { kit_id: string; disposable_item_id: string; qty: number }[];
    setKits(dkRaw.map((k) => ({ ...k, target_size: Number(k.target_size), items: kis.filter((x) => x.kit_id === k.id) })));
    setSyrups(((syRows ?? []) as SyrupLite[]).map((s) => ({ ...s, bottle_size: Number(s.bottle_size), bottle_price: Number(s.bottle_price) })));

    setSelectedFormulaId((prev) => {
      if (prev && fs.some((f) => f.id === prev)) return prev;
      return p?.active_formula_id ?? fs[0]?.id ?? null;
    });
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const selectedFormula = formulas.find((f) => f.id === selectedFormulaId) ?? null;
  const activeFormula = formulas.find((f) => f.id === product?.active_formula_id) ?? null;

  if (loading) {
    return <AppShell><div className="p-10 text-center text-sm text-muted-foreground">Loading…</div></AppShell>;
  }
  if (!product) {
    return (
      <AppShell>
        <div className="p-10 text-center">
          <p className="text-sm font-semibold">Product not found.</p>
          <Link to="/costs/products" className="mt-2 inline-block text-sm text-primary">Back to products</Link>
        </div>
      </AppShell>
    );
  }

  const setActive = async (fid: string) => {
    const { error } = await supabase.from("recipe_products").update({ active_formula_id: fid }).eq("id", product.id);
    if (error) return toast.error(error.message);
    toast.success("Active version updated");
    load();
  };

  return (
    <AppShell>
      <header className="mb-4">
        <Link to="/costs/products" className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" />Back to Products
        </Link>
        <h1 className="text-2xl font-black tracking-tight">{product.name}</h1>
        {product.description && <p className="text-sm text-muted-foreground">{product.description}</p>}
      </header>

      {/* Section 1: Formula Versions */}
      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Formula Versions</h2>
          <Button size="sm" onClick={() => setNewVersionOpen(true)}>
            <Plus className="mr-1 h-4 w-4" />New Version
          </Button>
        </div>

        {formulas.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            No formula versions yet. Create one to get started.
          </div>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap gap-2">
              {formulas.map((f) => {
                const isActive = f.id === product.active_formula_id;
                const isSelected = f.id === selectedFormulaId;
                return (
                  <button
                    key={f.id}
                    onClick={() => setSelectedFormulaId(f.id)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-foreground hover:border-primary/40",
                    )}
                  >
                    {f.name}
                    {isActive && <span className="ml-1 opacity-80">• active</span>}
                  </button>
                );
              })}
            </div>

            {selectedFormula && (
              <FormulaEditor
                key={selectedFormula.id}
                formula={selectedFormula}
                ingredients={ingredients}
                isActive={selectedFormula.id === product.active_formula_id}
                onSetActive={() => setActive(selectedFormula.id)}
                onSaved={load}
              />
            )}
          </>
        )}
      </section>

      {/* Section 2: Serving Sizes */}
      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Serving Sizes</h2>
          <Button size="sm" onClick={() => { setEditingSize(null); setSizeOpen(true); }}>
            <Plus className="mr-1 h-4 w-4" />Add Serving Size
          </Button>
        </div>
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          {sizes.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">No serving sizes yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Size</TableHead>
                  <TableHead>Kit</TableHead>
                  <TableHead>Syrup</TableHead>
                  <TableHead className="text-right">Syrup fl oz</TableHead>
                  <TableHead className="text-right">Formula</TableHead>
                  <TableHead className="text-right">Syrup $</TableHead>
                  <TableHead className="text-right">Kit $</TableHead>
                  <TableHead className="text-right">Total COGS</TableHead>
                  <TableHead className="w-[1%]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sizes.map((sz) => {
                  const kit = kits.find((k) => k.id === sz.disposable_kit_id) ?? null;
                  const syrup = syrups.find((s) => s.id === sz.syrup_id) ?? null;
                  const fCost = activeFormula
                    ? formulaCostForServing({ ingredients: activeFormula.ingredients }, ingredients, Number(sz.size_fl_oz))
                    : null;
                  const sCost = syrupCostForServing(syrup, sz.syrup_fl_oz);
                  const kCost = kitCostForServing(kit, dispItems);
                  const total = fCost == null ? null : fCost + sCost + kCost;
                  return (
                    <TableRow key={sz.id}>
                      <TableCell className="font-semibold">{Number(sz.size_fl_oz)} fl oz</TableCell>
                      <TableCell className="text-muted-foreground">{kit?.name ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{syrup?.name ?? "—"}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{sz.syrup_fl_oz ?? "—"}</TableCell>
                      <TableCell className="text-right">{fmtUSD(fCost)}</TableCell>
                      <TableCell className="text-right">{fmtUSD(sCost)}</TableCell>
                      <TableCell className="text-right">{fmtUSD(kCost)}</TableCell>
                      <TableCell className="text-right font-semibold">{fmtUSD(total)}</TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost" onClick={() => { setEditingSize(sz); setSizeOpen(true); }} aria-label="Edit">
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
      </section>

      {/* Section 3: Comparison */}
      {formulas.length >= 2 && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-bold">Formula Version Comparison</h2>
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Size</TableHead>
                  {formulas.map((f) => (
                    <TableHead key={f.id} className="text-right">
                      {f.name}{f.id === product.active_formula_id ? " (active)" : ""}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sizes.map((sz) => {
                  const kit = kits.find((k) => k.id === sz.disposable_kit_id) ?? null;
                  const syrup = syrups.find((s) => s.id === sz.syrup_id) ?? null;
                  const cellTotals = formulas.map((f) =>
                    totalCOGS({
                      formula: { ingredients: f.ingredients },
                      ingredients,
                      syrup,
                      syrupFlOz: sz.syrup_fl_oz,
                      kit,
                      disposableItems: dispItems,
                      servingSize: Number(sz.size_fl_oz),
                    }),
                  );
                  const finite = cellTotals.filter((n) => Number.isFinite(n));
                  const min = finite.length ? Math.min(...finite) : null;
                  const activeIdx = formulas.findIndex((f) => f.id === product.active_formula_id);
                  const activeTotal = activeIdx >= 0 ? cellTotals[activeIdx] : null;
                  return (
                    <TableRow key={sz.id}>
                      <TableCell className="font-semibold">{Number(sz.size_fl_oz)} fl oz</TableCell>
                      {formulas.map((f, i) => {
                        const t = cellTotals[i];
                        const cheapest = min != null && Math.abs(t - min) < 1e-9;
                        const diff = activeTotal != null && i !== activeIdx ? t - activeTotal : null;
                        return (
                          <TableCell key={f.id} className={cn("text-right", cheapest && "bg-emerald-500/10 font-semibold")}>
                            <div>{fmtUSD(t, 4)}</div>
                            {diff != null && (
                              <div className="text-xs text-muted-foreground">
                                {diff > 0 ? "+" : ""}{fmtUSD(diff, 4)}
                              </div>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      <NewVersionSheet
        open={newVersionOpen}
        onOpenChange={setNewVersionOpen}
        productId={product.id}
        existingFormulas={formulas}
        onSaved={() => { setNewVersionOpen(false); load(); }}
      />
      <ServingSizeSheet
        open={sizeOpen}
        onOpenChange={setSizeOpen}
        productId={product.id}
        editing={editingSize}
        kits={kits}
        syrups={syrups}
        onSaved={() => { setSizeOpen(false); load(); }}
      />
    </AppShell>
  );
}

/* ---------------- Formula Editor ---------------- */

type EditorRow = { ingredient_id: string; ratioPct: string };

function FormulaEditor({
  formula, ingredients, isActive, onSetActive, onSaved,
}: {
  formula: FormulaWithIngs;
  ingredients: Ingredient[];
  isActive: boolean;
  onSetActive: () => void;
  onSaved: () => void;
}) {
  const [batchSize, setBatchSize] = useState(String(formula.batch_size));
  const [rows, setRows] = useState<EditorRow[]>(
    formula.ingredients.map((fi) => ({ ingredient_id: fi.ingredient_id, ratioPct: String((fi.ratio * 100).toFixed(2).replace(/\.?0+$/, "")) })),
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setBatchSize(String(formula.batch_size));
    setRows(formula.ingredients.map((fi) => ({ ingredient_id: fi.ingredient_id, ratioPct: String((fi.ratio * 100).toFixed(2).replace(/\.?0+$/, "")) })));
  }, [formula.id, formula.batch_size, formula.ingredients]);

  const totalPct = rows.reduce((s, r) => s + (Number(r.ratioPct) || 0), 0);
  const totalOk = Math.abs(totalPct - 100) < 0.01;

  const update = (i: number, patch: Partial<EditorRow>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const addRow = () => setRows((rs) => [...rs, { ingredient_id: "", ratioPct: "" }]);
  const removeRow = (i: number) => setRows((rs) => rs.filter((_, idx) => idx !== i));

  const save = async () => {
    if (!totalOk) return toast.error("Ratios must sum to 100%");
    const bs = Number(batchSize);
    if (!bs || bs <= 0) return toast.error("Batch size must be > 0");
    const cleaned = rows.filter((r) => r.ingredient_id && Number(r.ratioPct) > 0);
    if (cleaned.length === 0) return toast.error("Add at least one ingredient");

    setSaving(true);
    const { error: e1 } = await supabase
      .from("recipe_formulas")
      .update({ batch_size: bs })
      .eq("id", formula.id);
    if (e1) { setSaving(false); return toast.error(e1.message); }
    await supabase.from("recipe_formula_ingredients").delete().eq("formula_id", formula.id);
    const { error: e2 } = await supabase.from("recipe_formula_ingredients").insert(
      cleaned.map((r) => ({
        formula_id: formula.id,
        ingredient_id: r.ingredient_id,
        ratio: Number(r.ratioPct) / 100,
      })),
    );
    setSaving(false);
    if (e2) return toast.error(e2.message);
    toast.success("Formula saved");
    onSaved();
  };

  const remove = async () => {
    if (!confirm(`Delete formula version "${formula.name}"? This cannot be undone.`)) return;
    const { error } = await supabase.from("recipe_formulas")
      .update({ deleted_at: new Date().toISOString() }).eq("id", formula.id);
    if (error) return toast.error(error.message);
    toast.success("Version deleted");
    onSaved();
  };

  const bs = Number(batchSize) || 0;

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <div className="text-base font-bold">{formula.name}</div>
          <div className="text-xs text-muted-foreground">{isActive ? "Active version" : "Draft version"}</div>
        </div>
        <div className="flex gap-2">
          {!isActive && <Button size="sm" variant="outline" onClick={onSetActive}>Set as Active</Button>}
          <Button size="sm" variant="ghost" onClick={remove} className="text-destructive">
            <Trash2 className="mr-1 h-4 w-4" />Delete
          </Button>
        </div>
      </div>

      <div className="mb-3 max-w-xs">
        <Label>Batch size (fl oz)</Label>
        <Input type="number" inputMode="decimal" value={batchSize} onChange={(e) => setBatchSize(e.target.value)} />
      </div>

      <div className="space-y-2">
        {rows.length === 0 ? (
          <p className="text-xs text-muted-foreground">No ingredients yet.</p>
        ) : (
          rows.map((r, i) => {
            const pct = Number(r.ratioPct) || 0;
            const flOz = bs * (pct / 100);
            return (
              <div key={i} className="flex items-end gap-2">
                <div className="flex-1">
                  <Label className="text-xs">Ingredient</Label>
                  <Select value={r.ingredient_id || undefined} onValueChange={(v) => update(i, { ingredient_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                    <SelectContent>
                      {ingredients.map((it) => (
                        <SelectItem key={it.id} value={it.id}>{it.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-24">
                  <Label className="text-xs">Ratio %</Label>
                  <Input type="number" inputMode="decimal" value={r.ratioPct}
                    onChange={(e) => update(i, { ratioPct: e.target.value })} />
                </div>
                <div className="w-24">
                  <Label className="text-xs">fl oz / batch</Label>
                  <Input value={flOz ? flOz.toFixed(2) : "—"} readOnly className="bg-muted/40" />
                </div>
                <Button size="icon" variant="ghost" onClick={() => removeRow(i)} aria-label="Remove">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            );
          })
        )}
        <Button type="button" variant="link" size="sm" className="px-0" onClick={addRow}>+ Add Ingredient</Button>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2 rounded-lg bg-muted/60 p-3 text-xs">
        <span className="text-muted-foreground">Total ratio</span>
        <span className={cn("font-bold", totalOk ? "text-emerald-500" : "text-destructive")}>
          {totalPct.toFixed(2)}%
        </span>
      </div>

      <div className="mt-3 flex justify-end">
        <Button onClick={save} disabled={!totalOk || saving}>
          {saving ? "Saving…" : "Save Formula"}
        </Button>
      </div>
    </div>
  );
}

/* ---------------- New Version Sheet ---------------- */

function NewVersionSheet({
  open, onOpenChange, productId, existingFormulas, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  productId: string;
  existingFormulas: FormulaWithIngs[];
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [cloneId, setCloneId] = useState<string>("");
  const [doClone, setDoClone] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName("");
      setCloneId(existingFormulas[0]?.id ?? "");
      setDoClone(false);
    }
  }, [open, existingFormulas]);

  const submit = async () => {
    if (!name.trim()) return toast.error("Name is required");
    setSaving(true);
    const source = doClone ? existingFormulas.find((f) => f.id === cloneId) : null;
    const batchSize = source?.batch_size ?? 64;
    const { data, error } = await supabase.from("recipe_formulas")
      .insert({ product_id: productId, name: name.trim(), batch_size: batchSize })
      .select("id").single();
    if (error || !data) { setSaving(false); return toast.error(error?.message ?? "Failed"); }
    if (source && source.ingredients.length) {
      await supabase.from("recipe_formula_ingredients").insert(
        source.ingredients.map((fi) => ({
          formula_id: data.id, ingredient_id: fi.ingredient_id, ratio: fi.ratio,
        })),
      );
    }
    setSaving(false);
    toast.success("Version created");
    onSaved();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>New formula version</SheetTitle>
          <SheetDescription>Name it. Optionally clone from an existing version.</SheetDescription>
        </SheetHeader>
        <div className="mt-4 flex-1 space-y-3">
          <div>
            <Label>Version name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Lite Coconut" />
          </div>
          {existingFormulas.length > 0 && (
            <>
              <div className="flex items-center gap-2">
                <Checkbox id="clone" checked={doClone} onCheckedChange={(v) => setDoClone(!!v)} />
                <Label htmlFor="clone" className="cursor-pointer">Clone from existing version</Label>
              </div>
              {doClone && (
                <div>
                  <Label>Source</Label>
                  <Select value={cloneId} onValueChange={setCloneId}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {existingFormulas.map((f) => (
                        <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}
        </div>
        <SheetFooter className="mt-6 flex flex-row justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Saving…" : "Create"}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/* ---------------- Serving Size Sheet ---------------- */

function ServingSizeSheet({
  open, onOpenChange, productId, editing, kits, syrups, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  productId: string;
  editing: RecipeServingSize | null;
  kits: DispKit[];
  syrups: SyrupLite[];
  onSaved: () => void;
}) {
  const [size, setSize] = useState("");
  const [kitId, setKitId] = useState<string>("");
  const [syrupId, setSyrupId] = useState<string>("");
  const [syrupFlOz, setSyrupFlOz] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSize(editing ? String(editing.size_fl_oz) : "");
    setKitId(editing?.disposable_kit_id ?? "");
    setSyrupId(editing?.syrup_id ?? "");
    setSyrupFlOz(editing?.syrup_fl_oz ? String(editing.syrup_fl_oz) : "");
  }, [open, editing]);

  const save = async () => {
    const sz = Number(size);
    if (!sz || sz <= 0) return toast.error("Size must be > 0");
    if (!kitId) return toast.error("Pick a kit");
    setSaving(true);
    const payload = {
      product_id: productId,
      size_fl_oz: sz,
      disposable_kit_id: kitId,
      syrup_id: syrupId || null,
      syrup_fl_oz: syrupId ? Number(syrupFlOz) || null : null,
    };
    const { error } = editing
      ? await supabase.from("recipe_serving_sizes").update(payload).eq("id", editing.id)
      : await supabase.from("recipe_serving_sizes").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Serving size updated" : "Serving size added");
    onSaved();
  };

  const remove = async () => {
    if (!editing) return;
    if (!confirm("Delete this serving size?")) return;
    const { error } = await supabase.from("recipe_serving_sizes").delete().eq("id", editing.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted"); onSaved();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{editing ? "Edit serving size" : "Add serving size"}</SheetTitle>
          <SheetDescription>Pair a size with a kit and an optional syrup.</SheetDescription>
        </SheetHeader>
        <div className="mt-4 flex-1 space-y-3">
          <div>
            <Label>Size (fl oz)</Label>
            <Input type="number" inputMode="decimal" value={size} onChange={(e) => setSize(e.target.value)} placeholder="12" />
          </div>
          <div>
            <Label>Kit</Label>
            <Select value={kitId || undefined} onValueChange={setKitId}>
              <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
              <SelectContent>
                {kits.map((k) => (
                  <SelectItem key={k.id} value={k.id}>{k.name} ({k.target_size} fl oz)</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Syrup (optional)</Label>
            <Select value={syrupId || "__none"} onValueChange={(v) => setSyrupId(v === "__none" ? "" : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">None</SelectItem>
                {syrups.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {syrupId && (
            <div>
              <Label>Syrup fl oz per serving</Label>
              <Input type="number" inputMode="decimal" value={syrupFlOz} onChange={(e) => setSyrupFlOz(e.target.value)} />
            </div>
          )}
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
