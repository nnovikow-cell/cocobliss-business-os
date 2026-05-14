import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Plus, Trash2, Save, Tag } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { CATEGORY_COLORS, colorById } from "@/lib/checklist-colors";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({ component: HubSettings });

function HubSettings() {
  return (
    <AppShell>
      <div className="mb-4 flex items-center gap-3">
        <Link to="/" className="rounded-full p-2 hover:bg-muted"><ArrowLeft className="h-5 w-5" /></Link>
        <div>
          <h1 className="text-2xl font-black">Hub Settings</h1>
          <p className="text-sm text-muted-foreground">Global config shared across all modules.</p>
        </div>
      </div>

      <Tabs defaultValue="staff" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="staff">Staff</TabsTrigger>
          <TabsTrigger value="event_tags">Event Tags</TabsTrigger>
        </TabsList>
        <TabsContent value="staff" className="mt-4"><StaffTab /></TabsContent>
        <TabsContent value="event_tags" className="mt-4"><EventTagsTab /></TabsContent>
      </Tabs>
    </AppShell>
  );
}

/* ---------- Staff ---------- */
type Staff = {
  id: string; name: string; first_name: string | null; last_name: string | null;
  role: string | null; active: boolean;
};
function StaffTab() {
  const [items, setItems] = useState<Staff[]>([]);
  const [first, setFirst] = useState(""); const [last, setLast] = useState("");
  const [role, setRole] = useState("");

  const load = async () => {
    const { data } = await supabase.from("attendants")
      .select("id,name,first_name,last_name,role,active")
      .is("deleted_at", null).order("sort_order");
    setItems((data ?? []) as Staff[]);
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    const f = first.trim(); const l = last.trim();
    if (!f && !l) return;
    const display = [f, l].filter(Boolean).join(" ");
    const { error } = await supabase.from("attendants").insert({
      name: display, first_name: f || null, last_name: l || null,
      role: role.trim() || null, sort_order: items.length * 10, active: true,
    });
    if (error) return toast.error(error.message);
    setFirst(""); setLast(""); setRole(""); toast.success("Staff added"); load();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-3">
        <div className="grid grid-cols-2 gap-2">
          <Input placeholder="First name" value={first} onChange={(e) => setFirst(e.target.value)} />
          <Input placeholder="Last name" value={last} onChange={(e) => setLast(e.target.value)} />
        </div>
        <Input placeholder="Role (e.g. Owner, Helper)" value={role} onChange={(e) => setRole(e.target.value)} className="mt-2" />
        <Button onClick={add} className="mt-2 w-full" size="sm"><Plus className="mr-1 h-4 w-4" />Add staff</Button>
      </div>
      <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {items.length === 0 && <p className="p-4 text-center text-sm text-muted-foreground">No staff yet.</p>}
        {items.map((s) => <StaffRow key={s.id} value={s} onUpdate={load} />)}
      </div>
    </div>
  );
}
function StaffRow({ value, onUpdate }: { value: Staff; onUpdate: () => void }) {
  const [first, setFirst] = useState(value.first_name ?? "");
  const [last, setLast] = useState(value.last_name ?? "");
  const [role, setRole] = useState(value.role ?? "");
  const [active, setActive] = useState(value.active);
  const [open, setOpen] = useState(false);
  const dirty = first !== (value.first_name ?? "") || last !== (value.last_name ?? "") ||
    role !== (value.role ?? "") || active !== value.active;
  return (
    <div className="p-3">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 text-left">
        <span className={cn("h-2 w-2 rounded-full", value.active ? "bg-emerald-500" : "bg-muted-foreground/40")} />
        <span className="flex-1 truncate font-semibold">{value.name || "—"}</span>
        {value.role && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">{value.role}</span>}
      </button>
      {open && (
        <div className="mt-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Input value={first} onChange={(e) => setFirst(e.target.value)} placeholder="First" />
            <Input value={last} onChange={(e) => setLast(e.target.value)} placeholder="Last" />
          </div>
          <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Role" />
          <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
            <span className="text-sm font-medium">Active</span>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" disabled={!dirty} className="flex-1" onClick={async () => {
              const f = first.trim(); const l = last.trim();
              const display = [f, l].filter(Boolean).join(" ") || value.name;
              const { error } = await supabase.from("attendants").update({
                first_name: f || null, last_name: l || null, role: role.trim() || null,
                active, name: display,
              }).eq("id", value.id);
              if (error) return toast.error(error.message);
              toast.success("Saved"); onUpdate();
            }}><Save className="mr-1 h-4 w-4" />Save</Button>
            <Button size="sm" variant="ghost" onClick={async () => {
              if (!confirm("Archive this staff member?")) return;
              await supabase.from("attendants").update({ deleted_at: new Date().toISOString() }).eq("id", value.id);
              toast.success("Archived"); onUpdate();
            }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Event Tags ---------- */
type EventTag = { id: string; name: string; color: string };
function EventTagsTab() {
  const [items, setItems] = useState<EventTag[]>([]);
  const [n, setN] = useState(""); const [c, setC] = useState("teal");
  const load = async () => {
    const { data } = await supabase.from("event_tags").select("id,name,color").is("deleted_at", null).order("sort_order");
    setItems((data ?? []) as EventTag[]);
  };
  useEffect(() => { load(); }, []);
  const add = async () => {
    if (!n.trim()) return;
    const { error } = await supabase.from("event_tags").insert({ name: n.trim(), color: c, sort_order: items.length * 10 });
    if (error) return toast.error(error.message);
    setN(""); toast.success("Tag added"); load();
  };
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-3">
        <Input placeholder="Tag name (e.g. Farmers Market)" value={n} onChange={(e) => setN(e.target.value)} />
        <ColorSwatchPicker value={c} onChange={setC} />
        <Button onClick={add} className="mt-2 w-full" size="sm"><Plus className="mr-1 h-4 w-4" />Add tag</Button>
      </div>
      <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {items.length === 0 && <p className="p-4 text-center text-sm text-muted-foreground">No event tags yet.</p>}
        {items.map((t) => <TagRow key={t.id} value={t} onUpdate={load} />)}
      </div>
    </div>
  );
}
function TagRow({ value, onUpdate }: { value: EventTag; onUpdate: () => void }) {
  const [name, setName] = useState(value.name);
  const [color, setColor] = useState(value.color);
  const [open, setOpen] = useState(false);
  const sw = colorById(color);
  const dirty = name !== value.name || color !== value.color;
  return (
    <div className="p-3">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 text-left">
        <span className="h-3 w-3 rounded-full" style={{ background: sw.ring }} />
        <Tag className="h-4 w-4 text-muted-foreground" />
        <span className="flex-1 truncate font-semibold">{value.name}</span>
      </button>
      {open && (
        <div className="mt-3 space-y-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
          <ColorSwatchPicker value={color} onChange={setColor} />
          <div className="flex gap-2">
            <Button size="sm" disabled={!dirty} className="flex-1" onClick={async () => {
              const { error } = await supabase.from("event_tags").update({ name, color }).eq("id", value.id);
              if (error) return toast.error(error.message);
              toast.success("Saved"); onUpdate();
            }}><Save className="mr-1 h-4 w-4" />Save</Button>
            <Button size="sm" variant="ghost" onClick={async () => {
              if (!confirm("Archive this tag?")) return;
              await supabase.from("event_tags").update({ deleted_at: new Date().toISOString() }).eq("id", value.id);
              onUpdate();
            }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </div>
        </div>
      )}
    </div>
  );
}
function ColorSwatchPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {CATEGORY_COLORS.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onChange(c.id)}
          className={cn("h-7 w-7 rounded-full ring-2 transition-transform",
            value === c.id ? "scale-110 ring-offset-2 ring-offset-card" : "ring-transparent hover:scale-105")}
          style={{ background: c.bg, ["--tw-ring-color" as string]: c.ring }}
          aria-label={c.label}
        />
      ))}
    </div>
  );
}
