export const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n || 0);

export function computeTotals(args: {
  subtotal: number;
  appliesTax: boolean;
  taxRate: number; // percent
}) {
  const tax = args.appliesTax ? +(args.subtotal * (args.taxRate / 100)).toFixed(2) : 0;
  const total = +(args.subtotal + tax).toFixed(2);
  return { subtotal: +args.subtotal.toFixed(2), tax, total };
}