import { useEffect, useMemo, useState } from "react";
import { Plus, Minus, X, Check, Users, User, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { fmt, computeTotals, computeTip, computeDiscount } from "@/lib/money";
import {
  type Product, type Flavor, type PaymentMethod, type DemographicOption,
  type TipOption, type DiscountOption,
  type CartLine, type CustomerCart, lineTotal, cartSubtotal,
} from "@/lib/sales-types";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onClose: () => void;
  mode?: "sale" | "sample";
  products: Product[];
  flavors: Flavor[];
  paymentMethods: PaymentMethod[];
  demographics: DemographicOption[];
  tipOptions: TipOption[];
  discountOptions: DiscountOption[];
  taxRate: number;
  initial?: {
    saleId: string;
    kind: "single" | "group";
    carts: CustomerCart[];
    paymentMethodId: string | null;
    tipAmount: number;
    discountId: string | null;
    discountAmount: number;
    note: string;
  } | null;
  onSubmit: (input: {
    saleId?: string;
    kind: "single" | "group";
    paymentMethod: PaymentMethod | null;
    customers: CustomerCart[];
    note: string;
    tipAmount: number;
    discountOption: DiscountOption | null;
    discountAmount: number;
    isSample: boolean;
  }) => Promise<void>;
};

export function SaleComposer(props: Props) {
  const { open, onClose, products, flavors, paymentMethods, demographics, tipOptions, discountOptions, taxRate, onSubmit, mode = "sale", initial } = props;
  const isSample = mode === "sample";
  const [kind, setKind] = useState<"single" | "group">("single");
  const [carts, setCarts] = useState<CustomerCart[]>([{ lines: [], demographicIds: [] }]);
  const [activeCustomer, setActiveCustomer] = useState(0);
  const [pendingPaleta, setPendingPaleta] = useState<Product | null>(null);
  const [paymentId, setPaymentId] = useState<string>("");
  const [tipId, setTipId] = useState<string>("");
  const [tipOverride, setTipOverride] = useState<number | null>(null);
  const [discountId, setDiscountId] = useState<string>("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      if (initial) {
        setKind(initial.kind);
        setCarts(initial.carts.length ? initial.carts : [{ lines: [], demographicIds: [] }]);
        setActiveCustomer(0);
        setPendingPaleta(null);
        setPaymentId(initial.paymentMethodId ?? "");
        setTipId("");
        setTipOverride(initial.tipAmount > 0 ? initial.tipAmount : null);
        setDiscountId(initial.discountId ?? "");
        setNote(initial.note);
      } else {
        setKind("single");
        setCarts([{ lines: [], demographicIds: [] }]);
        setActiveCustomer(0);
        setPendingPaleta(null);
        setPaymentId("");
        setTipId("");
        setTipOverride(null);
        setDiscountId("");
        setNote("");
      }
    }
  }, [open, initial]);

  const subtotal = useMemo(() => cartSubtotal(carts), [carts]);
  const selectedMethod = paymentMethods.find((m) => m.id === paymentId) ?? null;
  const selectedTip = tipOptions.find((t) => t.id === tipId) ?? null;
  const selectedDiscount = discountOptions.find((d) => d.id === discountId) ?? null;
  const tipAmount = isSample
    ? 0
    : selectedTip
      ? computeTip(selectedTip, subtotal)
      : (tipOverride ?? 0);
  const discountAmount = isSample ? 0 : computeDiscount(selectedDiscount, subtotal);
  const totals = computeTotals({
    subtotal: isSample ? 0 : subtotal,
    appliesTax: !isSample && (selectedMethod?.applies_tax ?? false),
    taxRate,
    tip: tipAmount,
    discount: discountAmount,
  });

  const shakes = products.filter((p) => p.type === "shake");
  const paletas = products.filter((p) => p.type === "paleta");

  const updateCart = (idx: number, fn: (c: CustomerCart) => CustomerCart) => {
    setCarts((cs) => cs.map((c, i) => (i === idx ? fn(c) : c)));
  };

  const addShake = (p: Product) => {
    updateCart(activeCustomer, (c) => ({
      ...c,
      lines: [...c.lines, {
        productId: p.id, productName: p.name, productType: "shake",
        basePrice: Number(p.price), upgradePrice: 0, quantity: 1,
      }],
    }));
  };

  const tapPaleta = (p: Product) => {
    if (flavors.length === 0) {
      addPaletaWithFlavor(p, null);
    } else {
      setPendingPaleta(p);
    }
  };

  const addPaletaWithFlavor = (p: Product, f: Flavor | null) => {
    updateCart(activeCustomer, (c) => ({
      ...c,
      lines: [...c.lines, {
        productId: p.id, productName: p.name, productType: "paleta",
        basePrice: Number(p.price),
        flavorId: f?.id, flavorName: f?.name,
        upgradePrice: f ? Number(f.upgrade_price) : 0,
        quantity: 1,
      }],
    }));
    setPendingPaleta(null);
  };

  const removeLine = (custIdx: number, lineIdx: number) => {
    updateCart(custIdx, (c) => ({ ...c, lines: c.lines.filter((_, i) => i !== lineIdx) }));
  };

  const adjustQty = (custIdx: number, lineIdx: number, delta: number) => {
    updateCart(custIdx, (c) => ({
      ...c,
      lines: c.lines.map((l, i) => i === lineIdx ? { ...l, quantity: Math.max(1, l.quantity + delta) } : l),
    }));
  };

  const toggleDemographic = (custIdx: number, demoId: string) => {
    updateCart(custIdx, (c) => ({
      ...c,
      demographicIds: c.demographicIds.includes(demoId)
        ? c.demographicIds.filter((d) => d !== demoId)
        : [...c.demographicIds, demoId],
    }));
  };

  const addCustomer = () => {
    setCarts((cs) => [...cs, { lines: [], demographicIds: [] }]);
    setActiveCustomer(carts.length);
  };

  const switchKind = (k: "single" | "group") => {
    setKind(k);
    if (k === "single") {
      setCarts([carts[0] ?? { lines: [], demographicIds: [] }]);
      setActiveCustomer(0);
    }
  };

  const hasItems = carts.some((c) => c.lines.length > 0);
  const canSubmit = hasItems && (isSample || !!selectedMethod) && !busy;

  const submit = async () => {
    if (!isSample && !selectedMethod) return;
    setBusy(true);
    try {
      await onSubmit({
        saleId: initial?.saleId,
        kind,
        paymentMethod: isSample ? null : selectedMethod,
        customers: carts,
        note,
        tipAmount,
        discountOption: isSample ? null : selectedDiscount,
        discountAmount,
        isSample,
      });
    } finally { setBusy(false); }
  };

  const groupedDemographics = demographics.reduce<Record<string, DemographicOption[]>>((acc, d) => {
    (acc[d.category] ??= []).push(d); return acc;
  }, {});

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="h-[92vh] overflow-y-auto p-0">
        <SheetHeader className="sticky top-0 z-10 border-b border-border bg-card px-4 py-3">
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              aria-label="Close without saving"
              className="rounded-full p-2 hover:bg-muted active:scale-95"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <SheetTitle className="flex-1 text-left text-xl font-black">
              {initial ? (isSample ? "Edit sample" : "Edit sale") : (isSample ? "Free sample" : "New sale")}
            </SheetTitle>
            <button
              onClick={onClose}
              aria-label="Close without saving"
              className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground active:scale-95"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-2 flex gap-2">
            <button onClick={() => switchKind("single")}
              className={cn("flex-1 rounded-xl px-3 py-2 text-sm font-bold transition-colors",
                kind === "single" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground")}>
              <User className="mr-1 inline h-4 w-4" /> Single
            </button>
            <button onClick={() => switchKind("group")}
              className={cn("flex-1 rounded-xl px-3 py-2 text-sm font-bold transition-colors",
                kind === "group" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground")}>
              <Users className="mr-1 inline h-4 w-4" /> Group
            </button>
          </div>
        </SheetHeader>

        <div className="space-y-4 px-3 py-3">
          {kind === "group" && (
            <div className="flex flex-wrap gap-2">
              {carts.map((_, i) => (
                <button key={i} onClick={() => setActiveCustomer(i)}
                  className={cn("rounded-full px-4 py-2 text-sm font-bold",
                    activeCustomer === i ? "bg-primary text-primary-foreground" : "bg-secondary")}>
                  Customer {i + 1}
                </button>
              ))}
              <button onClick={addCustomer} className="rounded-full bg-accent px-4 py-2 text-sm font-bold text-accent-foreground">
                <Plus className="mr-1 inline h-4 w-4" /> Add
              </button>
            </div>
          )}

          {/* Shakes */}
          {shakes.length > 0 && (
            <section>
              <h3 className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Shakes</h3>
              <div className="grid grid-cols-3 gap-1.5">
                {shakes.map((p) => {
                  const count = carts[activeCustomer].lines
                    .filter((l) => l.productId === p.id)
                    .reduce((s, l) => s + l.quantity, 0);
                  const selected = count > 0;
                  return (
                    <button key={p.id} onClick={() => addShake(p)}
                      className={cn(
                        "relative rounded-xl border-2 p-2 text-left font-bold transition-all active:scale-95",
                        selected
                          ? "border-primary bg-primary text-primary-foreground shadow-md"
                          : "border-border bg-card hover:border-primary"
                      )}>
                      <div className="text-[13px] leading-tight line-clamp-2">{p.name}</div>
                      <div className={cn("mt-0.5 text-xs", selected ? "text-primary-foreground/90" : "text-primary")}>
                        {isSample ? "free" : fmt(Number(p.price))}
                      </div>
                      {selected && (
                        <span className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-accent text-[11px] font-black text-accent-foreground shadow-md">
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* Paletas */}
          {paletas.length > 0 && (
            <section>
              <h3 className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Paletas</h3>
              <div className="grid grid-cols-3 gap-1.5">
                {paletas.map((p) => {
                  const count = carts[activeCustomer].lines
                    .filter((l) => l.productId === p.id)
                    .reduce((s, l) => s + l.quantity, 0);
                  const selected = count > 0 || pendingPaleta?.id === p.id;
                  return (
                    <button key={p.id} onClick={() => tapPaleta(p)}
                      className={cn(
                        "relative rounded-xl border-2 p-2 text-left font-bold transition-all active:scale-95",
                        selected
                          ? "border-primary bg-primary text-primary-foreground shadow-md"
                          : "border-border bg-card hover:border-primary"
                      )}>
                      <div className="text-[13px] leading-tight line-clamp-2">{p.name}</div>
                      <div className={cn("mt-0.5 text-xs", selected ? "text-primary-foreground/90" : "text-primary")}>
                        {isSample ? "free" : fmt(Number(p.price))}
                      </div>
                      {count > 0 && (
                        <span className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-accent text-[11px] font-black text-accent-foreground shadow-md">
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              {pendingPaleta && (
                <div className="mt-3 rounded-2xl border-2 border-primary bg-primary/5 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-bold">Choose flavor for {pendingPaleta.name}</p>
                    <button onClick={() => setPendingPaleta(null)}><X className="h-4 w-4" /></button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => addPaletaWithFlavor(pendingPaleta, null)}
                      className="rounded-full bg-secondary px-4 py-2 text-sm font-bold">
                      Plain (no upgrade)
                    </button>
                    {flavors.map((f) => (
                      <button key={f.id} onClick={() => addPaletaWithFlavor(pendingPaleta, f)}
                        className="rounded-full bg-accent px-4 py-2 text-sm font-bold text-accent-foreground">
                        {f.name} +{fmt(Number(f.upgrade_price))}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Cart for active customer */}
          <section>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {kind === "group" ? `Customer ${activeCustomer + 1} cart` : "Cart"}
            </h3>
            {carts[activeCustomer].lines.length === 0 ? (
              <p className="rounded-2xl border-2 border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                Tap a product above to add it.
              </p>
            ) : (
              <div className="space-y-2">
                {carts[activeCustomer].lines.map((l, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-2xl border border-border bg-card p-3">
                    <div className="flex-1">
                      <p className="font-bold">{l.productName}{l.flavorName ? ` · ${l.flavorName}` : ""}</p>
                      <p className="text-xs text-muted-foreground">{fmt(l.basePrice + l.upgradePrice)} ea</p>
                    </div>
                    <div className="flex items-center gap-1 rounded-full bg-muted px-1">
                      <button onClick={() => adjustQty(activeCustomer, i, -1)} className="p-1"><Minus className="h-4 w-4" /></button>
                      <span className="w-6 text-center font-bold">{l.quantity}</span>
                      <button onClick={() => adjustQty(activeCustomer, i, +1)} className="p-1"><Plus className="h-4 w-4" /></button>
                    </div>
                    <span className="w-16 text-right font-bold">{fmt(lineTotal(l))}</span>
                    <button onClick={() => removeLine(activeCustomer, i)} className="p-1 text-muted-foreground hover:text-destructive">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Demographics */}
          {demographics.length > 0 && (
            <section>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Demographics (optional{kind === "group" ? ` · Customer ${activeCustomer + 1}` : ""})
              </h3>
              <div className="space-y-2">
                {Object.entries(groupedDemographics).map(([cat, opts]) => (
                  <div key={cat}>
                    <p className="mb-1 text-[10px] font-bold uppercase text-muted-foreground">{cat}</p>
                    <div className="flex flex-wrap gap-2">
                      {opts.map((d) => {
                        const on = carts[activeCustomer].demographicIds.includes(d.id);
                        return (
                          <button key={d.id} onClick={() => toggleDemographic(activeCustomer, d.id)}
                            className={cn("rounded-full px-3 py-1.5 text-sm font-semibold",
                              on ? "bg-primary text-primary-foreground" : "bg-secondary")}>
                            {d.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Note */}
          <Textarea placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} className="resize-none" rows={2} />
        </div>

        {/* Sticky footer */}
        <div className="sticky bottom-0 border-t border-border bg-card p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {!isSample && (
          <>
          <div className="mb-3">
            <p className="mb-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">Tap to charge & save</p>
            <div className="flex flex-wrap gap-2">
              {paymentMethods.length === 0 && (
                <p className="text-sm text-destructive">Add a payment method in Settings.</p>
              )}
              {paymentMethods.map((m) => {
                const selected = m.id === paymentId;
                return (
                  <button key={m.id} onClick={() => setPaymentId(m.id)}
                    className={cn("flex-1 rounded-2xl border-2 px-3 py-3 text-sm font-bold transition-all",
                      selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary/50")}>
                    {m.name}
                    {m.applies_tax && <span className="ml-1 text-[10px] opacity-80">+tax</span>}
                  </button>
                );
              })}
            </div>
          </div>
          {tipOptions.length > 0 && (
            <div className="mb-3">
              <p className="mb-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">Tip</p>
              <div className="flex flex-wrap gap-2">
                {tipOptions.map((t) => {
                  const sel = t.id === tipId;
                  return (
                    <button key={t.id} onClick={() => { setTipId(sel ? "" : t.id); setTipOverride(null); }}
                      className={cn("rounded-full border-2 px-3 py-1.5 text-xs font-bold transition-all",
                        sel ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card")}>
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          </>
          )}
          <div className="mb-3 flex items-baseline justify-between">
            <div className="text-xs text-muted-foreground">
              {isSample ? (
                <span>Sample · no charge</span>
              ) : (
                <>
                  Subtotal {fmt(totals.subtotal)}
                  {totals.tax > 0 && <span className="ml-2">+ tax {fmt(totals.tax)}</span>}
                  {totals.tip > 0 && <span className="ml-2">+ tip {fmt(totals.tip)}</span>}
                </>
              )}
            </div>
            <div className="text-3xl font-black">{fmt(totals.total)}</div>
          </div>
          <Button onClick={submit} disabled={!canSubmit}
            className="h-14 w-full rounded-2xl text-base font-bold shadow-lg"
            style={canSubmit ? { background: "var(--gradient-hero)" } : undefined}>
            <Check className="mr-2 h-5 w-5" /> {busy ? "Saving..." : initial ? "Update" : isSample ? "Save sample" : "Save sale"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}