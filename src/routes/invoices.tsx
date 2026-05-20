import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, MoreVertical, Pencil, Trash2 } from "lucide-react";
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

type FilterKey = "all" | "unpaid" | "paid";

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtPaidAt(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtAmount(n: number): string {
  return `$${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>("all");

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
    setInvoices((data ?? []) as unknown as Invoice[]);
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

  const filtered = invoices
    .filter((inv) => {
      if (filter === "all") return true;
      if (filter === "paid") return inv.paid_at !== null;
      return inv.paid_at === null;
    })
    .sort((a, b) => {
      const aPaid = a.paid_at !== null;
      const bPaid = b.paid_at !== null;
      if (aPaid !== bPaid) return aPaid ? 1 : -1;
      // unpaid first, then due date asc (oldest first)
      return a.due_date.localeCompare(b.due_date);
    });

  return (
    <AppShell>
      <header className="mb-4">
        <h1 className="text-2xl font-black tracking-tight">Invoices</h1>
        <p className="text-sm text-muted-foreground">Market invoice log and payment tracking.</p>
      </header>

      <div className="mb-4 flex gap-2 overflow-x-auto">
        {([
          { k: "all", label: "All" },
          { k: "unpaid", label: "Unpaid" },
          { k: "paid", label: "Paid" },
        ] as { k: FilterKey; label: string }[]).map((p) => (
          <button
            key={p.k}
            onClick={() => setFilter(p.k)}
            className={cn(
              "shrink-0 rounded-full border-2 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors",
              filter === p.k
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:border-primary/50",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-center text-sm text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No invoices yet. Tap + to log your first one.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((inv) => {
            const paid = inv.paid_at !== null;
            const ev = inv.event_instances;
            const evName = ev?.event_series?.name ?? null;
            const evLoc = ev?.event_series?.location ?? null;
            return (
              <div
                key={inv.id}
                className={cn(
                  "rounded-2xl border p-4",
                  paid ? "border-border bg-card" : "border-amber-200 bg-amber-50",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-bold font-mono">{inv.invoice_number}</span>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                        paid ? "bg-emerald-100 text-emerald-700" : "bg-amber-200 text-amber-900",
                      )}
                    >
                      {paid ? "Paid" : "Unpaid"}
                    </span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Invoice actions">
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditing(inv)}>
                          <Pencil className="mr-2 h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setDeleteTarget(inv)} className="text-destructive focus:text-destructive">
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                <p className="mt-1 text-xs text-muted-foreground">
                  {ev && evName
                    ? `${evName} · ${fmtDate(ev.date)}${evLoc ? ` · ${evLoc}` : ""}`
                    : "No event linked"}
                </p>

                <div className="mt-2 flex items-baseline justify-between gap-2">
                  <span className="text-lg font-black">{fmtAmount(inv.amount)}</span>
                  <span className="text-xs text-muted-foreground">Due: {fmtDate(inv.due_date)}</span>
                </div>

                {paid ? (
                  <p className="mt-2 text-xs font-medium text-emerald-700/80">
                    Paid {fmtPaidAt(inv.paid_at!)}
                  </p>
                ) : (
                  <div className="mt-3">
                    <Button size="sm" className="rounded-full" onClick={() => setPayTarget(inv)}>
                      Mark Paid
                    </Button>
                  </div>
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
    if (!invoiceNumber.trim()) { toast.error("Invoice number is required"); return; }
    if (!amount || isNaN(Number(amount))) { toast.error("Valid amount required"); return; }
    if (!dueDate) { toast.error("Due date required"); return; }
    setSaving(true);
    const payload = {
      invoice_number: invoiceNumber.trim(),
      amount: Number(amount),
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
            <Label htmlFor="inv-num">Invoice Number</Label>
            <Input id="inv-num" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="inv-amt">Amount</Label>
            <div className="relative mt-1.5">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
              <Input
                id="inv-amt"
                type="number"
                inputMode="decimal"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-7"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="inv-due">Due Date</Label>
            <Input id="inv-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label>Event</Label>
            <div className="mt-1.5">
              <EventInstanceSelect
                value={eventInstanceId}
                onChange={(id) => setEventInstanceId(id)}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="inv-notes">Notes</Label>
            <Textarea id="inv-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1.5" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
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
  const [datePaid, setDatePaid] = useState<string>(todayISO());
  const [confirmation, setConfirmation] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (invoice) {
      setDatePaid(todayISO());
      setConfirmation("");
    }
  }, [invoice]);

  async function confirm() {
    if (!invoice) return;
    if (!datePaid) { toast.error("Pick a date"); return; }
    setSaving(true);
    const payload: { paid_at: string; notes?: string } = {
      paid_at: new Date(datePaid + "T12:00:00").toISOString(),
    };
    if (confirmation.trim()) payload.notes = confirmation.trim();
    const { error } = await supabase.from("invoices").update(payload).eq("id", invoice.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Invoice marked paid");
    onSaved();
  }

  return (
    <Dialog open={!!invoice} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Mark invoice paid</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="paid-date">Date paid</Label>
            <Input id="paid-date" type="date" value={datePaid} onChange={(e) => setDatePaid(e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="paid-conf">Confirmation / Notes</Label>
            <Input
              id="paid-conf"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder="Confirmation # or note (optional)"
              className="mt-1.5"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={confirm} disabled={saving}>{saving ? "Saving…" : "Confirm"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}