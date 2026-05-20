import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, MoreVertical, Pencil, Power, Landmark } from "lucide-react";
import { subMonths, subYears, format, parseISO } from "date-fns";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid, ReferenceLine,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/balances")({ component: BalancesPage });

type AccountType = "checking" | "savings" | "credit";
type Account = {
  id: string;
  name: string;
  type: AccountType;
  is_active: boolean;
  sort_order: number;
};
type Entry = {
  id: string;
  account_id: string;
  balance: number;
  logged_at: string;
  notes: string | null;
  created_at: string;
  balance_accounts: { name: string; type: AccountType } | null;
};

type ViewMode = "per_account" | "net_worth";
type RangeKey = "3m" | "6m" | "1y" | "all";

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtMoney(n: number): string {
  const abs = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${n < 0 ? "-" : ""}$${abs}`;
}

const TYPE_BADGE: Record<AccountType, string> = {
  checking: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  savings: "bg-green-500/15 text-green-600 dark:text-green-400",
  credit: "bg-red-500/15 text-red-600 dark:text-red-400",
};

const TYPE_BASE_COLOR: Record<AccountType, string> = {
  checking: "#0d9488",
  savings: "#10b981",
  credit: "#f97316",
};

// Vary lightness for multiple accounts of same type via simple hue rotation
function colorForAccount(account: Account, indexInType: number): string {
  const base = TYPE_BASE_COLOR[account.type];
  if (indexInType === 0) return base;
  // Shift alpha-like via simple darker/lighter variations
  const variants: Record<AccountType, string[]> = {
    checking: ["#0d9488", "#14b8a6", "#0f766e", "#5eead4"],
    savings: ["#10b981", "#059669", "#34d399", "#047857"],
    credit: ["#f97316", "#ea580c", "#fb923c", "#c2410c"],
  };
  const list = variants[account.type];
  return list[indexInType % list.length];
}

function BalancesPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  const [createAcctOpen, setCreateAcctOpen] = useState(false);
  const [editingAcct, setEditingAcct] = useState<Account | null>(null);
  const [logTarget, setLogTarget] = useState<Account | null>(null);

  const [view, setView] = useState<ViewMode>("per_account");
  const [range, setRange] = useState<RangeKey>("3m");

  async function load() {
    setLoading(true);
    const [a, e] = await Promise.all([
      supabase
        .from("balance_accounts")
        .select("*")
        .is("deleted_at", null)
        .eq("is_active", true)
        .order("sort_order"),
      supabase
        .from("balance_entries")
        .select("*, balance_accounts(name, type)")
        .is("deleted_at", null)
        .order("logged_at", { ascending: false })
        .limit(500),
    ]);
    if (a.error) toast.error(a.error.message);
    if (e.error) toast.error(e.error.message);
    setAccounts((a.data ?? []) as Account[]);
    setEntries((e.data ?? []) as unknown as Entry[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  // Latest entry per account
  const latestByAccount = useMemo(() => {
    const m = new Map<string, Entry>();
    for (const e of entries) {
      if (!m.has(e.account_id)) m.set(e.account_id, e);
    }
    return m;
  }, [entries]);

  // Filter entries by time range
  const rangeStart = useMemo(() => {
    const now = new Date();
    if (range === "3m") return subMonths(now, 3);
    if (range === "6m") return subMonths(now, 6);
    if (range === "1y") return subYears(now, 1);
    return null;
  }, [range]);

  const filteredEntries = useMemo(() => {
    if (!rangeStart) return entries;
    return entries.filter((e) => parseISO(e.logged_at) >= rangeStart);
  }, [entries, rangeStart]);

  // Per-account chart data: one row per date, one column per account
  const perAccountData = useMemo(() => {
    const dateSet = new Set<string>();
    for (const e of filteredEntries) dateSet.add(e.logged_at);
    const sortedDates = Array.from(dateSet).sort();
    return sortedDates.map((date) => {
      const row: Record<string, number | string> = { date };
      for (const acc of accounts) {
        const entryOnDate = filteredEntries.find(
          (e) => e.account_id === acc.id && e.logged_at === date,
        );
        if (entryOnDate) row[acc.id] = Number(entryOnDate.balance);
      }
      return row;
    });
  }, [filteredEntries, accounts]);

  // Net worth chart data with carry-forward
  const netWorthData = useMemo(() => {
    // Use ALL entries (not just filtered) for carry-forward to work before range start
    const dateSet = new Set<string>();
    for (const e of entries) dateSet.add(e.logged_at);
    const sortedDates = Array.from(dateSet).sort();
    const lastByAcct = new Map<string, number>();
    const series: { date: string; net: number }[] = [];
    for (const date of sortedDates) {
      // Update with any entries on this date
      for (const acc of accounts) {
        const onDate = entries.find((e) => e.account_id === acc.id && e.logged_at === date);
        if (onDate) lastByAcct.set(acc.id, Number(onDate.balance));
      }
      let net = 0;
      for (const acc of accounts) {
        const v = lastByAcct.get(acc.id);
        if (v === undefined) continue;
        if (acc.type === "credit") net -= v;
        else net += v;
      }
      series.push({ date, net });
    }
    if (!rangeStart) return series;
    return series.filter((p) => parseISO(p.date) >= rangeStart);
  }, [entries, accounts, rangeStart]);

  const netWorthColor = useMemo(() => {
    const last = netWorthData[netWorthData.length - 1];
    if (!last) return "#10b981";
    return last.net >= 0 ? "#10b981" : "#ef4444";
  }, [netWorthData]);

  // Account color map (indexed within type)
  const accountColors = useMemo(() => {
    const counts: Record<AccountType, number> = { checking: 0, savings: 0, credit: 0 };
    const m = new Map<string, string>();
    for (const a of accounts) {
      m.set(a.id, colorForAccount(a, counts[a.type]));
      counts[a.type] += 1;
    }
    return m;
  }, [accounts]);

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-5xl space-y-6 p-4 md:p-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight">Balances</h1>
            <p className="text-sm text-muted-foreground">Track account balances and net worth over time.</p>
          </div>
        </header>

        {/* Section 1: Account cards */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Accounts</h2>
            <Button size="sm" onClick={() => setCreateAcctOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Add account
            </Button>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : accounts.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-8 text-center">
              <Landmark className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No accounts yet. Add your first account to start tracking.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {accounts.map((acc) => {
                const latest = latestByAccount.get(acc.id);
                const bal = latest ? Number(latest.balance) : null;
                const isCredit = acc.type === "credit";
                return (
                  <div key={acc.id} className="rounded-lg border border-border bg-card p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 min-w-0">
                        <p className="text-sm font-bold truncate">{acc.name}</p>
                        <span className={cn("inline-block rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide", TYPE_BADGE[acc.type])}>
                          {acc.type}
                        </span>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 -mr-1 -mt-1">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditingAcct(acc)}>
                            <Pencil className="h-4 w-4 mr-2" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={async () => {
                              const { error } = await supabase
                                .from("balance_accounts")
                                .update({ is_active: false })
                                .eq("id", acc.id);
                              if (error) toast.error(error.message);
                              else {
                                toast.success("Account deactivated");
                                load();
                              }
                            }}
                          >
                            <Power className="h-4 w-4 mr-2" /> Deactivate
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div>
                      <p className={cn("text-2xl font-black tabular-nums", isCredit && "text-red-600 dark:text-red-400")}>
                        {bal === null ? "—" : fmtMoney(bal)}
                      </p>
                      {latest && (
                        <p className="text-xs text-muted-foreground">as of {format(parseISO(latest.logged_at), "MMM d, yyyy")}</p>
                      )}
                    </div>
                    <Button size="sm" variant="outline" className="w-full" onClick={() => setLogTarget(acc)}>
                      Log Balance
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Section 2: Graph */}
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-1 rounded-lg border border-border p-1">
              <button
                onClick={() => setView("per_account")}
                className={cn(
                  "rounded px-3 py-1 text-xs font-bold transition-colors",
                  view === "per_account" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                Per Account
              </button>
              <button
                onClick={() => setView("net_worth")}
                className={cn(
                  "rounded px-3 py-1 text-xs font-bold transition-colors",
                  view === "net_worth" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                Net Worth
              </button>
            </div>
            <div className="flex gap-1 rounded-lg border border-border p-1">
              {(["3m", "6m", "1y", "all"] as RangeKey[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={cn(
                    "rounded px-3 py-1 text-xs font-bold uppercase transition-colors",
                    range === r ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            {view === "per_account" ? (
              perAccountData.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">No entries in this range.</p>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={perAccountData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(d: string) => format(parseISO(d), "MMM d")}
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                    />
                    <YAxis
                      tickFormatter={(v: number) => `$${v.toLocaleString()}`}
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                    />
                    <Tooltip
                      formatter={(value: number, name: string) => {
                        const acc = accounts.find((a) => a.id === name);
                        return [fmtMoney(value), acc?.name ?? name];
                      }}
                      labelFormatter={(d: string) => format(parseISO(d), "MMM d, yyyy")}
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }}
                    />
                    <Legend
                      formatter={(value: string) => {
                        const acc = accounts.find((a) => a.id === value);
                        return acc?.name ?? value;
                      }}
                      wrapperStyle={{ fontSize: 12 }}
                    />
                    {accounts.map((acc) => (
                      <Line
                        key={acc.id}
                        type="monotone"
                        dataKey={acc.id}
                        stroke={accountColors.get(acc.id)}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              )
            ) : netWorthData.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">No entries in this range.</p>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={netWorthData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(d: string) => format(parseISO(d), "MMM d")}
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                  />
                  <YAxis
                    tickFormatter={(v: number) => `$${v.toLocaleString()}`}
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    label={{ value: "Net Worth", angle: -90, position: "insideLeft", style: { fill: "hsl(var(--muted-foreground))", fontSize: 12 } }}
                  />
                  <Tooltip
                    formatter={(value: number) => [fmtMoney(value), "Net Worth"]}
                    labelFormatter={(d: string) => format(parseISO(d), "MMM d, yyyy")}
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }}
                  />
                  <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" />
                  <Line
                    type="monotone"
                    dataKey="net"
                    stroke={netWorthColor}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>
      </div>

      <AccountDialog
        open={createAcctOpen}
        onOpenChange={setCreateAcctOpen}
        onSaved={load}
      />
      <AccountDialog
        open={!!editingAcct}
        onOpenChange={(o) => !o && setEditingAcct(null)}
        account={editingAcct}
        onSaved={() => {
          setEditingAcct(null);
          load();
        }}
      />
      <LogBalanceDialog
        account={logTarget}
        onOpenChange={(o) => !o && setLogTarget(null)}
        onSaved={() => {
          setLogTarget(null);
          load();
        }}
      />
    </AppShell>
  );
}

function AccountDialog({
  open,
  onOpenChange,
  account,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  account?: Account | null;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("checking");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(account?.name ?? "");
      setType(account?.type ?? "checking");
    }
  }, [open, account]);

  async function save() {
    if (!name.trim()) {
      toast.error("Account name is required");
      return;
    }
    setSaving(true);
    if (account) {
      const { error } = await supabase
        .from("balance_accounts")
        .update({ name: name.trim(), type })
        .eq("id", account.id);
      if (error) toast.error(error.message);
      else {
        toast.success("Account updated");
        onSaved();
      }
    } else {
      const { error } = await supabase
        .from("balance_accounts")
        .insert({ name: name.trim(), type });
      if (error) toast.error(error.message);
      else {
        toast.success("Account created");
        onSaved();
        onOpenChange(false);
      }
    }
    setSaving(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{account ? "Edit account" : "New account"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Account name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Chase Checking" />
          </div>
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as AccountType)}>
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
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LogBalanceDialog({
  account,
  onOpenChange,
  onSaved,
}: {
  account: Account | null;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  const [balance, setBalance] = useState("");
  const [date, setDate] = useState(todayISO());
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (account) {
      setBalance("");
      setDate(todayISO());
      setNotes("");
    }
  }, [account]);

  async function save() {
    if (!account) return;
    const num = Number(balance);
    if (!balance || Number.isNaN(num)) {
      toast.error("Enter a valid balance");
      return;
    }
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from("balance_entries").insert({
      account_id: account.id,
      balance: num,
      logged_at: date,
      notes: notes.trim() || null,
      created_by: userData.user?.id ?? null,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Balance logged");
      onSaved();
    }
    setSaving(false);
  }

  return (
    <Dialog open={!!account} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log balance{account ? ` — ${account.name}` : ""}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Balance</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
              <Input
                type="number"
                step="0.01"
                className="pl-7"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Notes (optional)</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}