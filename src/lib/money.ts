export const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n || 0);

export function computeTotals(args: {
  subtotal: number;
  appliesTax: boolean;
  taxRate: number; // percent
  tip?: number;
  discount?: number;
}) {
  const discount = Math.min(+(args.discount ?? 0).toFixed(2), +args.subtotal.toFixed(2));
  const taxable = Math.max(0, args.subtotal - discount);
  const tax = args.appliesTax ? +(taxable * (args.taxRate / 100)).toFixed(2) : 0;
  const tip = +(args.tip ?? 0).toFixed(2);
  const total = +(taxable + tax + tip).toFixed(2);
  return { subtotal: +args.subtotal.toFixed(2), discount: +discount.toFixed(2), tax, tip, total };
}

export function computeTip(opt: { kind: "percent" | "fixed"; amount: number } | null, subtotal: number) {
  if (!opt) return 0;
  if (opt.kind === "percent") return +(subtotal * (opt.amount / 100)).toFixed(2);
  return +opt.amount.toFixed(2);
}

export function computeDiscount(opt: { kind: "percent" | "fixed"; amount: number } | null, subtotal: number) {
  if (!opt) return 0;
  if (opt.kind === "percent") return +(subtotal * (opt.amount / 100)).toFixed(2);
  return +Math.min(opt.amount, subtotal).toFixed(2);
}