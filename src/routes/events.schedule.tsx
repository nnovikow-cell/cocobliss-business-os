import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  format, parseISO, startOfDay, startOfMonth, endOfMonth, addMonths,
  startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay,
} from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight, Filter, List, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  tagColor, INSTANCE_STATUS_LABEL, type InstanceStatus, staffShortName,
} from "@/lib/events-helpers";
import { InstanceDetailTrigger } from "@/components/events/instance-detail-trigger";
import { toast } from "sonner";
import { z } from "zod";

const searchSchema = z.object({
  series: z.string().optional(),
}).optional();

export const Route = createFileRoute("/events/schedule")({
  component: ScheduleTab,
  validateSearch: (search) => searchSchema.parse(search) ?? {},
});

type Tag = { id: string; name: string; color: string };
type Series = { id: string; name: string; tag_id: string | null; location: string | null };
type Staff = { id: string; first_name: string | null; last_name: string | null; name: string; active: boolean };
type Instance = {
  id: string; series_id: string; date: string;
  status: InstanceStatus; planned_staff_ids: string[];
};
type RowVM = Instance & { series: Series; tag: Tag | null };

function ScheduleTab() {
  const { series: seriesFilter } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [rows, setRows] = useState<RowVM[]>([]);
  const [series, setSeries] = useState<Series[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | InstanceStatus>("all");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [view, setView] = useState<"list" | "calendar">("list");

  const load = async () => {
    setLoading(true);
    const today = format(startOfDay(new Date()), "yyyy-MM-dd");
    const [{ data: insts }, { data: sers }, { data: tags }, { data: staffRows }] = await Promise.all([
      supabase.from("event_instances")
        .select("id,series_id,date,status,planned_staff_ids")
        .gte("date", today)
        .is("deleted_at", null)
        .order("date"),
      supabase.from("event_series")
        .select("id,name,tag_id,location")
        .eq("status", "active").is("deleted_at", null),
      supabase.from("event_tags").select("id,name,color").is("deleted_at", null),
      supabase.from("attendants")
        .select("id,first_name,last_name,name,active")
        .eq("is_archived", false).is("deleted_at", null).order("sort_order"),
    ]);
    const sMap = new Map((sers ?? []).map((s) => [s.id, s as Series]));
    const tMap = new Map((tags ?? []).map((t) => [t.id, t as Tag]));
    const vmRows: RowVM[] = (insts ?? [])
      .map((i) => {
        const s = sMap.get(i.series_id);
        if (!s) return null; // series terminated/hidden
        return {
          ...(i as Instance),
          series: s,
          tag: s.tag_id ? tMap.get(s.tag_id) ?? null : null,
        } as RowVM;
      })
      .filter((x): x is RowVM => x !== null);
    setRows(vmRows);
    setSeries((sers ?? []) as Series[]);
    setStaff((staffRows ?? []) as Staff[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const r = rows.filter((x) => {
      if (seriesFilter && x.series_id !== seriesFilter) return false;
      if (tagFilter !== "all" && x.tag?.id !== tagFilter) return false;
      if (statusFilter !== "all" && x.status !== statusFilter) return false;
      return true;
    });
    r.sort((a, b) => sortDir === "asc"
      ? a.date.localeCompare(b.date)
      : b.date.localeCompare(a.date));
    return r;
  }, [rows, seriesFilter, tagFilter, statusFilter, sortDir]);

  // Group by month
  const grouped = useMemo(() => {
    const out: { key: string; label: string; items: RowVM[] }[] = [];
    for (const r of filtered) {
      const d = parseISO(r.date);
      const key = format(d, "yyyy-MM");
      const label = format(d, "MMMM yyyy");
      const last = out[out.length - 1];
      if (last && last.key === key) last.items.push(r);
      else out.push({ key, label, items: [r] });
    }
    return out;
  }, [filtered]);

  const allTags = useMemo(() => {
    const map = new Map<string, Tag>();
    rows.forEach((r) => { if (r.tag) map.set(r.tag.id, r.tag); });
    return Array.from(map.values());
  }, [rows]);

  const filteredSeriesName = seriesFilter ? series.find((s) => s.id === seriesFilter)?.name : null;

  return (
    <div>
      {seriesFilter && (
        <div className="mb-3 flex items-center justify-between rounded-2xl border-2 border-primary/30 bg-primary/5 p-3 text-sm">
          <span>
            Showing <span className="font-bold">{filteredSeriesName ?? "series"}</span> only
          </span>
          <Button variant="ghost" size="sm" onClick={() => navigate({ search: {} })}>
            Clear
          </Button>
        </div>
      )}

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
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as "all" | InstanceStatus)}>
          <SelectTrigger className="h-9 w-auto min-w-[7rem] gap-1 rounded-full border-border text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="not_attending">Not attending</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline" size="sm"
          className="h-9 rounded-full text-xs"
          onClick={() => setSortDir((d) => d === "asc" ? "desc" : "asc")}
        >
          <Filter className="mr-1 h-3.5 w-3.5" />
          Date {sortDir === "asc" ? "↑" : "↓"}
        </Button>
        <div className="ml-auto flex rounded-full bg-muted p-0.5">
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
            onClick={() => setView("calendar")}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider transition-colors",
              view === "calendar" ? "bg-background text-foreground shadow" : "text-muted-foreground",
            )}
          >
            <CalendarDays className="h-3 w-3" /> Calendar
          </button>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border-2 border-border bg-card p-6 text-center text-sm text-muted-foreground">Loading…</div>
      ) : view === "calendar" ? (
        <CalendarView rows={filtered} onChanged={load} />
      ) : grouped.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-border bg-muted/30 p-10 text-center">
          <p className="text-sm font-semibold text-muted-foreground">No upcoming events.</p>
          <p className="mt-1 text-xs text-muted-foreground">Create a series in the Series tab to populate the schedule.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.map((g) => (
            <section key={g.key}>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {g.label}
              </h3>
              <div className="space-y-2">
                {g.items.map((r) => (
                  <InstanceRow key={r.id} row={r} staff={staff} onChanged={load} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function InstanceRow({ row, staff, onChanged }: { row: RowVM; staff: Staff[]; onChanged: () => void }) {
  const c = tagColor(row.tag?.color);
  const dimmed = row.status !== "confirmed";
  const date = parseISO(row.date);
  const plannedStaff = staff.filter((s) => row.planned_staff_ids.includes(s.id));

  const setStatus = async (status: InstanceStatus) => {
    const { error } = await supabase.from("event_instances")
      .update({ status }).eq("id", row.id);
    if (error) return toast.error(error.message);
    toast.success(`Marked ${INSTANCE_STATUS_LABEL[status]}`);
    onChanged();
  };

  const toggleStaff = async (sid: string, checked: boolean) => {
    const next = checked
      ? Array.from(new Set([...row.planned_staff_ids, sid]))
      : row.planned_staff_ids.filter((x) => x !== sid);
    const { error } = await supabase.from("event_instances")
      .update({ planned_staff_ids: next }).eq("id", row.id);
    if (error) return toast.error(error.message);
    onChanged();
  };

  const statusPill = (
    <Select value={row.status} onValueChange={(v) => setStatus(v as InstanceStatus)}>
      <SelectTrigger
        className={cn(
          "h-7 w-auto gap-1 rounded-full border-0 px-2.5 text-[11px] font-bold uppercase tracking-wider",
          row.status === "confirmed" && "bg-primary/15 text-primary",
          row.status === "not_attending" && "bg-muted text-muted-foreground",
          row.status === "cancelled" && "bg-destructive/15 text-destructive",
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
  );

  return (
    <div
      className={cn(
        "rounded-2xl border-2 border-border bg-card p-3.5 transition-opacity",
        dimmed && "opacity-50",
      )}
    >
      <div className="flex items-start gap-3">
        <InstanceDetailTrigger instanceId={row.id} onChanged={onChanged}>
          {(open) => (
            <button
              onClick={open}
              className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-muted text-center transition-colors hover:bg-primary/10"
              aria-label="Open event details"
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {format(date, "MMM")}
              </span>
              <span className="text-lg font-black leading-none">{format(date, "d")}</span>
            </button>
          )}
        </InstanceDetailTrigger>
        <div className="min-w-0 flex-1">
          <InstanceDetailTrigger instanceId={row.id} onChanged={onChanged}>
            {(open) => (
              <button
                onClick={open}
                className="flex flex-wrap items-center gap-2 text-left"
              >
                <p className="truncate text-sm font-bold hover:underline">{row.series.name}</p>
            {row.tag && (
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                style={{ background: c.bg, color: c.text }}
              >
                {row.tag.name}
              </span>
            )}
              </button>
            )}
          </InstanceDetailTrigger>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {format(date, "EEE, MMM d")} · {row.series.location ?? "—"}
          </p>
          {plannedStaff.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {plannedStaff.map((s) => (
                <span key={s.id} className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-secondary-foreground">
                  {staffShortName(s)}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {statusPill}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 gap-1 rounded-full px-2 text-[11px] font-semibold">
                <Users className="h-3 w-3" /> Staff
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2" align="end">
              <p className="px-1 pb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Planned staff</p>
              {staff.length === 0 ? (
                <p className="px-2 py-3 text-xs text-muted-foreground">No staff yet.</p>
              ) : staff.map((s) => {
                const checked = row.planned_staff_ids.includes(s.id);
                return (
                  <Label key={s.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
                    <Checkbox checked={checked} onCheckedChange={(v) => toggleStaff(s.id, !!v)} />
                    <span>{staffShortName(s)}</span>
                  </Label>
                );
              })}
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
}

/* ---------- Calendar (desktop) ---------- */
function CalendarView({ rows, onChanged }: { rows: RowVM[]; onChanged: () => void }) {
  const [cursor, setCursor] = useState<Date>(() => startOfMonth(new Date()));
  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const byDay = useMemo(() => {
    const m = new Map<string, RowVM[]>();
    rows.forEach((r) => {
      const k = r.date;
      const arr = m.get(k) ?? [];
      arr.push(r);
      m.set(k, arr);
    });
    return m;
  }, [rows]);

  return (
    <div className="rounded-2xl border-2 border-border bg-card p-3">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-black">{format(cursor, "MMMM yyyy")}</h3>
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
          return (
            <div
              key={key}
              className={cn(
                "min-h-[88px] rounded-lg border border-border p-1.5",
                !inMonth && "bg-muted/30 opacity-50",
                today && "border-primary",
              )}
            >
              <div className={cn(
                "mb-1 text-[11px] font-bold",
                today && "text-primary",
              )}>{format(d, "d")}</div>
              <div className="space-y-1">
                {items.slice(0, 3).map((it) => (
                  <InstanceDetailTrigger key={it.id} instanceId={it.id} onChanged={onChanged}>
                    {(open) => {
                      const c2 = tagColor(it.tag?.color);
                      const dim = it.status !== "confirmed";
                      return (
                        <button
                          onClick={open}
                          className={cn(
                            "block w-full truncate rounded-md px-1.5 py-0.5 text-left text-[10px] font-semibold transition-opacity hover:opacity-100",
                            dim && "opacity-50",
                          )}
                          style={{ background: c2.bg, color: c2.text }}
                          title={it.series.name}
                        >
                          {it.series.name}
                        </button>
                      );
                    }}
                  </InstanceDetailTrigger>
                ))}
                {items.length > 3 && (
                  <p className="px-1.5 text-[10px] font-semibold text-muted-foreground">+{items.length - 3} more</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
