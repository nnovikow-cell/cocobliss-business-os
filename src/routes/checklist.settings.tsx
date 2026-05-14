import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Plus, Trash2, Save } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CATEGORY_COLORS, colorById } from "@/lib/checklist-colors";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/checklist/settings")({ component: PackSettings });

function PackSettings() {
  return (
    <AppShell>
      <div className="mb-4 flex items-center gap-3">
        <Link to="/checklist" className="rounded-full p-2 hover:bg-muted"><ArrowLeft className="h-5 w-5" /></Link>
        <div>
          <h1 className="text-2xl font-black">Pack Settings</h1>
          <p className="text-sm text-muted-foreground">Manage categories and packing items.</p>
        </div>
      </div>
      <Tabs defaultValue="categories" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="items">Items</TabsTrigger>
        </TabsList>
        <TabsContent value="categories" className="mt-4"><CategoriesTab /></TabsContent>
        <TabsContent value="items" className="mt-4"><ItemsTab /></TabsContent>
      </Tabs>
    </AppShell>
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
      <div className="rounded-xl border border-border bg-card p-3">
        <Input placeholder="Category name (e.g. Money, Toppings)" value={n} onChange={(e) => setN(e.target.value)} />
        <ColorSwatchPicker value={c} onChange={setC} />
        <Button onClick={add} className="mt-2 w-full" size="sm"><Plus className="mr-1 h-4 w-4" />Add category</Button>
      </div>
      <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {items.length === 0 && <p className="p-4 text-center text-sm text-muted-foreground">No categories yet.</p>}
        {items.map((cat) => <CategoryRow key={cat.id} value={cat} onUpdate={load} />)}
      </div>
    </div>
  );
}
function CategoryRow({ value, onUpdate }: { value: Cat; onUpdate: () => void }) {
  const [name, setName] = useState(value.name);
  const [color, setColor] = useState(value.color);
  const [open, setOpen] = useState(false);
  const dirty = name !== value.name || color !== value.color;
  const sw = colorById(color);
  return (
    <div className="p-3">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 text-left">
        <span className="h-3 w-3 rounded-full" style={{ background: sw.ring }} />
        <span className="flex-1 truncate font-semibold">{value.name}</span>
      </button>
      {open && (
        <div className="mt-3 space-y-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
          <ColorSwatchPicker value={color} onChange={setColor} />
          <div className="flex gap-2">
            <Button size="sm" disabled={!dirty} className="flex-1" onClick={async () => {
              const { error } = await supabase.from("checklist_categories").update({ name, color }).eq("id", value.id);
              if (error) return toast.error(error.message);
              toast.success("Saved"); onUpdate();
            }}><Save className="mr-1 h-4 w-4" />Save</Button>
            <Button size="sm" variant="ghost" onClick={async () => {
              if (!confirm("Archive category?")) return;
              await supabase.from("checklist_categories").update({ deleted_at: new Date().toISOString() }).eq("id", value.id);
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
      <div className="rounded-xl border border-border bg-card p-3">
        <Input placeholder="Item name" value={n} onChange={(e) => setN(e.target.value)} />
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
        <Input placeholder="Location (e.g. Van)" value={loc} onChange={(e) => setLoc(e.target.value)} className="mt-2" />
        <Select value={owner} onValueChange={setOwner}>
          <SelectTrigger className="mt-2"><SelectValue placeholder="Owner (optional)" /></SelectTrigger>
          <SelectContent>{profiles.map((p) => <SelectItem key={p.user_id} value={p.user_id}>{p.display_name ?? "Unnamed"}</SelectItem>)}</SelectContent>
        </Select>
        <Button onClick={add} className="mt-2 w-full" size="sm"><Plus className="mr-1 h-4 w-4" />Add item</Button>
      </div>

      <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {items.length === 0 && <p className="p-4 text-center text-sm text-muted-foreground">No items yet.</p>}
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
    <div className="p-3">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 text-left">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: sw.ring }} />
        <span className="flex-1 truncate font-semibold">{value.name}</span>
        <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-bold">{value.size_tag}</span>
        {value.owner_user_id && (
          <span className="text-xs text-muted-foreground">{ownerName(value.owner_user_id)}</span>
        )}
      </button>
      {open && (
        <div className="mt-3 space-y-2">
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
          <Input value={loc} onChange={(e) => setLoc(e.target.value)} placeholder="Location" />
          <Select value={owner} onValueChange={setOwner}>
            <SelectTrigger><SelectValue placeholder="Owner" /></SelectTrigger>
            <SelectContent>{profiles.map((p) => <SelectItem key={p.user_id} value={p.user_id}>{p.display_name ?? "Unnamed"}</SelectItem>)}</SelectContent>
          </Select>
          <div className="flex gap-2">
            <Button size="sm" disabled={!dirty} className="flex-1" onClick={async () => {
              const { error } = await supabase.from("checklist_items").update({
                name, category_id: cat || null, location_tag: loc.trim() || null, size_tag: size, owner_user_id: owner || null,
              }).eq("id", value.id);
              if (error) return toast.error(error.message);
              toast.success("Saved"); onUpdate();
            }}><Save className="mr-1 h-4 w-4" />Save</Button>
            <Button size="sm" variant="ghost" onClick={async () => {
              if (!confirm("Archive item?")) return;
              await supabase.from("checklist_items").update({ deleted_at: new Date().toISOString() }).eq("id", value.id);
              toast.success("Archived"); onUpdate();
            }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </div>
        </div>
      )}
    </div>
  );
}
