import type { Ingredient } from "@/lib/ingredients";
import { itemToFlOz } from "@/lib/ingredients";

export type RecipeProduct = {
  id: string;
  name: string;
  description: string | null;
  active_formula_id: string | null;
};

export type RecipeFormula = {
  id: string;
  product_id: string;
  name: string;
  batch_size: number;
  created_at: string;
};

export type RecipeFormulaIngredient = {
  id: string;
  formula_id: string;
  ingredient_id: string;
  ratio: number;
};

export type RecipeServingSize = {
  id: string;
  product_id: string;
  size_fl_oz: number;
  disposable_kit_id: string | null;
  syrup_id: string | null;
  syrup_fl_oz: number | null;
};

export type DispItem = { id: string; name: string; package_qty: number; package_price: number };
export type DispKit = { id: string; name: string; target_size: number; items: { disposable_item_id: string; qty: number }[] };
export type SyrupLite = { id: string; name: string; bottle_size: number; bottle_price: number };

/** Cost per fl oz of one ingredient — matches productUtils spec */
export function ingredientCostPerFlOz(ing: Pick<Ingredient, "package_price" | "package_qty" | "item_size" | "unit" | "density">): number | null {
  if (!ing.package_qty || ing.package_qty <= 0) return null;
  if (!ing.item_size || ing.item_size <= 0) return null;
  const flOzPerItem = itemToFlOz(ing.item_size, ing.unit, ing.density);
  if (!flOzPerItem || flOzPerItem <= 0) return null;
  const totalFlOzPerPackage = ing.package_qty * flOzPerItem;
  if (totalFlOzPerPackage <= 0) return null;
  return ing.package_price / totalFlOzPerPackage;
}

export function formulaCostForServing(
  formula: { ingredients: { ingredient_id: string; ratio: number }[] },
  ingredients: Ingredient[],
  servingSize: number,
): number {
  return formula.ingredients.reduce((total, fi) => {
    const ing = ingredients.find((i) => i.id === fi.ingredient_id);
    if (!ing) return total;
    const cpf = ingredientCostPerFlOz(ing);
    if (cpf == null) return total;
    return total + fi.ratio * servingSize * cpf;
  }, 0);
}

export function syrupCostForServing(syrup: SyrupLite | null | undefined, syrupFlOz: number | null | undefined): number {
  if (!syrup || !syrupFlOz || syrup.bottle_size <= 0) return 0;
  return (syrup.bottle_price / syrup.bottle_size) * syrupFlOz;
}

export function kitCostForServing(kit: DispKit | null | undefined, items: DispItem[]): number {
  if (!kit) return 0;
  return kit.items.reduce((total, ki) => {
    const it = items.find((d) => d.id === ki.disposable_item_id);
    if (!it || it.package_qty <= 0) return total;
    return total + (it.package_price / it.package_qty) * ki.qty;
  }, 0);
}

export function totalCOGS(args: {
  formula: { ingredients: { ingredient_id: string; ratio: number }[] };
  ingredients: Ingredient[];
  syrup: SyrupLite | null;
  syrupFlOz: number | null;
  kit: DispKit | null;
  disposableItems: DispItem[];
  servingSize: number;
}): number {
  return (
    formulaCostForServing(args.formula, args.ingredients, args.servingSize) +
    syrupCostForServing(args.syrup, args.syrupFlOz) +
    kitCostForServing(args.kit, args.disposableItems)
  );
}
