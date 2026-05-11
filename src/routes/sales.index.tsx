import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Settings, Receipt, Lock, Unlock } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { fmt } from "@/lib/money";
import { toast } from "sonner";

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

  const create = async () => {
    if (!name.trim() || !user) return;
    const { data, error } = await supabase
      .from("sales_sessions")
      .insert({ name: name.trim(), location: location.trim() || null, opened_by: user.id })
      .select("id").single();
    if (error) return toast.error(error.message);
    setOpen(false); setName(""); setLocation("");
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
        <DialogContent>
          <DialogHeader><DialogTitle>Open a new session</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Saturday Market" />
            </div>
            <div>
              <Label>Location (optional)</Label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Downtown park" />
            </div>
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