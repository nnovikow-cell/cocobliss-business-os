import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { fmt } from "@/lib/money";

export type SaleDetail = {
  id: string;
  created_at: string;
  total: number;
  subtotal: number;
  tax_amount: number;
  tip_amount: number;
  payment_method_name_snapshot: string | null;
  note: string | null;
  is_sample: boolean;
  sale_kind?: "single" | "group" | null;
};

type Item = { product_name_snapshot: string; flavor_name_snapshot: string | null; quantity: number; line_total: number };

export function SaleDetailDialog({ sale, onClose }: { sale: SaleDetail | null; onClose: () => void }) {
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    if (!sale) { setItems([]); return; }
    let alive = true;
    (async () => {
      const { data } = await supabase.from("sale_items")
        .select("product_name_snapshot,flavor_name_snapshot,quantity,line_total")
        .eq("sale_id", sale.id).is("deleted_at", null);
      if (!alive) return;
      setItems((data ?? []).map((r) => ({ ...r, line_total: Number(r.line_total) })) as Item[]);
    })();
    return () => { alive = false; };
  }, [sale]);

  return (
    <Dialog open={!!sale} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {sale?.is_sample ? "Sample" : sale?.note === "Tip" ? "Tip" : "Sale"}
            {sale && !sale.is_sample && ` · ${fmt(sale.total)}`}
          </DialogTitle>
        </DialogHeader>
        {sale && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><span className="text-muted-foreground">When</span><div className="font-bold">{new Date(sale.created_at).toLocaleString()}</div></div>
              <div><span className="text-muted-foreground">Type</span><div className="font-bold">{sale.is_sample ? "Sample" : sale.note === "Tip" ? "Tip" : (sale.sale_kind ?? "sale")}</div></div>
              <div><span className="text-muted-foreground">Payment</span><div className="font-bold">{sale.payment_method_name_snapshot ?? "—"}</div></div>
              <div><span className="text-muted-foreground">Total</span><div className="font-bold tabular-nums">{fmt(sale.total)}</div></div>
              {sale.subtotal > 0 && <div><span className="text-muted-foreground">Subtotal</span><div className="font-bold tabular-nums">{fmt(sale.subtotal)}</div></div>}
              {sale.tax_amount > 0 && <div><span className="text-muted-foreground">Tax</span><div className="font-bold tabular-nums">{fmt(sale.tax_amount)}</div></div>}
              {sale.tip_amount > 0 && <div><span className="text-muted-foreground">Tip</span><div className="font-bold tabular-nums">{fmt(sale.tip_amount)}</div></div>}
            </div>
            {items.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">Items</p>
                <ul className="space-y-1">
                  {items.map((it, i) => (
                    <li key={i} className="flex items-center justify-between rounded-lg border border-border bg-card px-2 py-1.5 text-xs">
                      <span>{it.quantity}× {it.product_name_snapshot}{it.flavor_name_snapshot ? ` · ${it.flavor_name_snapshot}` : ""}</span>
                      <span className="font-bold tabular-nums">{fmt(it.line_total)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {sale.note && sale.note !== "Tip" && (
              <p className="text-xs text-muted-foreground">Note: {sale.note}</p>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}