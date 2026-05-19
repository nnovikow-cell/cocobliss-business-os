import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Search, Plus, Pencil, Trash2, ChevronUp, ChevronDown, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/sops")({ component: SOPsPage });

const CATEGORIES = ["Production", "Events", "Cleaning", "Admin", "Safety", "Other"] as const;
type Category = typeof CATEGORIES[number];

type SOP = {
  id: string;
  title: string;
  category: string;
  steps: string[];
  created_by: string | null;
  updated_at: string;
  created_at: string;
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function SOPsPage() {
  const { isAdmin } = useAuth();
  const [sops, setSops] = useState<SOP[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState<string>("All");
  const [readSop, setReadSop] = useState<SOP | null>(null);
  const [editSop, setEditSop] = useState<SOP | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("sops")
      .select("*")
      .is("deleted_at", null)
      .order("category")
      .order("title");
    if (error) toast.error(error.message);
    setSops(((data ?? []) as unknown as SOP[]).map((s) => ({
      ...s,
      steps: Array.isArray(s.steps) ? s.steps : [],
    })));
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sops.filter((s) => {
      if (activeCat !== "All" && s.category !== activeCat) return false;
      if (q && !s.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [sops, search, activeCat]);

  async function softDelete(s: SOP) {
    if (!confirm(`Delete "${s.title}"?`)) return;
    const { error } = await supabase
      .from("sops")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", s.id);
    if (error) return toast.error(error.message);
    toast.success("SOP deleted");
    setEditSop(null);
    setReadSop(null);
    load();
  }

  return (
    <AppShell>
      <header className="mb-4">
        <h1 className="text-2xl font-black tracking-tight">SOPs</h1>
        <p className="text-sm text-muted-foreground">Standard operating procedures</p>
      </header>

      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search SOPs..."
          className="pl-9"
        />
      </div>

      <div className="-mx-4 mb-4 overflow-x-auto px-4">
        <div className="flex gap-2">
          {(["All", ...CATEGORIES] as const).map((c) => (
            <button
              key={c}
              onClick={() => setActiveCat(c)}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                activeCat === c
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80",
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-center text-sm text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="mt-8 text-center text-sm text-muted-foreground">No SOPs found.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((s) => (
            <button
              key={s.id}
              onClick={() => setReadSop(s)}
              className="block w-full rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/50"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-bold">{s.title}</h3>
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs">{s.category}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Last updated {fmtDate(s.updated_at)}</p>
            </button>
          ))}
        </div>
      )}

      {isAdmin && (
        <Button
          size="icon"
          onClick={() => setCreateOpen(true)}
          className="fixed bottom-24 right-4 z-30 h-14 w-14 rounded-full shadow-xl md:bottom-8 md:right-8"
          aria-label="New SOP"
        >
          <Plus className="h-6 w-6" />
        </Button>
      )}

      <Sheet open={!!readSop} onOpenChange={(o) => { if (!o) setReadSop(null); }}>
        <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto">
          {readSop && (
            <>
              <SheetHeader className="text-left">
                <div className="flex items-start justify-between gap-2">
                  <SheetTitle className="text-2xl font-black tracking-tight">{readSop.title}</SheetTitle>
                  {isAdmin && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setEditSop(readSop); setReadSop(null); }}
                    >
                      <Pencil className="mr-1 h-3 w-3" />Edit
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{readSop.category}</span>
                  <span className="text-xs text-muted-foreground">Last updated {fmtDate(readSop.updated_at)}</span>
                </div>
              </SheetHeader>
              <div className="mt-6 space-y-4 pb-8">
                {readSop.steps.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No steps yet.</p>
                ) : (
                  readSop.steps.map((step, i) => (
                    <div key={i} className="flex gap-4">
                      <span className="shrink-0 text-lg font-black text-primary">{i + 1}</span>
                      <p className="text-base leading-relaxed">{step}</p>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <SOPDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={() => { setCreateOpen(false); load(); }}
      />
      <SOPDialog
        open={!!editSop}
        onOpenChange={(o) => { if (!o) setEditSop(null); }}
        editing={editSop}
        onSaved={() => { setEditSop(null); load(); }}
        onDelete={editSop ? () => softDelete(editSop) : undefined}
      />
    </AppShell>
  );
}

function SOPDialog({
  open, onOpenChange, editing, onSaved, onDelete,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing?: SOP | null;
  onSaved: () => void;
  onDelete?: () => void;
}) {
  const { user, isAdmin } = useAuth();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<Category>("Production");
  const [steps, setSteps] = useState<string[]>([""]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (editing) {
        setTitle(editing.title);
        setCategory((CATEGORIES as readonly string[]).includes(editing.category) ? editing.category as Category : "Other");
        setSteps(editing.steps.length ? editing.steps : [""]);
      } else {
        setTitle("");
        setCategory("Production");
        setSteps([""]);
      }
    }
  }, [open, editing]);

  function moveStep(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= steps.length) return;
    const next = [...steps];
    [next[i], next[j]] = [next[j], next[i]];
    setSteps(next);
  }

  async function save() {
    if (!isAdmin) return;
    if (!title.trim()) return toast.error("Title required");
    const cleanSteps = steps.map((s) => s.trim()).filter(Boolean);
    setSaving(true);
    const payload = {
      title: title.trim(),
      category,
      steps: cleanSteps,
    };
    let error;
    if (editing) {
      ({ error } = await supabase.from("sops").update(payload).eq("id", editing.id));
    } else {
      ({ error } = await supabase.from("sops").insert({ ...payload, created_by: user?.id ?? null }));
    }
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("SOP saved");
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit SOP" : "New SOP"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="sop-title">Title</Label>
            <Input id="sop-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Opening the booth" />
          </div>
          <div>
            <Label>Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Steps</Label>
            <div className="space-y-2">
              {steps.map((s, i) => (
                <div key={i} className="flex gap-2">
                  <span className="mt-2 w-5 shrink-0 text-center text-sm font-bold text-muted-foreground">{i + 1}</span>
                  <Textarea
                    rows={2}
                    value={s}
                    onChange={(e) => {
                      const next = [...steps];
                      next[i] = e.target.value;
                      setSteps(next);
                    }}
                    placeholder={`Step ${i + 1}`}
                    className="flex-1"
                  />
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => moveStep(i, -1)}
                      disabled={i === 0}
                      className="rounded-md p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"
                      aria-label="Move up"
                    >
                      <ChevronUp className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveStep(i, 1)}
                      disabled={i === steps.length - 1}
                      className="rounded-md p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"
                      aria-label="Move down"
                    >
                      <ChevronDown className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setSteps(steps.length > 1 ? steps.filter((_, x) => x !== i) : [""])}
                      className="rounded-md p-1 text-destructive hover:bg-muted"
                      aria-label="Delete step"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSteps([...steps, ""])}
                className="w-full"
              >
                <Plus className="mr-1 h-3 w-3" />Add step
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          {editing && onDelete ? (
            <Button variant="destructive" onClick={onDelete} className="sm:mr-auto">
              <Trash2 className="mr-1 h-4 w-4" />Delete
            </Button>
          ) : <div />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
