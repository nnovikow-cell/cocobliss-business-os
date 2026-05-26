import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Cloud, Users as UsersIcon, Receipt, Gift, Percent } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { AppShell } from "@/components/app/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { fmt } from "@/lib/money";
import { SaleDetailDialog, type SaleDetail } from "@/components/sales/sale-detail-dialog";

export const Route = createFileRoute("/sales/$sessionId/report")({ component: ReportPage });

const PIE_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

type Session = {
  id: string; name: string; location: string | null;
  opened_at: string; closed_at: string | null; status: string;
  shakes_quarts_brought: number; paletas_brought: number; shake_size_oz_snapshot: number;
  weather_label_snapshot: string | null; attendant_names_snapshot: string[] | null;
};

type Stats = {
  total: number; subtotal: number; tax: number; tip: number;
  count: number; sampleCount: number; tipCount: number; interactionCount: number; avgTicket: number;
  byPayment: Array<{ name: string; total: number; count: number }>;
  byProduct: Array<{ name: string; qty: number; total: number }>;
  byDemo: Array<{ category: string; label: string; count: number }>;
  unitsSold: { shakes: number; paletas: number };
  byHour: Array<{ hour: number; label: string; count: number; total: number }>;
  entries: Array<{
    id: string; created_at: string; total: number; subtotal: number;
    tax: number; tip: number; payment: string | null; note: string | null;
    is_sample: boolean;
  }>;
};

function bucketByHour(rows: Array<{ created_at: string; total: number }>) {
  const m = new Map<number, { count: number; total: number }>();
  rows.forEach((r) => {
    const h = new Date(r.created_at).getHours();
    const cur = m.get(h) ?? { count: 0, total: 0 };
    cur.count += 1; cur.total += r.total;
    m.set(h, cur);
  });
  if (m.size === 0) return [];
  const min = Math.min(...m.keys());
  const max = Math.max(...m.keys());
  const out: Array<{ hour: number; label: string; count: number; total: number }> = [];
  for (let h = min; h <= max; h++) {
    const v = m.get(h) ?? { count: 0, total: 0 };
    const hr12 = h % 12 === 0 ? 12 : h % 12;
    const ampm = h < 12 ? "am" : "pm";
    out.push({ hour: h, label: `${hr12}${ampm}`, count: v.count, total: +v.total.toFixed(2) });
  }
  return out;
}

function ReportPage() {
  const { sessionId } = Route.useParams();
  const [session, setSession] = useState<Session | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [detailSale, setDetailSale] = useState<SaleDetail | null>(null);

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.from("sales_sessions")
        .select("id,name,location,opened_at,closed_at,status,shakes_quarts_brought,paletas_brought,shake_size_oz_snapshot,weather_label_snapshot,attendant_names_snapshot")
        .eq("id", sessionId).maybeSingle();
      setSession(s as Session | null);

      const { data: sales } = await supabase
        .from("sales").select("id,subtotal,tax_amount,tip_amount,total,payment_method_name_snapshot,is_sample,note,created_at")
        .eq("session_id", sessionId).is("deleted_at", null);
      const allRows = sales ?? [];
      const real = allRows.filter((r) => !r.is_sample); // revenue-producing rows (incl. tips)
      const saleRows = real.filter((r) => r.note !== "Tip"); // actual sales only
      const sampleCount = allRows.filter((r) => r.is_sample).length;
      const tipCount = real.length - saleRows.length;
      const saleIds = saleRows.map((r) => r.id);

      let items: Array<{ product_name_snapshot: string; product_type_snapshot: string; quantity: number; line_total: number }> = [];
      let demos: Array<{ demographic_options: { category: string; label: string } | null }> = [];
      if (saleIds.length) {
        const [{ data: it }, { data: dm }] = await Promise.all([
          supabase.from("sale_items").select("product_name_snapshot,product_type_snapshot,quantity,line_total").in("sale_id", saleIds).is("deleted_at", null),
          supabase.from("sale_demographics").select("demographic_options(category,label)").in("sale_id", saleIds),
        ]);
        items = (it ?? []).map((r) => ({ ...r, line_total: Number(r.line_total) })) as typeof items;
        demos = (dm ?? []) as typeof demos;
      }

      // Revenue total includes tips; avg ticket divides sale-only revenue by sale count.
      const total = real.reduce((s, r) => s + Number(r.total), 0);
      const subtotal = real.reduce((s, r) => s + Number(r.subtotal), 0);
      const tax = real.reduce((s, r) => s + Number(r.tax_amount), 0);
      const tip = real.reduce((s, r) => s + Number(r.tip_amount ?? 0), 0);
      const saleRevenue = saleRows.reduce((s, r) => s + Number(r.total), 0);
      const avgTicket = saleRows.length ? saleRevenue / saleRows.length : 0;

      const byPaymentMap = new Map<string, { total: number; count: number }>();
      saleRows.forEach((r) => {
        const cur = byPaymentMap.get(r.payment_method_name_snapshot) ?? { total: 0, count: 0 };
        cur.total += Number(r.total); cur.count += 1;
        byPaymentMap.set(r.payment_method_name_snapshot, cur);
      });
      const byPayment = [...byPaymentMap.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.total - a.total);

      const byProductMap = new Map<string, { qty: number; total: number }>();
      let shakeUnits = 0, paletaUnits = 0;
      items.forEach((i) => {
        const cur = byProductMap.get(i.product_name_snapshot) ?? { qty: 0, total: 0 };
        cur.qty += i.quantity; cur.total += i.line_total;
        byProductMap.set(i.product_name_snapshot, cur);
        if (i.product_type_snapshot === "shake") shakeUnits += i.quantity;
        else if (i.product_type_snapshot === "paleta") paletaUnits += i.quantity;
      });
      const byProduct = [...byProductMap.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.total - a.total);

      const byDemoMap = new Map<string, { category: string; label: string; count: number }>();
      demos.forEach((d) => {
        if (!d.demographic_options) return;
        const key = `${d.demographic_options.category}::${d.demographic_options.label}`;
        const cur = byDemoMap.get(key) ?? { category: d.demographic_options.category, label: d.demographic_options.label, count: 0 };
        cur.count += 1;
        byDemoMap.set(key, cur);
      });
      const byDemo = [...byDemoMap.values()].sort((a, b) => b.count - a.count);

      setStats({
        total, subtotal, tax, tip,
        count: saleRows.length, sampleCount, tipCount, interactionCount: sampleCount + tipCount, avgTicket,
        byPayment, byProduct, byDemo, unitsSold: { shakes: shakeUnits, paletas: paletaUnits },
        byHour: bucketByHour(saleRows.map((r) => ({ created_at: r.created_at as string, total: Number(r.total) }))),
        entries: allRows
          .slice()
          .sort((a, b) => new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime())
          .map((r) => ({
            id: r.id as string,
            created_at: r.created_at as string,
            total: Number(r.total),
            subtotal: Number(r.subtotal),
            tax: Number(r.tax_amount),
            tip: Number(r.tip_amount ?? 0),
            payment: r.payment_method_name_snapshot as string | null,
            note: r.note as string | null,
            is_sample: !!r.is_sample,
          })),
      });
    })();
  }, [sessionId]);

  const inventoryData = useMemo(() => {
    if (!session) return [];
    const shakeSize = Number(session.shake_size_oz_snapshot) || 12;
    const totalShakes = Math.floor((Number(session.shakes_quarts_brought) * 32) / shakeSize);
    const totalPaletas = Number(session.paletas_brought) || 0;
    const out: Array<{ name: string; brought: number; sold: number }> = [];
    if (totalShakes > 0) out.push({ name: "Shakes", brought: totalShakes, sold: stats?.unitsSold.shakes ?? 0 });
    if (totalPaletas > 0) out.push({ name: "Paletas", brought: totalPaletas, sold: stats?.unitsSold.paletas ?? 0 });
    return out;
  }, [session, stats]);

  const ageData = useMemo(() => {
    if (!stats) return [];
    return stats.byDemo.filter((d) => /age/i.test(d.category));
  }, [stats]);

  const conversion = stats && stats.sampleCount > 0 ? stats.count / stats.sampleCount : null;

  return (
    <AppShell>
      <header className="mb-4 flex items-center gap-3">
        <Link to="/sales" className="rounded-full p-2 hover:bg-muted" aria-label="Back to Sales Tracker">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-black">{session?.name ?? "Report"}</h1>
          <p className="text-xs text-muted-foreground">
            {session?.opened_at && new Date(session.opened_at).toLocaleDateString()}
            {session?.closed_at && ` → ${new Date(session.closed_at).toLocaleDateString()}`}
          </p>
        </div>
      </header>

      {!stats || !session ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : (
        <>
          {/* Hero */}
          <div className="rounded-3xl p-6 text-white shadow-xl" style={{ background: "var(--gradient-hero)" }}>
            <p className="text-xs font-semibold uppercase tracking-wider opacity-90">Total revenue</p>
            <p className="mt-1 text-5xl font-black tabular-nums">{fmt(stats.total)}</p>
            <p className="mt-2 text-xs opacity-90">
              Subtotal {fmt(stats.subtotal)} · Tax {fmt(stats.tax)}
              {stats.tip > 0 && ` · Tip ${fmt(stats.tip)}`}
            </p>
          </div>

          {/* KPI grid */}
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Kpi icon={<Receipt className="h-4 w-4" />} label="Sales" value={String(stats.count)} />
            <Kpi icon={<Percent className="h-4 w-4" />} label="Avg ticket" value={fmt(stats.avgTicket)} />
            <Kpi
              icon={<Gift className="h-4 w-4" />}
              label="Interactions"
              value={String(stats.interactionCount)}
              sub={`${stats.sampleCount} sample${stats.sampleCount === 1 ? "" : "s"} · ${stats.tipCount} tip${stats.tipCount === 1 ? "" : "s"}`}
            />
            <Kpi
              icon={<Percent className="h-4 w-4" />}
              label="Conversion"
              value={conversion !== null ? `${conversion.toFixed(2)}×` : "—"}
              sub={conversion !== null ? "sales / sample" : undefined}
            />
          </div>

          {/* Meta */}
          {(session.weather_label_snapshot || (session.attendant_names_snapshot?.length ?? 0) > 0) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {session.weather_label_snapshot && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-bold">
                  <Cloud className="h-3.5 w-3.5" /> {session.weather_label_snapshot}
                </span>
              )}
              {session.attendant_names_snapshot && session.attendant_names_snapshot.length > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-bold">
                  <UsersIcon className="h-3.5 w-3.5" /> {session.attendant_names_snapshot.join(", ")}
                </span>
              )}
            </div>
          )}

          {/* Transaction log (read-only) */}
          {stats.entries.length > 0 && (
            <ChartCard title="Transaction log">
              <div className="space-y-1.5">
                {stats.entries.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => setDetailSale({
                      id: e.id,
                      created_at: e.created_at,
                      total: e.total,
                      subtotal: e.subtotal,
                      tax_amount: e.tax,
                      tip_amount: e.tip,
                      payment_method_name_snapshot: e.payment,
                      note: e.note,
                      is_sample: e.is_sample,
                    })}
                    className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-2.5 text-left transition-colors hover:border-primary"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold">
                        {e.is_sample ? (
                          <span className="inline-flex items-center gap-1 text-accent-foreground"><Gift className="h-3.5 w-3.5" /> Sample</span>
                        ) : (
                          <>
                            {fmt(e.total)}
                            <span className="text-xs font-normal text-muted-foreground"> · {e.payment ?? "—"}</span>
                          </>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(e.created_at).toLocaleTimeString()}
                        {e.tax > 0 && ` · tax ${fmt(e.tax)}`}
                        {e.tip > 0 && ` · tip ${fmt(e.tip)}`}
                        {e.note && ` · ${e.note}`}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </ChartCard>
          )}

          {/* Sales by product */}
          <ChartCard title="Sales by product">
            {stats.byProduct.length === 0 ? <Empty /> : (
              <ResponsiveContainer width="100%" height={Math.max(160, stats.byProduct.length * 36)}>
                <BarChart data={stats.byProduct} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid horizontal={false} stroke="var(--border)" />
                  <XAxis type="number" tickFormatter={(v) => `$${v}`} stroke="var(--muted-foreground)" fontSize={11} />
                  <YAxis type="category" dataKey="name" width={90} stroke="var(--muted-foreground)" fontSize={11} />
                  <Tooltip
                    contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 }}
                    formatter={(v: number, _n, p) => [fmt(v), `${p.payload.qty} sold`]}
                  />
                  <Bar dataKey="total" fill="var(--chart-1)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          {/* Payment donut */}
          <ChartCard title="By payment method">
            {stats.byPayment.length === 0 ? <Empty /> : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={stats.byPayment} dataKey="total" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                    {stats.byPayment.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 }}
                    formatter={(v: number) => fmt(v)}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          {/* Age groups */}
          {ageData.length > 0 && (
            <ChartCard title="By age group">
              <ResponsiveContainer width="100%" height={Math.max(140, ageData.length * 32)}>
                <BarChart data={ageData} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid horizontal={false} stroke="var(--border)" />
                  <XAxis type="number" allowDecimals={false} stroke="var(--muted-foreground)" fontSize={11} />
                  <YAxis type="category" dataKey="label" width={90} stroke="var(--muted-foreground)" fontSize={11} />
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 }} />
                  <Bar dataKey="count" fill="var(--chart-4)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          )}

          {/* Other demographics */}
          {stats.byDemo.filter((d) => !/age/i.test(d.category)).length > 0 && (
            <ChartCard title="Other demographics">
              <div className="space-y-1.5">
                {stats.byDemo.filter((d) => !/age/i.test(d.category)).map((r) => (
                  <div key={`${r.category}::${r.label}`} className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2 text-sm">
                    <span>
                      <span className="mr-2 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase">{r.category}</span>
                      {r.label}
                    </span>
                    <span className="font-bold tabular-nums">{r.count}</span>
                  </div>
                ))}
              </div>
            </ChartCard>
          )}

          {/* Inventory brought vs sold */}
          {inventoryData.length > 0 && (
            <ChartCard title="Inventory brought vs sold">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={inventoryData} margin={{ left: 8, right: 8 }}>
                  <CartesianGrid vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={12} />
                  <YAxis allowDecimals={false} stroke="var(--muted-foreground)" fontSize={11} />
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="brought" fill="var(--chart-3)" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="sold" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          )}

          {/* Sales by time of day */}
          {stats.byHour.length > 0 && (
            <ChartCard title="Sales by time of day">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={stats.byHour} margin={{ left: 8, right: 8 }}>
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

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-4 rounded-2xl border border-border bg-card p-4">
      <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}

function Kpi({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {icon} {label}
      </div>
      <p className="mt-1 text-xl font-black tabular-nums">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Empty() {
  return <p className="text-sm text-muted-foreground">No data.</p>;
}
