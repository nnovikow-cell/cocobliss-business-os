import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, MoreVertical } from "lucide-react";
import { format } from "date-fns";
import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/inventory/orders")({ component: OrdersPage });

type OrderLog = {
  quantity: number;
  item_id: string;
  inventory_items: {
    name: string;
    unit: string | null;
    package_size: number | null;
    package_type: string | null;
    library_code: string | null;
    price: number | null;
  } | null;
};

type Order = {
  id: string;
  supplier_name: string | null;
  order_number: string | null;
  order_date: string | null;
  projected_received_date: string | null;
  created_at: string;
  status: string;
  received_at: string | null;
  cancelled_at: string | null;
  shipping_cost: number | null;
  inventory_logs: OrderLog[];
};

type StatusFilter = "all" | "pending" | "received" | "cancelled";
const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "received", label: "Received" },
  { value: "cancelled", label: "Cancelled" },
];

function OrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [confirmCancel, setConfirmCancel] = useState<Order | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Order | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("inventory_log_batches")
        .select(`
          id, supplier_name, order_number, order_date, projected_received_date,
          created_at, status, received_at, cancelled_at, shipping_cost,
          inventory_logs(quantity, item_id,
            inventory_items(name, unit, package_size, package_type, library_code, price))
        `)
        .eq("kind", "restock")
        .order("created_at", { ascending: false });
      if (error) toast.error(error.message);
      setOrders((data ?? []) as unknown as Order[]);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(
    () => orders.filter((o) => filter === "all" || o.status === filter),
    [orders, filter],
  );

  const markReceived = async (order: Order) => {
    for (const log of order.inventory_logs) {
      const { data: current } = await supabase
        .from("inventory_items")
        .select("current_quantity")
        .eq("id", log.item_id)
        .single();
      if (!current) continue;
      const newQty = Number(current.current_quantity) + Number(log.quantity);
      await supabase.from("inventory_items").update({
        current_quantity: newQty,
        last_restocked_at: new Date().toISOString(),
      }).eq("id", log.item_id);
      await supabase.from("inventory_logs").update({
        quantity_after: newQty,
      }).eq("item_id", log.item_id).eq("batch_id", order.id);
    }
    const nowIso = new Date().toISOString();
    await supabase.from("inventory_log_batches").update({
      status: "received",
      received_at: nowIso,
      received_by: user?.id ?? null,
    }).eq("id", order.id);
    setOrders((prev) => prev.map((o) => o.id === order.id
      ? { ...o, status: "received", received_at: nowIso }
      : o));
    toast.success("Order marked received — stock updated");
  };

  const cancelOrder = async (order: Order) => {
    const nowIso = new Date().toISOString();
    const { error } = await supabase.from("inventory_log_batches").update({
      status: "cancelled",
      cancelled_at: nowIso,
      cancelled_by: user?.id ?? null,
    }).eq("id", order.id);
    if (error) return toast.error(error.message);
    setOrders((prev) => prev.map((o) => o.id === order.id
      ? { ...o, status: "cancelled", cancelled_at: nowIso }
      : o));
    setConfirmCancel(null);
    toast.success("Order cancelled");
  };

  const deleteOrder = async (order: Order) => {
    const { error: e1 } = await supabase.from("inventory_logs").delete().eq("batch_id", order.id);
    if (e1) return toast.error(e1.message);
    const { error: e2 } = await supabase.from("inventory_log_batches").delete().eq("id", order.id);
    if (e2) return toast.error(e2.message);
    setOrders((prev) => prev.filter((o) => o.id !== order.id));
    setConfirmDelete(null);
    toast.success("Order deleted");
  };

  return (
    <AppShell>
      <header className="mb-4">
        <Link to="/inventory" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Inventory
        </Link>
        <h1 className="mt-2 text-2xl font-black tracking-tight md:text-3xl">Purchase Orders</h1>
      </header>

      <div className="-mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {FILTERS.map((f) => {
          const active = filter === f.value;
          return (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={cn(
                "shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-32 animate-pulse rounded-2xl bg-muted/50" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          No orders.
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((order) => {
            const isCancelled = order.status === "cancelled";
            const isPending = order.status === "pending";
            const shipping = Number(order.shipping_cost ?? 0);
            const itemsTotal = order.inventory_logs.reduce((sum, log) => {
              const price = Number(log.inventory_items?.price ?? 0);
              const ps = Number(log.inventory_items?.package_size ?? 0);
              const pkgs = ps > 0 ? Number(log.quantity) / ps : Number(log.quantity);
              return sum + pkgs * price;
            }, 0);
            const grand = itemsTotal + shipping;

            return (
              <li key={order.id} className="rounded-2xl border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn(
                        "truncate text-sm font-bold",
                        isCancelled && "line-through text-muted-foreground",
                      )}>
                        {order.supplier_name ?? "Unknown supplier"}
                      </span>
                      {order.order_number && (
                        <span className="font-mono text-xs text-muted-foreground">
                          {order.order_number}
                        </span>
                      )}
                      {isPending && (
                        <span className="ml-auto rounded-full border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                          Pending
                        </span>
                      )}
                      {order.status === "received" && (
                        <span className="ml-auto rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                          Received
                        </span>
                      )}
                      {isCancelled && (
                        <span className="ml-auto rounded-full border bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                          Cancelled
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Ordered {format(new Date(order.order_date ?? order.created_at), "MMM d, yyyy")}
                      {order.projected_received_date && (
                        <> · Expected {format(new Date(order.projected_received_date), "MMM d, yyyy")}</>
                      )}
                      {order.received_at && (
                        <> · Received {format(new Date(order.received_at), "MMM d, yyyy")}</>
                      )}
                    </p>
                    <ul className="mt-2 space-y-0.5">
                      {order.inventory_logs.map((log) => {
                        const item = log.inventory_items;
                        const ps = Number(item?.package_size ?? 0);
                        const pkgType = item?.package_type?.trim();
                        const qty = ps > 0 ? Number(log.quantity) / ps : Number(log.quantity);
                        const unit = ps > 0 && pkgType ? `${pkgType}s` : item?.unit ?? "";
                        return (
                          <li key={log.item_id} className="text-xs">
                            +{qty.toFixed(1)} {unit} — {item?.name}
                            {item?.library_code && (
                              <span className="ml-1 font-mono text-muted-foreground">{item.library_code}</span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                    {(shipping > 0 || itemsTotal > 0) && (
                      <div className="mt-2 space-y-0.5 text-xs">
                        {shipping > 0 && (
                          <p className="text-muted-foreground">Shipping: ${shipping.toFixed(2)}</p>
                        )}
                        <p className="font-semibold">Order total: ${grand.toFixed(2)}</p>
                      </div>
                    )}
                  </div>
                </div>
                {!isCancelled && (
                  <div className="mt-3 flex items-center justify-end gap-2">
                    {isPending && (
                      <Button size="sm" className="rounded-full" onClick={() => markReceived(order)}>
                        Mark Received
                      </Button>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label="More">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {isPending && (
                          <DropdownMenuItem onClick={() => setConfirmCancel(order)}>
                            Cancel order
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setConfirmDelete(order)}
                        >
                          Delete order
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <AlertDialog open={!!confirmCancel} onOpenChange={(o) => !o && setConfirmCancel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this order?</AlertDialogTitle>
            <AlertDialogDescription>Stock will not be updated.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep order</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmCancel && cancelOrder(confirmCancel)}>
              Cancel order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this order?</AlertDialogTitle>
            <AlertDialogDescription>
              Permanently delete this order and all its log entries? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => confirmDelete && deleteOrder(confirmDelete)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}