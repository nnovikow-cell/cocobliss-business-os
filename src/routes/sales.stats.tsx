import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Receipt, DollarSign, Cloud, Percent, Gift, Download } from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Protected } from "@/components/app/protected";
import { SideNav } from "@/components/app/side-nav";
import { BottomNav } from "@/components/app/bottom-nav";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { supabase } from "@/integrations/supabase/client";
import { fmt } from "@/lib/money";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/sales/stats")({ component: StatsPage });

type Range = "7" | "30" | "all";

type SessionRow = {
  id: string; name: string; opened_at: string;
  weather_label_snapshot: string | null;
  location: string | null;
  attendant_names_snapshot: string[] | null;
  shakes_quarts_brought: number;
  paletas_brought: number;
  shake_size_oz_snapshot: number;
  missed_shakes: number;
  missed_paletas: number;
  notes: string | null;
};

function StatsPage() {
  const [range, setRange] = useState<Range>("30");
  const [sideCollapsed, setSideCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [sales, setSales] = useState<Array<{ id: string; session_id: string; total: number; subtotal: number; tax: number; tip: number; payment_method_name_snapshot: string | null; created_at: string; is_sample: boolean; note: string | null }>>([]);
  const [sampleCount, setSampleCount] = useState(0);
  const [tipCount, setTipCount] = useState(0);
  const [items, setItems] = useState<Array<{ sale_id: string; product_name_snapshot: string; product_type_snapshot: string | null; flavor_name_snapshot: string | null; quantity: number; line_total: number }>>([]);
  const [demos, setDemos] = useState<Array<{ sale_id: string; category: string; label: string }>>([]);
  const [products, setProducts] = useState<Array<{ type: string; price: number }>>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const since = range === "all" ? null
        : new Date(Date.now() - Number(range) * 86400000).toISOString();

      let q = supabase.from("sales_sessions")
        .select("id,name,opened_at,weather_label_snapshot,location,attendant_names_snapshot,shakes_quarts_brought,paletas_brought,shake_size_oz_snapshot,missed_shakes,missed_paletas,notes")
        .is("deleted_at", null)
        .order("opened_at", { ascending: true });
      if (since) q = q.gte("opened_at", since);
      const [{ data: ss }, { data: prodData }] = await Promise.all([
        q,
        supabase.from("products").select("type,price").is("deleted_at", null).eq("is_archived", false),
      ]);
      const sessionRows = (ss ?? []) as SessionRow[];
      setSessions(sessionRows);
      setProducts((prodData ?? []).map((p) => ({ type: p.type as string, price: Number(p.price) })));
      const sIds = sessionRows.map((s) => s.id);

      if (sIds.length === 0) {
        setSales([]); setItems([]); setDemos([]); setLoading(false); return;
      }

      const { data: sl } = await supabase
        .from("sales").select("id,session_id,total,subtotal,tax_amount,tip_amount,payment_method_name_snapshot,created_at,is_sample,note")
        .in("session_id", sIds).is("deleted_at", null);
      const all = sl ?? [];
      const real = all.filter((r) => !r.is_sample).map((r) => ({
        ...r,
        total: Number(r.total),
        subtotal: Number(r.subtotal ?? 0),
        tax: Number(r.tax_amount ?? 0),
        tip: Number(r.tip_amount ?? 0),
        payment_method_name_snapshot: r.payment_method_name_snapshot ?? "",
      }));
      const saleRows = real.filter((r) => r.note !== "Tip");
      setSampleCount(all.length - real.length);
      setTipCount(real.length - saleRows.length);
      setSales(saleRows);
      const saleIds = saleRows.map((r) => r.id);

      if (saleIds.length === 0) { setItems([]); setDemos([]); setLoading(false); return; }

      const [{ data: it }, { data: dm }] = await Promise.all([
        supabase.from("sale_items").select("sale_id,product_name_snapshot,product_type_snapshot,flavor_name_snapshot,quantity,line_total").in("sale_id", saleIds).is("deleted_at", null),
        supabase.from("sale_demographics").select("sale_id,demographic_options(category,label)").in("sale_id", saleIds),
      ]);
      setItems((it ?? []).map((r) => ({ ...r, line_total: Number(r.line_total) })));
      setDemos(((dm ?? []) as Array<{ sale_id: string; demographic_options: { category: string; label: string } | null }>)
        .filter((d) => d.demographic_options).map((d) => ({ sale_id: d.sale_id, ...d.demographic_options! })));
      setLoading(false);
    })();
  }, [range]);

  const totals = useMemo(() => {
    const total = sales.reduce((s, r) => s + r.total, 0);
    const subtotal = sales.reduce((s, r) => s + (r.subtotal ?? 0), 0);
    const tax = sales.reduce((s, r) => s + (r.tax ?? 0), 0);
    const tip = sales.reduce((s, r) => s + (r.tip ?? 0), 0);
    const count = sales.length;
    const interactions = tipCount + sampleCount;
    const avg = count ? total / count : 0;
    return { total, subtotal, tax, tip, count, interactions, avg, sessions: sessions.length };
  }, [sales, sessions, sampleCount, tipCount]);

  const forecastStats = useMemo(() => {
    const cheapestShake = products
      .filter((p) => p.type === "shake")
      .reduce((min, p) => (p.price < min ? p.price : min), Infinity);
    const cheapestPaleta = products
      .filter((p) => p.type === "paleta")
      .reduce((min, p) => (p.price < min ? p.price : min), Infinity);
    const shakePrice = isFinite(cheapestShake) ? cheapestShake : 0;
    const palataPrice = isFinite(cheapestPaleta) ? cheapestPaleta : 0;
    let totalFloor = 0;
    let totalMissedShakes = 0;
    let totalMissedPaletas = 0;
    sessions.forEach((s) => {
      const shakeSize = Number(s.shake_size_oz_snapshot) || 12;
      const totalShakes = Math.floor((Number(s.shakes_quarts_brought) * 32) / shakeSize);
      const totalPaletas = Number(s.paletas_brought);
      totalFloor += totalShakes * shakePrice + totalPaletas * palataPrice;
      totalMissedShakes += Number(s.missed_shakes ?? 0);
      totalMissedPaletas += Number(s.missed_paletas ?? 0);
    });
    const missedRevenue = totalMissedShakes * shakePrice + totalMissedPaletas * palataPrice;
    const hasMissed = totalMissedShakes > 0 || totalMissedPaletas > 0;
    return { totalFloor, totalMissedShakes, totalMissedPaletas, missedRevenue, hasMissed };
  }, [sessions, products]);

  const unitsBySesion = useMemo(() => {
    const saleToSession = new Map<string, string>();
    sales.forEach((r) => saleToSession.set(r.id, r.session_id));
    const m = new Map<string, { shakes: number; paletas: number }>();
    items.forEach((i) => {
      const sid = saleToSession.get(i.sale_id);
      if (!sid) return;
      const cur = m.get(sid) ?? { shakes: 0, paletas: 0 };
      if (i.product_type_snapshot === "shake") cur.shakes += i.quantity;
      else if (i.product_type_snapshot === "paleta") cur.paletas += i.quantity;
      m.set(sid, cur);
    });
    return m;
  }, [sales, items]);

  const revenueBySesion = useMemo(() => {
    const m = new Map<string, { total: number; subtotal: number; tax: number; tip: number; count: number }>();
    sales.forEach((r) => {
      const cur = m.get(r.session_id) ?? { total: 0, subtotal: 0, tax: 0, tip: 0, count: 0 };
      cur.total += r.total;
      cur.subtotal += r.subtotal ?? 0;
      cur.tax += r.tax ?? 0;
      cur.tip += r.tip ?? 0;
      cur.count += 1;
      m.set(r.session_id, cur);
    });
    return m;
  }, [sales]);

  const downloadSessionsCsv = () => {
    const esc = (v: string | number) => {
      const s = String(v ?? "");
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const cheapestShake = products.filter((p) => p.type === "shake")
      .reduce((min, p) => (p.price < min ? p.price : min), Infinity);
    const cheapestPaleta = products.filter((p) => p.type === "paleta")
      .reduce((min, p) => (p.price < min ? p.price : min), Infinity);
    const shakePrice = isFinite(cheapestShake) ? cheapestShake : 0;
    const palataPrice = isFinite(cheapestPaleta) ? cheapestPaleta : 0;

    const headers = [
      "session_id", "session_name", "date", "location", "weather", "attendants",
      "shake_size_oz", "shakes_brought_quarts", "shakes_brought_units", "paletas_brought",
      "sellout_floor",
      "total_revenue", "subtotal", "tax", "tips",
      "sales_count", "samples_count", "tips_count", "avg_ticket",
      "shakes_sold", "paletas_sold",
      "shake_sellthrough_pct", "paleta_sellthrough_pct",
      "missed_shakes", "missed_paletas", "missed_revenue_potential",
      "closing_note",
    ];

    const rows = sessions.map((s) => {
      const shakeSize = Number(s.shake_size_oz_snapshot) || 12;
      const broughtUnits = Math.floor((Number(s.shakes_quarts_brought) * 32) / shakeSize);
      const broughtPaletas = Number(s.paletas_brought) || 0;
      const floor = broughtUnits * shakePrice + broughtPaletas * palataPrice;
      const rev = revenueBySesion.get(s.id) ?? { total: 0, subtotal: 0, tax: 0, tip: 0, count: 0 };
      const units = unitsBySesion.get(s.id) ?? { shakes: 0, paletas: 0 };
      const shakePct = broughtUnits > 0 ? Math.round((units.shakes / broughtUnits) * 100) : "";
      const paletaPct = broughtPaletas > 0 ? Math.round((units.paletas / broughtPaletas) * 100) : "";
      const missedShakes = Number(s.missed_shakes ?? 0);
      const missedPaletas = Number(s.missed_paletas ?? 0);
      const missedRev = missedShakes * shakePrice + missedPaletas * palataPrice;
      const avgTicket = rev.count > 0 ? (rev.total / rev.count).toFixed(2) : "";
      return [
        s.id,
        s.name,
        new Date(s.opened_at).toISOString().slice(0, 10),
        s.location ?? "",
        s.weather_label_snapshot ?? "",
        (s.attendant_names_snapshot ?? []).join("; "),
        shakeSize,
        Number(s.shakes_quarts_brought) || 0,
        broughtUnits,
        broughtPaletas,
        floor.toFixed(2),
        rev.total.toFixed(2),
        rev.subtotal.toFixed(2),
        rev.tax.toFixed(2),
        rev.tip.toFixed(2),
        rev.count,
        "",
        "",
        avgTicket,
        units.shakes,
        units.paletas,
        shakePct,
        paletaPct,
        missedShakes,
        missedPaletas,
        missedRev.toFixed(2),
        s.notes ?? "",
      ].map(esc).join(",");
    });

    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const today = new Date().toISOString().slice(0, 10);
    a.download = `cocobliss-sessions-${range}-${today}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadTransactionsCsv = () => {
    const esc = (v: string | number) => {
      const s = String(v ?? "");
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const sessionMap = new Map<string, SessionRow>();
    sessions.forEach((s) => sessionMap.set(s.id, s));
    const itemsBySale = new Map<string, Array<{ product_name_snapshot: string; product_type_snapshot: string | null; flavor_name_snapshot: string | null; quantity: number }>>();
    items.forEach((i) => {
      const arr = itemsBySale.get(i.sale_id) ?? [];
      arr.push(i);
      itemsBySale.set(i.sale_id, arr);
    });
    const demosBySale = new Map<string, Array<{ category: string; label: string }>>();
    demos.forEach((d) => {
      const arr = demosBySale.get(d.sale_id) ?? [];
      arr.push({ category: d.category, label: d.label });
      demosBySale.set(d.sale_id, arr);
    });
    const allDemoCategories = [...new Set(demos.map((d) => d.category))].sort();
    const headers = [
      "session_id", "session_name", "date", "location", "weather", "attendants",
      "closing_note",
      "timestamp", "event_type",
      "product", "product_type", "flavor", "quantity",
      "payment_method",
      "subtotal", "tax", "tip", "total",
      "note",
      ...allDemoCategories.map((c) => `demo_${c.toLowerCase().replace(/\s+/g, "_")}`),
    ];
    const rows = sales
      .slice()
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .map((sale) => {
        const session = sessionMap.get(sale.session_id);
        const saleItems = itemsBySale.get(sale.id) ?? [];
        const saleDemos = demosBySale.get(sale.id) ?? [];
        const products = saleItems.map((i) => i.product_name_snapshot).join("; ");
        const productTypes = [...new Set(saleItems.map((i) => i.product_type_snapshot ?? ""))].join("; ");
        const flavors = saleItems.map((i) => i.flavor_name_snapshot ?? "").filter(Boolean).join("; ");
        const quantity = saleItems.reduce((s, i) => s + i.quantity, 0);
        const demoValues = allDemoCategories.map((cat) => {
          const match = saleDemos.find((d) => d.category.toLowerCase() === cat.toLowerCase());
          return match ? match.label : "";
        });
        return [
          sale.session_id,
          session?.name ?? "",
          session ? new Date(session.opened_at).toISOString().slice(0, 10) : "",
          session?.location ?? "",
          session?.weather_label_snapshot ?? "",
          (session?.attendant_names_snapshot ?? []).join("; "),
          session?.notes ?? "",
          new Date(sale.created_at).toISOString(),
          "sale",
          products,
          productTypes,
          flavors,
          quantity || "",
          sale.payment_method_name_snapshot ?? "",
          Number(sale.subtotal ?? 0).toFixed(2),
          Number(sale.tax ?? 0).toFixed(2),
          Number(sale.tip ?? 0).toFixed(2),
          Number(sale.total).toFixed(2),
          sale.note ?? "",
          ...demoValues,
        ].map(esc).join(",");
      });
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const today = new Date().toISOString().slice(0, 10);
    a.download = `cocobliss-transactions-${range}-${today}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Revenue by session (chronological)
  const revenueSeries = useMemo(() => {
    const totalsBySession = new Map<string, number>();
    sales.forEach((r) => totalsBySession.set(r.session_id, (totalsBySession.get(r.session_id) ?? 0) + r.total));
    return sessions.map((s) => ({
      label: new Date(s.opened_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      name: s.name,
      total: +(totalsBySession.get(s.id) ?? 0).toFixed(2),
    }));
  }, [sessions, sales]);

  // Best-selling products
  const bestProducts = useMemo(() => {
    const m = new Map<string, { qty: number; total: number }>();
    items.forEach((i) => {
      const cur = m.get(i.product_name_snapshot) ?? { qty: 0, total: 0 };
      cur.qty += i.quantity; cur.total += i.line_total;
      m.set(i.product_name_snapshot, cur);
    });
    return [...m.entries()].map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.total - a.total).slice(0, 10);
  }, [items]);

  // Demographics
  const demoTrends = useMemo(() => {
    const m = new Map<string, { category: string; label: string; count: number }>();
    demos.forEach((d) => {
      const k = `${d.category}::${d.label}`;
      const cur = m.get(k) ?? { category: d.category, label: d.label, count: 0 };
      cur.count += 1;
      m.set(k, cur);
    });
    return [...m.values()].sort((a, b) => b.count - a.count);
  }, [demos]);

  // Weather vs avg revenue
  const weatherSeries = useMemo(() => {
    const totalsBySession = new Map<string, number>();
    sales.forEach((r) => totalsBySession.set(r.session_id, (totalsBySession.get(r.session_id) ?? 0) + r.total));
    const m = new Map<string, { total: number; sessions: number }>();
    sessions.forEach((s) => {
      if (!s.weather_label_snapshot) return;
      const cur = m.get(s.weather_label_snapshot) ?? { total: 0, sessions: 0 };
      cur.total += totalsBySession.get(s.id) ?? 0;
      cur.sessions += 1;
      m.set(s.weather_label_snapshot, cur);
    });
    return [...m.entries()].map(([label, v]) => ({
      label,
      avg: +(v.total / v.sessions).toFixed(2),
      sessions: v.sessions,
    })).sort((a, b) => b.avg - a.avg);
  }, [sessions, sales]);

  // Sales by time of day (aggregated across sessions)
  const hourSeries = useMemo(() => {
    const m = new Map<number, { count: number; total: number }>();
    sales.forEach((r) => {
      const h = new Date(r.created_at).getHours();
      const cur = m.get(h) ?? { count: 0, total: 0 };
      cur.count += 1; cur.total += r.total;
      m.set(h, cur);
    });
    if (m.size === 0) return [];
    const min = Math.min(...m.keys());
    const max = Math.max(...m.keys());
    const out: Array<{ label: string; count: number; total: number }> = [];
    for (let h = min; h <= max; h++) {
      const v = m.get(h) ?? { count: 0, total: 0 };
      const hr12 = h % 12 === 0 ? 12 : h % 12;
      const ampm = h < 12 ? "am" : "pm";
      out.push({ label: `${hr12}${ampm}`, count: v.count, total: +v.total.toFixed(2) });
    }
    return out;
  }, [sales]);

  return (
    <Protected>
      <div className="min-h-screen bg-background pb-24 md:pb-0">
        <SideNav collapsed={sideCollapsed} onToggle={() => setSideCollapsed((v) => !v)} />
        <div className="fixed right-3 top-3 z-50 md:hidden">
          <ThemeToggle className="rounded-full bg-card/90 shadow-sm backdrop-blur-md" />
        </div>
        <div className={cn("transition-[padding] duration-200", sideCollapsed ? "md:pl-16" : "md:pl-56")}>
          <div className="mx-auto w-full max-w-[1600px] px-4 pt-4">
            <header className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link to="/sales" className="rounded-full p-2 hover:bg-muted" aria-label="Back to Sales Tracker">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-black tracking-tight">Sales Dashboard</h1>
            <p className="text-xs text-muted-foreground">Performance across all sessions</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-full border-2 border-border bg-card p-1">
            {(["7", "30", "all"] as Range[]).map((r) => (
              <button key={r} onClick={() => setRange(r)}
                className={cn("rounded-full px-3 py-1.5 text-xs font-bold transition-colors",
                  range === r ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
                {r === "all" ? "All time" : `Last ${r}d`}
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={downloadSessionsCsv}
            disabled={loading || sessions.length === 0}
          >
            <Download className="h-4 w-4" /> Sessions
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={downloadTransactionsCsv}
            disabled={loading || sales.length === 0}
          >
            <Download className="h-4 w-4" /> Transactions
          </Button>
        </div>
      </header>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : sessions.length === 0 ? (
        <p className="rounded-2xl border-2 border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No sessions in this range yet.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_1fr_300px] lg:h-[calc(100vh-80px)]">
          {/* COL 1 */}
          <div className="flex flex-col gap-3 min-h-0">
            <ChartCard title="Revenue over time" className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenueSeries} margin={{ left: 8, right: 16, top: 8 }}>
                  <CartesianGrid vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={11} />
                  <YAxis tickFormatter={(v) => `$${v}`} stroke="var(--muted-foreground)" fontSize={11} />
                  <Tooltip
                    contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 }}
                    formatter={(v: number) => fmt(v)}
                    labelFormatter={(l, p) => p?.[0]?.payload?.name ?? l}
                  />
                  <Line type="monotone" dataKey="total" stroke="var(--chart-1)" strokeWidth={3}
                    dot={{ r: 4, fill: "var(--chart-1)" }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            {hourSeries.length > 0 && (
              <ChartCard title="Sales by time of day" className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hourSeries} margin={{ left: 8, right: 8 }}>
                    <CartesianGrid vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={11} />
                    <YAxis allowDecimals={false} stroke="var(--muted-foreground)" fontSize={11} />
                    <Tooltip
                      contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 }}
                      formatter={(v: number, _n, p) => [`${v} sales`, fmt(p.payload.total)]}
                    />
                    <Bar dataKey="count" fill="var(--chart-2)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}
          </div>

          {/* COL 2 */}
          <div className="flex flex-col gap-3 min-h-0">
            {weatherSeries.length > 0 && (
              <ChartCard title={<span className="inline-flex items-center gap-1.5"><Cloud className="h-3.5 w-3.5" /> Weather vs avg revenue</span>} className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weatherSeries} margin={{ left: 8, right: 16 }}>
                    <CartesianGrid vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={11} />
                    <YAxis tickFormatter={(v) => `$${v}`} stroke="var(--muted-foreground)" fontSize={11} />
                    <Tooltip
                      contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 }}
                      formatter={(v: number, n) => [fmt(v), n]}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar name="Avg / session" dataKey="avg" fill="var(--chart-5)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}

            <ChartCard title="Best-selling products" className="flex-1 min-h-0">
              {bestProducts.length === 0 ? <Empty /> : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={bestProducts} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <CartesianGrid horizontal={false} stroke="var(--border)" />
                    <XAxis type="number" tickFormatter={(v) => `$${v}`} stroke="var(--muted-foreground)" fontSize={11} />
                    <YAxis type="category" dataKey="name" width={90} stroke="var(--muted-foreground)" fontSize={11} />
                    <Tooltip
                      contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 }}
                      formatter={(v: number, _n, p) => [fmt(v), `${p.payload.qty} sold`]}
                    />
                    <Bar dataKey="total" fill="var(--chart-2)" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>

          {/* COL 3: sidebar */}
          <div className="flex flex-col gap-2 min-h-0 overflow-y-auto">
            <div className="rounded-2xl p-4 text-white shadow-lg shrink-0" style={{ background: "var(--gradient-hero)" }}>
              <p className="text-[10px] font-semibold uppercase tracking-wider opacity-90">Revenue</p>
              <p className="mt-0.5 text-3xl font-black tabular-nums">{fmt(totals.total)}</p>
              <p className="mt-1 text-[10px] opacity-90">
                {totals.sessions} sessions · {totals.count} sales · {totals.interactions} interactions
              </p>
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                <div className="rounded-xl bg-white/15 px-2 py-1.5 backdrop-blur-sm">
                  <p className="text-[9px] font-bold uppercase tracking-wider opacity-80">Subtotal</p>
                  <p className="mt-0.5 text-sm font-black tabular-nums">{fmt(totals.subtotal)}</p>
                </div>
                <div className="rounded-xl bg-white/15 px-2 py-1.5 backdrop-blur-sm">
                  <p className="text-[9px] font-bold uppercase tracking-wider opacity-80">Tax</p>
                  <p className="mt-0.5 text-sm font-black tabular-nums">{fmt(totals.tax)}</p>
                </div>
                <div className="rounded-xl bg-white/15 px-2 py-1.5 backdrop-blur-sm">
                  <p className="text-[9px] font-bold uppercase tracking-wider opacity-80">Tips</p>
                  <p className="mt-0.5 text-sm font-black tabular-nums">{fmt(totals.tip)}</p>
                </div>
              </div>
              {(forecastStats.totalFloor > 0 || forecastStats.hasMissed) && (
                <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                  {forecastStats.totalFloor > 0 && (
                    <div className="rounded-xl bg-white/15 px-2 py-1.5 backdrop-blur-sm">
                      <p className="text-[9px] font-bold uppercase tracking-wider opacity-80">Sellout floor</p>
                      <p className="mt-0.5 text-sm font-black tabular-nums">{fmt(forecastStats.totalFloor)}</p>
                    </div>
                  )}
                  {forecastStats.hasMissed && (
                    <div className="rounded-xl bg-white/15 px-2 py-1.5 backdrop-blur-sm">
                      <p className="text-[9px] font-bold uppercase tracking-wider opacity-80">Missed potential</p>
                      <p className="mt-0.5 text-sm font-black tabular-nums">{fmt(forecastStats.missedRevenue)}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 shrink-0">
              <Kpi icon={<Receipt className="h-3.5 w-3.5" />} label="Sales" value={String(totals.count)} />
              <Kpi icon={<Gift className="h-3.5 w-3.5" />} label="Interactions" value={String(totals.interactions)} />
              <Kpi icon={<DollarSign className="h-3.5 w-3.5" />} label="Avg ticket" value={fmt(totals.avg)} />
              <Kpi icon={<Percent className="h-3.5 w-3.5" />} label="Per session" value={fmt(totals.sessions ? totals.total / totals.sessions : 0)} />
            </div>

            {demoTrends.length > 0 && (
              <ChartCard title="Demographics" className="flex-1 min-h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={demoTrends} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <CartesianGrid horizontal={false} stroke="var(--border)" />
                    <XAxis type="number" allowDecimals={false} stroke="var(--muted-foreground)" fontSize={11} />
                    <YAxis type="category" dataKey="label" width={100} stroke="var(--muted-foreground)" fontSize={11} />
                    <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 }} />
                    <Bar dataKey="count" fill="var(--chart-4)" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}
          </div>
        </div>
      )}
          </div>
        </div>
        <BottomNav />
      </div>
    </Protected>
  );
}

function ChartCard({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-2.5">
      <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
        {icon} {label}
      </div>
      <p className="mt-0.5 text-base font-black tabular-nums">{value}</p>
    </div>
  );
}

function Empty() {
  return <p className="text-sm text-muted-foreground">No data.</p>;
}
