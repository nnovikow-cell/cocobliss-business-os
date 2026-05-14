import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Plus, MoreVertical, Check, RotateCcw, Repeat, Pencil, Trash2, Undo2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/tasks")({ component: TasksPage });

const CATEGORIES = ["Admin", "Finance", "Marketing", "Operations", "Sales", "Tech", "HR", "Other"] as const;
type Category = typeof CATEGORIES[number];

const CAT_COLOR: Record<Category, string> = {
  Admin: "#64748b",      // slate
  Finance: "#10b981",    // emerald
  Marketing: "#a855f7",  // purple
  Operations: "#f97316", // orange
  Sales: "#14b8a6",      // teal
  Tech: "#0ea5e9",       // sky
  HR: "#f43f5e",         // rose
  Other: "#9ca3af",      // gray
};

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAYS_FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

type Task = {
  id: string;
  title: string;
  assigned_day: number;
  assigned_week: string;
  category: string;
  owner: string | null;
  note: string | null;
  completed_day: number | null;
  completed_at: string | null;
  created_at: string;
  is_recurring: boolean;
  recurrence_id: string | null;
  recurrence_day: number | null;
};

type Series = {
  id: string;
  title: string;
  category: string;
  owner: string | null;
  note: string | null;
  recurrence_day: number;
  is_active: boolean;
  frequency: "daily" | "weekly" | "biweekly" | "monthly";
  created_at: string;
};

type Attendant = { id: string; name: string };

function mondayOf(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const dow = x.getDay(); // 0=Sun..6=Sat
  const diff = (dow + 6) % 7; // days since Monday
  x.setDate(x.getDate() - diff);
  return x;
}
function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function fmtRange(monday: Date): string {
  const sun = addDays(monday, 6);
  const sameMonth = monday.getMonth() === sun.getMonth();
  const opt: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const left = monday.toLocaleDateString("en-US", opt);
  const right = sameMonth
    ? sun.toLocaleDateString("en-US", { day: "numeric" })
    : sun.toLocaleDateString("en-US", opt);
  return `${left} – ${right}, ${sun.getFullYear()}`;
}
function fmtShort(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

function TasksPage() {
  const [weekStart, setWeekStart] = useState<Date>(() => mondayOf(new Date()));
  const weekISO = useMemo(() => toISODate(weekStart), [weekStart]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [attendants, setAttendants] = useState<Attendant[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [createOpen, setCreateOpen] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [seriesPrompt, setSeriesPrompt] = useState<{ kind: "edit" | "delete"; task: Task } | null>(null);
  const [seriesScope, setSeriesScope] = useState<"one" | "future" | "all">("one");

  async function loadAttendants() {
    const { data } = await supabase
      .from("attendants")
      .select("id,name")
      .eq("is_archived", false)
      .is("deleted_at", null)
      .order("sort_order");
    setAttendants((data ?? []) as Attendant[]);
  }

  async function generateRecurringForWeek(iso: string) {
    const { data: series } = await supabase
      .from("recurrence_series")
      .select("*")
      .eq("is_active", true);
    if (!series || series.length === 0) return;

    const { data: existing } = await supabase
      .from("tasks")
      .select("recurrence_id")
      .eq("assigned_week", iso)
      .not("recurrence_id", "is", null);
    const have = new Set((existing ?? []).map((t) => t.recurrence_id as string));

    const weekMonday = new Date(iso + "T00:00:00");
    type InsertRow = {
      title: string; category: string; owner: string | null; note: string | null;
      assigned_week: string; is_recurring: boolean; recurrence_id: string;
      recurrence_day: number; assigned_day: number;
    };
    const toInsert: InsertRow[] = [];

    for (const raw of series as Series[]) {
      if (have.has(raw.id)) continue;
      const freq = raw.frequency ?? "weekly";
      const base = {
        title: raw.title, category: raw.category, owner: raw.owner, note: raw.note,
        assigned_week: iso, is_recurring: true, recurrence_id: raw.id,
        recurrence_day: raw.recurrence_day,
      };

      if (freq === "daily") {
        for (let d = 0; d < 7; d++) toInsert.push({ ...base, assigned_day: d });
      } else if (freq === "weekly") {
        toInsert.push({ ...base, assigned_day: raw.recurrence_day });
      } else if (freq === "biweekly") {
        const anchor = mondayOf(new Date(raw.created_at));
        const weeks = Math.round((weekMonday.getTime() - anchor.getTime()) / (7 * 86400000));
        if (weeks >= 0 && weeks % 2 === 0) {
          toInsert.push({ ...base, assigned_day: raw.recurrence_day });
        }
      } else if (freq === "monthly") {
        const dom = raw.recurrence_day; // 1-31
        for (let d = 0; d < 7; d++) {
          const day = addDays(weekMonday, d);
          if (day.getDate() === dom) {
            toInsert.push({ ...base, assigned_day: d });
            break;
          }
        }
      }
    }
    if (toInsert.length) await supabase.from("tasks").insert(toInsert);
  }

  async function loadWeek(iso: string) {
    setLoading(true);
    await generateRecurringForWeek(iso);
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("assigned_week", iso)
      .order("created_at");
    if (error) toast.error(error.message);
    setTasks((data ?? []) as Task[]);
    setLoading(false);
  }

  useEffect(() => { loadAttendants(); }, []);
  useEffect(() => { loadWeek(weekISO); /* eslint-disable-next-line */ }, [weekISO]);

  const ownerName = (id: string | null) => attendants.find((a) => a.id === id)?.name ?? "—";

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  function isOverdue(t: Task): boolean {
    if (t.completed_at) return false;
    if (toISODate(weekStart) !== toISODate(mondayOf(today))) return false;
    const day = addDays(weekStart, t.assigned_day);
    return day < today;
  }

  async function toggleComplete(t: Task, done: boolean) {
    const patch = done
      ? { completed_at: new Date().toISOString(), completed_day: t.assigned_day }
      : { completed_at: null, completed_day: null };
    const { error } = await supabase.from("tasks").update(patch).eq("id", t.id);
    if (error) return toast.error(error.message);
    setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, ...patch } as Task : x)));
  }

  async function deleteOne(t: Task) {
    const { error } = await supabase.from("tasks").delete().eq("id", t.id);
    if (error) return toast.error(error.message);
    setTasks((prev) => prev.filter((x) => x.id !== t.id));
  }

  async function deleteSeries(t: Task, scope: "future" | "all") {
    if (!t.recurrence_id) return;
    // Mark inactive
    await supabase.from("recurrence_series").update({ is_active: false }).eq("id", t.recurrence_id);
    if (scope === "future") {
      await supabase
        .from("tasks")
        .delete()
        .eq("recurrence_id", t.recurrence_id)
        .gte("assigned_week", t.assigned_week)
        .is("completed_at", null);
    } else {
      await supabase
        .from("tasks")
        .delete()
        .eq("recurrence_id", t.recurrence_id)
        .is("completed_at", null);
    }
    await loadWeek(weekISO);
  }

  async function handleDeleteRequest(t: Task) {
    if (t.is_recurring && t.recurrence_id) {
      setSeriesScope("one");
      setSeriesPrompt({ kind: "delete", task: t });
    } else {
      await deleteOne(t);
    }
  }

  async function confirmSeriesAction() {
    if (!seriesPrompt) return;
    const { kind, task } = seriesPrompt;
    if (kind === "delete") {
      if (seriesScope === "one") await deleteOne(task);
      else await deleteSeries(task, seriesScope);
    } else {
      // edit: open edit dialog with scope flag stored on task
      setEditTask({ ...task, _scope: seriesScope } as Task & { _scope: string });
    }
    setSeriesPrompt(null);
  }

  function handleEditRequest(t: Task) {
    if (t.is_recurring && t.recurrence_id) {
      setSeriesScope("one");
      setSeriesPrompt({ kind: "edit", task: t });
    } else {
      setEditTask(t);
    }
  }

  const pending = tasks.filter((t) => !t.completed_at);
  const completed = tasks.filter((t) => !!t.completed_at);
  const byDay = (list: Task[], d: number) => list.filter((t) => t.assigned_day === d);

  return (
    <AppShell>
      <header className="mb-4 flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Tasks</h1>
          <p className="text-sm text-muted-foreground">{fmtRange(weekStart)}</p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={() => setWeekStart((w) => addDays(w, -7))} aria-label="Previous week">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setWeekStart(mondayOf(new Date()))}>
            Today
          </Button>
          <Button variant="outline" size="icon" onClick={() => setWeekStart((w) => addDays(w, 7))} aria-label="Next week">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Column
          title="Pending"
          weekStart={weekStart}
          renderCard={(t) => (
            <PendingCard
              key={t.id}
              task={t}
              owner={ownerName(t.owner)}
              overdue={isOverdue(t)}
              onComplete={() => toggleComplete(t, true)}
              onEdit={() => handleEditRequest(t)}
              onDelete={() => handleDeleteRequest(t)}
            />
          )}
          getDayItems={(d) => byDay(pending, d)}
        />
        <Column
          title="Completed"
          weekStart={weekStart}
          renderCard={(t) => (
            <CompletedCard
              key={t.id}
              task={t}
              owner={ownerName(t.owner)}
              onUndo={() => toggleComplete(t, false)}
              onEdit={() => handleEditRequest(t)}
              onDelete={() => handleDeleteRequest(t)}
            />
          )}
          getDayItems={(d) => byDay(completed, d)}
        />
      </div>

      {loading && <p className="mt-6 text-center text-sm text-muted-foreground">Loading…</p>}

      <Button
        size="icon"
        onClick={() => setCreateOpen(true)}
        className="fixed bottom-24 right-4 z-30 h-14 w-14 rounded-full shadow-xl md:bottom-8 md:right-8"
        aria-label="New task"
      >
        <Plus className="h-6 w-6" />
      </Button>

      <TaskDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        attendants={attendants}
        weekISO={weekISO}
        onSaved={() => loadWeek(weekISO)}
      />

      <TaskDialog
        open={!!editTask}
        onOpenChange={(o) => { if (!o) setEditTask(null); }}
        attendants={attendants}
        weekISO={weekISO}
        editing={editTask}
        onSaved={() => { setEditTask(null); loadWeek(weekISO); }}
      />

      <Dialog open={!!seriesPrompt} onOpenChange={(o) => { if (!o) setSeriesPrompt(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {seriesPrompt?.kind === "edit" ? "Edit recurring task" : "Delete recurring task"}
            </DialogTitle>
            <DialogDescription>
              {seriesPrompt?.kind === "edit"
                ? "This is a recurring task. What would you like to change?"
                : "This is a recurring task. What would you like to delete? Completed instances are kept as a historical record."}
            </DialogDescription>
          </DialogHeader>
          <RadioGroup value={seriesScope} onValueChange={(v) => setSeriesScope(v as typeof seriesScope)} className="space-y-2 py-2">
            <label className="flex cursor-pointer items-center gap-3 rounded-md border border-border p-3">
              <RadioGroupItem value="one" id="one" />
              <span className="text-sm font-medium">This task only</span>
            </label>
            <label className="flex cursor-pointer items-center gap-3 rounded-md border border-border p-3">
              <RadioGroupItem value="future" id="future" />
              <span className="text-sm font-medium">This and all future tasks</span>
            </label>
            <label className="flex cursor-pointer items-center gap-3 rounded-md border border-border p-3">
              <RadioGroupItem value="all" id="all" />
              <span className="text-sm font-medium">All tasks in this series</span>
            </label>
          </RadioGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSeriesPrompt(null)}>Cancel</Button>
            <Button
              variant={seriesPrompt?.kind === "delete" ? "destructive" : "default"}
              onClick={confirmSeriesAction}
            >
              {seriesPrompt?.kind === "delete" ? "Delete" : "Continue"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function Column({
  title, weekStart, getDayItems, renderCard,
}: {
  title: string;
  weekStart: Date;
  getDayItems: (d: number) => Task[];
  renderCard: (t: Task) => React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card">
      <header className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">{title}</h2>
      </header>
      <div className="divide-y divide-border">
        {Array.from({ length: 7 }).map((_, d) => {
          const date = addDays(weekStart, d);
          const items = getDayItems(d);
          return (
            <div key={d} className="px-4 py-3">
              <div className="mb-2 flex items-baseline justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-foreground">{DAYS_FULL[d]}</span>
                <span className="text-[11px] text-muted-foreground">{fmtShort(date)}</span>
              </div>
              {items.length === 0 ? (
                <p className="text-xs text-muted-foreground/60">—</p>
              ) : (
                <div className="space-y-2">{items.map(renderCard)}</div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function CardMenu({
  onEdit, onComplete, onUndo, onDelete,
}: {
  onEdit: () => void;
  onComplete?: () => void;
  onUndo?: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Task actions"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onClick={onEdit}><Pencil className="mr-2 h-4 w-4" />Edit</DropdownMenuItem>
        {onComplete && <DropdownMenuItem onClick={onComplete}><Check className="mr-2 h-4 w-4" />Mark Done</DropdownMenuItem>}
        {onUndo && <DropdownMenuItem onClick={onUndo}><Undo2 className="mr-2 h-4 w-4" />Move to Pending</DropdownMenuItem>}
        <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
          <Trash2 className="mr-2 h-4 w-4" />Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PendingCard({
  task, owner, overdue, onComplete, onEdit, onDelete,
}: {
  task: Task; owner: string; overdue: boolean;
  onComplete: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const color = CAT_COLOR[(task.category as Category)] ?? CAT_COLOR.Other;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onComplete}
      onKeyDown={(e) => { if (e.key === "Enter") onComplete(); }}
      className={cn(
        "group flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted/50",
        overdue && "bg-destructive/10 border-destructive/30",
      )}
    >
      <span
        className="mt-1.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
        aria-label={task.category}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-semibold">{task.title}</p>
          {task.is_recurring && <Repeat className="h-3 w-3 shrink-0 text-muted-foreground/70" aria-label="Recurring" />}
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{owner}</p>
      </div>
      <CardMenu onEdit={onEdit} onComplete={onComplete} onDelete={onDelete} />
    </div>
  );
}

function CompletedCard({
  task, owner, onUndo, onEdit, onDelete,
}: {
  task: Task; owner: string;
  onUndo: () => void; onEdit: () => void; onDelete: () => void;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3">
      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-medium text-muted-foreground line-through">{task.title}</p>
          {task.is_recurring && <Repeat className="h-3 w-3 shrink-0 text-muted-foreground/70" />}
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{owner}</p>
      </div>
      <CardMenu onEdit={onEdit} onUndo={onUndo} onDelete={onDelete} />
    </div>
  );
}

function TaskDialog({
  open, onOpenChange, attendants, weekISO, editing, onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  attendants: Attendant[];
  weekISO: string;
  editing?: (Task & { _scope?: string }) | null;
  onSaved: () => void;
}) {
  const isEdit = !!editing;
  const [title, setTitle] = useState("");
  const [day, setDay] = useState<number>(0);
  const [category, setCategory] = useState<Category>("Operations");
  const [owner, setOwner] = useState<string>("");
  const [note, setNote] = useState("");
  const [recurring, setRecurring] = useState(false);
  const [frequency, setFrequency] = useState<"daily" | "weekly" | "biweekly" | "monthly">("weekly");
  const [monthlyDom, setMonthlyDom] = useState<number>(1);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (editing) {
        setTitle(editing.title);
        setDay(editing.assigned_day);
        setCategory((editing.category as Category) ?? "Other");
        setOwner(editing.owner ?? "");
        setNote(editing.note ?? "");
        setRecurring(editing.is_recurring);
        setFrequency("weekly");
        setMonthlyDom(1);
      } else {
        setTitle(""); setDay(0); setCategory("Operations"); setOwner(""); setNote(""); setRecurring(false);
        setFrequency("weekly"); setMonthlyDom(1);
      }
    }
  }, [open, editing]);

  async function save() {
    if (!title.trim()) { toast.error("Title is required"); return; }
    setSaving(true);
    try {
      if (!isEdit) {
        // Create
        let recurrence_id: string | null = null;
        if (recurring) {
          const seriesDay = frequency === "monthly" ? monthlyDom : day;
          const { data: s, error: se } = await supabase
            .from("recurrence_series")
            .insert({
              title: title.trim(), category, owner: owner || null, note: note || null,
              recurrence_day: seriesDay, is_active: true, frequency,
            })
            .select("id").single();
          if (se) throw se;
          recurrence_id = s.id;
        }
        const { error } = await supabase.from("tasks").insert({
          title: title.trim(),
          assigned_day: day,
          assigned_week: weekISO,
          category,
          owner: owner || null,
          note: note || null,
          is_recurring: recurring,
          recurrence_id,
          recurrence_day: recurring ? (frequency === "monthly" ? monthlyDom : day) : null,
        });
        if (error) throw error;
        toast.success("Task created");
      } else {
        const scope = editing?._scope ?? "one";
        const patch = {
          title: title.trim(),
          assigned_day: day,
          category,
          owner: owner || null,
          note: note || null,
        };
        if (scope === "one" || !editing?.recurrence_id) {
          const { error } = await supabase.from("tasks").update(patch).eq("id", editing!.id);
          if (error) throw error;
        } else if (scope === "future") {
          // Update this + future incomplete instances + the series
          await supabase.from("tasks").update(patch)
            .eq("recurrence_id", editing!.recurrence_id)
            .gte("assigned_week", editing!.assigned_week)
            .is("completed_at", null);
          await supabase.from("recurrence_series").update({
            title: patch.title, category: patch.category, owner: patch.owner, note: patch.note,
            recurrence_day: day,
          }).eq("id", editing!.recurrence_id);
        } else {
          // all incomplete + series
          await supabase.from("tasks").update(patch)
            .eq("recurrence_id", editing!.recurrence_id)
            .is("completed_at", null);
          await supabase.from("recurrence_series").update({
            title: patch.title, category: patch.category, owner: patch.owner, note: patch.note,
            recurrence_day: day,
          }).eq("id", editing!.recurrence_id);
        }
        toast.success("Task updated");
      }
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit task" : "New task"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs to get done?" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Day</Label>
              <Select value={String(day)} onValueChange={(v) => setDay(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DAYS_FULL.map((n, i) => <SelectItem key={i} value={String(i)}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      <span className="flex items-center gap-2">
                        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CAT_COLOR[c] }} />
                        {c}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Owner</Label>
            <Select value={owner} onValueChange={setOwner}>
              <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
              <SelectContent>
                {attendants.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Note (optional)</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </div>
          {!isEdit && (
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <div>
                <Label className="text-sm">Recurring</Label>
                {recurring && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {frequency === "daily" && "Repeats every day"}
                    {frequency === "weekly" && `Repeats every ${DAYS_FULL[day]}`}
                    {frequency === "biweekly" && `Repeats every other ${DAYS_FULL[day]}`}
                    {frequency === "monthly" && `Repeats monthly on the ${ordinal(monthlyDom)}`}
                  </p>
                )}
              </div>
              <Switch checked={recurring} onCheckedChange={setRecurring} />
            </div>
          )}
          {!isEdit && recurring && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Frequency</Label>
                <Select value={frequency} onValueChange={(v) => setFrequency(v as typeof frequency)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="biweekly">Biweekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {frequency === "monthly" && (
                <div>
                  <Label>Day of month</Label>
                  <Select value={String(monthlyDom)} onValueChange={(v) => setMonthlyDom(Number(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 31 }, (_, i) => i + 1).map((n) => (
                        <SelectItem key={n} value={String(n)}>{ordinal(n)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            <RotateCcw className={cn("mr-2 h-4 w-4 hidden", saving && "inline animate-spin")} />
            {isEdit ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}