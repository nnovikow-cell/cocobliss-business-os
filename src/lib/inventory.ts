export type InventoryCategory = "consumable" | "disposable";

export type InventoryCategoryV2 = "ingredient" | "topping" | "disposable" | "other";
export const CATEGORY_V2_LABEL: Record<InventoryCategoryV2, string> = {
  ingredient: "Ingredient",
  topping: "Topping",
  disposable: "Disposable",
  other: "Other",
};
export const CATEGORY_V2_VALUES: InventoryCategoryV2[] = ["ingredient", "topping", "disposable", "other"];

export type WorkflowTag = "production_batch" | "log_event" | "restock" | "all";
export const WORKFLOW_LABEL: Record<WorkflowTag, string> = {
  production_batch: "Production Batch",
  log_event: "Log Event",
  restock: "Restock",
  all: "All",
};
export const WORKFLOW_VALUES: WorkflowTag[] = ["production_batch", "log_event", "restock", "all"];

export type LogKind = "use" | "restock" | "production_batch" | "event_use";
export const LOG_KIND_LABEL: Record<LogKind, string> = {
  use: "Manual use",
  restock: "Restock",
  production_batch: "Production batch",
  event_use: "Event use",
};

export const UNIT_OPTIONS = ["oz", "ml", "kg", "g", "units", "bags", "cases", "quarts", "lbs"];

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
  category_v2: InventoryCategoryV2 | null;
  workflow_tags: WorkflowTag[];
  package_type: string | null;
  supplier_name: string | null;
  purchase_url: string | null;
  physical_location: string | null;
  price: number | null;
  price_updated_at: string | null;
  package_size: number | null;
  package_size_unit: string | null;
  cost_per_unit: number | null;
};

export type InventoryStatus = "ok" | "low" | "out";

/**
 * Stock status:
 *  - green ("ok"): qty > par * 1.2  (comfortably above par)
 *  - yellow ("low"): within 20% of par (par*0.8 <= qty <= par*1.2)
 *  - red ("out"): qty < par*0.8 or qty <= 0
 *  - if par == 0 and qty > 0 → green
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
