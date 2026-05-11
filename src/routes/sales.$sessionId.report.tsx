import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { fmt } from "@/lib/money";

export const Route = createFileRoute("/sales/$sessionId/report")({ component: ReportPage });

type Session = { id: string; name: string; location: string | null; opened_at: string; closed_at: string | null; status: string };

function ReportPage() {
  const { sessionId } = Route.useParams();
  const [session, setSession] = useState<Session | null>(null);
  const [stats, setStats] = useState<{
    total: number; subtotal: number; tax: number; count: number;
    byPayment: Array<{ name: string; total: number; count: number }>;
    byProduct: Array<{ name: string; qty: number; total: number }>;
    byDemo: Array<{ category: string; label: string; count: number }>;
  } | null>(null);

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.from("sales_sessions").select("id,name,location,opened_at,closed_at,status").eq("id", sessionId).maybeSingle();
      setSession(s as Session | null);

      const { data: sales } = await supabase
        .from("sales").select("id,subtotal,tax_amount,total,payment_method_name_snapshot")
        .eq("session_id", sessionId).is("deleted_at", null);
      const saleIds = (sales ?? []).map((r) => r.id);

      let items: Array<{ product_name_snapshot: string; quantity: number; line_total: number }> = [];
      let demos: Array<{ demographic_option_id: string; demographic_options: { category: string; label: string } | null }> = [];
      if (saleIds.length) {
        const [{ data: it }, { data: dm }] = await Promise.all([
          supabase.from("sale_items").select("product_name_snapshot,quantity,line_total").in("sale_id", saleIds).is("deleted_at", null),
          supabase.from("sale_demographics").select("demographic_option_id, demographic_options(category,label)").in("sale_id", saleIds),
        ]);
        items = (it ?? []).map((r) => ({ ...r, line_total: Number(r.line_total) }));
        demos = (dm ?? []) as typeof demos;
      }

      const total = (sales ?? []).reduce((s, r) => s + Number(r.total), 0);
      const subtotal = (sales ?? []).reduce((s, r) => s + Number(r.subtotal), 0);
      const tax = (sales ?? []).reduce((s, r) => s + Number(r.tax_amount), 0);

      const byPaymentMap = new Map<string, { total: number; count: number }>();
      (sales ?? []).forEach((r) => {
        const cur = byPaymentMap.get(r.payment_method_name_snapshot) ?? { total: 0, count: 0 };
        cur.total += Number(r.total); cur.count += 1;
        byPaymentMap.set(r.payment_method_name_snapshot, cur);
      });
      const byPayment = [...byPaymentMap.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.total - a.total);

      const byProductMap = new Map<string, { qty: number; total: number }>();
      items.forEach((i) => {
        const cur = byProductMap.get(i.product_name_snapshot) ?? { qty: 0, total: 0 };
        cur.qty += i.quantity; cur.total += i.line_total;
        byProductMap.set(i.product_name_snapshot, cur);
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

      setStats({ total, subtotal, tax, count: (sales ?? []).length, byPayment, byProduct, byDemo });
    })();
  }, [sessionId]);

  return (
    <AppShell>
      <header className="mb-4 flex items-center gap-3">
        <Link to="/sales" className="rounded-full p-2 hover:bg-muted" aria-label="Back to Sales Tracker">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-black">{session?.name ?? "Report"}</h1>
          <p className="text-xs text-muted-foreground">
            {session?.opened_at && new Date(session.opened_at).toLocaleDateString()}
            {session?.closed_at && ` → ${new Date(session.closed_at).toLocaleDateString()}`}
          </p>
        </div>
      </header>

      {!stats ? <p className="text-sm text-muted-foreground">Loading...</p> : (
        <>
          <div className="rounded-3xl p-6 text-white shadow-xl" style={{ background: "var(--gradient-hero)" }}>
            <p className="text-xs font-semibold uppercase tracking-wider opacity-90">Total revenue</p>
            <p className="mt-1 text-5xl font-black tabular-nums">{fmt(stats.total)}</p>
            <p className="mt-2 text-xs opacity-90">
              Subtotal {fmt(stats.subtotal)} · Tax {fmt(stats.tax)} · {stats.count} sale{stats.count === 1 ? "" : "s"}
            </p>
          </div>

          <Section title="By payment method">
            {stats.byPayment.length === 0 ? <Empty /> : stats.byPayment.map((r) => (
              <Row key={r.name} left={r.name} right={fmt(r.total)} sub={`${r.count} sale${r.count === 1 ? "" : "s"}`} />
            ))}
          </Section>

          <Section title="By product">
            {stats.byProduct.length === 0 ? <Empty /> : stats.byProduct.map((r) => (
              <Row key={r.name} left={r.name} right={fmt(r.total)} sub={`${r.qty} sold`} />
            ))}
          </Section>

          {stats.byDemo.length > 0 && (
            <Section title="By demographic">
              {stats.byDemo.map((r) => (
                <Row key={`${r.category}::${r.label}`}
                  left={<><span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase mr-2">{r.category}</span>{r.label}</>}
                  right={`${r.count}`} />
              ))}
            </Section>
          )}
        </>
      )}
    </AppShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Row({ left, right, sub }: { left: React.ReactNode; right: React.ReactNode; sub?: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-3">
      <div className="flex flex-col">
        <span className="font-semibold">{left}</span>
        {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
      </div>
      <span className="font-bold tabular-nums">{right}</span>
    </div>
  );
}

function Empty() {
  return <p className="text-sm text-muted-foreground">No data.</p>;
}