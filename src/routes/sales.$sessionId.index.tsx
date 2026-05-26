import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Plus, Trash2, Lock, Gift, Package, DollarSign, Pencil } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { fmt, computeTotals } from "@/lib/money";
import { SaleComposer } from "@/components/sales/sale-composer";
import type { Product, Flavor, PaymentMethod, DemographicOption, TipOption, CustomerCart } from "@/lib/sales-types";
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
  const [composerOpen, setComposerOpen] = useState(false);
  const [editInitial, setEditInitial] = useState<{
    saleId: string;
    kind: "single" | "group";
    carts: CustomerCart[];
    paymentMethodId: string | null;
    tipAmount: number;
    note: string;
  } | null>(null);
  const [editMode, setEditMode] = useState<"sale" | "sample">("sale");
  const [sampling, setSampling] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [tipOpen, setTipOpen] = useState(false);
  const [tipAmount, setTipAmount] = useState("");
  const [savingTip, setSavingTip] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [topProduct, setTopProduct] = useState<{ name: string; qty: number } | null>(null);
  const [unitsSold, setUnitsSold] = useState<{ shakes: number; paletas: number }>({ shakes: 0, paletas: 0 });
  const [counts, setCounts] = useState<{ sales: number; samples: number; tips: number }>({ sales: 0, samples: 0, tips: 0 });

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
    const sampleCount = rows.filter((r) => r.is_sample).length;
    const tipCount = rows.filter((r) => !r.is_sample && r.note === "Tip").length;
    const realSales = rows.filter((r) => !r.is_sample && r.note !== "Tip");
    setCounts({ sales: realSales.length, samples: sampleCount, tips: tipCount });
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

    const payload = {
      sale_kind: input.kind,
      payment_method_id: input.paymentMethod?.id ?? null,
      payment_method_name_snapshot: input.paymentMethod?.name ?? (input.isSample ? "Sample" : ""),
      applies_tax_snapshot: appliesTax,
      tax_rate_snapshot: appliesTax ? taxRate : 0,
      subtotal: totals.subtotal, tax_amount: totals.tax, tip_amount: totals.tip, total: totals.total,
      is_sample: input.isSample,
      note: input.note || null,
    };

    let saleId = input.saleId;
    if (saleId) {
      const { error: upErr } = await supabase.from("sales").update(payload).eq("id", saleId);
      if (upErr) { toast.error(upErr.message); return; }
      await supabase.from("sale_items").delete().eq("sale_id", saleId);
      await supabase.from("sale_demographics").delete().eq("sale_id", saleId);
    } else {
      const { data: sale, error } = await supabase.from("sales").insert({
        session_id: sessionId, logged_by: user.id, ...payload,
      }).select("id").single();
      if (error || !sale) { toast.error(error?.message ?? "Failed"); return; }
      saleId = sale.id;
    }

    const items = input.customers.flatMap((c, ci) => c.lines.map((l) => ({
      sale_id: saleId!, customer_index: ci,
      product_id: l.productId, product_name_snapshot: l.productName, product_type_snapshot: l.productType,
      base_price_snapshot: l.basePrice,
      flavor_upgrade_id: l.flavorId ?? null, flavor_name_snapshot: l.flavorName ?? null,
      upgrade_price_snapshot: l.upgradePrice, quantity: l.quantity,
      line_total: (l.basePrice + l.upgradePrice) * l.quantity,
    })));
    if (items.length) await supabase.from("sale_items").insert(items);

    const demos = input.customers.flatMap((c, ci) =>
      c.demographicIds.map((d) => ({ sale_id: saleId!, customer_index: ci, demographic_option_id: d }))
    );
    if (demos.length) await supabase.from("sale_demographics").insert(demos);

    toast.success(input.saleId ? "Sale updated" : input.isSample ? "Sample logged" : `Sale logged · ${fmt(totals.total)}`);
    setComposerOpen(false);
    setEditInitial(null);
    loadSales();
  };

  const openEdit = async (saleRow: SaleRow) => {
    const [{ data: itemRows }, { data: demoRows }] = await Promise.all([
      supabase.from("sale_items")
        .select("customer_index,product_id,product_name_snapshot,product_type_snapshot,base_price_snapshot,flavor_upgrade_id,flavor_name_snapshot,upgrade_price_snapshot,quantity")
        .eq("sale_id", saleRow.id).is("deleted_at", null).order("customer_index"),
      supabase.from("sale_demographics")
        .select("customer_index,demographic_option_id").eq("sale_id", saleRow.id),
    ]);
    const byCust = new Map<number, CustomerCart>();
    (itemRows ?? []).forEach((r) => {
      const ci = r.customer_index ?? 0;
      if (!byCust.has(ci)) byCust.set(ci, { lines: [], demographicIds: [] });
      byCust.get(ci)!.lines.push({
        productId: r.product_id ?? "",
        productName: r.product_name_snapshot,
        productType: r.product_type_snapshot as "shake" | "paleta",
        basePrice: Number(r.base_price_snapshot),
        flavorId: r.flavor_upgrade_id ?? undefined,
        flavorName: r.flavor_name_snapshot ?? undefined,
        upgradePrice: Number(r.upgrade_price_snapshot),
        quantity: r.quantity ?? 1,
      });
    });
    (demoRows ?? []).forEach((r) => {
      const ci = r.customer_index ?? 0;
      if (!byCust.has(ci)) byCust.set(ci, { lines: [], demographicIds: [] });
      byCust.get(ci)!.demographicIds.push(r.demographic_option_id);
    });
    const maxIdx = Math.max(0, ...Array.from(byCust.keys()));
    const carts: CustomerCart[] = [];
    for (let i = 0; i <= maxIdx; i++) carts.push(byCust.get(i) ?? { lines: [], demographicIds: [] });

    // Resolve payment method id from snapshot name
    const pm = paymentMethods.find((m) => m.name === saleRow.payment_method_name_snapshot);

    setEditMode(saleRow.is_sample ? "sample" : "sale");
    setEditInitial({
      saleId: saleRow.id,
      kind: saleRow.sale_kind,
      carts: carts.length ? carts : [{ lines: [], demographicIds: [] }],
      paymentMethodId: pm?.id ?? null,
      tipAmount: saleRow.tip_amount,
      note: saleRow.note ?? "",
    });
    setComposerOpen(true);
  };

  const quickSample = async () => {
    if (!user || sampling) return;
    setSampling(true);
    const { error } = await supabase.from("sales").insert({
      session_id: sessionId, logged_by: user.id, sale_kind: "single",
      payment_method_id: null, payment_method_name_snapshot: "Sample",
      applies_tax_snapshot: false, tax_rate_snapshot: 0,
      subtotal: 0, tax_amount: 0, tip_amount: 0, total: 0,
      is_sample: true, note: null,
    });
    setSampling(false);
    if (error) return toast.error(error.message);
    toast.success("Sample logged");
    loadSales();
  };

  const submitTip = async () => {
    if (!user || savingTip) return;
    const amt = Number(tipAmount);
    if (!Number.isFinite(amt) || amt <= 0) return toast.error("Enter a tip amount");
    setSavingTip(true);
    const { error } = await supabase.from("sales").insert({
      session_id: sessionId, logged_by: user.id, sale_kind: "single",
      payment_method_id: null, payment_method_name_snapshot: "Tip",
      applies_tax_snapshot: false, tax_rate_snapshot: 0,
      subtotal: 0, tax_amount: 0, tip_amount: amt, total: amt,
      is_sample: false, note: "Tip",
    });
    setSavingTip(false);
    if (error) return toast.error(error.message);
    toast.success(`Tip logged · ${fmt(amt)}`);
    setTipAmount(""); setTipOpen(false);
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
    // Auto-close any linked checklist session
    const { data: linked } = await supabase.from("sales_sessions")
      .select("linked_checklist_session_id").eq("id", sessionId).maybeSingle();
    const linkedId = (linked as { linked_checklist_session_id: string | null } | null)?.linked_checklist_session_id;
    if (linkedId) {
      await supabase.from("checklist_sessions")
        .update({ status: "closed", closed_at: new Date().toISOString(), closed_by: user.id })
        .eq("id", linkedId).eq("status", "active");
    }
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
            <p className="mt-1 text-xs opacity-90">
              {counts.sales} sale{counts.sales === 1 ? "" : "s"}
              {(counts.samples + counts.tips) > 0 && ` · ${counts.samples + counts.tips} interaction${counts.samples + counts.tips === 1 ? "" : "s"}`}
            </p>
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
        </div>
      )}

      {counts.samples > 0 && (
        <div className="mt-2 flex items-center justify-between rounded-2xl border border-border bg-card px-3 py-2 text-xs">
          <span className="font-bold">Samples → Sales</span>
          <span className="tabular-nums text-muted-foreground">
            {counts.sales} / {counts.samples}
            {conversion !== null && <span className="ml-2 font-black text-foreground">{conversion.toFixed(2)}× conv.</span>}
          </span>
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
                    <div className="flex items-center gap-1">
                      {s.note !== "Tip" && (
                        <button
                          onClick={() => openEdit(s)}
                          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-bold text-muted-foreground hover:bg-primary/10 hover:text-primary"
                        >
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </button>
                      )}
                    <button
                      onClick={() => setConfirmDeleteId(s.id)}
                      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-bold text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </button>
                    </div>
                  )
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <SaleComposer
        open={composerOpen} onClose={() => { setComposerOpen(false); setEditInitial(null); }}
        mode={editInitial ? editMode : "sale"}
        initial={editInitial}
        products={products} flavors={flavors} paymentMethods={paymentMethods}
        demographics={demographics} tipOptions={tipOptions} taxRate={taxRate} onSubmit={submitSale}
      />

      {isOpen && (
        <div className="fixed inset-x-0 bottom-16 z-30 mx-auto max-w-md px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          <div className="flex gap-2 rounded-2xl bg-background/80 p-1.5 backdrop-blur-md ring-1 ring-border">
            <Button onClick={() => setComposerOpen(true)} className="h-14 flex-[2] rounded-xl text-base font-bold shadow-lg"
              style={{ background: "var(--gradient-hero)" }}>
              <Plus className="mr-2 h-5 w-5" /> New sale
            </Button>
            <Button onClick={quickSample} disabled={sampling} variant="outline"
              className="h-14 flex-1 rounded-xl border-2 text-sm font-bold">
              <Gift className="mr-1 h-4 w-4" /> Sample
            </Button>
            <Button onClick={() => setTipOpen(true)} variant="outline"
              className="h-14 flex-1 rounded-xl border-2 text-sm font-bold">
              <DollarSign className="mr-1 h-4 w-4" /> Tip
            </Button>
          </div>
        </div>
      )}

      <Dialog open={tipOpen} onOpenChange={(o) => { setTipOpen(o); if (!o) setTipAmount(""); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add tip</DialogTitle></DialogHeader>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
            <Input
              autoFocus inputMode="decimal" type="number" step="0.01" min="0"
              placeholder="0.00" value={tipAmount}
              onChange={(e) => setTipAmount(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submitTip(); }}
              className="h-12 pl-7 text-lg font-bold"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTipOpen(false)}>Cancel</Button>
            <Button onClick={submitTip} disabled={savingTip || !tipAmount}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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