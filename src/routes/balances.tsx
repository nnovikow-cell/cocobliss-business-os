import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, MoreVertical } from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend, ReferenceLine,
} from "recharts";
import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { format, subMonths, subYears } from "date-fns";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/balances")({ component: BalancesPage });

type AccountType = "checking" | "savings" | "credit";
type Account = { id: string; name: string; type: AccountType; is_active: boolean; sort_order: number };
type Entry = {
  id: string;
  account_id: string;
  balance: number;
  logged_at: string;
  notes: string | null;
  balance_accounts: { name: string; type: AccountType } | null;
};

const TYPE_META: Record<AccountType, { label: string; badge: string; color: string }> = {
  checking: { label: "Checking", badge: "border-teal-500/30 bg-teal-500/15 text-teal-700 dark:text-teal-300", color: "#0d9488" },
  savings: { label: "Savings", badge: "border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300", color: "#10b981" },
  credit: { label: "Credit", badge: "border-red-500/30 bg-red-500/15 text-red-700 dark:text-red-300", color: "#f97316" },
};

type GraphMode = "per_account" | "net_worth";
type Range = "3m" | "6m" | "1y" | "all";

function fmtMoney(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function BalancesPage() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<GraphMode>("per_account");
  const [range, setRange] = useState<Range>("3m");

  const [logFor, setLogFor] = useState<Account | null>(null);
  const [logBalance, setLogBalance] = useState("");
  const [logDate, setLogDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [logNotes, setLogNotes] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<AccountType>("checking");

  const [editAcct, setEditAcct] = useState<Account | null>(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState<AccountType>("checking");

  const fetchData = async () => {
    setLoading(true);
    const [acctRes, entRes] = await Promise.all([
      supabase
        .from("balance_accounts")
        .select("*")
        .is("deleted_at", null)
        .order("sort_order"),
      supabase
        .from("balance_entries")
        .select("id, account_id, balance, logged_at, notes, balance_accounts(name, type)")
        .is("deleted_at", null)
        .order("logged_at", { ascending: false })
        .limit(500),
    ]);
    if (acctRes.error) toast.error(acctRes.error.message);
    if (entRes.error) toast.error(entRes.error.message);
    setAccounts((acctRes.data ?? []) as Account[]);
    setEntries((entRes.data ?? []) as unknown as Entry[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const latestByAccount = useMemo(() => {
    const m = new Map<string, Entry>();
    for (const e of entries) {
      const existing = m.get(e.account_id);
      if (!existing || new Date(e.logged_at) > new Date(existing.logged_at)) m.set(e.account_id, e);
    }
    return m;
  }, [entries]);

  const cutoffDate = useMemo(() => {
    if (range === "3m") return subMonths(new Date(), 3);
    if (range === "6m") return subMonths(new Date(), 6);
    if (range === "1y") return subYears(new Date(), 1);
    return null;
  }, [range]);

  const chartData = useMemo(() => {
    const inRange = entries.filter((e) => !cutoffDate || new Date(e.logged_at) >= cutoffDate);
    const dates = Array.from(new Set(inRange.map((e) => e.logged_at))).sort();
    if (dates.length === 0) return [];

    // For each account, build sorted entries asc (all-time, for carry forward)
    const byAcct = new Map<string, Entry[]>();
    for (const a of accounts) byAcct.set(a.id, []);
    for (const e of [...entries].sort((a, b) => a.logged_at.localeCompare(b.logged_at))) {
      if (byAcct.has(e.account_id)) byAcct.get(e.account_id)!.push(e);
    }

    const balanceAt = (acctId: string, date: string): number | null => {
      const arr = byAcct.get(acctId) ?? [];
      let val: number | null = null;
      for (const e of arr) {
        if (e.logged_at <= date) val = Number(e.balance);
        else break;
      }
      return val;
    };

    return dates.map((d) => {
      const row: Record<string, string | number> = { date: d, label: format(new Date(d), "MMM d") };
      if (mode === "per_account") {
        for (const a of accounts) {
          const v = balanceAt(a.id, d);
          if (v !== null) row[a.id] = v;
        }
      } else {
        let net = 0;
        for (const a of accounts) {
          const v = balanceAt(a.id, d) ?? 0;
          net += a.type === "credit" ? -v : v;
        }
        row.net = net;
      }
      return row;
    });
  }, [entries, accounts, cutoffDate, mode]);

  const submitLog = async () => {
    if (!logFor) return;
    const bal = parseFloat(logBalance);
    if (Number.isNaN(bal)) return toast.error("Enter a valid balance");
    const { error } = await supabase.from("balance_entries").insert({
      account_id: logFor.id,
      balance: bal,
      logged_at: logDate,
      notes: logNotes.trim() || null,
      created_by: user?.id ?? null,
    });
    if (error) return toast.error(error.message);
    toast.success("Balance logged");
    setLogFor(null);
    setLogBalance("");
    setLogNotes("");
    setLogDate(format(new Date(), "yyyy-MM-dd"));
    fetchData();
  };

  const submitCreate = async () => {
    if (!newName.trim()) return toast.error("Name required");
    const maxOrder = accounts.reduce((m, a) => Math.max(m, a.sort_order), 0);
    const { error } = await supabase.from("balance_accounts").insert({
      name: newName.trim(),
      type: newType,
      sort_order: maxOrder + 1,
    });
    if (error) return toast.error(error.message);
    toast.success("Account created");
    setCreateOpen(false);
    setNewName("");
    setNewType("checking");
    fetchData();
  };

  const submitEdit = async () => {
    if (!editAcct) return;
    const { error } = await supabase
      .from("balance_accounts")
      .update({ name: editName.trim(), type: editType })
      .eq("id", editAcct.id);
    if (error) return toast.error(error.message);
    toast.success("Account updated");
    setEditAcct(null);
    fetchData();
  };

  const deactivate = async (a: Account) => {
    const { error } = await supabase
      .from("balance_accounts")
      .update({ is_active: false })
      .eq("id", a.id);
    if (error) return toast.error(error.message);
    toast.success("Account deactivated");
    fetchData();
  };

  return (
    <AppShell>
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-black tracking-tight md:text-3xl">Balances</h1>
        <Button size="icon" onClick={() => setCreateOpen(true)} aria-label="Create account">
          <Plus className="h-4 w-4" />
        </Button>
      </header>

      {/* Section 1 - Account cards */}
      <section className="mb-6">
        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-32 animate-pulse rounded-2xl bg-muted/50" />
            ))}
          </div>
        ) : accounts.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            No accounts yet. Tap + to create one.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {accounts.map((a) => {
              const meta = TYPE_META[a.type];
              const latest = latestByAccount.get(a.id);
              const bal = latest ? Number(latest.balance) : 0;
              const isCredit = a.type === "credit";
              return (
                <div key={a.id} className="rounded-2xl border bg-card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-bold">{a.name}</span>
                        <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-semibold", meta.badge)}>
                          {meta.label}
                        </span>
                      </div>
                      <p className={cn("mt-2 text-2xl font-black tracking-tight", isCredit && "text-red-600 dark:text-red-400")}>
                        ${fmtMoney(bal)}
                      </p>
                      {latest && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          as of {format(new Date(latest.logged_at), "MMM d, yyyy")}
                        </p>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label="Account actions">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => {
                          setEditAcct(a);
                          setEditName(a.name);
                          setEditType(a.type);
                        }}>Edit</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => deactivate(a)}>Deactivate</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 w-full"
                    onClick={() => {
                      setLogFor(a);
                      setLogBalance("");
                      setLogNotes("");
                      setLogDate(format(new Date(), "yyyy-MM-dd"));
                    }}
                  >
                    Log Balance
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Section 2 - Graph */}
      <section className="rounded-2xl border bg-card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-1.5">
            {([
              { v: "per_account", l: "Per Account" },
              { v: "net_worth", l: "Net Worth" },
            ] as const).map((p) => (
              <button
                key={p.v}
                type="button"
                onClick={() => setMode(p.v)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                  mode === p.v
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                {p.l}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5">
            {(["3m", "6m", "1y", "all"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                  range === r
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                {r === "all" ? "All" : r}
              </button>
            ))}
          </div>
        </div>

        {chartData.length === 0 ? (
          <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            No data in range.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => `$${Number(v).toLocaleString()}`}
              />
              <Tooltip
                formatter={(value: number | string, name) => {
                  const num = Number(value);
                  const acct = accounts.find((a) => a.id === name);
                  return [`$${fmtMoney(num)}`, acct?.name ?? (name === "net" ? "Net Worth" : String(name))];
                }}
                labelFormatter={(_l, payload) => {
                  const d = payload?.[0]?.payload?.date as string | undefined;
                  return d ? format(new Date(d), "MMM d, yyyy") : "";
                }}
              />
              {mode === "per_account" ? (
                <>
                  <Legend formatter={(v) => accounts.find((a) => a.id === v)?.name ?? v} />
                  {accounts.map((a) => (
                    <Line
                      key={a.id}
                      type="monotone"
                      dataKey={a.id}
                      stroke={TYPE_META[a.type].color}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      connectNulls
                    />
                  ))}
                </>
              ) : (
                <>
                  <ReferenceLine y={0} strokeDasharray="3 3" className="stroke-muted-foreground" />
                  <Line
                    type="monotone"
                    dataKey="net"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={(props: { cx?: number; cy?: number; payload?: { net?: number }; index?: number }) => {
                      const { cx, cy, payload, index } = props;
                      const v = Number(payload?.net ?? 0);
                      return (
                        <circle
                          key={index}
                          cx={cx}
                          cy={cy}
                          r={3}
                          fill={v >= 0 ? "#10b981" : "#ef4444"}
                        />
                      );
                    }}
                  />
                </>
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
      </section>

      {/* Log Balance dialog */}
      <Dialog open={!!logFor} onOpenChange={(o) => !o && setLogFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log balance — {logFor?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Balance ($)</Label>
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={logBalance}
                onChange={(e) => setLogBalance(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={logDate} onChange={(e) => setLogDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={logNotes} onChange={(e) => setLogNotes(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLogFor(null)}>Cancel</Button>
            <Button onClick={submitLog}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create account dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create account</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Main Checking" />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={newType} onValueChange={(v) => setNewType(v as AccountType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="checking">Checking</SelectItem>
                  <SelectItem value="savings">Savings</SelectItem>
                  <SelectItem value="credit">Credit</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={submitCreate}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit account dialog */}
      <Dialog open={!!editAcct} onOpenChange={(o) => !o && setEditAcct(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit account</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={editType} onValueChange={(v) => setEditType(v as AccountType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="checking">Checking</SelectItem>
                  <SelectItem value="savings">Savings</SelectItem>
                  <SelectItem value="credit">Credit</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditAcct(null)}>Cancel</Button>
            <Button onClick={submitEdit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}