export type IngredientUnit = "fl oz" | "ml" | "g" | "kg" | "lb";
export const INGREDIENT_UNITS: IngredientUnit[] = ["fl oz", "ml", "g", "kg", "lb"];
export const WEIGHT_UNITS: IngredientUnit[] = ["g", "kg", "lb"];

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
    case "g":
      if (!density || density <= 0) return null;
      return (itemSize / density) * 0.033814;
    case "kg":
      if (!density || density <= 0) return null;
      return (itemSize / density) * 33.814;
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