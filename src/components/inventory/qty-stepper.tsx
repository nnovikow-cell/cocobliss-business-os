import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function QtyStepper({
  value,
  onChange,
  unit,
  step = 1,
}: {
  value: number;
  onChange: (n: number) => void;
  unit?: string;
  step?: number;
}) {
  const set = (n: number) => onChange(Math.max(0, n));
  return (
    <div className="inline-flex items-center gap-1.5">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-9 w-9 rounded-full"
        onClick={() => set(value - step)}
        disabled={value <= 0}
      >
        <Minus className="h-4 w-4" />
      </Button>
      <Input
        type="number"
        inputMode="decimal"
        value={value === 0 ? "" : String(value)}
        onChange={(e) => set(Number(e.target.value || 0))}
        placeholder="0"
        className="h-9 w-20 text-center font-semibold"
      />
      {unit && <span className="min-w-[2rem] text-xs text-muted-foreground">{unit}</span>}
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-9 w-9 rounded-full"
        onClick={() => set(value + step)}
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}