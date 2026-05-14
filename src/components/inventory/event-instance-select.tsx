import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type Row = {
  id: string;
  date: string;
  status: "confirmed" | "not_attending" | "cancelled";
  series: { name: string; location: string | null } | null;
};

export function EventInstanceSelect({
  value,
  onChange,
  placeholder = "Select event…",
}: {
  value: string | null;
  onChange: (instanceId: string | null, row?: Row) => void;
  placeholder?: string;
}) {
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    (async () => {
      const today = format(new Date(), "yyyy-MM-dd");
      // Get a wide window: last 60 days through next 365 days
      const past = new Date(); past.setDate(past.getDate() - 60);
      const { data } = await supabase
        .from("event_instances")
        .select("id,date,status,series:event_series(name,location)")
        .gte("date", format(past, "yyyy-MM-dd"))
        .is("deleted_at", null)
        .order("date", { ascending: false })
        .limit(200);
      setRows((data ?? []) as unknown as Row[]);
      void today;
    })();
  }, []);

  return (
    <Select
      value={value ?? ""}
      onValueChange={(v) => {
        const r = rows.find((x) => x.id === v);
        onChange(v || null, r);
      }}
    >
      <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent className="max-h-80">
        {rows.length === 0 && (
          <div className="px-2 py-3 text-xs text-muted-foreground">No events yet.</div>
        )}
        {rows.map((r) => {
          const dim = r.status !== "confirmed";
          return (
            <SelectItem key={r.id} value={r.id} className={dim ? "opacity-50" : ""}>
              <span className="font-medium">{r.series?.name ?? "—"}</span>
              <span className="ml-2 text-xs text-muted-foreground">
                {format(parseISO(r.date), "MMM d, yyyy")}
                {r.series?.location ? ` · ${r.series.location}` : ""}
                {dim ? ` · ${r.status === "cancelled" ? "Cancelled" : "Not attending"}` : ""}
              </span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}