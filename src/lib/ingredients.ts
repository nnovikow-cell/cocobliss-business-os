export type IngredientUnit =
  | "fl oz" | "ml" | "L" | "tsp" | "tbsp" | "cup"
  | "g" | "kg" | "mg" | "oz" | "lb";

export const INGREDIENT_UNITS: IngredientUnit[] = [
  "fl oz", "ml", "L", "tsp", "tbsp", "cup",
  "g", "kg", "mg", "oz", "lb",
];
export const WEIGHT_UNITS: IngredientUnit[] = ["g", "kg", "mg", "oz", "lb"];

export const UNIT_LABELS: Record<IngredientUnit, string> = {
  "fl oz": "fl oz (volume)",
  ml: "ml",
  L: "L",
  tsp: "tsp",
  tbsp: "tbsp",
  cup: "cup",
  g: "g",
  kg: "kg",
  mg: "mg",
  oz: "oz (weight)",
  lb: "lb",
};

export type DensitySource = "table" | "manual";

export type Ingredient = {
  id: string;
  name: string;
  description: string | null;
  package_qty: number;
  package_price: number;
  item_size: number;
  unit: IngredientUnit;
  density: number | null;
  density_source: DensitySource | null;
  supplier_name: string | null;
  source_url: string | null;
  source_address: string | null;
};

export const densityTable: { match: string; density: number }[] = [
  { match: "coconut milk", density: 1.03 },
  { match: "condensed milk", density: 1.31 },
  { match: "shredded coconut", density: 0.35 },
  { match: "coconut water", density: 1.0 },
  { match: "heavy cream", density: 1.01 },
  { match: "whole milk", density: 1.03 },
  { match: "sugar", density: 0.85 },
  { match: "honey", density: 1.42 },
  { match: "vanilla extract", density: 0.88 },
  { match: "cocoa powder", density: 0.5 },
];

export function lookupDensity(name: string): number | null {
  const n = name.trim().toLowerCase();
  if (!n) return null;
  const hit = densityTable.find((d) => n.includes(d.match));
  return hit ? hit.density : null;
}

/** Convert one item (size in `unit`) to total fl oz. Density is g/ml. */
export function itemToFlOz(itemSize: number, unit: IngredientUnit, density: number | null): number | null {
  if (!itemSize || itemSize <= 0) return null;
  switch (unit) {
    case "fl oz":
      return itemSize;
    case "ml":
      return itemSize * 0.033814;
    case "L":
      return itemSize * 33.814;
    case "tsp":
      return itemSize * 0.166667;
    case "tbsp":
      return itemSize * 0.5;
    case "cup":
      return itemSize * 8;
    case "g":
      if (!density || density <= 0) return null;
      return (itemSize / density) * 0.033814;
    case "mg":
      if (!density || density <= 0) return null;
      return (itemSize / density) * 0.000033814;
    case "kg":
      if (!density || density <= 0) return null;
      return (itemSize / density) * 33.814;
    case "oz":
      if (!density || density <= 0) return null;
      return ((itemSize * 28.3495) / density) * 0.033814;
    case "lb":
      if (!density || density <= 0) return null;
      return ((itemSize * 453.592) / density) * 0.033814;
  }
}

export function costPerItem(packagePrice: number, packageQty: number): number | null {
  if (!packageQty || packageQty <= 0) return null;
  return packagePrice / packageQty;
}

export function costPerFlOz(i: Pick<Ingredient, "package_price" | "package_qty" | "item_size" | "unit" | "density">): number | null {
  const cpi = costPerItem(i.package_price, i.package_qty);
  if (cpi === null) return null;
  const flOz = itemToFlOz(i.item_size, i.unit, i.density);
  if (flOz === null || flOz <= 0) return null;
  return cpi / flOz;
}

export const fmtUSD = (n: number | null, digits = 2) =>
  n === null || Number.isNaN(n) ? "—" : `$${n.toFixed(digits)}`;

/* ----------------------------------------------------------------------
 * Inventory ↔ Ingredient adapter
 *
 * The standalone `ingredients` table is being retired. Cost Calculator
 * now reads from `inventory_items` where `category_v2 = 'ingredient'`.
 * Map raw inventory rows into the `Ingredient` shape the cost math
 * expects via `inventoryItemToIngredient`.
 * -------------------------------------------------------------------- */

type RawInventoryItem = {
  id: string;
  name: string;
  notes?: string | null;
  description?: string | null;
  package_qty?: number | string | null;
  price?: number | string | null;
  package_size?: number | string | null;
  package_size_unit?: string | null;
  density?: number | string | null;
  density_source?: string | null;
  supplier_name?: string | null;
  purchase_url?: string | null;
  physical_location?: string | null;
  library_code?: string | null;
};

export function inventoryItemToIngredient(item: RawInventoryItem): Ingredient {
  const num = (v: unknown) =>
    v === null || v === undefined || v === "" ? null : Number(v);
  return {
    id: item.id,
    name: item.name,
    description: item.description ?? item.notes ?? null,
    package_qty: (num(item.package_qty) ?? 0) as number,
    package_price: (num(item.price) ?? 0) as number,
    item_size: (num(item.package_size) ?? 0) as number,
    unit: (item.package_size_unit as IngredientUnit) ?? "fl oz",
    density: num(item.density),
    density_source: (item.density_source as DensitySource | null) ?? null,
    supplier_name: item.supplier_name ?? null,
    source_url: item.purchase_url ?? null,
    source_address: item.physical_location ?? null,
  };
}

/** Display label for selectors: "Name — Code (Supplier)" with graceful fallback. */
export function formatIngredientLabel(
  it: { name: string; library_code?: string | null; supplier_name?: string | null },
): string {
  const code = it.library_code?.trim();
  const supplier = it.supplier_name?.trim();
  let base = it.name;
  if (code) base += ` — ${code}`;
  if (supplier) base += ` (${supplier})`;
  return base;
}

/* ----------------------------------------------------------------------
 * Inventory ↔ Syrup adapter
 *
 * Syrups live in `inventory_items` where `category_v2 = 'syrup'`. Cost
 * math expects the legacy `SyrupLite` shape — use this adapter to map
 * raw inventory rows.
 * -------------------------------------------------------------------- */

export type SyrupFromInventory = {
  id: string;
  name: string;
  bottle_size: number;   // maps from package_size
  bottle_price: number;  // maps from price
  supplier_name: string | null;
  source_url: string | null;
};

export function inventoryItemToSyrup(item: RawInventoryItem): SyrupFromInventory {
  const num = (v: unknown) =>
    v === null || v === undefined || v === "" ? 0 : Number(v);
  return {
    id: item.id,
    name: item.name,
    bottle_size: num(item.package_size),
    bottle_price: num(item.price),
    supplier_name: item.supplier_name ?? null,
    source_url: item.purchase_url ?? null,
  };
}