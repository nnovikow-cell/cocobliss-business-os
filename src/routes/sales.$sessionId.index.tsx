import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Plus, Trash2, Lock, Gift, Package } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { fmt, computeTotals } from "@/lib/money";
import { SaleComposer } from "@/components/sales/sale-composer";
import type { Product, Flavor, PaymentMethod, DemographicOption, TipOption } from "@/lib/sales-types";
import { toast } from "sonner";

export const Route = createFileRoute("/sales/$sessionId/")({ component: ActiveSession });

type Session = {
  id: string; name: string; location: string | null;
  status: "open" | "closed"; opened_at: string;
  shakes_quarts_brought: number; paletas_brought: number;
  shake_size_oz_snapshot: number;
  weather_label_snapshot: string | null;
  attendant_names_snapshot: string[] | null;
};

type SaleRow = {
  id: string; created_at: string; sale_kind: "single" | "group";
  payment_method_name_snapshot: string | null;
  applies_tax_snapshot: boolean;
  subtotal: number; tax_amount: number; tip_amount: number; total: number;
  note: string | null; logged_by: string;
  is_sample: boolean;
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
  const [tipOptions, setTipOptions] = useState<TipOption[]>([]);
  const [taxRate, setTaxRate] = useState(0);
  const [composerMode, setComposerMode] = useState<null | "sale" | "sample">(null);
  const [closeOpen, setCloseOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [topProduct, setTopProduct] = useState<{ name: string; qty: number } | null>(null);
  const [unitsSold, setUnitsSold] = useState<{ shakes: number; paletas: number }>({ shakes: 0, paletas: 0 });
  const [counts, setCounts] = useState<{ sales: number; samples: number }>({ sales: 0, samples: 0 });

  const loadConfig = async () => {
    const [{ data: prods }, { data: flv }, { data: pm }, { data: dem }, { data: tips }, { data: settings }] = await Promise.all([
      supabase.from("products").select("id,name,type,price").is("deleted_at", null).eq("is_archived", false).order("type").order("sort_order"),
      supabase.from("paleta_flavor_upgrades").select("id,name,upgrade_price").is("deleted_at", null).eq("is_archived", false).order("sort_order"),
      supabase.from("payment_methods").select("id,name,applies_tax").is("deleted_at", null).eq("is_archived", false).order("sort_order"),
      supabase.from("demographic_options").select("id,category,label").is("deleted_at", null).eq("is_archived", false).order("category").order("sort_order"),
      supabase.from("tip_options").select("id,label,kind,amount").is("deleted_at", null).eq("is_archived", false).order("sort_order"),
      supabase.from("app_settings").select("tax_rate").limit(1).maybeSingle(),
    ]);
    setProducts((prods ?? []).map((p) => ({ ...p, price: Number(p.price) })) as Product[]);
    setFlavors((flv ?? []).map((f) => ({ ...f, upgrade_price: Number(f.upgrade_price) })) as Flavor[]);
    setPaymentMethods((pm ?? []) as PaymentMethod[]);
    setDemographics((dem ?? []) as DemographicOption[]);
    setTipOptions((tips ?? []).map((t) => ({ ...t, amount: Number(t.amount) })) as TipOption[]);
    setTaxRate(Number(settings?.tax_rate ?? 0));
  };

  const loadSession = async () => {
    const { data } = await supabase.from("sales_sessions")
      .select("id,name,location,status,opened_at,shakes_quarts_brought,paletas_brought,shake_size_oz_snapshot,weather_label_snapshot,attendant_names_snapshot")
      .eq("id", sessionId).maybeSingle();
    setSession(data as Session | null);
  };

  const loadSales = async () => {
    const { data } = await supabase
      .from("sales")
      .select("id,created_at,sale_kind,payment_method_name_snapshot,applies_tax_snapshot,subtotal,tax_amount,tip_amount,total,note,logged_by,is_sample")
      .eq("session_id", sessionId).is("deleted_at", null)
      .order("created_at", { ascending: false });
    setSales((data ?? []).map((r) => ({
      ...r,
      subtotal: Number(r.subtotal), tax_amount: Number(r.tax_amount), tip_amount: Number(r.tip_amount ?? 0), total: Number(r.total),
    })) as SaleRow[]);
    const rows = data ?? [];
    const realSales = rows.filter((r) => !r.is_sample);
    const sampleCount = rows.length - realSales.length;
    setCounts({ sales: realSales.length, samples: sampleCount });
    const ids = realSales.map((r) => r.id);
    if (ids.length === 0) { setTopProduct(null); setUnitsSold({ shakes: 0, paletas: 0 }); return; }
    const { data: items } = await supabase
      .from("sale_items")
      .select("product_name_snapshot,product_type_snapshot,quantity")
      .in("sale_id", ids).is("deleted_at", null);
    const counts = new Map<string, number>();
    let s = 0, p = 0;
    (items ?? []).forEach((i) => {
      counts.set(i.product_name_snapshot, (counts.get(i.product_name_snapshot) ?? 0) + (i.quantity ?? 0));
      if (i.product_type_snapshot === "shake") s += i.quantity ?? 0;
      else if (i.product_type_snapshot === "paleta") p += i.quantity ?? 0;
    });
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    setTopProduct(top ? { name: top[0], qty: top[1] } : null);
    setUnitsSold({ shakes: s, paletas: p });
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
    const rawSubtotal = input.customers.reduce((sum, c) =>
      sum + c.lines.reduce((s, l) => s + (l.basePrice + l.upgradePrice) * l.quantity, 0), 0);
    const subtotal = input.isSample ? 0 : rawSubtotal;
    const appliesTax = !input.isSample && (input.paymentMethod?.applies_tax ?? false);
    const totals = computeTotals({ subtotal, appliesTax, taxRate, tip: input.isSample ? 0 : input.tipAmount });

    const { data: sale, error } = await supabase.from("sales").insert({
      session_id: sessionId, logged_by: user.id, sale_kind: input.kind,
      payment_method_id: input.paymentMethod?.id ?? null,
      payment_method_name_snapshot: input.paymentMethod?.name ?? (input.isSample ? "Sample" : ""),
      applies_tax_snapshot: appliesTax,
      tax_rate_snapshot: appliesTax ? taxRate : 0,
      subtotal: totals.subtotal, tax_amount: totals.tax, tip_amount: totals.tip, total: totals.total,
      is_sample: input.isSample,
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

    toast.success(input.isSample ? "Sample logged" : `Sale logged · ${fmt(totals.total)}`);
    setComposerMode(null);
    loadSales();
  };

  const performDelete = async (id: string) => {
    const { error } = await supabase.from("sales").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Sale deleted");
    setConfirmDeleteId(null);
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
  const totalShakeOz = (session.shakes_quarts_brought ?? 0) * 32;
  const shakeSize = Number(session.shake_size_oz_snapshot ?? 12) || 12;
  const shakesAvail = Math.max(0, Math.floor(totalShakeOz / shakeSize) - unitsSold.shakes);
  const paletasAvail = Math.max(0, (session.paletas_brought ?? 0) - unitsSold.paletas);
  const hasInventory = (session.shakes_quarts_brought ?? 0) > 0 || (session.paletas_brought ?? 0) > 0;
  const totalShakes = Math.floor(totalShakeOz / shakeSize);
  const totalPaletas = session.paletas_brought ?? 0;
  const shakePct = totalShakes > 0 ? Math.min(100, (unitsSold.shakes / totalShakes) * 100) : 0;
  const paletaPct = totalPaletas > 0 ? Math.min(100, (unitsSold.paletas / totalPaletas) * 100) : 0;
  const conversion = counts.samples > 0 ? counts.sales / counts.samples : null;

  return (
    <AppShell>
    <div className="pb-32">
      <header className="mb-4 flex items-center gap-3">
        <Link to="/sales" className="rounded-full p-2 hover:bg-muted"><ArrowLeft className="h-5 w-5" /></Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-black">{session.name}</h1>
          <p className="truncate text-xs text-muted-foreground">
            {session.location ?? "—"}
            {session.weather_label_snapshot && ` · ${session.weather_label_snapshot}`}
            {session.attendant_names_snapshot && session.attendant_names_snapshot.length > 0 &&
              ` · ${session.attendant_names_snapshot.join(", ")}`}
          </p>
        </div>
        {isOpen ? (
          <button
            onClick={() => setCloseOpen(true)}
            className="inline-flex items-center gap-1 rounded-full border-2 border-border bg-card px-3 py-2 text-xs font-bold hover:border-destructive hover:text-destructive"
          >
            <Lock className="h-3.5 w-3.5" /> Close
          </button>
        ) : (
          <Link to="/sales/$sessionId/report" params={{ sessionId }} className="rounded-full bg-secondary px-3 py-2 text-xs font-bold">
            Report
          </Link>
        )}
      </header>

      <div className="rounded-3xl p-6 text-white shadow-xl" style={{ background: "var(--gradient-hero)" }}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider opacity-90">Live revenue</p>
            <p className="mt-1 text-5xl font-black tabular-nums">{fmt(total)}</p>
            <p className="mt-1 text-xs opacity-90">{sales.length} sale{sales.length === 1 ? "" : "s"}</p>
          </div>
          {topProduct && (
            <div className="shrink-0 rounded-2xl bg-white/15 px-3 py-2 text-right backdrop-blur-sm">
              <p className="text-[10px] font-bold uppercase tracking-wider opacity-90">Top seller</p>
              <p className="mt-0.5 max-w-[10rem] truncate text-sm font-black">{topProduct.name}</p>
              <p className="text-xs opacity-90">{topProduct.qty} sold</p>
            </div>
          )}
        </div>
      </div>

      {hasInventory && (
        <div className="mt-3 space-y-2 rounded-2xl border border-border bg-card p-3">
          {totalShakes > 0 && (
            <div>
              <div className="flex items-baseline justify-between text-xs">
                <span className="font-bold">Shakes</span>
                <span className="tabular-nums text-muted-foreground"><span className="font-black text-foreground">{shakesAvail}</span> left · {unitsSold.shakes}/{totalShakes}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${shakePct}%` }} />
              </div>
            </div>
          )}
          {totalPaletas > 0 && (
            <div>
              <div className="flex items-baseline justify-between text-xs">
                <span className="font-bold">Paletas</span>
                <span className="tabular-nums text-muted-foreground"><span className="font-black text-foreground">{paletasAvail}</span> left · {unitsSold.paletas}/{totalPaletas}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${paletaPct}%` }} />
              </div>
            </div>
          )}
          {counts.samples > 0 && (
            <div className="flex items-center justify-between border-t border-border/50 pt-2 text-xs">
              <span className="font-bold">Samples → Sales</span>
              <span className="tabular-nums text-muted-foreground">
                {counts.sales} sales / {counts.samples} samples
                {conversion !== null && <span className="ml-2 font-black text-foreground">{conversion.toFixed(2)}×</span>}
              </span>
            </div>
          )}
        </div>
      )}

      {!isOpen && (
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
                  <p className="font-bold">
                    {s.is_sample ? <span className="inline-flex items-center gap-1 text-accent-foreground"><Gift className="h-3.5 w-3.5" /> Sample</span> : fmt(s.total)}
                    {!s.is_sample && <span className="text-xs font-normal text-muted-foreground"> · {s.payment_method_name_snapshot}</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(s.created_at).toLocaleTimeString()} · {s.sale_kind}
                    {s.tax_amount > 0 && ` · tax ${fmt(s.tax_amount)}`}
                    {s.tip_amount > 0 && ` · tip ${fmt(s.tip_amount)}`}
                    {s.note && ` · ${s.note}`}
                  </p>
                </div>
                {isOpen && (
                  confirmDeleteId === s.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => performDelete(s.id)}
                        className="rounded-full bg-destructive px-3 py-1.5 text-xs font-bold text-destructive-foreground"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="rounded-full bg-muted px-3 py-1.5 text-xs font-bold"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(s.id)}
                      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-bold text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </button>
                  )
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <SaleComposer
        open={composerMode !== null} onClose={() => setComposerMode(null)}
        mode={composerMode ?? "sale"}
        products={products} flavors={flavors} paymentMethods={paymentMethods}
        demographics={demographics} tipOptions={tipOptions} taxRate={taxRate} onSubmit={submitSale}
      />

      {isOpen && (
        <div className="fixed inset-x-0 bottom-16 z-30 mx-auto max-w-md px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          <div className="flex gap-2 rounded-2xl bg-background/80 p-1.5 backdrop-blur-md ring-1 ring-border">
            <Button onClick={() => setComposerMode("sale")} className="h-14 flex-[2] rounded-xl text-base font-bold shadow-lg"
              style={{ background: "var(--gradient-hero)" }}>
              <Plus className="mr-2 h-5 w-5" /> New sale
            </Button>
            <Button onClick={() => setComposerMode("sample")} variant="outline"
              className="h-14 flex-1 rounded-xl border-2 text-sm font-bold">
              <Gift className="mr-1 h-4 w-4" /> Sample
            </Button>
          </div>
        </div>
      )}

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

    </div>
    </AppShell>
  );
}