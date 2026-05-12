import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Plus, Trash2, Save, MapPin, User as UserIcon } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CATEGORY_COLORS, colorById } from "@/lib/checklist-colors";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({ component: GlobalSettings });

function GlobalSettings() {
  return (
    <AppShell>
      <div className="mb-4 flex items-center gap-3">
        <Link to="/" className="rounded-full p-2 hover:bg-muted"><ArrowLeft className="h-5 w-5" /></Link>
        <h1 className="text-2xl font-black">App Settings</h1>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">Shared across all modules.</p>

      <Tabs defaultValue="events" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="events">Events</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="items">Items</TabsTrigger>
        </TabsList>
        <TabsContent value="events" className="mt-4"><EventsTab /></TabsContent>
        <TabsContent value="categories" className="mt-4"><CategoriesTab /></TabsContent>
        <TabsContent value="items" className="mt-4"><ItemsTab /></TabsContent>
      </Tabs>
    </AppShell>
  );
}

/* ---------- Events ---------- */
type Ev = { id: string; name: string; location: string | null };
function EventsTab() {
  const [items, setItems] = useState<Ev[]>([]);
  const [n, setN] = useState(""); const [loc, setLoc] = useState("");
  const load = async () => {
    const { data } = await supabase.from("events").select("id,name,location").is("deleted_at", null).order("sort_order");
    setItems((data ?? []) as Ev[]);
  };
  useEffect(() => { load(); }, []);
  const add = async () => {
    if (!n.trim()) return;
    const { error } = await supabase.from("events").insert({ name: n.trim(), location: loc.trim() || null, sort_order: items.length * 10 });
    if (error) return toast.error(error.message);
    setN(""); setLoc(""); toast.success("Event added"); load();
  };
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border-2 border-dashed border-border bg-card p-4">
        <h3 className="mb-3 font-bold">Add event</h3>
        <Input placeholder="Name (e.g. Farmers Market - Hillcrest)" value={n} onChange={(e) => setN(e.target.value)} />
        <Input placeholder="Location (optional)" value={loc} onChange={(e) => setLoc(e.target.value)} className="mt-2" />
        <Button onClick={add} className="mt-3 w-full"><Plus className="mr-2 h-4 w-4" />Add</Button>
      </div>
      <div className="space-y-2">
        {items.map((e) => <EventRow key={e.id} value={e} onUpdate={load} />)}
      </div>
    </div>
  );
}
function EventRow({ value, onUpdate }: { value: Ev; onUpdate: () => void }) {
  const [name, setName] = useState(value.name);
  const [location, setLocation] = useState(value.location ?? "");
  const dirty = name !== value.name || location !== (value.location ?? "");
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-border bg-card p-3">
      <Input value={name} onChange={(e) => setName(e.target.value)} className="flex-1" />
      <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location" className="flex-1" />
      <Button size="icon" variant="ghost" disabled={!dirty} onClick={async () => {
        const { error } = await supabase.from("events").update({ name, location: location.trim() || null }).eq("id", value.id);
        if (error) return toast.error(error.message);
        onUpdate();
      }}><Save className="h-4 w-4" /></Button>
      <Button size="icon" variant="ghost" onClick={async () => {
        if (!confirm("Archive event?")) return;
        await supabase.from("events").update({ deleted_at: new Date().toISOString() }).eq("id", value.id);
        onUpdate();
      }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
    </div>
  );
}

/* ---------- Categories ---------- */
type Cat = { id: string; name: string; color: string };
function CategoriesTab() {
  const [items, setItems] = useState<Cat[]>([]);
  const [n, setN] = useState(""); const [c, setC] = useState("teal");
  const load = async () => {
    const { data } = await supabase.from("checklist_categories").select("id,name,color").is("deleted_at", null).order("sort_order");
    setItems((data ?? []) as Cat[]);
  };
  useEffect(() => { load(); }, []);
  const add = async () => {
    if (!n.trim()) return;
    const { error } = await supabase.from("checklist_categories").insert({ name: n.trim(), color: c, sort_order: items.length * 10 });
    if (error) return toast.error(error.message);
    setN(""); toast.success("Category added"); load();
  };
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border-2 border-dashed border-border bg-card p-4">
        <h3 className="mb-3 font-bold">Add category</h3>
        <Input placeholder="Name (e.g. Money Stuff, Toppings)" value={n} onChange={(e) => setN(e.target.value)} />
        <ColorSwatchPicker value={c} onChange={setC} />
        <Button onClick={add} className="mt-3 w-full"><Plus className="mr-2 h-4 w-4" />Add</Button>
      </div>
      <div className="space-y-2">
        {items.map((cat) => <CategoryRow key={cat.id} value={cat} onUpdate={load} />)}
      </div>
    </div>
  );
}
function CategoryRow({ value, onUpdate }: { value: Cat; onUpdate: () => void }) {
  const [name, setName] = useState(value.name);
  const [color, setColor] = useState(value.color);
  const dirty = name !== value.name || color !== value.color;
  const swatch = colorById(color);
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <div className="flex items-center gap-2">
        <span className="h-7 w-7 shrink-0 rounded-full ring-2" style={{ background: swatch.bg, ["--tw-ring-color" as string]: swatch.ring }} />
        <Input value={name} onChange={(e) => setName(e.target.value)} className="flex-1" />
        <Button size="icon" variant="ghost" disabled={!dirty} onClick={async () => {
          const { error } = await supabase.from("checklist_categories").update({ name, color }).eq("id", value.id);
          if (error) return toast.error(error.message);
          onUpdate();
        }}><Save className="h-4 w-4" /></Button>
        <Button size="icon" variant="ghost" onClick={async () => {
          if (!confirm("Delete category?")) return;
          await supabase.from("checklist_categories").update({ deleted_at: new Date().toISOString() }).eq("id", value.id);
          onUpdate();
        }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
      </div>
      <ColorSwatchPicker value={color} onChange={setColor} />
    </div>
  );
}
function ColorSwatchPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {CATEGORY_COLORS.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onChange(c.id)}
          className={cn("h-9 w-9 rounded-full ring-2 transition-transform", value === c.id ? "scale-110 ring-offset-2 ring-offset-card" : "ring-transparent hover:scale-105")}
          style={{ background: c.bg, ["--tw-ring-color" as string]: c.ring }}
          aria-label={c.label}
        />
      ))}
    </div>
  );
}

/* ---------- Items ---------- */
type ItemRow = { id: string; name: string; category_id: string | null; location_tag: string | null; size_tag: "S"|"M"|"L"; owner_user_id: string | null };
type Profile = { user_id: string; display_name: string | null };
function ItemsTab() {
  const [items, setItems] = useState<ItemRow[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [n, setN] = useState(""); const [cat, setCat] = useState<string>("");
  const [loc, setLoc] = useState(""); const [size, setSize] = useState<"S"|"M"|"L">("M");
  const [owner, setOwner] = useState<string>("");

  const load = async () => {
    const [{ data: it }, { data: c }, { data: p }] = await Promise.all([
      supabase.from("checklist_items").select("id,name,category_id,location_tag,size_tag,owner_user_id").is("deleted_at", null).order("sort_order"),
      supabase.from("checklist_categories").select("id,name,color").is("deleted_at", null).order("sort_order"),
      supabase.from("profiles").select("user_id,display_name").order("display_name"),
    ]);
    setItems((it ?? []) as ItemRow[]);
    setCats((c ?? []) as Cat[]);
    setProfiles((p ?? []) as Profile[]);
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!n.trim()) return;
    const { error } = await supabase.from("checklist_items").insert({
      name: n.trim(), category_id: cat || null, location_tag: loc.trim() || null,
      size_tag: size, owner_user_id: owner || null, sort_order: items.length * 10,
    });
    if (error) return toast.error(error.message);
    setN(""); setLoc(""); toast.success("Item added"); load();
  };

  const ownerName = (id: string | null) => profiles.find((p) => p.user_id === id)?.display_name ?? "—";
  const catFor = (id: string | null) => cats.find((c) => c.id === id);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border-2 border-dashed border-border bg-card p-4">
        <h3 className="mb-3 font-bold">Add item</h3>
        <Input placeholder="Name (e.g. Float, Squeeze bottles)" value={n} onChange={(e) => setN(e.target.value)} />
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Select value={cat} onValueChange={setCat}>
            <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>{cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={size} onValueChange={(v) => setSize(v as "S"|"M"|"L")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="S">Small</SelectItem>
              <SelectItem value="M">Medium</SelectItem>
              <SelectItem value="L">Large</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Input placeholder="Location (e.g. Van, My bag)" value={loc} onChange={(e) => setLoc(e.target.value)} className="mt-2" />
        <Select value={owner} onValueChange={setOwner}>
          <SelectTrigger className="mt-2"><SelectValue placeholder="Owner" /></SelectTrigger>
          <SelectContent>{profiles.map((p) => <SelectItem key={p.user_id} value={p.user_id}>{p.display_name ?? "Unnamed"}</SelectItem>)}</SelectContent>
        </Select>
        <Button onClick={add} className="mt-3 w-full"><Plus className="mr-2 h-4 w-4" />Add</Button>
      </div>

      <div className="space-y-2">
        {items.map((it) => (
          <ItemEditor key={it.id} value={it} cats={cats} profiles={profiles} catFor={catFor} ownerName={ownerName} onUpdate={load} />
        ))}
      </div>
    </div>
  );
}

function ItemEditor({ value, cats, profiles, catFor, ownerName, onUpdate }: {
  value: ItemRow; cats: Cat[]; profiles: Profile[];
  catFor: (id: string | null) => Cat | undefined;
  ownerName: (id: string | null) => string;
  onUpdate: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(value.name);
  const [cat, setCat] = useState(value.category_id ?? "");
  const [loc, setLoc] = useState(value.location_tag ?? "");
  const [size, setSize] = useState<"S"|"M"|"L">(value.size_tag);
  const [owner, setOwner] = useState(value.owner_user_id ?? "");
  const c = catFor(value.category_id);
  const sw = colorById(c?.color);
  const dirty = name !== value.name || cat !== (value.category_id ?? "") ||
    loc !== (value.location_tag ?? "") || size !== value.size_tag || owner !== (value.owner_user_id ?? "");

  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 text-left">
        <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: sw.ring }} />
        <span className="flex-1 font-bold">{value.name}</span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold">{value.size_tag}</span>
        <span className="text-xs text-muted-foreground">{ownerName(value.owner_user_id)}</span>
      </button>
      {open && (
        <div className="mt-3 space-y-2 border-t border-border pt-3">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <Select value={cat} onValueChange={setCat}>
              <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>{cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={size} onValueChange={(v) => setSize(v as "S"|"M"|"L")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="S">Small</SelectItem>
                <SelectItem value="M">Medium</SelectItem>
                <SelectItem value="L">Large</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="relative">
            <MapPin className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={loc} onChange={(e) => setLoc(e.target.value)} className="pl-8" placeholder="Location" />
          </div>
          <Select value={owner} onValueChange={setOwner}>
            <SelectTrigger><UserIcon className="mr-1 inline h-4 w-4" /><SelectValue placeholder="Owner" /></SelectTrigger>
            <SelectContent>{profiles.map((p) => <SelectItem key={p.user_id} value={p.user_id}>{p.display_name ?? "Unnamed"}</SelectItem>)}</SelectContent>
          </Select>
          <div className="flex gap-2">
            <Button disabled={!dirty} className="flex-1" onClick={async () => {
              const { error } = await supabase.from("checklist_items").update({
                name, category_id: cat || null, location_tag: loc.trim() || null, size_tag: size, owner_user_id: owner || null,
              }).eq("id", value.id);
              if (error) return toast.error(error.message);
              toast.success("Saved"); onUpdate();
            }}><Save className="mr-1 h-4 w-4" /> Save</Button>
            <Button variant="outline" onClick={async () => {
              if (!confirm("Delete item?")) return;
              await supabase.from("checklist_items").update({ deleted_at: new Date().toISOString() }).eq("id", value.id);
              toast.success("Deleted"); onUpdate();
            }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </div>
        </div>
      )}
    </div>
  );
}
