import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, MoreVertical, Pencil, Trash2, FileText, CheckCircle2 } from "lucide-react";
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
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { fmt } from "@/lib/money";
import { EventInstanceSelect } from "@/components/inventory/event-instance-select";

export const Route = createFileRoute("/invoices")({ component: InvoicesPage });

type Invoice = {
  id: string;
  invoice_number: string;
  amount: number;
  due_date: string;
  paid_at: string | null;
  event_instance_id: string | null;
  notes: string | null;
  created_at: string;
  event_instances: {
    date: string;
    event_series: { name: string; location: string | null } | null;
  } | null;
};

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

type Filter = "all" | "unpaid" | "paid";

function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Invoice | null>(null);
  const [payTarget, setPayTarget] = useState<Invoice | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("invoices")
      .select("*, event_instances(date, event_series(name, location))")
      .is("deleted_at", null)
      .order("due_date", { ascending: false });
    if (error) toast.error(error.message);
    setInvoices(((data ?? []) as unknown) as Invoice[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleDelete() {
    if (!deleteTarget) return;
    const { error } = await supabase.from("invoices").update({ deleted_at: new Date().toISOString() }).eq("id", deleteTarget.id);
    if (error) return toast.error(error.message);
    setDeleteTarget(null);
    toast.success("Invoice deleted");
    load();
  }

  const filtered = invoices.filter((i) => {
    if (filter === "unpaid") return i.paid_at === null;
    if (filter === "paid") return i.paid_at !== null;
    return true;
  });
  // Unpaid float to top, then by due_date desc (already sorted by due_date desc)
  const sorted = [...filtered].sort((a, b) => {
    const aP = a.paid_at ? 1 : 0;
    const bP = b.paid_at ? 1 : 0;
    if (aP !== bP) return aP - bP;
    return b.due_date.localeCompare(a.due_date);
  });

  return (
    <AppShell>
      <header className="mb-4">
        <h1 className="text-2xl font-black tracking-tight">Invoices</h1>
        <p className="text-sm text-muted-foreground">Track invoices and payment status.</p>
      </header>

      <div className="mb-4 flex gap-2">
        {(["all", "unpaid", "paid"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-full border-2 px-3 py-1 text-xs font-bold uppercase tracking-wider transition-colors",
              filter === f ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-center text-sm text-muted-foreground">Loading…</p>
      ) : sorted.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No invoices yet. Tap + to add your first one.
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((i) => {
            const paid = i.paid_at !== null;
            const ev = i.event_instances;
            const series = ev?.event_series;
            return (
              <div
                key={i.id}
                className={cn(
                  "rounded-2xl border p-4",
                  paid ? "border-border bg-card" : "border-amber-200 bg-amber-50",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold">{i.invoice_number}</span>
                      <span className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                        paid ? "bg-emerald-100 text-emerald-700" : "bg-amber-200 text-amber-900",
                      )}>
                        {paid ? "Paid" : "Unpaid"}
                      </span>
                    </div>
                    {series && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {series.name}
                        {ev?.date ? ` · ${fmtDate(ev.date)}` : ""}
                        {series.location ? ` · ${series.location}` : ""}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                      <span className="font-black tabular-nums">{fmt(Number(i.amount))}</span>
                      <span className="text-xs text-muted-foreground">Due {fmtDate(i.due_date)}</span>
                    </div>
                    {paid && i.paid_at && (
                      <p className="mt-1 text-xs font-medium text-emerald-700">Paid {fmtDateTime(i.paid_at)}</p>
                    )}
                    {i.notes && (
                      <p className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">{i.notes}</p>
                    )}
                    {!paid && (
                      <Button size="sm" className="mt-3 h-8 rounded-full" onClick={() => setPayTarget(i)}>
                        <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Mark Paid
                      </Button>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Invoice actions">
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setEditing(i)}>
                        <Pencil className="mr-2 h-4 w-4" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setDeleteTarget(i)} className="text-destructive focus:text-destructive">
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Button
        size="icon"
        onClick={() => setCreateOpen(true)}
        className="fixed bottom-24 right-4 z-30 h-14 w-14 rounded-full shadow-xl md:bottom-8 md:right-8"
        aria-label="New invoice"
      >
        <Plus className="h-6 w-6" />
      </Button>

      <InvoiceDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={() => { setCreateOpen(false); load(); }}
      />
      <InvoiceDialog
        open={!!editing}
        onOpenChange={(o) => { if (!o) setEditing(null); }}
        editing={editing}
        onSaved={() => { setEditing(null); load(); }}
      />

      <MarkPaidDialog
        invoice={payTarget}
        onOpenChange={(o) => { if (!o) setPayTarget(null); }}
        onSaved={() => { setPayTarget(null); load(); }}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this invoice?</AlertDialogTitle>
            <AlertDialogDescription>This will remove the invoice from the list. This cannot be undone from the UI.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Avoid unused import warning */}
      <FileText className="hidden" />
    </AppShell>
  );
}

function InvoiceDialog({
  open, onOpenChange, editing, onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing?: Invoice | null;
  onSaved: () => void;
}) {
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [amount, setAmount] = useState<string>("");
  const [dueDate, setDueDate] = useState<string>(todayISO());
  const [eventInstanceId, setEventInstanceId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setInvoiceNumber(editing.invoice_number);
      setAmount(String(editing.amount));
      setDueDate(editing.due_date);
      setEventInstanceId(editing.event_instance_id);
      setNotes(editing.notes ?? "");
    } else {
      setInvoiceNumber("");
      setAmount("");
      setDueDate(todayISO());
      setEventInstanceId(null);
      setNotes("");
    }
  }, [open, editing]);

  async function save() {
    if (!invoiceNumber.trim()) { toast.error("Invoice number required"); return; }
    if (!dueDate) { toast.error("Due date required"); return; }
    setSaving(true);
    const payload = {
      invoice_number: invoiceNumber.trim(),
      amount: Number(amount) || 0,
      due_date: dueDate,
      event_instance_id: eventInstanceId,
      notes: notes.trim() || null,
    };
    let error;
    if (editing) {
      ({ error } = await supabase.from("invoices").update(payload).eq("id", editing.id));
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      ({ error } = await supabase.from("invoices").insert({ ...payload, created_by: user?.id ?? null }));
    }
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Invoice saved");
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit invoice" : "New invoice"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="inv-number">Invoice number</Label>
            <Input id="inv-number" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} className="mt-1.5 font-mono" />
          </div>
          <div>
            <Label htmlFor="inv-amount">Amount ($)</Label>
            <Input id="inv-amount" type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="inv-due">Due date</Label>
            <Input id="inv-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label>Event (optional)</Label>
            <div className="mt-1.5">
              <EventInstanceSelect value={eventInstanceId} onChange={(id) => setEventInstanceId(id)} />
            </div>
          </div>
          <div>
            <Label htmlFor="inv-notes">Notes</Label>
            <Textarea id="inv-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1.5" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MarkPaidDialog({
  invoice, onOpenChange, onSaved,
}: {
  invoice: Invoice | null;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  const [paidDate, setPaidDate] = useState<string>(todayISO());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (invoice) { setPaidDate(todayISO()); setNote(""); }
  }, [invoice]);

  async function save() {
    if (!invoice) return;
    setSaving(true);
    const paidAt = new Date(paidDate + "T12:00:00").toISOString();
    const newNotes = note.trim()
      ? (invoice.notes ? `${invoice.notes}\n\n[Paid] ${note.trim()}` : `[Paid] ${note.trim()}`)
      : invoice.notes;
    const { error } = await supabase.from("invoices")
      .update({ paid_at: paidAt, notes: newNotes }).eq("id", invoice.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Marked paid");
    onSaved();
  }

  return (
    <Dialog open={!!invoice} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Mark as paid</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="paid-date">Date paid</Label>
            <Input id="paid-date" type="date" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="paid-note">Confirmation note (optional)</Label>
            <Textarea id="paid-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} className="mt-1.5" placeholder="Check #, reference, etc." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Confirm"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}