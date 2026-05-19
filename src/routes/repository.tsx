import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Search, Plus, Pencil, Trash2, Copy, Eye, EyeOff, Link as LinkIcon, MoreVertical,
} from "lucide-react";
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
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/repository")({ component: RepositoryPage });

const CATEGORIES = ["Supplier", "Platform", "Social Media", "Banking", "Tools", "Other"] as const;
type Category = typeof CATEGORIES[number];

type Credential = {
  id: string;
  service_name: string;
  url: string | null;
  username: string | null;
  password: string | null;
  category: string;
  notes: string | null;
  created_at: string;
};

function RepositoryPage() {
  const [items, setItems] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState<string>("All");
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Credential | null>(null);
  const [deleting, setDeleting] = useState<Credential | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("credentials")
      .select("*")
      .is("deleted_at", null)
      .order("category")
      .order("service_name");
    if (error) toast.error(error.message);
    setItems((data ?? []) as Credential[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((c) => {
      if (activeCat !== "All" && c.category !== activeCat) return false;
      if (q) {
        const hay = `${c.service_name} ${c.username ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, search, activeCat]);

  function toggleReveal(id: string) {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function copy(text: string | null | undefined, label: string) {
    if (!text) return toast.error(`No ${label} to copy`);
    await navigator.clipboard.writeText(text);
    toast.success("Copied");
  }

  async function confirmDelete() {
    if (!deleting) return;
    const { error } = await supabase
      .from("credentials")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", deleting.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    setDeleting(null);
    load();
  }

  return (
    <AppShell>
      <header className="mb-3">
        <h1 className="text-2xl font-black tracking-tight">Repository</h1>
        <p className="text-sm text-muted-foreground">Accounts & credentials</p>
      </header>

      <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
        ⚠️ Passwords are stored unencrypted. Do not store high-security credentials here.
      </div>

      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by service or username..."
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
        <p className="mt-8 text-center text-sm text-muted-foreground">No credentials found.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => {
            const isShown = revealed.has(c.id);
            return (
              <div key={c.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-1 items-center gap-2">
                    <h3 className="text-sm font-bold">{c.service_name}</h3>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{c.category}</span>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Actions">
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setEditing(c)}>
                        <Pencil className="mr-2 h-4 w-4" />Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setDeleting(c)} className="text-destructive focus:text-destructive">
                        <Trash2 className="mr-2 h-4 w-4" />Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {c.username && (
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="truncate text-sm">{c.username}</span>
                    <button
                      onClick={() => copy(c.username, "username")}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label="Copy username"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                {c.password && (
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span className={cn("truncate text-sm", !isShown && "tracking-widest")}>
                      {isShown ? c.password : "••••••••"}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => toggleReveal(c.id)}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label={isShown ? "Hide password" : "Show password"}
                      >
                        {isShown ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        onClick={() => copy(c.password, "password")}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label="Copy password"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                {c.url && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <LinkIcon className="h-3 w-3 shrink-0" />
                    <span className="truncate">{c.url}</span>
                  </div>
                )}

                {c.notes && (
                  <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{c.notes}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Button
        size="icon"
        onClick={() => setCreateOpen(true)}
        className="fixed bottom-24 right-4 z-30 h-14 w-14 rounded-full shadow-xl md:bottom-8 md:right-8"
        aria-label="New credential"
      >
        <Plus className="h-6 w-6" />
      </Button>

      <CredentialDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={() => { setCreateOpen(false); load(); }}
      />
      <CredentialDialog
        open={!!editing}
        onOpenChange={(o) => { if (!o) setEditing(null); }}
        editing={editing}
        onSaved={() => { setEditing(null); load(); }}
      />

      <AlertDialog open={!!deleting} onOpenChange={(o) => { if (!o) setDeleting(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete credential?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove "{deleting?.service_name}" from the repository. This cannot be undone from the UI.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

function CredentialDialog({
  open, onOpenChange, editing, onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing?: Credential | null;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [serviceName, setServiceName] = useState("");
  const [category, setCategory] = useState<Category>("Other");
  const [url, setUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (editing) {
        setServiceName(editing.service_name);
        setCategory((CATEGORIES as readonly string[]).includes(editing.category) ? editing.category as Category : "Other");
        setUrl(editing.url ?? "");
        setUsername(editing.username ?? "");
        setPassword(editing.password ?? "");
        setNotes(editing.notes ?? "");
      } else {
        setServiceName(""); setCategory("Other"); setUrl("");
        setUsername(""); setPassword(""); setNotes("");
      }
    }
  }, [open, editing]);

  async function save() {
    if (!serviceName.trim()) return toast.error("Service name required");
    setSaving(true);
    const payload = {
      service_name: serviceName.trim(),
      category,
      url: url.trim() || null,
      username: username.trim() || null,
      password: password || null,
      notes: notes.trim() || null,
    };
    let error;
    if (editing) {
      ({ error } = await supabase.from("credentials").update(payload).eq("id", editing.id));
    } else {
      ({ error } = await supabase.from("credentials").insert({ ...payload, created_by: user?.id ?? null }));
    }
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit credential" : "New credential"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="svc">Service name</Label>
            <Input id="svc" value={serviceName} onChange={(e) => setServiceName(e.target.value)} placeholder="e.g. Square" />
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
            <Label htmlFor="url">URL</Label>
            <Input id="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
          </div>
          <div>
            <Label htmlFor="user">Username</Label>
            <Input id="user" value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="pw">Password</Label>
            <Input id="pw" type="text" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
