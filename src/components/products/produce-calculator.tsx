import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { inventoryItemToIngredient } from "@/lib/ingredients";
import type { Ingredient } from "@/lib/ingredients";

/* Production calc constants */
const QT_TO_ML = 946.353;
const BATCH_DENSITY = 1.05;
const G_PER_QT = QT_TO_ML * BATCH_DENSITY; // 993.67
const FLOZ_TO_ML = 29.5735;
const OZ_TO_G = 28.3495;
const INGREDIENT_DENSITY_FLOZ = 1.03;

const LS_PRODUCT = "cocobliss_produce_product_id";
const LS_TARGET = "cocobliss_produce_target_qt";
const LS_BLENDER = "cocobliss_produce_blender_qt";

type IngredientWithMeta = Ingredient & {
  library_code?: string | null;
  package_type?: string | null;
};

type ProductOpt = {
  id: string;
  name: string;
  active_formula_id: string | null;
};

type FormulaIng = { formula_id: string; ingredient_id: string; ratio: number; id: string };

export function ProduceCalculator() {
  const [products, setProducts] = useState<ProductOpt[]>([]);
  const [formulaIngs, setFormulaIngs] = useState<FormulaIng[]>([]);
  const [ingredients, setIngredients] = useState<IngredientWithMeta[]>([]);
  const [loading, setLoading] = useState(true);

  const [productId, setProductId] = useState<string>("");
  const [targetQt, setTargetQt] = useState("");
  const [blenderQt, setBlenderQt] = useState("");

  // restore on mount
  useEffect(() => {
    try {
      const p = localStorage.getItem(LS_PRODUCT);
      const t = localStorage.getItem(LS_TARGET);
      const b = localStorage.getItem(LS_BLENDER);
      if (p) setProductId(p);
      if (t) setTargetQt(t);
      if (b) setBlenderQt(b);
    } catch { /* ignore */ }
  }, []);

  // persist
  useEffect(() => {
    try {
      if (productId) localStorage.setItem(LS_PRODUCT, productId);
    } catch { /* ignore */ }
  }, [productId]);
  useEffect(() => {
    try {
      if (targetQt) localStorage.setItem(LS_TARGET, targetQt);
    } catch { /* ignore */ }
  }, [targetQt]);
  useEffect(() => {
    try {
      if (blenderQt) localStorage.setItem(LS_BLENDER, blenderQt);
    } catch { /* ignore */ }
  }, [blenderQt]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: prods, error: pe }, { data: fis }, { data: ings }] = await Promise.all([
        supabase.from("recipe_products").select("id,name,active_formula_id").is("deleted_at", null).order("name"),
        supabase.from("recipe_formula_ingredients").select("id,formula_id,ingredient_id,ratio"),
        supabase.from("inventory_items").select("*").eq("category_v2", "ingredient").is("deleted_at", null),
      ]);
      if (pe) toast.error(pe.message);
      setProducts((prods ?? []) as ProductOpt[]);
      setFormulaIngs(
        ((fis ?? []) as { id: string; formula_id: string; ingredient_id: string; ratio: number | string }[]).map((x) => ({
          ...x, ratio: Number(x.ratio),
        })),
      );
      setIngredients(
        (ings ?? []).map((it) => {
          const ing = inventoryItemToIngredient(it as never);
          return Object.assign(ing, {
            library_code: (it as { library_code: string | null }).library_code ?? null,
            package_type: (it as { package_type: string | null }).package_type ?? null,
          }) as IngredientWithMeta;
        }),
      );
      setLoading(false);
    })();
  }, []);

  const product = products.find((p) => p.id === productId) ?? null;
  const activeFormulaId = product?.active_formula_id ?? null;
  const ings = useMemo(
    () => formulaIngs.filter((fi) => fi.formula_id === activeFormulaId),
    [formulaIngs, activeFormulaId],
  );

  const reset = () => {
    setProductId("");
    setTargetQt("");
    setBlenderQt("");
    try {
      localStorage.removeItem(LS_PRODUCT);
      localStorage.removeItem(LS_TARGET);
      localStorage.removeItem(LS_BLENDER);
    } catch { /* ignore */ }
  };

  const target = Number(targetQt) || 0;
  const blender = Number(blenderQt) || 0;
  const totalG = target * G_PER_QT;
  const blenderG = blender * G_PER_QT;
  const numBlenders = blender > 0 ? target / blender : 0;
  const blenderLabel = (() => {
    if (!blender || !target) return "—";
    const rounded = Math.round(numBlenders * 100) / 100;
    const isWhole = Math.abs(rounded - Math.round(rounded)) < 1e-6;
    return isWhole ? `${Math.round(rounded)} loads` : `${rounded} loads`;
  })();
  const partial = blender > 0 && target > 0 && Math.abs(numBlenders - Math.round(numBlenders)) > 1e-6;

  const rows = useMemo(() => {
    return ings.map((fi) => {
      const ing = ingredients.find((i) => i.id === fi.ingredient_id);
      const totalGNeeded = fi.ratio * totalG;
      const gPerBlender = fi.ratio * blenderG;

      let singlePackageG: number | null = null;
      if (ing && ing.item_size > 0) {
        if (ing.unit === "fl oz") singlePackageG = ing.item_size * FLOZ_TO_ML * INGREDIENT_DENSITY_FLOZ;
        else if (ing.unit === "oz") singlePackageG = ing.item_size * OZ_TO_G;
        else if (ing.unit === "g") singlePackageG = ing.item_size;
        else if (ing.unit === "ml" && ing.density) singlePackageG = ing.item_size * ing.density;
        else if (ing.unit === "L" && ing.density) singlePackageG = ing.item_size * 1000 * ing.density;
        else if (ing.unit === "kg") singlePackageG = ing.item_size * 1000;
        else if (ing.unit === "lb") singlePackageG = ing.item_size * 453.592;
      }

      const packagesExact = singlePackageG && singlePackageG > 0 ? totalGNeeded / singlePackageG : null;
      const packagesNeeded = packagesExact != null ? Math.ceil(packagesExact) : null;
      const leftoverG =
        packagesNeeded != null && singlePackageG != null
          ? packagesNeeded * singlePackageG - totalGNeeded
          : null;
      const leftoverPct =
        leftoverG != null && singlePackageG && singlePackageG > 0
          ? (leftoverG / singlePackageG) * 100
          : null;

      return {
        key: fi.id,
        ing,
        totalGNeeded,
        gPerBlender,
        singlePackageG,
        packagesNeeded,
        leftoverG,
        leftoverPct,
        packageType: ing?.package_type ?? null,
      };
    });
  }, [ings, ingredients, totalG, blenderG]);

  const ready = !!product && activeFormulaId && ings.length > 0 && target > 0 && blender > 0;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-bold">Production Calculator</div>
          <Button variant="secondary" size="sm" onClick={reset}>Reset</Button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <Label>Product</Label>
            <Select value={productId || undefined} onValueChange={setProductId}>
              <SelectTrigger><SelectValue placeholder={loading ? "Loading…" : "Select a product"} /></SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Target batch (qt)</Label>
            <Input
              type="number"
              inputMode="decimal"
              value={targetQt}
              onChange={(e) => setTargetQt(e.target.value)}
              placeholder="e.g. 10"
            />
          </div>
          <div>
            <Label>Blender capacity (qt)</Label>
            <Input
              type="number"
              inputMode="decimal"
              value={blenderQt}
              onChange={(e) => setBlenderQt(e.target.value)}
              placeholder="e.g. 2"
            />
          </div>
        </div>
      </div>

      {!product ? (
        <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Select a product to start.
        </div>
      ) : !activeFormulaId || ings.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Set an active formula first to use the production calculator.
        </div>
      ) : !ready ? (
        <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Enter target batch and blender capacity to calculate.
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-2 text-sm font-bold">Batch Summary</div>
            <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
              <div>
                <div className="text-xs text-muted-foreground">Total batch weight</div>
                <div className="font-semibold">{totalG.toFixed(0)} g</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Blender loads</div>
                <div className="font-semibold">{blenderLabel}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Grams per load</div>
                <div className="font-semibold">{blenderG.toFixed(0)} g</div>
              </div>
            </div>
            {partial && (
              <p className="mt-2 text-xs text-muted-foreground">
                Last load is partial — adjust to target.
              </p>
            )}
          </div>
          {/* TODO: Send to Log */}

          <div className="space-y-3">
            {rows.map((r) => {
              const unitLabel = r.packageType ?? "units";
              const pluralUnit = r.packagesNeeded === 1 ? unitLabel : `${unitLabel}s`.replace(/ss$/, "s");
              return (
                <div key={r.key} className="rounded-2xl border border-border bg-card p-4">
                  <div className="mb-2 flex items-baseline justify-between gap-2">
                    <div className="font-semibold">
                      {r.ing?.name ?? "Unknown ingredient"}
                      {r.ing?.library_code && (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          {r.ing.library_code}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                    <div>
                      <div className="text-xs text-muted-foreground">Per blender</div>
                      <div className="font-semibold">{r.gPerBlender.toFixed(0)} g</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Full batch total</div>
                      <div className="font-semibold">{r.totalGNeeded.toFixed(0)} g</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Packages to open</div>
                      <div className="font-semibold">
                        {r.packagesNeeded != null ? `${r.packagesNeeded} ${pluralUnit}` : "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Leftover</div>
                      <div className="font-semibold">
                        {r.leftoverG != null
                          ? `${r.leftoverG.toFixed(0)} g (${(r.leftoverPct ?? 0).toFixed(0)}% of one ${unitLabel})`
                          : "—"}
                      </div>
                    </div>
                  </div>
                  {r.leftoverPct != null && r.leftoverPct > 80 && (
                    <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                      Almost a full package left — consider adjusting batch size.
                    </p>
                  )}
                  {r.singlePackageG == null && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Missing package size/unit on this ingredient — cannot compute packages.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}