export const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n || 0);

export function computeTotals(args: {
  subtotal: number;
  appliesTax: boolean;
  taxRate: number; // percent
  tip?: number;
}) {
  const tax = args.appliesTax ? +(args.subtotal * (args.taxRate / 100)).toFixed(2) : 0;
  const tip = +(args.tip ?? 0).toFixed(2);
  const total = +(args.subtotal + tax + tip).toFixed(2);
  return { subtotal: +args.subtotal.toFixed(2), tax, tip, total };
}

export function computeTip(opt: { kind: "percent" | "fixed"; amount: number } | null, subtotal: number) {
  if (!opt) return 0;
  if (opt.kind === "percent") return +(subtotal * (opt.amount / 100)).toFixed(2);
  return +opt.amount.toFixed(2);
}