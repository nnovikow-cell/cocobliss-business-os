import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Check } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { ItemForm, emptyItemForm, type ItemFormState } from "@/components/inventory/item-form";
import type { InventoryCategory } from "@/lib/inventory";

export const Route = createFileRoute("/inventory/new")({ component: NewItem });

function NewItem() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [form, setForm] = useState<ItemFormState>(emptyItemForm);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.name.trim()) return toast.error("Name required");
    setSaving(true);
    const legacyCategory: InventoryCategory =
      form.category_v2 === "disposable" ? "disposable" : "consumable";
    const insert = {
      name: form.name.trim(),
      category: legacyCategory,
      category_v2: form.category_v2,
      workflow_tags: form.workflow_tags.length ? form.workflow_tags : ["all"],
      unit: form.unit || "units",
      package_type: form.package_type.trim() || null,
      supplier_name: form.supplier_name.trim() || null,
      purchase_url: form.purchase_url.trim() || null,
      physical_location: form.physical_location.trim() || null,
      price: form.price ? Number(form.price) : null,
      package_size: form.package_size ? Number(form.package_size) : null,
      package_size_unit: form.package_size_unit || null,
      current_quantity: Number(form.current_quantity || 0),
      par_level: Number(form.par_level || 0),
      notes: form.notes.trim() || null,
      created_by: user?.id ?? null,
      last_restocked_at: Number(form.current_quantity) > 0 ? new Date().toISOString() : null,
    };
    const { data, error } = await supabase.from("inventory_items").insert(insert).select("id").single();
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Item added");
    navigate({ to: "/inventory/$itemId", params: { itemId: data!.id } });
  };

  return (
    <AppShell>
      <header className="mb-4">
        <Link to="/inventory" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Inventory
        </Link>
        <h1 className="mt-2 text-2xl font-black tracking-tight md:text-3xl">New inventory item</h1>
      </header>
      <ItemForm value={form} onChange={setForm} />
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" asChild><Link to="/inventory">Cancel</Link></Button>
        <Button onClick={save} disabled={saving}><Check className="h-4 w-4" /> {saving ? "Saving…" : "Save item"}</Button>
      </div>
    </AppShell>
  );
}