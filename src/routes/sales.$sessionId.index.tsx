import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Plus, Trash2, Lock } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { fmt, computeTotals } from "@/lib/money";
import { SaleComposer } from "@/components/sales/sale-composer";
import type { Product, Flavor, PaymentMethod, DemographicOption } from "@/lib/sales-types";
import { toast } from "sonner";

export const Route = createFileRoute("/sales/$sessionId/")({ component: ActiveSession });

type Session = {
  id: string; name: string; location: string | null;
  status: "open" | "closed"; opened_at: string;
};

type SaleRow = {
  id: string; created_at: string; sale_kind: "single" | "group";
  payment_method_name_snapshot: string;
  applies_tax_snapshot: boolean;
  subtotal: number; tax_amount: number; total: number;
  note: string | null; logged_by: string;
};

function ActiveSession() {
  const { sessionId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [session, setSession] = useState<Session | null>(null);
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [flavors, setFlavors] = useState<Flavor[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [demographics, setDemographics] = useState<DemographicOption[]>([]);
  const [taxRate, setTaxRate] = useState(0);
  const [composerOpen, setComposerOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  const loadConfig = async () => {
    const [{ data: prods }, { data: flv }, { data: pm }, { data: dem }, { data: settings }] = await Promise.all([
      supabase.from("products").select("id,name,type,price").is("deleted_at", null).eq("is_archived", false).order("type").order("sort_order"),
      supabase.from("paleta_flavor_upgrades").select("id,name,upgrade_price").is("deleted_at", null).eq("is_archived", false).order("sort_order"),
      supabase.from("payment_methods").select("id,name,applies_tax").is("deleted_at", null).eq("is_archived", false).order("sort_order"),
      supabase.from("demographic_options").select("id,category,label").is("deleted_at", null).eq("is_archived", false).order("category").order("sort_order"),
      supabase.from("app_settings").select("tax_rate").limit(1).maybeSingle(),
    ]);
    setProducts((prods ?? []).map((p) => ({ ...p, price: Number(p.price) })) as Product[]);
    setFlavors((flv ?? []).map((f) => ({ ...f, upgrade_price: Number(f.upgrade_price) })) as Flavor[]);
    setPaymentMethods((pm ?? []) as PaymentMethod[]);
    setDemographics((dem ?? []) as DemographicOption[]);
    setTaxRate(Number(settings?.tax_rate ?? 0));
  };

  const loadSession = async () => {
    const { data } = await supabase.from("sales_sessions").select("id,name,location,status,opened_at").eq("id", sessionId).maybeSingle();
    setSession(data as Session | null);
  };

  const loadSales = async () => {
    const { data } = await supabase
      .from("sales")
      .select("id,created_at,sale_kind,payment_method_name_snapshot,applies_tax_snapshot,subtotal,tax_amount,total,note,logged_by")
      .eq("session_id", sessionId).is("deleted_at", null)
      .order("created_at", { ascending: false });
    setSales((data ?? []).map((r) => ({
      ...r,
      subtotal: Number(r.subtotal), tax_amount: Number(r.tax_amount), total: Number(r.total),
    })) as SaleRow[]);
  };

  useEffect(() => { loadConfig(); loadSession(); loadSales(); }, [sessionId]);

  // Realtime
  useEffect(() => {
    const channel = supabase.channel(`session-${sessionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "sales", filter: `session_id=eq.${sessionId}` },
        () => loadSales())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "sales_sessions", filter: `id=eq.${sessionId}` },
        () => loadSession())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [sessionId]);

  const total = useMemo(() => sales.reduce((s, r) => s + r.total, 0), [sales]);

  const submitSale = async (input: Parameters<React.ComponentProps<typeof SaleComposer>["onSubmit"]>[0]) => {
    if (!user) return;
    const subtotal = input.customers.reduce((sum, c) =>
      sum + c.lines.reduce((s, l) => s + (l.basePrice + l.upgradePrice) * l.quantity, 0), 0);
    const totals = computeTotals({ subtotal, appliesTax: input.paymentMethod.applies_tax, taxRate });

    const { data: sale, error } = await supabase.from("sales").insert({
      session_id: sessionId, logged_by: user.id, sale_kind: input.kind,
      payment_method_id: input.paymentMethod.id,
      payment_method_name_snapshot: input.paymentMethod.name,
      applies_tax_snapshot: input.paymentMethod.applies_tax,
      tax_rate_snapshot: input.paymentMethod.applies_tax ? taxRate : 0,
      subtotal: totals.subtotal, tax_amount: totals.tax, total: totals.total,
      note: input.note || null,
    }).select("id").single();
    if (error || !sale) { toast.error(error?.message ?? "Failed"); return; }

    const items = input.customers.flatMap((c, ci) => c.lines.map((l) => ({
      sale_id: sale.id, customer_index: ci,
      product_id: l.productId, product_name_snapshot: l.productName, product_type_snapshot: l.productType,
      base_price_snapshot: l.basePrice,
      flavor_upgrade_id: l.flavorId ?? null, flavor_name_snapshot: l.flavorName ?? null,
      upgrade_price_snapshot: l.upgradePrice, quantity: l.quantity,
      line_total: (l.basePrice + l.upgradePrice) * l.quantity,
    })));
    if (items.length) await supabase.from("sale_items").insert(items);

    const demos = input.customers.flatMap((c, ci) =>
      c.demographicIds.map((d) => ({ sale_id: sale.id, customer_index: ci, demographic_option_id: d }))
    );
    if (demos.length) await supabase.from("sale_demographics").insert(demos);

    toast.success(`Sale logged · ${fmt(totals.total)}`);
    setComposerOpen(false);
    loadSales();
  };

  const confirmDelete = async () => {
    if (deleteConfirm !== "DELETE" || !deleteId) return;
    const { error } = await supabase.from("sales").update({ deleted_at: new Date().toISOString() }).eq("id", deleteId);
    if (error) return toast.error(error.message);
    toast.success("Sale deleted");
    setDeleteId(null); setDeleteConfirm("");
    loadSales();
  };

  const closeSession = async () => {
    if (!user) return;
    const { error } = await supabase.from("sales_sessions")
      .update({ status: "closed", closed_by: user.id, closed_at: new Date().toISOString() })
      .eq("id", sessionId);
    if (error) return toast.error(error.message);
    toast.success("Session closed");
    setCloseOpen(false);
    navigate({ to: "/sales/$sessionId/report", params: { sessionId } });
  };

  if (!session) return <AppShell><p className="text-sm text-muted-foreground">Loading...</p></AppShell>;

  const isOpen = session.status === "open";

  return (
    <AppShell>
      <header className="mb-4 flex items-center gap-3">
        <Link to="/sales" className="rounded-full p-2 hover:bg-muted"><ArrowLeft className="h-5 w-5" /></Link>
        <div className="flex-1">
          <h1 className="text-xl font-black">{session.name}</h1>
          <p className="text-xs text-muted-foreground">{session.location ?? "—"}</p>
        </div>
        {!isOpen && (
          <Link to="/sales/$sessionId/report" params={{ sessionId }} className="rounded-full bg-secondary px-3 py-2 text-xs font-bold">
            Report
          </Link>
        )}
      </header>

      <div className="rounded-3xl p-6 text-white shadow-xl" style={{ background: "var(--gradient-hero)" }}>
        <p className="text-xs font-semibold uppercase tracking-wider opacity-90">Live revenue</p>
        <p className="mt-1 text-5xl font-black tabular-nums">{fmt(total)}</p>
        <p className="mt-1 text-xs opacity-90">{sales.length} sale{sales.length === 1 ? "" : "s"}</p>
      </div>

      {isOpen ? (
        <Button onClick={() => setComposerOpen(true)} className="mt-4 h-14 w-full rounded-2xl text-base font-bold">
          <Plus className="mr-2 h-5 w-5" /> New sale
        </Button>
      ) : (
        <div className="mt-4 flex items-center gap-2 rounded-2xl border-2 border-dashed border-border p-4 text-sm text-muted-foreground">
          <Lock className="h-4 w-4" /> Session is closed — view-only.
        </div>
      )}

      <section className="mt-6">
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Live feed</h2>
        {sales.length === 0 ? (
          <p className="rounded-2xl border-2 border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No sales yet. Tap "New sale" to log the first one.
          </p>
        ) : (
          <div className="space-y-2">
            {sales.map((s) => (
              <div key={s.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
                <div className="flex-1">
                  <p className="font-bold">{fmt(s.total)} <span className="text-xs font-normal text-muted-foreground">· {s.payment_method_name_snapshot}</span></p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(s.created_at).toLocaleTimeString()} · {s.sale_kind}
                    {s.tax_amount > 0 && ` · tax ${fmt(s.tax_amount)}`}
                    {s.note && ` · ${s.note}`}
                  </p>
                </div>
                {isOpen && (
                  <button onClick={() => setDeleteId(s.id)} className="p-2 text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {isOpen && (
        <Button variant="outline" onClick={() => setCloseOpen(true)} className="mt-6 h-12 w-full rounded-2xl border-2 font-bold">
          <Lock className="mr-2 h-4 w-4" /> Close session
        </Button>
      )}

      <SaleComposer
        open={composerOpen} onClose={() => setComposerOpen(false)}
        products={products} flavors={flavors} paymentMethods={paymentMethods}
        demographics={demographics} taxRate={taxRate} onSubmit={submitSale}
      />

      <Dialog open={closeOpen} onOpenChange={setCloseOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Close session?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Total: <strong>{fmt(total)}</strong> across {sales.length} sale{sales.length === 1 ? "" : "s"}.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseOpen(false)}>Cancel</Button>
            <Button onClick={closeSession}>Close session</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteId} onOpenChange={(o) => !o && (setDeleteId(null), setDeleteConfirm(""))}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete sale?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This is a soft-delete. Type <strong>DELETE</strong> below to confirm.</p>
          <Input value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} placeholder="DELETE" />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteId(null); setDeleteConfirm(""); }}>Cancel</Button>
            <Button variant="destructive" disabled={deleteConfirm !== "DELETE"} onClick={confirmDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}