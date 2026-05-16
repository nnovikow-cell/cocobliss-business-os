import { useEffect, useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  type Ingredient, costPerItem, costPerFlOz, fmtUSD,
  inventoryItemToIngredient,
} from "@/lib/ingredients";
import { InventoryItemDrawer } from "@/components/inventory/item-drawer";

type Row = Ingredient & { library_code: string | null };

export function IngredientLibrary() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("inventory_items")
      .select("*")
      .eq("category_v2", "ingredient")
      .is("deleted_at", null)
      .order("name");
    if (error) toast.error(error.message);
    setRows(
      (data ?? []).map((it) => {
        const ing = inventoryItemToIngredient(it as never);
        return { ...ing, library_code: (it as { library_code: string | null }).library_code ?? null };
      }),
    );
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Pulled from Inventory — items tagged as <span className="font-medium">Ingredient</span>.
        </p>
        <Button onClick={() => { setEditingId(null); setOpen(true); }} size="sm">
          <Plus className="mr-1 h-4 w-4" />Add Ingredient
        </Button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {loading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-semibold">No ingredients yet.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add a new inventory item with category Ingredient to get started.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Package</TableHead>
                <TableHead className="text-right">Pkg Price</TableHead>
                <TableHead className="text-right">Cost/Item</TableHead>
                <TableHead className="text-right">Cost/fl oz</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead className="w-[1%]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const cpi = costPerItem(r.package_price, r.package_qty);
                const cpf = costPerFlOz(r);
                return (
                  <TableRow
                    key={r.id}
                    className="cursor-pointer"
                    onClick={() => { setEditingId(r.id); setOpen(true); }}
                  >
                    <TableCell className="font-semibold">{r.name}</TableCell>
                    <TableCell className="text-muted-foreground">{r.library_code ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {r.package_qty || "—"} × {r.item_size || "—"} {r.unit}
                    </TableCell>
                    <TableCell className="text-right">{fmtUSD(r.package_price)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{fmtUSD(cpi)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{fmtUSD(cpf, 4)}</TableCell>
                    <TableCell className="text-muted-foreground">{r.supplier_name ?? "—"}</TableCell>
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={(e) => { e.stopPropagation(); setEditingId(r.id); setOpen(true); }}
                        aria-label="Edit"
                      >
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

      <InventoryItemDrawer
        open={open}
        onOpenChange={setOpen}
        itemId={editingId}
        defaultCategory="ingredient"
        onSaved={() => { setOpen(false); load(); }}
      />
    </div>
  );
}
