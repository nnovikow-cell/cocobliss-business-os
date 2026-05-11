import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Vertical wheel-style number picker. Drag, swipe, or scroll to pick a value.
 * Snaps to the nearest step. Designed for one-handed market use.
 */
export function WheelPicker({
  label,
  value,
  onChange,
  step = 1,
  min = 0,
  max = 100,
  suffix,
  itemHeight = 40,
  visible = 5,
}: {
  label?: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  suffix?: string;
  itemHeight?: number;
  visible?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const skipScroll = useRef(false);
  const decimals = step < 1 ? String(step).split(".")[1]?.length ?? 0 : 0;

  const items: number[] = [];
  for (let v = min; v <= max + 1e-9; v = +(v + step).toFixed(decimals)) items.push(+v.toFixed(decimals));

  const indexFor = (v: number) => {
    const i = Math.round((v - min) / step);
    return Math.max(0, Math.min(items.length - 1, i));
  };

  // Scroll to current value when value changes externally.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const target = indexFor(value) * itemHeight;
    if (Math.abs(el.scrollTop - target) > 1) {
      skipScroll.current = true;
      el.scrollTo({ top: target, behavior: "auto" });
      requestAnimationFrame(() => { skipScroll.current = false; });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, items.length]);

  // Snap on scroll end.
  const onScroll = () => {
    const el = ref.current;
    if (!el || skipScroll.current) return;
    window.clearTimeout((onScroll as any)._t);
    (onScroll as any)._t = window.setTimeout(() => {
      const i = Math.round(el.scrollTop / itemHeight);
      const clamped = Math.max(0, Math.min(items.length - 1, i));
      const next = items[clamped];
      if (next !== value) onChange(next);
      const snap = clamped * itemHeight;
      if (Math.abs(el.scrollTop - snap) > 0.5) el.scrollTo({ top: snap, behavior: "smooth" });
    }, 90);
  };

  const padHeight = ((visible - 1) / 2) * itemHeight;
  const containerHeight = visible * itemHeight;

  return (
    <div>
      {label && <div className="mb-1 text-sm font-medium">{label}</div>}
      <div className="relative overflow-hidden rounded-xl border-2 border-border bg-card">
        <div
          ref={ref}
          onScroll={onScroll}
          className="no-scrollbar overflow-y-scroll snap-y snap-mandatory"
          style={{ height: containerHeight, scrollSnapType: "y mandatory" }}
        >
          <div style={{ height: padHeight }} />
          {items.map((it) => (
            <div
              key={it}
              className={cn(
                "flex items-center justify-center snap-center tabular-nums transition-colors",
                it === value ? "text-foreground font-black text-2xl" : "text-muted-foreground/60 text-lg",
              )}
              style={{ height: itemHeight, scrollSnapAlign: "center" }}
              onClick={() => onChange(it)}
            >
              {it}
              {suffix && <span className="ml-1 text-xs font-medium">{suffix}</span>}
            </div>
          ))}
          <div style={{ height: padHeight }} />
        </div>
        {/* center selection indicator */}
        <div
          className="pointer-events-none absolute inset-x-0 border-y-2 border-primary/40"
          style={{ top: padHeight, height: itemHeight }}
        />
        {/* fade masks */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-card to-transparent"
          style={{ height: padHeight }}
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-card to-transparent"
          style={{ height: padHeight }}
        />
      </div>
    </div>
  );
}