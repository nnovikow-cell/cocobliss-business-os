import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Settings, Receipt, Lock, Unlock, Minus } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [shakesQuarts, setShakesQuarts] = useState(0);
  const [paletas, setPaletas] = useState(0);
  const [weatherId, setWeatherId] = useState<string>("");
  const [attendantIds, setAttendantIds] = useState<string[]>([]);
  const [weatherOpts, setWeatherOpts] = useState<Array<{ id: string; label: string }>>([]);
  const [attendantOpts, setAttendantOpts] = useState<Array<{ id: string; name: string }>>([]);
  const [shakeSize, setShakeSize] = useState(12);

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
    ]).then(([w, a, s]) => {
      setWeatherOpts((w.data ?? []) as Array<{ id: string; label: string }>);
      setAttendantOpts((a.data ?? []) as Array<{ id: string; name: string }>);
      setShakeSize(Number(s.data?.shake_size_oz ?? 12));
    });
  }, [open]);

  const create = async () => {
    if (!name.trim() || !user) return;
    const weather = weatherOpts.find((w) => w.id === weatherId) ?? null;
    const selectedAttendants = attendantOpts.filter((a) => attendantIds.includes(a.id));
    const { data, error } = await supabase
      .from("sales_sessions")
      .insert({
        name: name.trim(),
        location: location.trim() || null,
        opened_by: user.id,
        shakes_quarts_brought: shakesQuarts,
        paletas_brought: paletas,
        shake_size_oz_snapshot: shakeSize,
        weather_option_id: weather?.id ?? null,
        weather_label_snapshot: weather?.label ?? null,
        attendant_ids: attendantIds,
        attendant_names_snapshot: selectedAttendants.map((a) => a.name),
      })
      .select("id").single();
    if (error) return toast.error(error.message);
    setOpen(false); setName(""); setLocation("");
    setShakesQuarts(0); setPaletas(0); setWeatherId(""); setAttendantIds([]);
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

  const openSessions = sessions.filter((s) => s.status === "open");
  const closed = sessions.filter((s) => s.status === "closed");

  return (
    <AppShell>
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Sales Tracker</h1>
          <p className="text-sm text-muted-foreground">Open a session to start logging.</p>
        </div>
        <Link to="/sales/settings" className="rounded-full p-3 hover:bg-muted">
          <Settings className="h-6 w-6" />
        </Link>
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
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Saturday Market" />
            </div>
            <div>
              <Label>Location (optional)</Label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Downtown park" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <ScrollPicker label="Shakes (quarts)" value={shakesQuarts} setValue={setShakesQuarts} step={0.5} max={50} suffix="qt" />
              <ScrollPicker label="Paletas (units)" value={paletas} setValue={setPaletas} step={1} max={500} suffix="" />
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

            <Button onClick={create} className="w-full">Open session</Button>
          </div>
        </DialogContent>
      </Dialog>

      {openSessions.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Open</h2>
          <div className="space-y-2">
            {openSessions.map((s) => <SessionCard key={s.id} s={s} total={totals[s.id] ?? 0} />)}
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
              <SessionCard key={s.id} s={s} total={totals[s.id] ?? 0} onReopen={() => reopen(s.id)} canReopen={isAdmin} />
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}

function SessionCard({ s, total, onReopen, canReopen }: { s: Session; total: number; onReopen?: () => void; canReopen?: boolean }) {
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
    </div>
  );
}

function ScrollPicker({ label, value, setValue, step, max, suffix }: {
  label: string; value: number; setValue: (v: number) => void; step: number; max: number; suffix: string;
}) {
  const dec = () => setValue(Math.max(0, +(value - step).toFixed(2)));
  const inc = () => setValue(Math.min(max, +(value + step).toFixed(2)));
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-1.5 flex items-center gap-1 rounded-xl border-2 border-border bg-card p-1">
        <button type="button" onClick={dec} className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-muted active:scale-95">
          <Minus className="h-4 w-4" />
        </button>
        <div className="flex-1 text-center">
          <span className="text-2xl font-black tabular-nums">{value}</span>
          {suffix && <span className="ml-1 text-xs text-muted-foreground">{suffix}</span>}
        </div>
        <button type="button" onClick={inc} className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-muted active:scale-95">
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}