export type InventoryCategory = "consumable" | "disposable";

export type InventoryItem = {
  id: string;
  name: string;
  category: InventoryCategory;
  subcategory: string | null;
  unit: string;
  current_quantity: number;
  par_level: number;
  last_restocked_at: string | null;
  notes: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
};

export type InventoryStatus = "ok" | "low" | "out";

export function stockStatus(item: Pick<InventoryItem, "current_quantity" | "par_level">): InventoryStatus {
  const qty = Number(item.current_quantity ?? 0);
  const par = Number(item.par_level ?? 0);
  if (qty <= 0) return "out";
  if (par <= 0) return "ok";
  if (qty < par) return "out" === "out" && qty <= 0 ? "out" : qty < par ? "low" : "ok";
  // qty >= par; check 20% margin (within 20% above par => yellow per spec "within 20% of par")
  if (qty <= par * 1.2) return "low";
  return "ok";
}

// Cleaner: re-export proper logic
export function computeStatus(qty: number, par: number): InventoryStatus {
  if (qty <= 0) return "out";
  if (par <= 0) return "ok";
  if (qty < par) return "low"; // below par => red, but spec says low=yellow, below=red
  return "ok";
}

/**
 * Spec:
 *  - green if above par (qty > par * 1.2 effectively "above par with margin")
 *  - yellow if within 20% of par (qty between par and par*1.2, OR slightly below)
 *  - red if below par
 * Interpretation used: red when qty < par*0.8 OR qty<=0; yellow when par*0.8 <= qty <= par*1.2; green when qty > par*1.2.
 */
export function statusOf(qty: number, par: number): InventoryStatus {
  if (qty <= 0) return "out";
  if (par <= 0) return "ok";
  if (qty < par * 0.8) return "out";
  if (qty <= par * 1.2) return "low";
  return "ok";
}

export const statusMeta: Record<InventoryStatus, { label: string; classes: string; dot: string }> = {
  ok: {
    label: "In stock",
    classes: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    dot: "bg-emerald-500",
  },
  low: {
    label: "Low stock",
    classes: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    dot: "bg-amber-500",
  },
  out: {
    label: "Below par",
    classes: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
    dot: "bg-red-500",
  },
};

export const categoryLabel: Record<InventoryCategory, string> = {
  consumable: "Consumables",
  disposable: "Disposables",
};