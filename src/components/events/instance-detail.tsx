import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { Link } from "@tanstack/react-router";
import {
  CalendarDays, MapPin, Users, Receipt, ClipboardList, Package,
  ArrowUpRight, FileText,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { fmt } from "@/lib/money";
import { cn } from "@/lib/utils";
import {
  tagColor, INSTANCE_STATUS_LABEL, type InstanceStatus, staffShortName,
} from "@/lib/events-helpers";
import { toast } from "sonner";

type Instance = {
  id: string; series_id: string; date: string;
  status: InstanceStatus; planned_staff_ids: string[];
};
type Series = {
  id: string; name: string; tag_id: string | null; location: string | null;
};
type Tag = { id: string; name: string; color: string };
type Staff = { id: string; first_name: string | null; last_name: string | null; name: string };

type SalesAgg = {
  sessions: number;
  revenue: number;
  saleCount: number;
  sampleCount: number;
  attendantNames: string[];
  sessionRows: Array<{ id: string; name: string; total: number; status: string }>;
};
type ChecklistAgg = {
  sessions: number; total: number; packed: number;
};
type InventoryAgg = {
  totalLogs: number; useCount: number; restockCount: number;
};
type InvoiceRow = {
  id: string; invoice_number: string; amount: number;
  due_date: string; paid_at: string | null;
};

export function InstanceDetail({
  instanceId, onChanged, onClose,
}: { instanceId: string; onChanged?: () => void; onClose?: () => void }) {
  const [loading, setLoading] = useState(true);
  const [instance, setInstance] = useState<Instance | null>(null);
  const [series, setSeries] = useState<Series | null>(null);
  const [tag, setTag] = useState<Tag | null>(null);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [sales, setSales] = useState<SalesAgg | null>(null);
  const [checklist, setChecklist] = useState<ChecklistAgg | null>(null);
  const [inventory, setInventory] = useState<InventoryAgg | null>(null);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);

  const load = async () => {
    setLoading(true);
    const { data: inst } = await supabase
      .from("event_instances")
      .select("id,series_id,date,status,planned_staff_ids")
      .eq("id", instanceId).maybeSingle();
    if (!inst) { setLoading(false); return; }
    setInstance(inst as Instance);

    const { data: ser } = await supabase
      .from("event_series")
      .select("id,name,tag_id,location")
      .eq("id", inst.series_id).maybeSingle();
    setSeries(ser as Series | null);

    const tagId = (ser as Series | null)?.tag_id ?? null;
    if (tagId) {
      const { data: t } = await supabase.from("event_tags")
        .select("id,name,color").eq("id", tagId).maybeSingle();
      setTag(t as Tag | null);
    } else setTag(null);

    const { data: staffRows } = await supabase.from("attendants")
      .select("id,first_name,last_name,name")
      .is("deleted_at", null);
    setStaff((staffRows ?? []) as Staff[]);

    // Sales sessions linked to this instance
    const { data: sessions } = await supabase
      .from("sales_sessions")
      .select("id,name,attendant_names_snapshot,status")
      .eq("event_instance_id", instanceId)
      .is("deleted_at", null);
    const sessIds = (sessions ?? []).map((s) => s.id);
    let revenue = 0, saleCount = 0, sampleCount = 0;
    const sessTotals = new Map<string, number>();
    if (sessIds.length) {
      const { data: salesRows } = await supabase
        .from("sales").select("session_id,total,is_sample")
        .in("session_id", sessIds).is("deleted_at", null);
      (salesRows ?? []).forEach((r: any) => {
        if (r.is_sample) sampleCount += 1;
        else {
          revenue += Number(r.total) || 0;
          saleCount += 1;
        }
        sessTotals.set(r.session_id, (sessTotals.get(r.session_id) ?? 0) + (r.is_sample ? 0 : Number(r.total) || 0));
      });
    }
    const attSet = new Set<string>();
    (sessions ?? []).forEach((s: any) =>
      (s.attendant_names_snapshot ?? []).forEach((n: string) => n && attSet.add(n)));
    setSales({
      sessions: sessions?.length ?? 0,
      revenue, saleCount, sampleCount,
      attendantNames: Array.from(attSet),
      sessionRows: (sessions ?? []).map((s: any) => ({
        id: s.id, name: s.name, status: s.status,
        total: sessTotals.get(s.id) ?? 0,
      })),
    });

    // Checklist sessions
    const { data: clSessions } = await supabase
      .from("checklist_sessions").select("id")
      .eq("event_instance_id", instanceId).is("deleted_at", null);
    const clIds = (clSessions ?? []).map((s) => s.id);
    let total = 0, packed = 0;
    if (clIds.length) {
      const { data: items } = await supabase.from("checklist_session_items")
        .select("is_packed").in("session_id", clIds);
      (items ?? []).forEach((i: any) => { total += 1; if (i.is_packed) packed += 1; });
    }
    setChecklist({ sessions: clSessions?.length ?? 0, total, packed });

    // Inventory logs
    const { data: invLogs } = await supabase.from("inventory_logs")
      .select("kind").eq("event_instance_id", instanceId);
    let useCount = 0, restockCount = 0;
    (invLogs ?? []).forEach((l: any) => {
      if (l.kind === "use") useCount += 1;
      else if (l.kind === "restock") restockCount += 1;
    });
    setInventory({
      totalLogs: invLogs?.length ?? 0,
      useCount, restockCount,
    });

    // Invoices linked to this instance
    const { data: invRows } = await supabase.from("invoices")
      .select("id, invoice_number, amount, due_date, paid_at")
      .eq("event_instance_id", instanceId)
      .is("deleted_at", null)
      .order("due_date", { ascending: false });
    setInvoices(((invRows ?? []) as unknown) as InvoiceRow[]);

    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [instanceId]);

  const setStatus = async (status: InstanceStatus) => {
    if (!instance) return;
    const { error } = await supabase.from("event_instances")
      .update({ status }).eq("id", instance.id);
    if (error) return toast.error(error.message);
    toast.success(`Marked ${INSTANCE_STATUS_LABEL[status]}`);
    setInstance({ ...instance, status });
    onChanged?.();
  };

  if (loading || !instance || !series) {
    return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  }

  const c = tagColor(tag?.color);
  const date = parseISO(instance.date);
  const planned = staff.filter((s) => instance.planned_staff_ids.includes(s.id));
  const dimmed = instance.status !== "confirmed";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-2xl font-black tracking-tight">{series.name}</h2>
          {tag && (
            <span
              className="rounded-full px-2 py-0.5 text-[11px] font-bold"
              style={{ background: c.bg, color: c.text }}
            >
              {tag.name}
            </span>
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="h-4 w-4" /> {format(date, "EEE, MMM d, yyyy")}
          </span>
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-4 w-4" /> {series.location ?? "—"}
          </span>
        </div>
      </div>

      {/* Status */}
      <div className={cn("rounded-2xl border-2 border-border bg-card p-4", dimmed && "opacity-70")}>
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Status</p>
        <div className="mt-2">
          <Select value={instance.status} onValueChange={(v) => setStatus(v as InstanceStatus)}>
            <SelectTrigger
              className={cn(
                "h-9 w-auto gap-1 rounded-full border-0 px-3 text-xs font-bold uppercase tracking-wider",
                instance.status === "confirmed" && "bg-primary/15 text-primary",
                instance.status === "not_attending" && "bg-muted text-muted-foreground",
                instance.status === "cancelled" && "bg-destructive/15 text-destructive",
              )}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="not_attending">Not attending</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Staff */}
      <div className="rounded-2xl border-2 border-border bg-card p-4">
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          <Users className="h-3.5 w-3.5" /> Staff
        </div>
        <div className="mt-3 space-y-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Planned</p>
            {planned.length === 0 ? (
              <p className="mt-1 text-xs text-muted-foreground">None planned.</p>
            ) : (
              <div className="mt-1 flex flex-wrap gap-1">
                {planned.map((s) => (
                  <span key={s.id} className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-secondary-foreground">
                    {staffShortName(s)}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Actual (from sales sessions)</p>
            {!sales || sales.attendantNames.length === 0 ? (
              <p className="mt-1 text-xs text-muted-foreground">No sales session opened yet.</p>
            ) : (
              <div className="mt-1 flex flex-wrap gap-1">
                {sales.attendantNames.map((n) => (
                  <span key={n} className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                    {n}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sales summary */}
      <div className="rounded-2xl border-2 border-border bg-card p-4">
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          <Receipt className="h-3.5 w-3.5" /> Sales
        </div>
        {!sales || sales.sessions === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">No sales sessions linked yet.</p>
        ) : (
          <>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <Stat label="Revenue" value={fmt(sales.revenue)} />
              <Stat label="Sales" value={String(sales.saleCount)} />
              <Stat label="Samples" value={String(sales.sampleCount)} />
            </div>
            <div className="mt-3 space-y-1.5">
              {sales.sessionRows.map((s) => (
                <Link
                  key={s.id}
                  to="/sales/$sessionId/report" params={{ sessionId: s.id }}
                  onClick={() => onClose?.()}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted"
                >
                  <span className="truncate font-semibold">{s.name}</span>
                  <span className="ml-2 inline-flex items-center gap-2 text-xs">
                    <span className="font-bold tabular-nums">{fmt(s.total)}</span>
                    <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </span>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Checklist */}
      <div className="rounded-2xl border-2 border-border bg-card p-4">
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          <ClipboardList className="h-3.5 w-3.5" /> Checklist
        </div>
        {!checklist || checklist.sessions === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">No checklist session linked yet.</p>
        ) : (
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Stat label="Sessions" value={String(checklist.sessions)} />
            <Stat label="Packed" value={`${checklist.packed} / ${checklist.total}`} />
            <Stat
              label="Complete"
              value={checklist.total === 0 ? "—" : `${Math.round((checklist.packed / checklist.total) * 100)}%`}
            />
          </div>
        )}
      </div>

      {/* Inventory */}
      <div className="rounded-2xl border-2 border-border bg-card p-4">
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          <Package className="h-3.5 w-3.5" /> Inventory activity
        </div>
        {!inventory || inventory.totalLogs === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">No inventory logs linked yet.</p>
        ) : (
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Stat label="Total logs" value={String(inventory.totalLogs)} />
            <Stat label="Used" value={String(inventory.useCount)} />
            <Stat label="Restocked" value={String(inventory.restockCount)} />
          </div>
        )}
      </div>

      {/* Invoices */}
      <div className="rounded-2xl border-2 border-border bg-card p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            <FileText className="h-3.5 w-3.5" /> Invoices
          </div>
          <Link to="/invoices" onClick={() => onClose?.()} className="text-xs font-semibold text-primary hover:underline">
            View all →
          </Link>
        </div>
        {invoices.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">No invoices linked yet.</p>
        ) : (
          <ul className="mt-3 space-y-1.5">
            {invoices.map((i) => {
              const paid = i.paid_at !== null;
              return (
                <li key={i.id} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="font-mono text-xs font-bold">{i.invoice_number}</span>
                    <span className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                      paid ? "bg-emerald-100 text-emerald-700" : "bg-amber-200 text-amber-900",
                    )}>
                      {paid ? "Paid" : "Unpaid"}
                    </span>
                  </span>
                  <span className="ml-2 inline-flex items-center gap-2 text-xs">
                    <span className="font-bold tabular-nums">{fmt(Number(i.amount))}</span>
                    <span className="text-muted-foreground">Due {format(parseISO(i.due_date), "MMM d")}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="flex justify-end pt-2">
        <Button asChild variant="outline" size="sm" className="rounded-full">
          <Link
            to="/events/schedule" search={{ series: series.id }}
            onClick={() => onClose?.()}
          >
            View series schedule
          </Link>
        </Button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-black tabular-nums">{value}</p>
    </div>
  );
}