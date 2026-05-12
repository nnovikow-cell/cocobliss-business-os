import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Settings, Receipt, Lock, Unlock, BarChart3, Trash2, Calendar as CalendarIcon } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WheelPicker } from "@/components/app/wheel-picker";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { fmt } from "@/lib/money";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/sales/")({ component: SalesIndex });

type Session = {
  id: string; name: string; location: string | null; status: "open" | "closed";
  opened_at: string; closed_at: string | null;
};

function SalesIndex() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [totals, setTotals] = useState<Record<string, number>>({});
  const [open, setOpen] = useState(false);
  const [eventId, setEventId] = useState<string>("");
  const [events, setEvents] = useState<Array<{ id: string; name: string; location: string | null }>>([]);
  const todayLocal = () => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  };
  const [sessionDate, setSessionDate] = useState<string>(todayLocal());
  const [shakesQuarts, setShakesQuarts] = useState(0);
  const [paletas, setPaletas] = useState(0);
  const [weatherId, setWeatherId] = useState<string>("");
  const [attendantIds, setAttendantIds] = useState<string[]>([]);
  const [weatherOpts, setWeatherOpts] = useState<Array<{ id: string; label: string }>>([]);
  const [attendantOpts, setAttendantOpts] = useState<Array<{ id: string; name: string }>>([]);
  const [shakeSize, setShakeSize] = useState(12);
  const [deleteTarget, setDeleteTarget] = useState<Session | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [checklistSessions, setChecklistSessions] = useState<Array<{ id: string; event_name_snapshot: string }>>([]);
  const [linkedChecklistId, setLinkedChecklistId] = useState<string>("");

  const load = async () => {
    const { data } = await supabase
      .from("sales_sessions")
      .select("id,name,location,status,opened_at,closed_at")
      .is("deleted_at", null)
      .order("opened_at", { ascending: false });
    setSessions((data ?? []) as Session[]);

    const ids = (data ?? []).map((s) => s.id);
    if (ids.length) {
      const { data: rows } = await supabase
        .from("sales").select("session_id,total")
        .is("deleted_at", null).in("session_id", ids);
      const t: Record<string, number> = {};
      (rows ?? []).forEach((r) => { t[r.session_id] = (t[r.session_id] ?? 0) + Number(r.total); });
      setTotals(t);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!open) return;
    Promise.all([
      supabase.from("weather_options").select("id,label").is("deleted_at", null).eq("is_archived", false).order("sort_order"),
      supabase.from("attendants").select("id,name").is("deleted_at", null).eq("is_archived", false).order("sort_order"),
      supabase.from("app_settings").select("shake_size_oz").limit(1).maybeSingle(),
      supabase.from("events").select("id,name,location").is("deleted_at", null).eq("is_archived", false).order("sort_order"),
      supabase.from("checklist_sessions")
        .select("id,event_name_snapshot")
        .eq("status", "active").is("deleted_at", null)
        .gte("opened_at", new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
        .order("opened_at", { ascending: false }),
    ]).then(([w, a, s, e, c]) => {
      setWeatherOpts((w.data ?? []) as Array<{ id: string; label: string }>);
      setAttendantOpts((a.data ?? []) as Array<{ id: string; name: string }>);
      setShakeSize(Number(s.data?.shake_size_oz ?? 12));
      setEvents((e.data ?? []) as Array<{ id: string; name: string; location: string | null }>);
      setChecklistSessions((c.data ?? []) as Array<{ id: string; event_name_snapshot: string }>);
    });
  }, [open]);

  const create = async () => {
    const ev = events.find((x) => x.id === eventId);
    if (!ev || !user) return;
    const weather = weatherOpts.find((w) => w.id === weatherId) ?? null;
    const selectedAttendants = attendantOpts.filter((a) => attendantIds.includes(a.id));
    // Use the selected calendar date but keep current time-of-day so sales
    // logged today still sit chronologically under the session.
    let openedAt: string | undefined;
    if (sessionDate && sessionDate !== todayLocal()) {
      const now = new Date();
      const [y, m, d] = sessionDate.split("-").map(Number);
      const dt = new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds());
      openedAt = dt.toISOString();
    }
    const { data, error } = await supabase
      .from("sales_sessions")
      .insert({
        name: ev.name,
        location: ev.location,
        opened_by: user.id,
        ...(openedAt ? { opened_at: openedAt } : {}),
        shakes_quarts_brought: shakesQuarts,
        paletas_brought: paletas,
        shake_size_oz_snapshot: shakeSize,
        weather_option_id: weather?.id ?? null,
        weather_label_snapshot: weather?.label ?? null,
        attendant_ids: attendantIds,
        attendant_names_snapshot: selectedAttendants.map((a) => a.name),
        linked_checklist_session_id: linkedChecklistId || null,
      })
      .select("id").single();
    if (error) return toast.error(error.message);
    setOpen(false); setEventId(""); setSessionDate(todayLocal());
    setShakesQuarts(0); setPaletas(0); setWeatherId(""); setAttendantIds([]);
    setLinkedChecklistId("");
    navigate({ to: "/sales/$sessionId", params: { sessionId: data.id } });
  };

  const reopen = async (id: string) => {
    if (!isAdmin) return toast.error("Only admins can reopen a session");
    if (!confirm("Reopen this session?")) return;
    const { error } = await supabase.from("sales_sessions").update({ status: "open" }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Reopened");
    load();
  };

  const confirmDelete = async () => {
    if (!deleteTarget || !isAdmin) return;
    if (deleteConfirm !== "DELETE") return;
    const { error } = await supabase.from("sales_sessions")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", deleteTarget.id);
    if (error) return toast.error(error.message);
    toast.success("Session deleted");
    setDeleteTarget(null); setDeleteConfirm("");
    load();
  };

  const openSessions = sessions.filter((s) => s.status === "open");
  const closed = sessions.filter((s) => s.status === "closed");

  return (
    <AppShell>
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Sales Tracker</h1>
          <p className="text-sm text-muted-foreground">Open a session to start logging.</p>
        </div>
        <div className="flex items-center gap-1">
          <Link to="/sales/stats" className="rounded-full p-3 hover:bg-muted" aria-label="Stats">
            <BarChart3 className="h-6 w-6" />
          </Link>
          <Link to="/sales/settings" className="rounded-full p-3 hover:bg-muted" aria-label="Settings">
            <Settings className="h-6 w-6" />
          </Link>
        </div>
      </header>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button className="h-14 w-full rounded-2xl text-base font-bold shadow-lg" style={{ background: "var(--gradient-hero)" }}>
            <Plus className="mr-2 h-5 w-5" /> New session
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Open a new session</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Event</Label>
              {events.length === 0 ? (
                <p className="mt-1 rounded-xl border-2 border-dashed border-border bg-muted/30 p-3 text-sm text-muted-foreground">
                  No events yet. Add one in <Link to="/sales/settings" className="font-semibold text-primary underline">Settings → Events</Link>.
                </p>
              ) : (
                <Select value={eventId} onValueChange={setEventId}>
                  <SelectTrigger><SelectValue placeholder="Pick an event" /></SelectTrigger>
                  <SelectContent>
                    {events.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.name}{e.location ? ` · ${e.location}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div>
              <Label className="flex items-center gap-1.5"><CalendarIcon className="h-3.5 w-3.5" /> Session date</Label>
              <Input type="date" value={sessionDate} max={todayLocal()} onChange={(e) => setSessionDate(e.target.value)} />
              <p className="mt-1 text-[11px] text-muted-foreground">Defaults to today. Change to backdate a past event.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <WheelPicker label="Shakes (quarts)" value={shakesQuarts} onChange={setShakesQuarts} step={0.5} max={50} suffix="qt" />
              <WheelPicker label="Paletas (units)" value={paletas} onChange={setPaletas} step={1} max={500} />
            </div>

            {weatherOpts.length > 0 && (
              <div>
                <Label>Weather</Label>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {weatherOpts.map((w) => {
                    const sel = w.id === weatherId;
                    return (
                      <button key={w.id} onClick={() => setWeatherId(sel ? "" : w.id)}
                        className={cn("rounded-full border-2 px-4 py-2 text-sm font-bold transition-all",
                          sel ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card")}>
                        {w.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {attendantOpts.length > 0 && (
              <div>
                <Label>Attendants</Label>
                <div className="mt-1.5 space-y-1.5">
                  {attendantOpts.map((a) => {
                    const on = attendantIds.includes(a.id);
                    return (
                      <button key={a.id}
                        onClick={() => setAttendantIds((prev) => on ? prev.filter((x) => x !== a.id) : [...prev, a.id])}
                        className={cn("flex w-full items-center justify-between rounded-xl border-2 px-3 py-2 text-left text-sm font-semibold",
                          on ? "border-primary bg-primary/10" : "border-border bg-card")}>
                        <span>{a.name}</span>
                        <span className={cn("flex h-5 w-5 items-center justify-center rounded border-2",
                          on ? "border-primary bg-primary text-primary-foreground" : "border-border")}>
                          {on && "✓"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <Button onClick={create} disabled={!eventId} className="w-full">Open session</Button>
          </div>
        </DialogContent>
      </Dialog>

      {openSessions.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Open</h2>
          <div className="space-y-2">
            {openSessions.map((s) => (
              <SessionCard key={s.id} s={s} total={totals[s.id] ?? 0}
                onDelete={isAdmin ? () => setDeleteTarget(s) : undefined} />
            ))}
          </div>
        </section>
      )}

      <section className="mt-6">
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">History</h2>
        {closed.length === 0 ? (
          <p className="text-sm text-muted-foreground">No closed sessions yet.</p>
        ) : (
          <div className="space-y-2">
            {closed.map((s) => (
              <SessionCard key={s.id} s={s} total={totals[s.id] ?? 0}
                onReopen={() => reopen(s.id)} canReopen={isAdmin}
                onDelete={isAdmin ? () => setDeleteTarget(s) : undefined} />
            ))}
          </div>
        )}
      </section>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) { setDeleteTarget(null); setDeleteConfirm(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this session?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-semibold text-foreground">{deleteTarget?.name}</span> and all of its sales will be removed from reports.
              This cannot be undone from the app. Type <span className="font-mono font-bold">DELETE</span> to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input autoFocus value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} placeholder="DELETE" />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmDelete(); }}
              disabled={deleteConfirm !== "DELETE"}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

function SessionCard({ s, total, onReopen, canReopen, onDelete }: { s: Session; total: number; onReopen?: () => void; canReopen?: boolean; onDelete?: () => void }) {
  const isOpen = s.status === "open";
  return (
    <div className="flex items-center gap-3 rounded-2xl border-2 border-border bg-card p-4 transition-colors hover:border-primary">
      <div className={`rounded-xl p-3 ${isOpen ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
        {isOpen ? <Unlock className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
      </div>
      <div className="flex-1">
        <Link to="/sales/$sessionId" params={{ sessionId: s.id }} className="block">
          <p className="font-bold">{s.name}</p>
          <p className="text-xs text-muted-foreground">
            {s.location ?? "—"} · {new Date(s.opened_at).toLocaleDateString()}
          </p>
        </Link>
      </div>
      <div className="text-right">
        <p className="text-lg font-black">{fmt(total)}</p>
        {!isOpen && canReopen && (
          <button onClick={onReopen} className="text-xs font-semibold text-primary hover:underline">Reopen</button>
        )}
      </div>
      {!isOpen && (
        <Link to="/sales/$sessionId/report" params={{ sessionId: s.id }} className="rounded-full bg-secondary p-2 text-secondary-foreground">
          <Receipt className="h-4 w-4" />
        </Link>
      )}
      {onDelete && (
        <button onClick={onDelete} aria-label="Delete session"
          className="rounded-full p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
