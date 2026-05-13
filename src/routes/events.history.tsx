import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  format, parseISO, startOfDay, startOfMonth, endOfMonth, addMonths,
  startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay,
} from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight, List } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { fmt } from "@/lib/money";
import { tagColor, type InstanceStatus } from "@/lib/events-helpers";
import { InstanceDetailTrigger } from "@/components/events/instance-detail-trigger";

export const Route = createFileRoute("/events/history")({ component: HistoryTab });

type Tag = { id: string; name: string; color: string };
type Series = { id: string; name: string; tag_id: string | null; location: string | null };
type Instance = {
  id: string; series_id: string; date: string; status: InstanceStatus;
};
type RowVM = Instance & { series: Series; tag: Tag | null; revenue: number };

function HistoryTab() {
  const [rows, setRows] = useState<RowVM[]>([]);
  const [loading, setLoading] = useState(true);
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [view, setView] = useState<"list" | "heatmap">("list");

  const load = async () => {
    setLoading(true);
    const today = format(startOfDay(new Date()), "yyyy-MM-dd");
    const [{ data: insts }, { data: sers }, { data: tags }] = await Promise.all([
      supabase.from("event_instances")
        .select("id,series_id,date,status")
        .lt("date", today)
        .is("deleted_at", null)
        .order("date", { ascending: false }),
      supabase.from("event_series")
        .select("id,name,tag_id,location")
        .is("deleted_at", null),
      supabase.from("event_tags").select("id,name,color").is("deleted_at", null),
    ]);
    const sMap = new Map((sers ?? []).map((s) => [s.id, s as Series]));
    const tMap = new Map((tags ?? []).map((t) => [t.id, t as Tag]));

    // Pull revenue for these instances via sales_sessions → sales
    const instIds = (insts ?? []).map((i) => i.id);
    const revByInstance = new Map<string, number>();
    if (instIds.length) {
      const { data: sessions } = await supabase
        .from("sales_sessions").select("id,event_instance_id")
        .in("event_instance_id", instIds).is("deleted_at", null);
      const sessIds = (sessions ?? []).map((s) => s.id);
      const sessToInst = new Map((sessions ?? []).map((s) => [s.id, s.event_instance_id as string]));
      if (sessIds.length) {
        const { data: salesRows } = await supabase
          .from("sales").select("session_id,total,is_sample")
          .in("session_id", sessIds).is("deleted_at", null);
        (salesRows ?? []).forEach((r: any) => {
          if (r.is_sample) return;
          const iid = sessToInst.get(r.session_id);
          if (!iid) return;
          revByInstance.set(iid, (revByInstance.get(iid) ?? 0) + (Number(r.total) || 0));
        });
      }
    }

    const vm: RowVM[] = (insts ?? [])
      .map((i) => {
        const s = sMap.get(i.series_id);
        if (!s) return null;
        return {
          ...(i as Instance),
          series: s,
          tag: s.tag_id ? tMap.get(s.tag_id) ?? null : null,
          revenue: revByInstance.get(i.id) ?? 0,
        } as RowVM;
      })
      .filter((x): x is RowVM => x !== null);

    setRows(vm);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const allTags = useMemo(() => {
    const m = new Map<string, Tag>();
    rows.forEach((r) => { if (r.tag) m.set(r.tag.id, r.tag); });
    return Array.from(m.values());
  }, [rows]);

  const filtered = useMemo(() => rows.filter((r) =>
    tagFilter === "all" || r.tag?.id === tagFilter
  ), [rows, tagFilter]);

  const grouped = useMemo(() => {
    const out: { key: string; label: string; items: RowVM[] }[] = [];
    for (const r of filtered) {
      const d = parseISO(r.date);
      const key = format(d, "yyyy-MM");
      const last = out[out.length - 1];
      if (last && last.key === key) last.items.push(r);
      else out.push({ key, label: format(d, "MMMM yyyy"), items: [r] });
    }
    return out;
  }, [filtered]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Select value={tagFilter} onValueChange={setTagFilter}>
          <SelectTrigger className="h-9 w-auto min-w-[7rem] gap-1 rounded-full border-border text-xs">
            <SelectValue placeholder="Tag" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All tags</SelectItem>
            {allTags.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="ml-auto hidden md:flex rounded-full bg-muted p-0.5">
          <button
            onClick={() => setView("list")}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider transition-colors",
              view === "list" ? "bg-background text-foreground shadow" : "text-muted-foreground",
            )}
          >
            <List className="h-3 w-3" /> List
          </button>
          <button
            onClick={() => setView("heatmap")}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider transition-colors",
              view === "heatmap" ? "bg-background text-foreground shadow" : "text-muted-foreground",
            )}
          >
            <CalendarDays className="h-3 w-3" /> Heatmap
          </button>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border-2 border-border bg-card p-6 text-center text-sm text-muted-foreground">Loading…</div>
      ) : view === "heatmap" ? (
        <RevenueHeatmap rows={filtered} onChanged={load} />
      ) : grouped.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-border bg-muted/30 p-10 text-center">
          <p className="text-sm font-semibold text-muted-foreground">No past events yet.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.map((g) => (
            <section key={g.key}>
              <h3 className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <span>{g.label}</span>
                <span className="tabular-nums">
                  {fmt(g.items.reduce((s, r) => s + r.revenue, 0))}
                </span>
              </h3>
              <div className="space-y-2">
                {g.items.map((r) => <HistoryRow key={r.id} row={r} onChanged={load} />)}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function HistoryRow({ row, onChanged }: { row: RowVM; onChanged: () => void }) {
  const c = tagColor(row.tag?.color);
  const date = parseISO(row.date);
  const dimmed = row.status !== "confirmed";
  return (
    <InstanceDetailTrigger instanceId={row.id} onChanged={onChanged}>
      {(open) => (
        <button
          onClick={open}
          className={cn(
            "flex w-full items-center gap-3 rounded-2xl border-2 border-border bg-card p-3.5 text-left transition-colors hover:bg-muted",
            dimmed && "opacity-50",
          )}
        >
          <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-muted text-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {format(date, "MMM")}
            </span>
            <span className="text-lg font-black leading-none">{format(date, "d")}</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-bold">{row.series.name}</p>
              {row.tag && (
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                  style={{ background: c.bg, color: c.text }}
                >
                  {row.tag.name}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {format(date, "EEE, MMM d, yyyy")} · {row.series.location ?? "—"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-base font-black tabular-nums">{fmt(row.revenue)}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">revenue</p>
          </div>
        </button>
      )}
    </InstanceDetailTrigger>
  );
}

/* ---------- Revenue heatmap (desktop) ---------- */
function RevenueHeatmap({ rows, onChanged }: { rows: RowVM[]; onChanged: () => void }) {
  const [cursor, setCursor] = useState<Date>(() => startOfMonth(new Date()));
  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const byDay = useMemo(() => {
    const m = new Map<string, RowVM[]>();
    rows.forEach((r) => {
      const arr = m.get(r.date) ?? [];
      arr.push(r);
      m.set(r.date, arr);
    });
    return m;
  }, [rows]);

  const maxRev = useMemo(() => {
    let max = 0;
    byDay.forEach((arr) => {
      const sum = arr.reduce((s, r) => s + r.revenue, 0);
      if (sum > max) max = sum;
    });
    return max;
  }, [byDay]);

  const intensity = (rev: number) => {
    if (maxRev === 0 || rev === 0) return 0;
    return Math.min(1, rev / maxRev);
  };

  return (
    <div className="rounded-2xl border-2 border-border bg-card p-3">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-black">{format(cursor, "MMMM yyyy")}</h3>
        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground sm:flex">
            <span>Less</span>
            {[0.15, 0.4, 0.65, 0.9].map((v) => (
              <span
                key={v}
                className="h-3 w-3 rounded-sm"
                style={{ background: `color-mix(in oklab, var(--primary) ${Math.round(v * 100)}%, transparent)` }}
              />
            ))}
            <span>More</span>
          </div>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" className="h-8 w-8 rounded-full p-0" onClick={() => setCursor((d) => addMonths(d, -1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" className="h-8 rounded-full px-3 text-xs" onClick={() => setCursor(startOfMonth(new Date()))}>
              Today
            </Button>
            <Button variant="outline" size="sm" className="h-8 w-8 rounded-full p-0" onClick={() => setCursor((d) => addMonths(d, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => (
          <div key={d} className="px-2 py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const key = format(d, "yyyy-MM-dd");
          const items = byDay.get(key) ?? [];
          const inMonth = isSameMonth(d, cursor);
          const today = isSameDay(d, new Date());
          const sum = items.reduce((s, r) => s + r.revenue, 0);
          const i = intensity(sum);
          const bg = sum > 0
            ? `color-mix(in oklab, var(--primary) ${Math.round(15 + i * 75)}%, transparent)`
            : undefined;
          // Single-instance days: open detail directly. Multi-instance: list.
          const single = items.length === 1 ? items[0] : null;
          const cellInner = (
            <div className="text-left">
              <div className={cn(
                "text-[11px] font-bold",
                today && "text-primary",
              )}>{format(d, "d")}</div>
              {sum > 0 && (
                <p className="mt-1 text-[10px] font-black tabular-nums">{fmt(sum)}</p>
              )}
              {items.length > 1 && (
                <p className="text-[9px] font-semibold text-muted-foreground">{items.length} events</p>
              )}
            </div>
          );
          const cellClass = cn(
            "min-h-[72px] rounded-lg border border-border p-1.5 transition-colors",
            !inMonth && "opacity-40",
            today && "border-primary",
            items.length > 0 && "hover:ring-2 hover:ring-primary/40",
          );
          if (single) {
            return (
              <InstanceDetailTrigger key={key} instanceId={single.id} onChanged={onChanged}>
                {(open) => (
                  <button onClick={open} className={cn(cellClass, "block w-full text-left")} style={{ background: bg }}>
                    {cellInner}
                  </button>
                )}
              </InstanceDetailTrigger>
            );
          }
          return (
            <div key={key} className={cellClass} style={{ background: bg }}>
              {cellInner}
              {items.length > 1 && (
                <div className="mt-1 space-y-0.5">
                  {items.slice(0, 2).map((it) => (
                    <InstanceDetailTrigger key={it.id} instanceId={it.id} onChanged={onChanged}>
                      {(open) => (
                        <button
                          onClick={open}
                          className="block w-full truncate rounded px-1 py-0.5 text-left text-[9px] font-semibold hover:bg-background/60"
                        >
                          {it.series.name}
                        </button>
                      )}
                    </InstanceDetailTrigger>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}