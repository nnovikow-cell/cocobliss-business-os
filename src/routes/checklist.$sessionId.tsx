import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Search, ArrowUpDown, MapPin, Lock, Check, Download, ListChecks } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import jsPDF from "jspdf";
import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { colorById } from "@/lib/checklist-colors";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/checklist/$sessionId")({ component: ChecklistSession });

type Sess = {
  id: string; event_name_snapshot: string; event_location_snapshot: string | null;
  status: "active"|"closed"; opened_at: string; closed_at: string | null;
};
type SItem = {
  id: string; item_name_snapshot: string;
  category_id: string | null; category_name_snapshot: string | null; category_color_snapshot: string | null;
  location_snapshot: string | null; size_snapshot: "S"|"M"|"L";
  owner_user_id_snapshot: string | null; owner_name_snapshot: string | null;
  is_packed: boolean; packed_at: string | null;
};

type SortMode = "category" | "alpha" | "size" | "owner";

function ChecklistSession() {
  const { sessionId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [session, setSession] = useState<Sess | null>(null);
  const [items, setItems] = useState<SItem[]>([]);
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("category");
  const [filter, setFilter] = useState<string>("all"); // "all"|"mine"|`user:<id>`|`cat:<id>`
  const [closeOpen, setCloseOpen] = useState(false);

  const load = async () => {
    const { data: s } = await supabase.from("checklist_sessions")
      .select("id,event_name_snapshot,event_location_snapshot,status,opened_at,closed_at")
      .eq("id", sessionId).maybeSingle();
    setSession(s as Sess | null);
    const { data: it } = await supabase.from("checklist_session_items")
      .select("id,item_name_snapshot,category_id,category_name_snapshot,category_color_snapshot,location_snapshot,size_snapshot,owner_user_id_snapshot,owner_name_snapshot,is_packed,packed_at")
      .eq("session_id", sessionId)
      .order("item_name_snapshot");
    setItems((it ?? []) as SItem[]);
  };

  useEffect(() => { load(); }, [sessionId]);

  useEffect(() => {
    const ch = supabase.channel(`checklist-${sessionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "checklist_session_items", filter: `session_id=eq.${sessionId}` }, () => load())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "checklist_sessions", filter: `id=eq.${sessionId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [sessionId]);

  const isClosed = session?.status === "closed";

  // Owners present in this session
  const owners = useMemo(() => {
    const m = new Map<string, string>();
    items.forEach((i) => {
      if (i.owner_user_id_snapshot) m.set(i.owner_user_id_snapshot, i.owner_name_snapshot ?? "Unnamed");
    });
    return [...m.entries()].map(([id, name]) => ({ id, name }));
  }, [items]);

  const categories = useMemo(() => {
    const m = new Map<string, { name: string; color: string }>();
    items.forEach((i) => {
      const id = i.category_id ?? "_uncat";
      if (!m.has(id)) m.set(id, { name: i.category_name_snapshot ?? "Uncategorized", color: i.category_color_snapshot ?? "graphite" });
    });
    return [...m.entries()].map(([id, v]) => ({ id, ...v }));
  }, [items]);

  // Per-owner remaining counts
  const teamStatus = useMemo(() => {
    const counts: Record<string, { name: string; left: number }> = {};
    items.forEach((i) => {
      const oid = i.owner_user_id_snapshot ?? "_unassigned";
      const name = i.owner_user_id_snapshot ? (i.owner_name_snapshot ?? "Unnamed") : "Unassigned";
      if (!counts[oid]) counts[oid] = { name, left: 0 };
      if (!i.is_packed) counts[oid].left += 1;
    });
    return counts;
  }, [items]);

  // Filter pipeline
  const filtered = useMemo(() => {
    let out = items;
    const q = search.trim().toLowerCase();
    if (q) out = out.filter((i) =>
      i.item_name_snapshot.toLowerCase().includes(q)
      || (i.location_snapshot ?? "").toLowerCase().includes(q)
      || (i.category_name_snapshot ?? "").toLowerCase().includes(q)
      || (i.owner_name_snapshot ?? "").toLowerCase().includes(q)
    );
    if (filter === "mine" && user) out = out.filter((i) => i.owner_user_id_snapshot === user.id);
    else if (filter.startsWith("user:")) {
      const id = filter.slice(5);
      out = out.filter((i) => i.owner_user_id_snapshot === id);
    } else if (filter.startsWith("cat:")) {
      const id = filter.slice(4);
      out = out.filter((i) => (i.category_id ?? "_uncat") === id);
    }
    return out;
  }, [items, search, filter, user]);

  const sortFn = (a: SItem, b: SItem) => {
    if (sortMode === "alpha") return a.item_name_snapshot.localeCompare(b.item_name_snapshot);
    if (sortMode === "size") {
      const order = { S: 0, M: 1, L: 2 } as const;
      return order[a.size_snapshot] - order[b.size_snapshot] || a.item_name_snapshot.localeCompare(b.item_name_snapshot);
    }
    if (sortMode === "owner") return (a.owner_name_snapshot ?? "").localeCompare(b.owner_name_snapshot ?? "");
    // category
    return (a.category_name_snapshot ?? "z").localeCompare(b.category_name_snapshot ?? "z") || a.item_name_snapshot.localeCompare(b.item_name_snapshot);
  };

  const toPack = useMemo(() => filtered.filter((i) => !i.is_packed).sort(sortFn), [filtered, sortMode]);
  const packed = useMemo(() => filtered.filter((i) => i.is_packed).sort(sortFn), [filtered, sortMode]);

  // Group packed by category
  const packedByCat = useMemo(() => {
    const m = new Map<string, { name: string; color: string; items: SItem[]; total: number }>();
    // Pre-fill totals from full items list (so progress reflects all, not filtered)
    items.forEach((i) => {
      const id = i.category_id ?? "_uncat";
      if (!m.has(id)) m.set(id, { name: i.category_name_snapshot ?? "Uncategorized", color: i.category_color_snapshot ?? "graphite", items: [], total: 0 });
      m.get(id)!.total += 1;
    });
    packed.forEach((i) => {
      const id = i.category_id ?? "_uncat";
      m.get(id)?.items.push(i);
    });
    return [...m.entries()].filter(([_, v]) => v.items.length > 0);
  }, [packed, items]);

  const togglePacked = async (item: SItem, packedNow: boolean) => {
    if (isClosed) return;
    if (item.owner_user_id_snapshot && user && item.owner_user_id_snapshot !== user.id) return;
    // optimistic
    setItems((prev) => prev.map((p) => p.id === item.id ? { ...p, is_packed: packedNow, packed_at: packedNow ? new Date().toISOString() : null } : p));
    const { error } = await supabase.from("checklist_session_items").update({
      is_packed: packedNow,
      packed_at: packedNow ? new Date().toISOString() : null,
      packed_by: packedNow ? user?.id ?? null : null,
    }).eq("id", item.id);
    if (error) { toast.error(error.message); load(); }
  };

  const closeSession = async () => {
    if (!user) return;
    const { error } = await supabase.from("checklist_sessions")
      .update({ status: "closed", closed_at: new Date().toISOString(), closed_by: user.id })
      .eq("id", sessionId);
    if (error) return toast.error(error.message);
    toast.success("Session closed");
    setCloseOpen(false);
    load();
  };

  const exportPDF = () => {
    if (!session) return;
    const doc = new jsPDF({ unit: "pt" });
    const margin = 40;
    let y = margin;
    doc.setFont("helvetica", "bold"); doc.setFontSize(20);
    doc.text("Event Checklist", margin, y); y += 24;
    doc.setFontSize(14);
    doc.text(session.event_name_snapshot, margin, y); y += 18;
    doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    if (session.event_location_snapshot) { doc.text(session.event_location_snapshot, margin, y); y += 14; }
    doc.text(`Opened: ${new Date(session.opened_at).toLocaleString()}`, margin, y); y += 12;
    if (session.closed_at) { doc.text(`Closed: ${new Date(session.closed_at).toLocaleString()}`, margin, y); y += 12; }
    const total = items.length, pkd = items.filter((i) => i.is_packed).length;
    y += 6;
    doc.setFont("helvetica", "bold"); doc.text(`Packed: ${pkd} / ${total}`, margin, y); y += 18;

    const grouped = new Map<string, SItem[]>();
    items.forEach((i) => {
      const k = i.category_name_snapshot ?? "Uncategorized";
      if (!grouped.has(k)) grouped.set(k, []);
      grouped.get(k)!.push(i);
    });

    const pageH = doc.internal.pageSize.getHeight();
    [...grouped.entries()].sort().forEach(([cat, list]) => {
      if (y > pageH - 80) { doc.addPage(); y = margin; }
      doc.setFont("helvetica", "bold"); doc.setFontSize(12);
      const catPkd = list.filter((i) => i.is_packed).length;
      doc.text(`${cat}  (${catPkd}/${list.length})`, margin, y); y += 14;
      doc.setFont("helvetica", "normal"); doc.setFontSize(10);
      list.sort((a, b) => a.item_name_snapshot.localeCompare(b.item_name_snapshot)).forEach((i) => {
        if (y > pageH - 40) { doc.addPage(); y = margin; }
        const mark = i.is_packed ? "[x]" : "[ ]";
        const owner = i.owner_name_snapshot ?? "Unassigned";
        const loc = i.location_snapshot ? ` · ${i.location_snapshot}` : "";
        doc.text(`${mark} ${i.item_name_snapshot}  (${i.size_snapshot}) — ${owner}${loc}`, margin + 12, y);
        y += 13;
      });
      y += 6;
    });

    const safe = session.event_name_snapshot.replace(/[^a-z0-9]+/gi, "_");
    doc.save(`checklist_${safe}.pdf`);
  };

  if (!session) return <AppShell><p className="text-sm text-muted-foreground">Loading…</p></AppShell>;

  const total = items.length;
  const pkd = items.filter((i) => i.is_packed).length;
  const overallPct = total > 0 ? (pkd / total) * 100 : 0;
  const catsDone = packedByCat.filter(([_, v]) => v.items.length === v.total).length;

  return (
    <AppShell>
      <div className="pb-32">
        <header className="mb-3 flex items-center gap-2">
          <Link to="/checklist" className="rounded-full p-2 hover:bg-muted"><ArrowLeft className="h-5 w-5" /></Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-black">{session.event_name_snapshot}</h1>
            <p className="truncate text-xs text-muted-foreground">
              {session.event_location_snapshot ?? "—"} · {new Date(session.opened_at).toLocaleDateString()}
              {isClosed && " · Archived"}
            </p>
          </div>
          {isClosed && (
            <button onClick={exportPDF} className="inline-flex items-center gap-1 rounded-full border-2 border-border bg-card px-3 py-2 text-xs font-bold hover:border-primary">
              <Download className="h-3.5 w-3.5" /> PDF
            </button>
          )}
        </header>

        {/* Team status */}
        <div className="mb-3 flex flex-wrap gap-1.5">
          {Object.entries(teamStatus).map(([id, t]) => {
            const me = user && id === user.id;
            return (
              <span key={id} className={cn("rounded-full border-2 px-2.5 py-1 text-xs font-bold",
                me ? "border-primary bg-primary/10 text-primary" : "border-border bg-card")}>
                {me ? "You" : t.name} — {t.left} left
              </span>
            );
          })}
        </div>

        {/* Search + Sort */}
        <div className="mb-2 flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search items, locations…" className="pl-9" />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="shrink-0"><ArrowUpDown className="mr-1 h-4 w-4" /> Sort</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setSortMode("category")}>By category</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortMode("alpha")}>A–Z</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortMode("size")}>By size</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortMode("owner")}>By owner</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Filter chips */}
        <div className="-mx-4 mb-3 overflow-x-auto px-4 no-scrollbar">
          <div className="flex gap-1.5">
            <Chip on={filter === "all"} onClick={() => setFilter("all")}>All</Chip>
            <Chip on={filter === "mine"} onClick={() => setFilter("mine")}>Mine</Chip>
            {owners.map((o) => (
              <Chip key={o.id} on={filter === `user:${o.id}`} onClick={() => setFilter(`user:${o.id}`)}>{o.name}</Chip>
            ))}
            {categories.map((c) => (
              <Chip key={c.id} on={filter === `cat:${c.id}`} onClick={() => setFilter(`cat:${c.id}`)} dot={colorById(c.color).ring}>{c.name}</Chip>
            ))}
          </div>
        </div>

        {items.length === 0 ? (
          <p className="rounded-2xl border-2 border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            This session has no items. Add items in <Link to="/settings" className="font-semibold text-primary underline">App Settings → Items</Link>, then start a new session.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {/* To Pack */}
            <section>
              <h2 className="mb-2 flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                To Pack <span className="rounded-full bg-muted px-1.5 py-0.5 text-foreground">{toPack.length}</span>
              </h2>
              <div className="space-y-1.5">
                <AnimatePresence initial={false}>
                  {toPack.map((it) => (
                    <ItemCard key={it.id} item={it} mine={user?.id === it.owner_user_id_snapshot} disabled={isClosed} onTap={() => togglePacked(it, true)} />
                  ))}
                </AnimatePresence>
                {toPack.length === 0 && <p className="rounded-xl border border-dashed border-border p-3 text-center text-[11px] text-muted-foreground">All packed!</p>}
              </div>
            </section>

            {/* Packed */}
            <section>
              <h2 className="mb-2 flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                Packed <span className="rounded-full bg-muted px-1.5 py-0.5 text-foreground">{packed.length}</span>
              </h2>
              <div className="space-y-2">
                <AnimatePresence initial={false}>
                  {packedByCat.map(([id, group]) => {
                    const sw = colorById(group.color);
                    const done = group.items.length === group.total;
                    return (
                      <motion.div key={id} layout className="rounded-xl border border-border bg-muted/30 p-1.5">
                        <div className="mb-1 flex items-center gap-1.5 px-1">
                          <span className="h-2 w-2 rounded-full" style={{ background: sw.ring }} />
                          <span className="flex-1 truncate text-[11px] font-black">{group.name}</span>
                          {done ? (
                            <span className="rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-black uppercase text-primary-foreground">✓ Done</span>
                          ) : (
                            <span className="text-[10px] font-bold text-muted-foreground">{group.items.length}/{group.total}</span>
                          )}
                        </div>
                        <div className="space-y-1">
                          {group.items.map((it) => (
                            <PackedRow key={it.id} item={it} mine={user?.id === it.owner_user_id_snapshot} disabled={isClosed} onTap={() => togglePacked(it, false)} />
                          ))}
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
                {packedByCat.length === 0 && <p className="rounded-xl border border-dashed border-border p-3 text-center text-[11px] text-muted-foreground">Nothing packed yet.</p>}
              </div>
            </section>
          </div>
        )}

        {/* Bottom progress bar */}
        <div className="fixed inset-x-0 bottom-16 z-30 mx-auto max-w-md px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          <div className="rounded-2xl bg-background/85 p-3 ring-1 ring-border backdrop-blur-md">
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="font-bold">{pkd} of {total} packed{catsDone > 0 && ` · ${catsDone} ${catsDone === 1 ? "category" : "categories"} done`}</span>
              {!isClosed ? (
                <Button size="sm" variant="outline" onClick={() => setCloseOpen(true)} className="h-7 text-xs">Close session</Button>
              ) : (
                <Button size="sm" variant="outline" onClick={exportPDF} className="h-7 text-xs"><Download className="mr-1 h-3 w-3" /> Export</Button>
              )}
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary transition-all" style={{ width: `${overallPct}%` }} />
            </div>
          </div>
        </div>

        <Dialog open={closeOpen} onOpenChange={setCloseOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Close session?</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">
              {pkd} of {total} packed. The session will be archived with the current state and ownership snapshot.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCloseOpen(false)}>Cancel</Button>
              <Button onClick={closeSession}>Close & archive</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}

function Chip({ on, onClick, dot, children }: { on: boolean; onClick: () => void; dot?: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={cn("inline-flex shrink-0 items-center gap-1 rounded-full border-2 px-3 py-1.5 text-xs font-bold transition-colors",
        on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary")}>
      {dot && <span className="h-2 w-2 rounded-full" style={{ background: dot }} />}
      {children}
    </button>
  );
}

function ownerInitial(name: string | null) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? "?").toUpperCase();
}

function ItemCard({ item, mine, disabled, onTap }: { item: SItem; mine: boolean; disabled?: boolean; onTap: () => void }) {
  const sw = colorById(item.category_color_snapshot);
  const interactive = !disabled && (mine || !item.owner_user_id_snapshot);
  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      onClick={interactive ? onTap : undefined}
      disabled={!interactive}
      className={cn(
        "group relative w-full rounded-xl border-2 p-2 text-left transition-all",
        interactive ? "border-border bg-card active:scale-[0.97]" : "border-border bg-muted/40 opacity-60",
      )}
      style={{ borderLeftColor: sw.ring, borderLeftWidth: 4 }}
    >
      <div className="flex items-start gap-1.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-bold leading-tight">{item.item_name_snapshot}</p>
          {item.location_snapshot && (
            <p className="mt-0.5 flex items-center gap-0.5 truncate text-[10px] text-muted-foreground">
              <MapPin className="h-2.5 w-2.5 shrink-0" /> {item.location_snapshot}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className={cn("flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-black",
            mine ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
            {ownerInitial(item.owner_name_snapshot)}
          </span>
        </div>
      </div>
      <div className="mt-1 flex items-center gap-1">
        <span className="rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase" style={{ background: sw.bg, color: sw.text }}>
          {item.category_name_snapshot ?? "—"}
        </span>
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-black">{item.size_snapshot}</span>
        {!interactive && !disabled && <Lock className="ml-auto h-3 w-3 text-muted-foreground" />}
      </div>
    </motion.button>
  );
}

function PackedRow({ item, mine, disabled, onTap }: { item: SItem; mine: boolean; disabled?: boolean; onTap: () => void }) {
  const interactive = !disabled && (mine || !item.owner_user_id_snapshot);
  return (
    <motion.button
      layout
      initial={{ opacity: 0, x: 6 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      onClick={interactive ? onTap : undefined}
      disabled={!interactive}
      className={cn("flex w-full items-center gap-1.5 rounded-lg bg-card p-1.5 text-left transition-colors",
        interactive ? "hover:bg-muted" : "opacity-60")}
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <Check className="h-2.5 w-2.5" />
      </span>
      <span className="min-w-0 flex-1 truncate text-[12px] font-bold">{item.item_name_snapshot}</span>
      <span className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-black",
        mine ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground")}>
        {ownerInitial(item.owner_name_snapshot)}
      </span>
      {!interactive && !disabled && <Lock className="h-3 w-3 text-muted-foreground" />}
    </motion.button>
  );
}
