import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronDown, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app/app-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { Ingredient } from "@/lib/ingredients";
import { inventoryItemToIngredient, inventoryItemToSyrup, inventoryItemToDispItem } from "@/lib/ingredients";
import {
  formulaCostForServing, syrupCostForServing, kitCostForServing,
  type RecipeProduct, type RecipeFormula, type RecipeServingSize,
  type DispItem, type DispKit, type SyrupLite,
} from "@/lib/products";

export const Route = createFileRoute("/simulate")({ component: SimulatePage });

type FormulaWithIngs = RecipeFormula & {
  ingredients: { ingredient_id: string; ratio: number }[];
};

const fmt2 = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);
const fmtPct = (n: number) =>
  Number.isFinite(n) ? `${n.toFixed(1)}%` : "—";
const fmtInt = (n: number) =>
  new Intl.NumberFormat("en-US").format(Math.round(n || 0));

function SimulatePage() {
  const [products, setProducts] = useState<RecipeProduct[]>([]);
  const [formulas, setFormulas] = useState<FormulaWithIngs[]>([]);
  const [sizes, setSizes] = useState<RecipeServingSize[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [kits, setKits] = useState<DispKit[]>([]);
  const [dispItems, setDispItems] = useState<DispItem[]>([]);
  const [syrups, setSyrups] = useState<SyrupLite[]>([]);
  const [loading, setLoading] = useState(true);

  const [productId, setProductId] = useState<string>("");
  const [formulaId, setFormulaId] = useState<string>("");
  const [sizeId, setSizeId] = useState<string>("");
  const [sellingPrice, setSellingPrice] = useState<string>("");
  const [units, setUnits] = useState<string>("");
  const [fixedOpen, setFixedOpen] = useState(false);
  const [rent, setRent] = useState<string>("");
  const [labor, setLabor] = useState<string>("");
  const [otherCost, setOtherCost] = useState<string>("");
  // Per-row selling price overrides for the comparison table
  const [rowPrices, setRowPrices] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      const [
        { data: pRows },
        { data: fRows },
        { data: fiRows },
        { data: sRows },
        { data: ingRows },
        { data: kitRows },
        { data: kiRows },
        { data: diRows },
        { data: syRows },
      ] = await Promise.all([
        supabase.from("recipe_products").select("*").is("deleted_at", null).order("name"),
        supabase.from("recipe_formulas").select("*").is("deleted_at", null).order("created_at"),
        supabase.from("recipe_formula_ingredients").select("*"),
        supabase.from("recipe_serving_sizes").select("*").order("size_fl_oz"),
        supabase.from("inventory_items").select("*").eq("category_v2", "ingredient").is("deleted_at", null),
        supabase.from("disposable_kits").select("*").is("deleted_at", null),
        supabase.from("disposable_kit_items").select("*"),
        supabase.from("inventory_items").select("*").eq("category_v2", "disposable").is("deleted_at", null),
        supabase.from("inventory_items").select("*").eq("category_v2", "syrup").is("deleted_at", null),
      ]);
      const allFi = (fiRows ?? []) as { formula_id: string; ingredient_id: string; ratio: number }[];
      const fs: FormulaWithIngs[] = ((fRows ?? []) as RecipeFormula[]).map((f) => ({
        ...f,
        batch_size: Number(f.batch_size),
        ingredients: allFi
          .filter((x) => x.formula_id === f.id)
          .map((x) => ({ ingredient_id: x.ingredient_id, ratio: Number(x.ratio) })),
      }));
      const dkRaw = (kitRows ?? []) as Omit<DispKit, "items">[];
      const dki = (kiRows ?? []) as { kit_id: string; disposable_item_id: string; qty: number }[];
      const dks: DispKit[] = dkRaw.map((k) => ({ ...k, items: dki.filter((x) => x.kit_id === k.id) }));
      setProducts((pRows ?? []) as RecipeProduct[]);
      setFormulas(fs);
      setSizes((sRows ?? []) as RecipeServingSize[]);
      setIngredients((ingRows ?? []).map((it) => inventoryItemToIngredient(it as never)) as Ingredient[]);
      setKits(dks);
      setDispItems((diRows ?? []).map((it) => inventoryItemToDispItem(it as never)) as unknown as DispItem[]);
      setSyrups(
        (syRows ?? []).map((it) => {
          const s = inventoryItemToSyrup(it as never);
          return { id: s.id, name: s.name, bottle_size: s.bottle_size, bottle_price: s.bottle_price } as SyrupLite;
        }),
      );
      setLoading(false);
    })();
  }, []);

  const product = products.find((p) => p.id === productId) ?? null;
  const productFormulas = formulas.filter((f) => f.product_id === productId);
  const productSizes = sizes.filter((s) => s.product_id === productId);

  // Auto-select formula + size when product changes
  useEffect(() => {
    if (!product) { setFormulaId(""); setSizeId(""); return; }
    const active = product.active_formula_id;
    const fId = active && productFormulas.some((f) => f.id === active)
      ? active
      : productFormulas[0]?.id ?? "";
    setFormulaId(fId);
    setSizeId(productSizes[0]?.id ?? "");
    setRowPrices({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const formula = productFormulas.find((f) => f.id === formulaId) ?? null;
  const size = productSizes.find((s) => s.id === sizeId) ?? null;

  const breakdown = useMemo(() => {
    if (!formula || !size) return null;
    const fc = formulaCostForServing({ ingredients: formula.ingredients }, ingredients, Number(size.size_fl_oz));
    const sc = syrupCostForServing(syrups.find((s) => s.id === size.syrup_id) ?? null, size.syrup_fl_oz);
    const kc = kitCostForServing(kits.find((k) => k.id === size.disposable_kit_id) ?? null, dispItems);
    return { formula: fc, syrup: sc, kit: kc, total: fc + sc + kc };
  }, [formula, size, ingredients, syrups, kits, dispItems]);

  const sp = parseFloat(sellingPrice);
  const u = parseFloat(units);
  const rentN = parseFloat(rent) || 0;
  const laborN = parseFloat(labor) || 0;
  const otherN = parseFloat(otherCost) || 0;
  const fixedTotal = rentN + laborN + otherN;
  const hasFixed = fixedTotal > 0;

  const ready = breakdown != null && Number.isFinite(sp) && sp > 0 && Number.isFinite(u) && u > 0;

  const cogs = breakdown?.total ?? 0;
  const gpc = ready ? sp - cogs : 0;
  const margin = ready && sp > 0 ? (gpc / sp) * 100 : 0;
  const totalRevenue = ready ? sp * u : 0;
  const totalCogs = ready ? cogs * u : 0;
  const totalGp = ready ? gpc * u : 0;
  const netProfit = totalGp - fixedTotal;
  const beUnits = hasFixed && gpc > 0 ? fixedTotal / gpc : null;
  const beRevenue = beUnits != null ? beUnits * sp : null;
  const aboveBe = beUnits != null ? u - beUnits : null;

  // Comparison rows for all serving sizes of selected product/formula
  const comparison = useMemo(() => {
    if (!formula) return [];
    return productSizes.map((sz) => {
      const fc = formulaCostForServing({ ingredients: formula.ingredients }, ingredients, Number(sz.size_fl_oz));
      const sc = syrupCostForServing(syrups.find((s) => s.id === sz.syrup_id) ?? null, sz.syrup_fl_oz);
      const kc = kitCostForServing(kits.find((k) => k.id === sz.disposable_kit_id) ?? null, dispItems);
      const c = fc + sc + kc;
      const rowPriceRaw = rowPrices[sz.id];
      const rowPrice = rowPriceRaw != null && rowPriceRaw !== ""
        ? parseFloat(rowPriceRaw)
        : sz.id === sizeId && Number.isFinite(sp) ? sp : NaN;
      const validPrice = Number.isFinite(rowPrice);
      const gp = validPrice ? rowPrice - c : 0;
      const m = validPrice && rowPrice > 0 ? (gp / rowPrice) * 100 : 0;
      const rev = validPrice && Number.isFinite(u) ? rowPrice * u : 0;
      const np = validPrice && Number.isFinite(u) ? gp * u - fixedTotal : 0;
      return {
        id: sz.id,
        size: Number(sz.size_fl_oz),
        cogs: c,
        price: rowPrice,
        validPrice,
        gp,
        margin: m,
        revenue: rev,
        net: np,
      };
    });
  }, [formula, productSizes, ingredients, syrups, kits, dispItems, rowPrices, sizeId, sp, u, fixedTotal]);

  const bestMarginId = useMemo(() => {
    const valid = comparison.filter((r) => r.validPrice);
    if (valid.length === 0) return null;
    return valid.reduce((a, b) => (a.margin >= b.margin ? a : b)).id;
  }, [comparison]);

  return (
    <AppShell>
      <header className="mb-4">
        <h1 className="text-2xl font-black tracking-tight">Profitability Simulator</h1>
        <p className="text-sm text-muted-foreground">Run what-if scenarios across products, prices, and scale.</p>
      </header>

      {loading ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">Loading…</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* LEFT: INPUTS */}
          <div className="space-y-4">
            <section className="rounded-2xl border border-border bg-card p-4">
              <h2 className="mb-3 text-sm font-bold tracking-tight">Product setup</h2>
              <div className="space-y-3">
                <div>
                  <Label>Product</Label>
                  <Select value={productId} onValueChange={setProductId}>
                    <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                    <SelectContent>
                      {products.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Formula version</Label>
                  <Select value={formulaId} onValueChange={setFormulaId} disabled={!productId}>
                    <SelectTrigger><SelectValue placeholder="Select formula" /></SelectTrigger>
                    <SelectContent>
                      {productFormulas.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.name}{f.id === product?.active_formula_id ? " (active)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Serving size</Label>
                  <Select value={sizeId} onValueChange={setSizeId} disabled={!productId}>
                    <SelectTrigger><SelectValue placeholder="Select size" /></SelectTrigger>
                    <SelectContent>
                      {productSizes.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{Number(s.size_fl_oz)} fl oz</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {breakdown && (
                  <div className="rounded-xl border border-border bg-muted/40 p-3 text-sm">
                    <Row label="Formula cost" value={fmt2(breakdown.formula)} />
                    <Row label="Syrup cost" value={fmt2(breakdown.syrup)} />
                    <Row label="Kit cost" value={fmt2(breakdown.kit)} />
                    <div className="my-2 border-t border-border" />
                    <Row label="Total COGS" value={fmt2(breakdown.total)} bold />
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-card p-4">
              <h2 className="mb-3 text-sm font-bold tracking-tight">Pricing</h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Selling price ($)</Label>
                  <Input inputMode="decimal" value={sellingPrice} onChange={(e) => setSellingPrice(e.target.value)} placeholder="0.00" />
                </div>
                <div>
                  <Label>Units to produce</Label>
                  <Input inputMode="numeric" value={units} onChange={(e) => setUnits(e.target.value)} placeholder="0" />
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-card p-4">
              <button
                type="button"
                onClick={() => setFixedOpen((v) => !v)}
                className="flex w-full items-center justify-between gap-2 text-left"
              >
                <div>
                  <h2 className="text-sm font-bold tracking-tight">Fixed costs</h2>
                  <p className="text-xs text-muted-foreground">Optional — add monthly overhead to calculate net profit</p>
                </div>
                {fixedOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
              {fixedOpen && (
                <div className="mt-3 space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label>Rent ($)</Label>
                      <Input inputMode="decimal" value={rent} onChange={(e) => setRent(e.target.value)} placeholder="0" />
                    </div>
                    <div>
                      <Label>Labor ($)</Label>
                      <Input inputMode="decimal" value={labor} onChange={(e) => setLabor(e.target.value)} placeholder="0" />
                    </div>
                    <div>
                      <Label>Other ($)</Label>
                      <Input inputMode="decimal" value={otherCost} onChange={(e) => setOtherCost(e.target.value)} placeholder="0" />
                    </div>
                  </div>
                  <div className="rounded-xl border border-border bg-muted/40 p-3 text-sm">
                    <Row label="Fixed costs total" value={fmt2(fixedTotal)} bold />
                  </div>
                </div>
              )}
            </section>
          </div>

          {/* RIGHT: RESULTS */}
          <div className="space-y-4">
            {!ready ? (
              <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
                Fill in the inputs to see your profitability.
              </div>
            ) : (
              <>
                <section className="rounded-2xl border border-border bg-card p-4">
                  <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Per cup</h2>
                  <div className="grid grid-cols-2 gap-3">
                    <Stat label="Selling price" value={fmt2(sp)} />
                    <Stat label="COGS" value={fmt2(cogs)} />
                    <Stat label="Gross profit" value={fmt2(gpc)} accent={gpc >= 0 ? "good" : "bad"} />
                    <Stat label="Margin" value={fmtPct(margin)} accent={margin >= 0 ? "good" : "bad"} />
                  </div>
                </section>

                <section className="rounded-2xl border border-border bg-card p-4">
                  <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">For this batch</h2>
                  <div className="grid grid-cols-2 gap-3">
                    <Stat label="Units" value={fmtInt(u)} />
                    <Stat label="Total revenue" value={fmt2(totalRevenue)} />
                    <Stat label="Total COGS" value={fmt2(totalCogs)} />
                    <Stat label="Total gross profit" value={fmt2(totalGp)} accent={totalGp >= 0 ? "good" : "bad"} />
                    {hasFixed && (
                      <div className="col-span-2">
                        <Stat label="Net profit (after fixed costs)" value={fmt2(netProfit)} accent={netProfit >= 0 ? "good" : "bad"} big />
                      </div>
                    )}
                  </div>
                </section>

                {hasFixed && beUnits != null && beRevenue != null && (
                  <section className="rounded-2xl border border-border bg-card p-4">
                    <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Break-even</h2>
                    <div className="grid grid-cols-2 gap-3">
                      <Stat label="Break-even at" value={`${fmtInt(beUnits)} cups`} />
                      <Stat label="Break-even revenue" value={fmt2(beRevenue)} />
                    </div>
                    {aboveBe != null && (
                      <p className={cn(
                        "mt-3 text-sm font-semibold",
                        aboveBe >= 0 ? "text-emerald-600" : "text-rose-600",
                      )}>
                        You are {fmtInt(Math.abs(aboveBe))} cups {aboveBe >= 0 ? "above" : "below"} break-even
                      </p>
                    )}
                  </section>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* COMPARISON TABLE */}
      {!loading && formula && comparison.length > 0 && (
        <section className="mt-6 rounded-2xl border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-bold tracking-tight">Serving size comparison</h2>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Size</TableHead>
                  <TableHead className="text-right">COGS</TableHead>
                  <TableHead className="text-right">Selling price</TableHead>
                  <TableHead className="text-right">Gross profit</TableHead>
                  <TableHead className="text-right">Margin %</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Net profit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {comparison.map((r) => {
                  const isBest = r.id === bestMarginId && r.validPrice;
                  const isNeg = r.validPrice && r.gp < 0;
                  return (
                    <TableRow
                      key={r.id}
                      className={cn(
                        isBest && "bg-emerald-500/10",
                        isNeg && !isBest && "bg-rose-500/10",
                      )}
                    >
                      <TableCell className="font-semibold">{r.size} fl oz</TableCell>
                      <TableCell className="text-right">{fmt2(r.cogs)}</TableCell>
                      <TableCell className="text-right">
                        <Input
                          inputMode="decimal"
                          className="ml-auto h-8 w-24 text-right"
                          value={rowPrices[r.id] ?? (r.id === sizeId ? sellingPrice : "")}
                          onChange={(e) => setRowPrices((m) => ({ ...m, [r.id]: e.target.value }))}
                          placeholder="0.00"
                        />
                      </TableCell>
                      <TableCell className="text-right">{r.validPrice ? fmt2(r.gp) : "—"}</TableCell>
                      <TableCell className="text-right">{r.validPrice ? fmtPct(r.margin) : "—"}</TableCell>
                      <TableCell className="text-right">{r.validPrice && Number.isFinite(u) ? fmt2(r.revenue) : "—"}</TableCell>
                      <TableCell className="text-right">{r.validPrice && Number.isFinite(u) ? fmt2(r.net) : "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </section>
      )}
    </AppShell>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between py-0.5", bold && "font-bold")}>
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function Stat({
  label, value, accent, big,
}: { label: string; value: string; accent?: "good" | "bad"; big?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn(
        "mt-1 font-black tabular-nums tracking-tight",
        big ? "text-3xl" : "text-2xl",
        accent === "good" && "text-emerald-600",
        accent === "bad" && "text-rose-600",
      )}>
        {value}
      </div>
    </div>
  );
}