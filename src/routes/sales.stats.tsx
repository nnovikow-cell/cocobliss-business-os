import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Receipt, DollarSign, Cloud, Percent, Gift } from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";
import { AppShell } from "@/components/app/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { fmt } from "@/lib/money";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/sales/stats")({ component: StatsPage });

type Range = "7" | "30" | "all";

type SessionRow = {
  id: string; name: string; opened_at: string;
  weather_label_snapshot: string | null;
  shakes_quarts_brought: number;
  paletas_brought: number;
  shake_size_oz_snapshot: number;
  missed_shakes: number;
  missed_paletas: number;
};

function StatsPage() {
  const [range, setRange] = useState<Range>("30");
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [sales, setSales] = useState<Array<{ id: string; session_id: string; total: number; subtotal: number; tax: number; tip: number; created_at: string; is_sample: boolean; note: string | null }>>([]);
  const [sampleCount, setSampleCount] = useState(0);
  const [tipCount, setTipCount] = useState(0);
  const [items, setItems] = useState<Array<{ sale_id: string; product_name_snapshot: string; quantity: number; line_total: number }>>([]);
  const [demos, setDemos] = useState<Array<{ category: string; label: string }>>([]);
  const [products, setProducts] = useState<Array<{ type: string; price: number }>>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const since = range === "all" ? null
        : new Date(Date.now() - Number(range) * 86400000).toISOString();

      let q = supabase.from("sales_sessions")
        .select("id,name,opened_at,weather_label_snapshot,shakes_quarts_brought,paletas_brought,shake_size_oz_snapshot,missed_shakes,missed_paletas")
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
        .from("sales").select("id,session_id,total,subtotal,tax_amount,tip_amount,created_at,is_sample,note")
        .in("session_id", sIds).is("deleted_at", null);
      const all = sl ?? [];
      const real = all.filter((r) => !r.is_sample).map((r) => ({
        ...r,
        total: Number(r.total),
        subtotal: Number(r.subtotal ?? 0),
        tax: Number(r.tax_amount ?? 0),
        tip: Number(r.tip_amount ?? 0),
      }));
      const saleRows = real.filter((r) => r.note !== "Tip");
      setSampleCount(all.length - real.length);
      setTipCount(real.length - saleRows.length);
      setSales(saleRows);
      const saleIds = saleRows.map((r) => r.id);

      if (saleIds.length === 0) { setItems([]); setDemos([]); setLoading(false); return; }

      const [{ data: it }, { data: dm }] = await Promise.all([
        supabase.from("sale_items").select("sale_id,product_name_snapshot,quantity,line_total").in("sale_id", saleIds).is("deleted_at", null),
        supabase.from("sale_demographics").select("demographic_options(category,label)").in("sale_id", saleIds),
      ]);
      setItems((it ?? []).map((r) => ({ ...r, line_total: Number(r.line_total) })));
      setDemos(((dm ?? []) as Array<{ demographic_options: { category: string; label: string } | null }>)
        .filter((d) => d.demographic_options).map((d) => d.demographic_options!));
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
    <AppShell>
      <header className="mb-4 flex items-center gap-3">
        <Link to="/sales" className="rounded-full p-2 hover:bg-muted" aria-label="Back to Sales Tracker">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-black">Stats</h1>
          <p className="text-xs text-muted-foreground">Across all sessions</p>
        </div>
      </header>

      <div className="mb-3 inline-flex rounded-full border-2 border-border bg-card p-1">
        {(["7", "30", "all"] as Range[]).map((r) => (
          <button key={r} onClick={() => setRange(r)}
            className={cn("rounded-full px-3 py-1.5 text-xs font-bold transition-colors",
              range === r ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
            {r === "all" ? "All time" : `Last ${r}d`}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : sessions.length === 0 ? (
        <p className="rounded-2xl border-2 border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No sessions in this range yet.
        </p>
      ) : (
        <>
          <div className="rounded-3xl p-6 text-white shadow-xl" style={{ background: "var(--gradient-hero)" }}>
            <p className="text-xs font-semibold uppercase tracking-wider opacity-90">Revenue</p>
            <p className="mt-1 text-5xl font-black tabular-nums">{fmt(totals.total)}</p>
            <p className="mt-2 text-xs opacity-90">
              {totals.sessions} session{totals.sessions === 1 ? "" : "s"} · {totals.count} sales · {totals.interactions} interaction{totals.interactions === 1 ? "" : "s"}
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-2xl bg-white/15 px-3 py-2 backdrop-blur-sm">
                <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">Subtotal</p>
                <p className="mt-0.5 text-base font-black tabular-nums">{fmt(totals.subtotal)}</p>
              </div>
              <div className="rounded-2xl bg-white/15 px-3 py-2 backdrop-blur-sm">
                <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">Tax</p>
                <p className="mt-0.5 text-base font-black tabular-nums">{fmt(totals.tax)}</p>
              </div>
              <div className="rounded-2xl bg-white/15 px-3 py-2 backdrop-blur-sm">
                <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">Tips</p>
                <p className="mt-0.5 text-base font-black tabular-nums">{fmt(totals.tip)}</p>
              </div>
            </div>
            {(forecastStats.totalFloor > 0 || forecastStats.hasMissed) && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                {forecastStats.totalFloor > 0 && (
                  <div className="rounded-2xl bg-white/15 px-3 py-2 backdrop-blur-sm">
                    <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">Sellout floor</p>
                    <p className="mt-0.5 text-base font-black tabular-nums">{fmt(forecastStats.totalFloor)}</p>
                  </div>
                )}
                {forecastStats.hasMissed && (
                  <div className="rounded-2xl bg-white/15 px-3 py-2 backdrop-blur-sm">
                    <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">Missed potential</p>
                    <p className="mt-0.5 text-base font-black tabular-nums">{fmt(forecastStats.missedRevenue)}</p>
                    <p className="text-[10px] opacity-70">
                      {forecastStats.totalMissedShakes > 0 && `${forecastStats.totalMissedShakes} shake${forecastStats.totalMissedShakes !== 1 ? "s" : ""}`}
                      {forecastStats.totalMissedShakes > 0 && forecastStats.totalMissedPaletas > 0 && " · "}
                      {forecastStats.totalMissedPaletas > 0 && `${forecastStats.totalMissedPaletas} paleta${forecastStats.totalMissedPaletas !== 1 ? "s" : ""}`}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Kpi icon={<Receipt className="h-4 w-4" />} label="Sales" value={String(totals.count)} />
            <Kpi icon={<Gift className="h-4 w-4" />} label="Interactions" value={String(totals.interactions)} />
            <Kpi icon={<DollarSign className="h-4 w-4" />} label="Avg ticket" value={fmt(totals.avg)} />
            <Kpi icon={<Percent className="h-4 w-4" />} label="Per session" value={fmt(totals.sessions ? totals.total / totals.sessions : 0)} />
          </div>

          {/* Revenue over time */}
          <ChartCard title="Revenue over time">
            <ResponsiveContainer width="100%" height={220}>
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

          {/* Best sellers */}
          <ChartCard title="Best-selling products">
            {bestProducts.length === 0 ? <Empty /> : (
              <ResponsiveContainer width="100%" height={Math.max(160, bestProducts.length * 32)}>
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

          {/* Demographic trends */}
          {demoTrends.length > 0 && (
            <ChartCard title="Demographic trends">
              <ResponsiveContainer width="100%" height={Math.max(160, demoTrends.length * 28)}>
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

          {/* Weather vs revenue */}
          {weatherSeries.length > 0 && (
            <ChartCard title={<span className="inline-flex items-center gap-1.5"><Cloud className="h-3.5 w-3.5" /> Weather vs avg revenue</span>}>
              <ResponsiveContainer width="100%" height={220}>
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

          {/* Sales by time of day */}
          {hourSeries.length > 0 && (
            <ChartCard title="Sales by time of day">
              <ResponsiveContainer width="100%" height={220}>
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
        </>
      )}
    </AppShell>
  );
}

function ChartCard({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mt-4 rounded-2xl border border-border bg-card p-4">
      <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {icon} {label}
      </div>
      <p className="mt-1 text-lg font-black tabular-nums">{value}</p>
    </div>
  );
}

function Empty() {
  return <p className="text-sm text-muted-foreground">No data.</p>;
}
