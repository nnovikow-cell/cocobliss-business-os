import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Pencil, Power, ListFilter } from "lucide-react";
import { format, addDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { tagColor, RECURRENCE_LABEL, type Recurrence } from "@/lib/events-helpers";
import { toast } from "sonner";

export const Route = createFileRoute("/events/series")({ component: SeriesTab });

type Tag = { id: string; name: string; color: string };
type Series = {
  id: string; name: string; tag_id: string | null; location: string | null;
  recurrence: Recurrence; start_date: string; end_date: string;
  status: "active" | "terminated";
};
type Row = Series & { instance_count: number; tag: Tag | null };

function SeriesTab() {
  const [rows, setRows] = useState<Row[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [{ data: series }, { data: tagRows }] = await Promise.all([
      supabase.from("event_series")
        .select("id,name,tag_id,location,recurrence,start_date,end_date,status")
        .is("deleted_at", null).eq("status", "active").order("start_date", { ascending: false }),
      supabase.from("event_tags").select("id,name,color").is("deleted_at", null).order("sort_order"),
    ]);
    const tagMap = new Map((tagRows ?? []).map((t) => [t.id, t as Tag]));
    const ids = (series ?? []).map((s) => s.id);
    let counts = new Map<string, number>();
    if (ids.length) {
      const { data: insts } = await supabase.from("event_instances")
        .select("series_id").in("series_id", ids);
      (insts ?? []).forEach((i) => counts.set(i.series_id, (counts.get(i.series_id) ?? 0) + 1));
    }
    setRows((series ?? []).map((s) => ({
      ...(s as Series),
      tag: s.tag_id ? tagMap.get(s.tag_id) ?? null : null,
      instance_count: counts.get(s.id) ?? 0,
    })));
    setTags((tagRows ?? []) as Tag[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Active series
        </p>
        <NewSeriesDialog tags={tags} onCreated={load} />
      </div>

      {loading ? (
        <div className="rounded-2xl border-2 border-border bg-card p-6 text-center text-sm text-muted-foreground">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-border bg-muted/30 p-10 text-center">
          <p className="text-sm font-semibold text-muted-foreground">No active series yet.</p>
          <p className="mt-1 text-xs text-muted-foreground">Create one to auto-generate event instances.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => <SeriesRow key={r.id} row={r} tags={tags} onChanged={load} />)}
        </div>
      )}
    </div>
  );
}

function SeriesRow({ row, tags, onChanged }: { row: Row; tags: Tag[]; onChanged: () => void }) {
  const c = tagColor(row.tag?.color);
  return (
    <div className="rounded-2xl border-2 border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-base font-bold">{row.name}</p>
            {row.tag && (
              <span
                className="rounded-full px-2 py-0.5 text-[11px] font-bold"
                style={{ background: c.bg, color: c.text }}
              >
                {row.tag.name}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {row.location ?? "—"} · {RECURRENCE_LABEL[row.recurrence]}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {format(new Date(row.start_date), "MMM d, yyyy")} → {format(new Date(row.end_date), "MMM d, yyyy")}
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-black tabular-nums">{row.instance_count}</p>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">instances</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          to="/events/schedule"
          search={{ series: row.id }}
          className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs font-semibold hover:bg-muted"
        >
          <ListFilter className="h-3.5 w-3.5" /> View instances
        </Link>
        <EditSeriesDialog row={row} tags={tags} onSaved={onChanged} />
        <TerminateSeriesDialog row={row} onDone={onChanged} />
      </div>
    </div>
  );
}

/* ---------- New series ---------- */
function NewSeriesDialog({ tags, onCreated }: { tags: Tag[]; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [tagId, setTagId] = useState<string>("none");
  const [location, setLocation] = useState("");
  const [recurrence, setRecurrence] = useState<Recurrence>("single");
  const today = format(new Date(), "yyyy-MM-dd");
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(format(addDays(new Date(), 30), "yyyy-MM-dd"));
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (recurrence === "single") setEnd(start); }, [recurrence, start]);

  const submit = async () => {
    if (!name.trim()) return toast.error("Name is required");
    if (new Date(end) < new Date(start)) return toast.error("End date must be on or after start");
    setSaving(true);
    const { error } = await supabase.from("event_series").insert({
      name: name.trim(),
      tag_id: tagId === "none" ? null : tagId,
      location: location.trim() || null,
      recurrence,
      start_date: start,
      end_date: recurrence === "single" ? start : end,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Series created — instances generated");
    setOpen(false);
    setName(""); setTagId("none"); setLocation(""); setRecurrence("single");
    setStart(today); setEnd(format(addDays(new Date(), 30), "yyyy-MM-dd"));
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-full" size="sm">
          <Plus className="mr-1 h-4 w-4" /> New series
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New event series</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Farmers Market — Hillcrest" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tag</Label>
              <Select value={tagId} onValueChange={setTagId}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No tag</SelectItem>
                  {tags.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Recurrence</Label>
              <Select value={recurrence} onValueChange={(v) => setRecurrence(v as Recurrence)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">Single</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="biweekly">Bi-weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Location</Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Liberty Station" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Start date</Label>
              <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div>
              <Label>End date</Label>
              <Input
                type="date" value={end} min={start}
                onChange={(e) => setEnd(e.target.value)}
                disabled={recurrence === "single"}
              />
            </div>
          </div>
          {tags.length === 0 && (
            <p className="rounded-lg bg-muted p-2 text-xs text-muted-foreground">
              Tip: manage tags in <Link to="/settings" className="font-semibold text-primary underline">Hub Settings</Link> (added in Phase 4).
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Saving…" : "Create series"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Edit series ---------- */
function EditSeriesDialog({ row, tags, onSaved }: { row: Row; tags: Tag[]; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(row.name);
  const [tagId, setTagId] = useState<string>(row.tag_id ?? "none");
  const [location, setLocation] = useState(row.location ?? "");
  const [endDate, setEndDate] = useState(row.end_date);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(row.name); setTagId(row.tag_id ?? "none");
      setLocation(row.location ?? ""); setEndDate(row.end_date);
    }
  }, [open, row]);

  const save = async () => {
    if (!name.trim()) return toast.error("Name is required");
    if (new Date(endDate) < new Date(row.start_date)) return toast.error("End date must be on or after start");
    setSaving(true);
    const { error } = await supabase.from("event_series").update({
      name: name.trim(),
      tag_id: tagId === "none" ? null : tagId,
      location: location.trim() || null,
      end_date: row.recurrence === "single" ? row.start_date : endDate,
    }).eq("id", row.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Series updated");
    setOpen(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="rounded-full">
          <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit series</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tag</Label>
              <Select value={tagId} onValueChange={setTagId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No tag</SelectItem>
                  {tags.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>End date</Label>
              <Input
                type="date" value={endDate} min={row.start_date}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={row.recurrence === "single"}
              />
            </div>
          </div>
          <div><Label>Location</Label><Input value={location} onChange={(e) => setLocation(e.target.value)} /></div>
          <p className="rounded-lg bg-muted p-2 text-xs text-muted-foreground">
            Extending the end date adds new instances. Shortening it removes future instances that have no linked sales, checklist, or inventory.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Terminate ---------- */
function TerminateSeriesDialog({ row, onDone }: { row: Row; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const terminate = async () => {
    setBusy(true);
    const { error } = await supabase.from("event_series")
      .update({ status: "terminated" }).eq("id", row.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Series terminated");
    onDone();
  };
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" className="rounded-full text-destructive hover:bg-destructive/10">
          <Power className="mr-1 h-3.5 w-3.5" /> Terminate
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Terminate {row.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            Future instances with no linked sales, checklist, or inventory will be removed.
            Past instances and their data stay visible in History. This series will be hidden from the Series and Schedule tabs.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={terminate}
            disabled={busy}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Terminate
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}