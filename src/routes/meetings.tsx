import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, MoreVertical, Pencil, Trash2, Plus as PlusIcon } from "lucide-react";
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
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/meetings")({ component: MeetingsPage });

type ActionItem = { text: string; owner: string; due_date: string | null };

type Meeting = {
  id: string;
  meeting_date: string;
  attendee_ids: string[];
  attendee_names_snapshot: string[];
  topics_discussed: string | null;
  decisions: string[];
  action_items: ActionItem[];
  next_meeting_topics: string | null;
  created_at: string;
};

type Attendant = { id: string; name: string; first_name: string | null; last_name: string | null };

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fmtDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

function fmtDue(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function MeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [attendants, setAttendants] = useState<Attendant[]>([]);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Meeting | null>(null);
  const [reading, setReading] = useState<Meeting | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Meeting | null>(null);

  async function load() {
    setLoading(true);
    const [{ data: m, error }, { data: a }] = await Promise.all([
      supabase.from("meetings").select("*").is("deleted_at", null).order("meeting_date", { ascending: false }),
      supabase.from("attendants").select("id,name,first_name,last_name").eq("active", true).order("first_name"),
    ]);
    if (error) toast.error(error.message);
    setMeetings(((m ?? []) as unknown) as Meeting[]);
    setAttendants((a ?? []) as Attendant[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleDelete() {
    if (!deleteTarget) return;
    const { error } = await supabase.from("meetings").update({ deleted_at: new Date().toISOString() }).eq("id", deleteTarget.id);
    if (error) return toast.error(error.message);
    setDeleteTarget(null);
    toast.success("Meeting deleted");
    load();
  }

  const lastNextTopics = meetings[0]?.next_meeting_topics ?? "";

  return (
    <AppShell>
      <header className="mb-4">
        <h1 className="text-2xl font-black tracking-tight">Meetings</h1>
        <p className="text-sm text-muted-foreground">Decisions, action items, and meeting history.</p>
      </header>

      {loading ? (
        <p className="text-center text-sm text-muted-foreground">Loading…</p>
      ) : meetings.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No meetings yet. Tap + to log your first one.
        </div>
      ) : (
        <div className="space-y-3">
          {meetings.map((m) => (
            <button
              key={m.id}
              onClick={() => setReading(m)}
              className="block w-full rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/50"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold">{fmtDate(m.meeting_date)}</span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {m.attendee_names_snapshot.length} {m.attendee_names_snapshot.length === 1 ? "attendee" : "attendees"}
                    </span>
                  </div>
                  {m.attendee_names_snapshot.length > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">{m.attendee_names_snapshot.join(", ")}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {m.decisions.length > 0 && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                        {m.decisions.length} {m.decisions.length === 1 ? "decision" : "decisions"}
                      </span>
                    )}
                    {m.action_items.length > 0 && (
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-foreground">
                        {m.action_items.length} {m.action_items.length === 1 ? "action item" : "action items"}
                      </span>
                    )}
                  </div>
                </div>
                <div onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Meeting actions">
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setEditing(m)}>
                        <Pencil className="mr-2 h-4 w-4" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setDeleteTarget(m)} className="text-destructive focus:text-destructive">
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      <Button
        size="icon"
        onClick={() => setCreateOpen(true)}
        className="fixed bottom-24 right-4 z-30 h-14 w-14 rounded-full shadow-xl md:bottom-8 md:right-8"
        aria-label="New meeting"
      >
        <Plus className="h-6 w-6" />
      </Button>

      <MeetingDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        attendants={attendants}
        defaultNextTopics={lastNextTopics ?? ""}
        onSaved={() => { setCreateOpen(false); load(); }}
      />

      <MeetingDialog
        open={!!editing}
        onOpenChange={(o) => { if (!o) setEditing(null); }}
        attendants={attendants}
        editing={editing}
        onSaved={() => { setEditing(null); load(); }}
      />

      <Sheet open={!!reading} onOpenChange={(o) => { if (!o) setReading(null); }}>
        <SheetContent side="bottom" className="h-[100dvh] overflow-y-auto">
          {reading && (
            <>
              <SheetHeader className="text-left">
                <div className="flex items-center justify-between gap-2">
                  <SheetTitle className="text-2xl font-black tracking-tight">{fmtDate(reading.meeting_date)}</SheetTitle>
                  <Button variant="outline" size="sm" onClick={() => { const m = reading; setReading(null); setEditing(m); }}>
                    <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
                  </Button>
                </div>
              </SheetHeader>
              <div className="mt-6 space-y-6">
                <section>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Attendees</h3>
                  <p className="mt-1 text-sm">
                    {reading.attendee_names_snapshot.length > 0 ? reading.attendee_names_snapshot.join(", ") : "—"}
                  </p>
                </section>

                {reading.topics_discussed && (
                  <section>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Topics Discussed</h3>
                    <p className="mt-1 whitespace-pre-wrap text-sm">{reading.topics_discussed}</p>
                  </section>
                )}

                {reading.decisions.length > 0 && (
                  <section>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Decisions</h3>
                    <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
                      {reading.decisions.map((d, i) => (<li key={i}>{d}</li>))}
                    </ol>
                  </section>
                )}

                {reading.action_items.length > 0 && (
                  <section>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Action Items</h3>
                    <ul className="mt-2 space-y-2">
                      {reading.action_items.map((a, i) => (
                        <li key={i} className="rounded-xl border border-border bg-card p-3">
                          <p className="text-sm font-medium">{a.text}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {a.owner || "Unassigned"}
                            {a.due_date ? ` · Due: ${fmtDue(a.due_date)}` : ""}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {reading.next_meeting_topics && (
                  <section>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Next Meeting Topics</h3>
                    <div className="mt-2 rounded-xl border border-primary/20 bg-primary/5 p-3">
                      <p className="whitespace-pre-wrap text-sm">{reading.next_meeting_topics}</p>
                    </div>
                  </section>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this meeting?</AlertDialogTitle>
            <AlertDialogDescription>This will remove the meeting from history. This cannot be undone from the UI.</AlertDialogDescription>
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

function MeetingDialog({
  open, onOpenChange, attendants, editing, defaultNextTopics, onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  attendants: Attendant[];
  editing?: Meeting | null;
  defaultNextTopics?: string;
  onSaved: () => void;
}) {
  const [meetingDate, setMeetingDate] = useState<string>(todayISO());
  const [attendeeIds, setAttendeeIds] = useState<string[]>([]);
  const [topics, setTopics] = useState<string>("");
  const [decisions, setDecisions] = useState<string[]>([""]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([{ text: "", owner: "", due_date: null }]);
  const [nextTopics, setNextTopics] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setMeetingDate(editing.meeting_date);
      setAttendeeIds(editing.attendee_ids);
      setTopics(editing.topics_discussed ?? "");
      setDecisions(editing.decisions.length ? editing.decisions : [""]);
      setActionItems(editing.action_items.length ? editing.action_items : [{ text: "", owner: "", due_date: null }]);
      setNextTopics(editing.next_meeting_topics ?? "");
    } else {
      setMeetingDate(todayISO());
      setAttendeeIds([]);
      setTopics("");
      setDecisions([""]);
      setActionItems([{ text: "", owner: "", due_date: null }]);
      setNextTopics(defaultNextTopics ?? "");
    }
  }, [open, editing, defaultNextTopics]);

  const attendantLabel = (a: Attendant) =>
    [a.first_name, a.last_name].filter(Boolean).join(" ").trim() || a.name;

  async function save() {
    if (!meetingDate) { toast.error("Pick a meeting date"); return; }
    setSaving(true);
    const selected = attendants.filter((a) => attendeeIds.includes(a.id));
    const cleanDecisions = decisions.map((s) => s.trim()).filter(Boolean);
    const cleanActions = actionItems
      .map((a) => ({ text: a.text.trim(), owner: a.owner.trim(), due_date: a.due_date || null }))
      .filter((a) => a.text.length > 0);

    const payload = {
      meeting_date: meetingDate,
      attendee_ids: attendeeIds,
      attendee_names_snapshot: selected.map(attendantLabel),
      topics_discussed: topics.trim() || null,
      decisions: cleanDecisions,
      action_items: cleanActions,
      next_meeting_topics: nextTopics.trim() || null,
    };

    let error;
    if (editing) {
      ({ error } = await supabase.from("meetings").update(payload).eq("id", editing.id));
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      ({ error } = await supabase.from("meetings").insert({ ...payload, created_by: user?.id ?? null }));
    }
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Meeting saved");
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit meeting" : "New meeting"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="meeting-date">Meeting Date</Label>
            <Input id="meeting-date" type="date" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} className="mt-1.5" />
          </div>

          {attendants.length > 0 && (
            <div>
              <Label>Attendees</Label>
              <div className="mt-1.5 space-y-1.5">
                {attendants.map((a) => {
                  const on = attendeeIds.includes(a.id);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setAttendeeIds((prev) => on ? prev.filter((x) => x !== a.id) : [...prev, a.id])}
                      className={cn(
                        "flex w-full items-center justify-between rounded-xl border-2 px-3 py-2 text-left text-sm font-semibold",
                        on ? "border-primary bg-primary/10" : "border-border bg-card",
                      )}
                    >
                      <span>{attendantLabel(a)}</span>
                      <span className={cn(
                        "flex h-5 w-5 items-center justify-center rounded border-2",
                        on ? "border-primary bg-primary text-primary-foreground" : "border-border",
                      )}>
                        {on && "✓"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="topics">Topics Discussed</Label>
            <Textarea id="topics" rows={3} value={topics} onChange={(e) => setTopics(e.target.value)} className="mt-1.5" />
          </div>

          <div>
            <Label>Decisions</Label>
            <div className="mt-1.5 space-y-2">
              {decisions.map((d, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={d}
                    placeholder={`Decision ${i + 1}`}
                    onChange={(e) => setDecisions((prev) => prev.map((x, j) => j === i ? e.target.value : x))}
                  />
                  <Button type="button" variant="ghost" size="icon" onClick={() => setDecisions((prev) => prev.length === 1 ? [""] : prev.filter((_, j) => j !== i))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => setDecisions((prev) => [...prev, ""])}>
                <PlusIcon className="mr-1.5 h-3.5 w-3.5" /> Add decision
              </Button>
            </div>
          </div>

          <div>
            <Label>Action Items</Label>
            <div className="mt-1.5 space-y-2">
              {actionItems.map((a, i) => (
                <div key={i} className="space-y-1.5 rounded-xl border border-border p-2">
                  <div className="flex items-center gap-2">
                    <Input
                      value={a.text}
                      placeholder="What needs doing"
                      onChange={(e) => setActionItems((prev) => prev.map((x, j) => j === i ? { ...x, text: e.target.value } : x))}
                    />
                    <Button type="button" variant="ghost" size="icon" onClick={() => setActionItems((prev) => prev.length === 1 ? [{ text: "", owner: "", due_date: null }] : prev.filter((_, j) => j !== i))}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      value={a.owner}
                      placeholder="Owner"
                      onChange={(e) => setActionItems((prev) => prev.map((x, j) => j === i ? { ...x, owner: e.target.value } : x))}
                    />
                    <Input
                      type="date"
                      value={a.due_date ?? ""}
                      onChange={(e) => setActionItems((prev) => prev.map((x, j) => j === i ? { ...x, due_date: e.target.value || null } : x))}
                    />
                  </div>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => setActionItems((prev) => [...prev, { text: "", owner: "", due_date: null }])}>
                <PlusIcon className="mr-1.5 h-3.5 w-3.5" /> Add action item
              </Button>
            </div>
          </div>

          <div>
            <Label htmlFor="next-topics">Next Meeting Topics</Label>
            <Textarea id="next-topics" rows={3} value={nextTopics} onChange={(e) => setNextTopics(e.target.value)} className="mt-1.5" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save meeting"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}