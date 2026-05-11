import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Plus, Trash2, Save } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/sales/settings")({ component: SettingsPage });

function SettingsPage() {
  return (
    <AppShell>
      <div className="mb-4 flex items-center gap-3">
        <Link to="/sales" className="rounded-full p-2 hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold">Sales Settings</h1>
      </div>

      <Tabs defaultValue="products" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="flavors">Flavors</TabsTrigger>
          <TabsTrigger value="payments">Payment</TabsTrigger>
        </TabsList>
        <TabsList className="mt-2 grid w-full grid-cols-2">
          <TabsTrigger value="demographics">Demographics</TabsTrigger>
          <TabsTrigger value="tax">Tax</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="mt-4"><ProductsTab /></TabsContent>
        <TabsContent value="flavors" className="mt-4"><FlavorsTab /></TabsContent>
        <TabsContent value="payments" className="mt-4"><PaymentMethodsTab /></TabsContent>
        <TabsContent value="demographics" className="mt-4"><DemographicsTab /></TabsContent>
        <TabsContent value="tax" className="mt-4"><TaxTab /></TabsContent>
      </Tabs>
    </AppShell>
  );
}

/* ---------- Products ---------- */
type Product = { id: string; name: string; type: "shake" | "paleta"; price: number; sort_order: number; is_archived: boolean };

function ProductsTab() {
  const [items, setItems] = useState<Product[]>([]);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<"shake" | "paleta">("shake");
  const [newPrice, setNewPrice] = useState("");

  const load = async () => {
    const { data } = await supabase
      .from("products")
      .select("*")
      .is("deleted_at", null)
      .order("type")
      .order("sort_order");
    setItems((data ?? []) as Product[]);
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!newName.trim()) return;
    const { error } = await supabase.from("products").insert({
      name: newName.trim(), type: newType, price: parseFloat(newPrice) || 0,
      sort_order: items.length * 10,
    });
    if (error) return toast.error(error.message);
    setNewName(""); setNewPrice(""); toast.success("Added"); load();
  };

  const update = async (id: string, patch: Partial<Product>) => {
    const { error } = await supabase.from("products").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Archive this product?")) return;
    const { error } = await supabase.from("products").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Archived"); load();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border-2 border-dashed border-border bg-card p-4">
        <h3 className="mb-3 font-bold">Add product</h3>
        <div className="grid grid-cols-2 gap-2">
          <Input placeholder="Name" value={newName} onChange={(e) => setNewName(e.target.value)} className="col-span-2" />
          <Select value={newType} onValueChange={(v) => setNewType(v as "shake" | "paleta")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="shake">Shake</SelectItem>
              <SelectItem value="paleta">Paleta</SelectItem>
            </SelectContent>
          </Select>
          <Input type="number" step="0.01" placeholder="Price" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} />
        </div>
        <Button onClick={add} className="mt-3 w-full"><Plus className="mr-2 h-4 w-4" />Add</Button>
      </div>

      {(["shake", "paleta"] as const).map((t) => (
        <div key={t}>
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">{t}s</h3>
          <div className="space-y-2">
            {items.filter((i) => i.type === t).map((p) => (
              <ItemRow key={p.id} value={p} onChange={(patch) => update(p.id, patch)} onDelete={() => remove(p.id)} priceLabel="Price" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ItemRow({ value, onChange, onDelete, priceField = "price", priceLabel = "Price" }: {
  value: Record<string, unknown> & { id: string; name: string };
  onChange: (patch: Record<string, unknown>) => void;
  onDelete: () => void;
  priceField?: string;
  priceLabel?: string;
}) {
  const [name, setName] = useState(value.name);
  const [price, setPrice] = useState(String(value[priceField] ?? ""));
  const dirty = name !== value.name || price !== String(value[priceField] ?? "");
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-border bg-card p-3">
      <Input value={name} onChange={(e) => setName(e.target.value)} className="flex-1" />
      <Input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className="w-24" aria-label={priceLabel} />
      <Button size="icon" variant="ghost" disabled={!dirty} onClick={() => onChange({ name, [priceField]: parseFloat(price) || 0 })}>
        <Save className="h-4 w-4" />
      </Button>
      <Button size="icon" variant="ghost" onClick={onDelete}>
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );
}

/* ---------- Flavors ---------- */
function FlavorsTab() {
  const [items, setItems] = useState<Array<{ id: string; name: string; upgrade_price: number }>>([]);
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");

  const load = async () => {
    const { data } = await supabase.from("paleta_flavor_upgrades").select("*").is("deleted_at", null).order("sort_order");
    setItems((data ?? []) as Array<{ id: string; name: string; upgrade_price: number }>);
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!newName.trim()) return;
    const { error } = await supabase.from("paleta_flavor_upgrades").insert({
      name: newName.trim(), upgrade_price: parseFloat(newPrice) || 0, sort_order: items.length * 10,
    });
    if (error) return toast.error(error.message);
    setNewName(""); setNewPrice(""); load();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border-2 border-dashed border-border bg-card p-4">
        <h3 className="mb-3 font-bold">Add flavor upgrade</h3>
        <div className="flex gap-2">
          <Input placeholder="Name" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <Input type="number" step="0.01" placeholder="Price" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} className="w-28" />
        </div>
        <Button onClick={add} className="mt-3 w-full"><Plus className="mr-2 h-4 w-4" />Add</Button>
      </div>
      <div className="space-y-2">
        {items.map((p) => (
          <ItemRow
            key={p.id}
            value={p as unknown as { id: string; name: string }}
            priceField="upgrade_price"
            priceLabel="Upgrade price"
            onChange={(patch) =>
              supabase
                .from("paleta_flavor_upgrades")
                .update(patch as { name?: string; upgrade_price?: number })
                .eq("id", p.id)
                .then(load)
            }
            onDelete={() => {
              if (!confirm("Archive flavor?")) return;
              supabase.from("paleta_flavor_upgrades").update({ deleted_at: new Date().toISOString() }).eq("id", p.id).then(load);
            }}
          />
        ))}
      </div>
    </div>
  );
}

/* ---------- Payment Methods ---------- */
function PaymentMethodsTab() {
  const [items, setItems] = useState<Array<{ id: string; name: string; applies_tax: boolean }>>([]);
  const [newName, setNewName] = useState("");
  const [newAppliesTax, setNewAppliesTax] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("payment_methods").select("*").is("deleted_at", null).order("sort_order");
    setItems((data ?? []) as Array<{ id: string; name: string; applies_tax: boolean }>);
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!newName.trim()) return;
    const { error } = await supabase.from("payment_methods").insert({
      name: newName.trim(), applies_tax: newAppliesTax, sort_order: items.length * 10,
    });
    if (error) return toast.error(error.message);
    setNewName(""); setNewAppliesTax(false); load();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border-2 border-dashed border-border bg-card p-4">
        <h3 className="mb-3 font-bold">Add payment method</h3>
        <Input placeholder="Name (e.g. Cash, Card)" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <div className="mt-3 flex items-center justify-between">
          <Label>Applies tax</Label>
          <Switch checked={newAppliesTax} onCheckedChange={setNewAppliesTax} />
        </div>
        <Button onClick={add} className="mt-3 w-full"><Plus className="mr-2 h-4 w-4" />Add</Button>
      </div>
      <div className="space-y-2">
        {items.map((m) => (
          <PaymentRow key={m.id} value={m} onUpdate={load} />
        ))}
      </div>
    </div>
  );
}

function PaymentRow({ value, onUpdate }: { value: { id: string; name: string; applies_tax: boolean }; onUpdate: () => void }) {
  const [name, setName] = useState(value.name);
  const [appliesTax, setAppliesTax] = useState(value.applies_tax);
  const dirty = name !== value.name || appliesTax !== value.applies_tax;
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-border bg-card p-3">
      <Input value={name} onChange={(e) => setName(e.target.value)} className="flex-1" />
      <div className="flex items-center gap-1 px-2">
        <span className="text-xs font-semibold text-muted-foreground">TAX</span>
        <Switch checked={appliesTax} onCheckedChange={setAppliesTax} />
      </div>
      <Button size="icon" variant="ghost" disabled={!dirty} onClick={async () => {
        const { error } = await supabase.from("payment_methods").update({ name, applies_tax: appliesTax }).eq("id", value.id);
        if (error) return toast.error(error.message);
        onUpdate();
      }}>
        <Save className="h-4 w-4" />
      </Button>
      <Button size="icon" variant="ghost" onClick={async () => {
        if (!confirm("Archive payment method?")) return;
        await supabase.from("payment_methods").update({ deleted_at: new Date().toISOString() }).eq("id", value.id);
        onUpdate();
      }}>
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );
}

/* ---------- Demographics ---------- */
function DemographicsTab() {
  const [items, setItems] = useState<Array<{ id: string; category: string; label: string }>>([]);
  const [newCategory, setNewCategory] = useState("age_group");
  const [newLabel, setNewLabel] = useState("");

  const load = async () => {
    const { data } = await supabase.from("demographic_options").select("*").is("deleted_at", null).order("category").order("sort_order");
    setItems((data ?? []) as Array<{ id: string; category: string; label: string }>);
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!newLabel.trim() || !newCategory.trim()) return;
    const { error } = await supabase.from("demographic_options").insert({
      category: newCategory.trim(), label: newLabel.trim(), sort_order: items.length * 10,
    });
    if (error) return toast.error(error.message);
    setNewLabel(""); load();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border-2 border-dashed border-border bg-card p-4">
        <h3 className="mb-3 font-bold">Add demographic option</h3>
        <Input placeholder="Category (e.g. age_group, sex)" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} />
        <Input placeholder="Label (e.g. 18-25)" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} className="mt-2" />
        <Button onClick={add} className="mt-3 w-full"><Plus className="mr-2 h-4 w-4" />Add</Button>
      </div>
      <div className="space-y-2">
        {items.map((d) => (
          <div key={d.id} className="flex items-center gap-2 rounded-2xl border border-border bg-card p-3">
            <span className="rounded-full bg-secondary px-2 py-1 text-xs font-bold uppercase">{d.category}</span>
            <span className="flex-1 font-medium">{d.label}</span>
            <Button size="icon" variant="ghost" onClick={async () => {
              if (!confirm("Archive?")) return;
              await supabase.from("demographic_options").update({ deleted_at: new Date().toISOString() }).eq("id", d.id);
              load();
            }}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Tax ---------- */
function TaxTab() {
  const [taxRate, setTaxRate] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    supabase.from("app_settings").select("tax_rate").limit(1).maybeSingle().then(({ data }) => {
      setTaxRate(String(data?.tax_rate ?? 0));
      setLoaded(true);
    });
  }, []);

  const save = async () => {
    const { data: existing } = await supabase.from("app_settings").select("id").limit(1).maybeSingle();
    const value = parseFloat(taxRate) || 0;
    if (existing) {
      const { error } = await supabase.from("app_settings").update({ tax_rate: value }).eq("id", existing.id);
      if (error) return toast.error(error.message);
    } else {
      await supabase.from("app_settings").insert({ tax_rate: value });
    }
    toast.success("Tax rate saved");
  };

  if (!loaded) return null;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5">
        <Label htmlFor="tax-rate" className="text-base font-bold">Tax rate (%)</Label>
        <p className="mb-3 text-sm text-muted-foreground">Applied to sales paid with a tax-enabled payment method.</p>
        <div className="flex gap-2">
          <Input id="tax-rate" type="number" step="0.01" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} className="text-2xl font-bold" />
          <Button onClick={save}>Save</Button>
        </div>
      </div>
    </div>
  );
}