import { useEffect, useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { fmtUSD, inventoryItemToSyrup } from "@/lib/ingredients";
import { InventoryItemDrawer } from "@/components/inventory/item-drawer";

type SyrupRow = {
  id: string;
  name: string;
  bottle_size: number;
  bottle_price: number;
  supplier_name: string | null;
};

export function SyrupLibrary() {
  const [rows, setRows] = useState<SyrupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("inventory_items")
      .select("*")
      .eq("category_v2", "syrup")
      .is("deleted_at", null)
      .order("name");
    if (error) toast.error(error.message);
    const mapped = (data ?? []).map((it) => {
      const s = inventoryItemToSyrup(it as never);
      return {
        id: s.id,
        name: s.name,
        bottle_size: s.bottle_size,
        bottle_price: s.bottle_price,
        supplier_name: s.supplier_name,
      };
    });
    setRows(mapped);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditingId(null); setDrawerOpen(true); };
  const openEdit = (id: string) => { setEditingId(id); setDrawerOpen(true); };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Syrups added per cup at pour time.</p>
        <Button onClick={openNew} size="sm">
          <Plus className="mr-1 h-4 w-4" />Add Syrup
        </Button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {loading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-semibold">No syrups yet.</p>
            <p className="mt-1 text-sm text-muted-foreground">Add your first one to get started.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="text-right">Bottle Size</TableHead>
                <TableHead className="text-right">Bottle Price</TableHead>
                <TableHead className="text-right">Cost/fl oz</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead className="w-[1%]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const cpf = r.bottle_size > 0 ? r.bottle_price / r.bottle_size : null;
                return (
                  <TableRow
                    key={r.id}
                    className="cursor-pointer"
                    onClick={() => openEdit(r.id)}
                  >
                    <TableCell className="font-semibold">{r.name}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{r.bottle_size} fl oz</TableCell>
                    <TableCell className="text-right">{fmtUSD(r.bottle_price)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{fmtUSD(cpf, 4)}</TableCell>
                    <TableCell className="text-muted-foreground">{r.supplier_name ?? "—"}</TableCell>
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={(e) => { e.stopPropagation(); openEdit(r.id); }}
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
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        itemId={editingId}
        defaultCategory="syrup"
        onSaved={() => { setDrawerOpen(false); load(); }}
      />
    </div>
  );
}
