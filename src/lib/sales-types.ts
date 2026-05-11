export type Product = {
  id: string;
  name: string;
  type: "shake" | "paleta";
  price: number;
};

export type Flavor = {
  id: string;
  name: string;
  upgrade_price: number;
};

export type PaymentMethod = {
  id: string;
  name: string;
  applies_tax: boolean;
};

export type DemographicOption = {
  id: string;
  category: string;
  label: string;
};

export type CartLine = {
  productId: string;
  productName: string;
  productType: "shake" | "paleta";
  basePrice: number;
  flavorId?: string;
  flavorName?: string;
  upgradePrice: number;
  quantity: number;
};

export type CustomerCart = {
  lines: CartLine[];
  demographicIds: string[];
};

export const lineTotal = (l: CartLine) => (l.basePrice + l.upgradePrice) * l.quantity;
export const cartSubtotal = (carts: CustomerCart[]) =>
  carts.reduce((sum, c) => sum + c.lines.reduce((s, l) => s + lineTotal(l), 0), 0);