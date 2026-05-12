import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, ListChecks, Lock, Unlock, ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/checklist/")({ component: ChecklistIndex });

type Sess = { id: string; event_name_snapshot: string; event_location_snapshot: string | null; status: "active"|"closed"; opened_at: string; closed_at: string | null };
type Ev = { id: string; name: string; location: string | null };

function ChecklistIndex() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<Sess[]>([]);
  const [counts, setCounts] = useState<Record<string, { packed: number; total: number }>>({});
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<Ev[]>([]);
  const [eventId, setEventId] = useState("");

  const load = async () => {
    const { data } = await supabase.from("checklist_sessions")
      .select("id,event_name_snapshot,event_location_snapshot,status,opened_at,closed_at")
      .is("deleted_at", null).order("opened_at", { ascending: false });
    setSessions((data ?? []) as Sess[]);
    const ids = (data ?? []).map((s) => s.id);
    if (ids.length) {
      const { data: rows } = await supabase.from("checklist_session_items")
        .select("session_id,is_packed").in("session_id", ids);
      const c: Record<string, { packed: number; total: number }> = {};
      (rows ?? []).forEach((r) => {
        if (!c[r.session_id]) c[r.session_id] = { packed: 0, total: 0 };
        c[r.session_id].total += 1;
        if (r.is_packed) c[r.session_id].packed += 1;
      });
      setCounts(c);
    }
  };
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!open) return;
    supabase.from("events").select("id,name,location").is("deleted_at", null).eq("is_archived", false).order("sort_order")
      .then(({ data }) => setEvents((data ?? []) as Ev[]));
  }, [open]);

  const create = async () => {
    if (!user || !eventId) return;
    const ev = events.find((x) => x.id === eventId);
    if (!ev) return;
    // Snapshot all current items
    const { data: items, error: itemsErr } = await supabase.from("checklist_items")
      .select("id,name,category_id,location_tag,size_tag,owner_user_id, checklist_categories(id,name,color), profiles!checklist_items_owner_user_id_fkey(display_name)")
      .is("deleted_at", null).eq("is_archived", false);
    // Fallback simpler query (no FK relation enforced); fetch separately
    let rows = items as unknown as Array<{ id: string; name: string; category_id: string | null; location_tag: string | null; size_tag: "S"|"M"|"L"; owner_user_id: string | null }>;
    if (itemsErr || !rows) {
      const r = await supabase.from("checklist_items").select("id,name,category_id,location_tag,size_tag,owner_user_id").is("deleted_at", null).eq("is_archived", false);
      rows = (r.data ?? []) as typeof rows;
    } else {
      // strip joins; we'll re-fetch lookups below
      rows = rows.map((r) => ({ id: r.id, name: r.name, category_id: r.category_id, location_tag: r.location_tag, size_tag: r.size_tag, owner_user_id: r.owner_user_id }));
    }

    const [{ data: cats }, { data: profs }] = await Promise.all([
      supabase.from("checklist_categories").select("id,name,color").is("deleted_at", null),
      supabase.from("profiles").select("user_id,display_name"),
    ]);
    const catMap = new Map((cats ?? []).map((c) => [c.id, c]));
    const profMap = new Map((profs ?? []).map((p) => [p.user_id, p.display_name]));

    const { data: sess, error } = await supabase.from("checklist_sessions").insert({
      event_id: ev.id, event_name_snapshot: ev.name, event_location_snapshot: ev.location, opened_by: user.id,
    }).select("id").single();
    if (error || !sess) return toast.error(error?.message ?? "Failed");

    if (rows.length) {
      const snap = rows.map((it) => {
        const c = it.category_id ? catMap.get(it.category_id) : null;
        return {
          session_id: sess.id, item_id: it.id, item_name_snapshot: it.name,
          category_id: it.category_id, category_name_snapshot: c?.name ?? null, category_color_snapshot: c?.color ?? null,
          location_snapshot: it.location_tag, size_snapshot: it.size_tag,
          owner_user_id_snapshot: it.owner_user_id,
          owner_name_snapshot: it.owner_user_id ? (profMap.get(it.owner_user_id) ?? null) : null,
        };
      });
      await supabase.from("checklist_session_items").insert(snap);
    }
    setOpen(false); setEventId("");
    navigate({ to: "/checklist/$sessionId", params: { sessionId: sess.id } });
  };

  const active = sessions.filter((s) => s.status === "active");
  const closed = sessions.filter((s) => s.status === "closed");

  return (
    <AppShell>
      <header className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link to="/" className="rounded-full p-2 hover:bg-muted"><ArrowLeft className="h-5 w-5" /></Link>
          <div>
            <h1 className="text-3xl font-black tracking-tight">Event Checklist</h1>
            <p className="text-sm text-muted-foreground">Pack the van. Together.</p>
          </div>
        </div>
      </header>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button className="h-14 w-full rounded-2xl text-base font-bold shadow-lg" style={{ background: "var(--gradient-hero)" }}>
            <Plus className="mr-2 h-5 w-5" /> New event session
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>Open a checklist session</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Event</Label>
              {events.length === 0 ? (
                <p className="mt-1 rounded-xl border-2 border-dashed border-border bg-muted/30 p-3 text-sm text-muted-foreground">
                  No events yet. Add one in <Link to="/settings" className="font-semibold text-primary underline">App Settings → Events</Link>.
                </p>
              ) : (
                <Select value={eventId} onValueChange={setEventId}>
                  <SelectTrigger><SelectValue placeholder="Pick an event" /></SelectTrigger>
                  <SelectContent>
                    {events.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.name}{e.location ? ` · ${e.location}` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <Button onClick={create} disabled={!eventId} className="w-full">Open session</Button>
          </div>
        </DialogContent>
      </Dialog>

      {active.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Active</h2>
          <div className="space-y-2">
            {active.map((s) => <Card key={s.id} s={s} c={counts[s.id]} />)}
          </div>
        </section>
      )}

      <section className="mt-6">
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Archive</h2>
        {closed.length === 0 ? (
          <p className="text-sm text-muted-foreground">No archived sessions yet.</p>
        ) : (
          <div className="space-y-2">{closed.map((s) => <Card key={s.id} s={s} c={counts[s.id]} />)}</div>
        )}
      </section>
    </AppShell>
  );
}

function Card({ s, c }: { s: Sess; c?: { packed: number; total: number } }) {
  const isActive = s.status === "active";
  const pct = c && c.total > 0 ? Math.round((c.packed / c.total) * 100) : 0;
  return (
    <Link to="/checklist/$sessionId" params={{ sessionId: s.id }}
      className="flex items-center gap-3 rounded-2xl border-2 border-border bg-card p-4 transition-colors hover:border-primary">
      <div className={`rounded-xl p-3 ${isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
        {isActive ? <Unlock className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold">{s.event_name_snapshot}</p>
        <p className="text-xs text-muted-foreground">
          {s.event_location_snapshot ?? "—"} · {new Date(s.opened_at).toLocaleDateString()}
        </p>
        {c && c.total > 0 && (
          <div className="mt-1.5 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[11px] font-bold tabular-nums text-muted-foreground">{c.packed}/{c.total}</span>
          </div>
        )}
      </div>
      <ListChecks className="h-5 w-5 text-muted-foreground" />
    </Link>
  );
}
