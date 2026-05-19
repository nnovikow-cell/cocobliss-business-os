import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import { fmtUSD, inventoryItemToIngredient, inventoryItemToSyrup, inventoryItemToDispItem } from "@/lib/ingredients";
import type { Ingredient } from "@/lib/ingredients";
import {
  totalCOGS,
  type RecipeProduct,
  type RecipeFormula,
  type RecipeServingSize,
  type DispItem,
  type DispKit,
  type SyrupLite,
} from "@/lib/products";
import { KitsLibrary } from "@/components/products/kits-library";

export const Route = createFileRoute("/products/")({ component: ProductsListPage });

type ProductCard = RecipeProduct & {
  activeFormulaName: string | null;
  servingCount: number;
  costMin: number | null;
  costMax: number | null;
};

function ProductsListPage() {
  const [cards, setCards] = useState<ProductCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    const [
      { data: products, error: ep },
      { data: formulas },
      { data: fingreds },
      { data: ingredients },
      { data: sizes },
      { data: kits },
      { data: kitItems },
      { data: dispItems },
      { data: syrups },
    ] = await Promise.all([
      supabase.from("recipe_products").select("*").is("deleted_at", null).order("name"),
      supabase.from("recipe_formulas").select("*").is("deleted_at", null),
      supabase.from("recipe_formula_ingredients").select("*"),
      supabase.from("inventory_items").select("*").eq("category_v2", "ingredient").is("deleted_at", null),
      supabase.from("recipe_serving_sizes").select("*"),
      supabase.from("disposable_kits").select("*").is("deleted_at", null),
      supabase.from("disposable_kit_items").select("*"),
      supabase.from("inventory_items").select("*").eq("category_v2", "disposable").is("deleted_at", null),
      supabase.from("inventory_items").select("*").eq("category_v2", "syrup").is("deleted_at", null),
    ]);
    if (ep) toast.error(ep.message);

    const ings = (ingredients ?? []).map((it) => inventoryItemToIngredient(it as never)) as Ingredient[];
    const dis = (dispItems ?? []).map((it) => inventoryItemToDispItem(it as never)) as DispItem[];
    const dkRaw = (kits ?? []) as Omit<DispKit, "items">[];
    const dki = (kitItems ?? []) as { kit_id: string; disposable_item_id: string; qty: number }[];
    const dks: DispKit[] = dkRaw.map((k) => ({ ...k, items: dki.filter((x) => x.kit_id === k.id) }));
    const syrs = (syrups ?? []).map((it) => inventoryItemToSyrup(it as never)) as SyrupLite[];

    const built: ProductCard[] = ((products ?? []) as RecipeProduct[]).map((p) => {
      const activeF = (formulas ?? []).find((f: any) => f.id === p.active_formula_id) as RecipeFormula | undefined;
      const formulaIngs = (fingreds ?? [])
        .filter((fi: any) => fi.formula_id === activeF?.id)
        .map((fi: any) => ({ ingredient_id: fi.ingredient_id, ratio: Number(fi.ratio) }));
      const productSizes = ((sizes ?? []) as RecipeServingSize[]).filter((s) => s.product_id === p.id);
      const costs = activeF
        ? productSizes
            .map((sz) =>
              totalCOGS({
                formula: { ingredients: formulaIngs },
                ingredients: ings,
                syrup: syrs.find((s) => s.id === sz.syrup_id) ?? null,
                syrupFlOz: sz.syrup_fl_oz,
                kit: dks.find((k) => k.id === sz.disposable_kit_id) ?? null,
                disposableItems: dis,
                servingSize: Number(sz.size_fl_oz),
              }),
            )
            .filter((n) => Number.isFinite(n))
        : [];
      return {
        ...p,
        activeFormulaName: activeF?.name ?? null,
        servingCount: productSizes.length,
        costMin: costs.length ? Math.min(...costs) : null,
        costMax: costs.length ? Math.max(...costs) : null,
      };
    });
    setCards(built);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const create = async (name: string, description: string): Promise<void> => {
    const { data, error } = await supabase
      .from("recipe_products")
      .insert({ name: name.trim(), description: description.trim() || null })
      .select("id")
      .single();
    if (error || !data) { toast.error(error?.message ?? "Failed"); return; }
    toast.success("Product created");
    setOpen(false);
    navigate({ to: "/products/$id", params: { id: data.id } });
  };

  return (
    <AppShell>
      <header className="mb-4">
        <h1 className="text-2xl font-black tracking-tight">Products</h1>
        <p className="text-sm text-muted-foreground">Build, version, and cost out formulas — plus the kits they ship in.</p>
      </header>

      <Tabs defaultValue="products" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-sm">
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="kits">Kits</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="mt-4">
          <div className="mb-3 flex items-center justify-end">
            <Button onClick={() => setOpen(true)} size="sm">
              <Plus className="mr-1 h-4 w-4" />New Product
            </Button>
          </div>
          {loading ? (
            <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">Loading…</div>
          ) : cards.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card p-10 text-center">
              <p className="text-sm font-semibold">No products yet.</p>
              <p className="mt-1 text-sm text-muted-foreground">Create your first one.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {cards.map((c) => (
                <Link
                  key={c.id}
                  to="/products/$id"
                  params={{ id: c.id }}
                  className="group rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
                >
                  <div className="text-base font-bold tracking-tight">{c.name}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {c.activeFormulaName ? `Active: ${c.activeFormulaName}` : "No active formula"}
                  </div>
                  <div className="mt-3 flex items-end justify-between">
                    <div className="text-xs text-muted-foreground">
                      {c.servingCount} serving{c.servingCount === 1 ? "" : "s"}
                    </div>
                    <div className="text-sm font-semibold">
                      {c.costMin == null
                        ? "—"
                        : c.costMin === c.costMax
                        ? fmtUSD(c.costMin)
                        : `${fmtUSD(c.costMin)} – ${fmtUSD(c.costMax)}`}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="kits" className="mt-4">
          <KitsLibrary />
        </TabsContent>
      </Tabs>

      <NewProductSheet open={open} onOpenChange={setOpen} onCreate={create} />
    </AppShell>
  );
}

function NewProductSheet({
  open, onOpenChange, onCreate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreate: (name: string, description: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) { setName(""); setDescription(""); } }, [open]);

  const submit = async () => {
    if (!name.trim()) return toast.error("Name is required");
    setSaving(true);
    await onCreate(name, description);
    setSaving(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>New product</SheetTitle>
          <SheetDescription>Set up the basics. You'll add formulas and servings on the next screen.</SheetDescription>
        </SheetHeader>
        <div className="mt-4 flex-1 space-y-3">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Classic Coconut" />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>
        <SheetFooter className="mt-6 flex flex-row justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Saving…" : "Create"}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}