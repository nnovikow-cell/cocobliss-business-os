# CocoBLiss Business OS — Implementation Plan (v1)

## Scope

Build the app shell with nav for all 4 modules, then fully implement Sales Tracker. Other modules render "Coming soon" placeholders.

## Decisions (from your answers)

- **Auth**: Email/password signup screen, no auto-confirm. You create your own accounts.
- **Paleta**: One configurable base "Paleta" product (editable name + price). Flavor upgrades configurable separately, each with its own price. Everything editable.
- **Demographics**: Optional per sale.
- **Group Sale**: Stepper — add customers one at a time, each with their own items + optional demographics.
- **Payment method**: Required per sale. No defaults seeded — you configure them. **Card adds tax automatically.** Tax % is configurable in Settings. Cash (and any non-card method) does not add tax.
- **Session reopen**: Only "authorized" users can reopen a closed session. We'll set this up via a `user_roles` table now (role: `admin`) so adding employees later is just adding rows. Both you and Ernesto get `admin` on signup.
- **Offline**: Online-only for v1, with clear connection error toasts.
- **Seed data**: Pre-loaded with the example menu (Biscoff Addiction, Berry Bliss, Piña Cocada, Dulce Flow, Cocada + Paleta base + a couple flavor upgrades). No payment methods, no demographics seeded.
- **Design**: High-contrast premium feel — deep tropical palette with a vivid coconut-cream + sunlit-mango accent, heavy weights, oversized rounded pills, clear shadows, designed to be readable in direct sunlight.

---

## Tax Logic

Configurable in Settings:

- `tax_rate` (e.g. 8.25, stored as numeric percent)
- Each payment method has a flag `applies_tax` (true for Card, false for Cash by default — fully editable)

Formula at sale logging:

```
subtotal      = sum(line_total of all sale_items)
tax_amount    = method.applies_tax ? subtotal * (tax_rate / 100) : 0
total         = subtotal + tax_amount
```

All three (`subtotal`, `tax_amount`, `total`) and the tax rate snapshot are saved on the sale row so historical reports stay correct if rates change later.

UI: when the user taps a payment method that applies tax, the running total visibly updates with a "+ tax" line. One-tap card → tax applied → done.

---

## Screen Inventory

**Shell**

- `/login` — email/password
- `/` — module hub (4 cards: Sales Tracker active, others "Coming soon")
- Bottom nav (mobile) with 4 module icons

**Sales Tracker** (`/sales/...`)

- Sessions list (open session pinned, history below)
- Active Session — live logging UI (the workhorse)
- Single Sale composer (inline on Active Session)
- Group Sale composer (stepper modal)
- Close Session screen (summary + confirm)
- Session report (totals by product / payment method / demographic / user; tax breakdown)
- Settings (tabs):
  - Products
  - Paleta Flavor Upgrades
  - Payment Methods (with `applies_tax` toggle)
  - Demographic Options
  - Tax & General (tax rate)
  - Users (list; reopen-permission visible)

**Placeholders**

- `/inventory`, `/costs`, `/meetings` — "Coming soon" pages

---

## Database Schema

All tables: `id uuid pk`, `created_at`, `updated_at`, `deleted_at` nullable. RLS on everywhere.

**Auth & roles**

- `profiles` — `user_id (fk auth.users on delete cascade)`, `display_name`, `accent_color`
- `user_roles` — `user_id`, `role` enum(`admin`, `staff`); checked via `has_role()` security-definer fn
- Trigger: on new auth user → insert profile + assign `admin` role (so you and Ernesto both get admin on signup; later employees can be downgraded)

**Config**

- `products` — `name`, `type` enum(`shake`,`paleta`), `price numeric(10,2)`, `sort_order`, `is_archived`
- `paleta_flavor_upgrades` — `name`, `upgrade_price numeric(10,2)`, `sort_order`, `is_archived`
- `payment_methods` — `name`, `applies_tax bool default false`, `sort_order`, `is_archived`
- `demographic_options` — `category` (e.g. `age_group`, `sex`), `label`, `sort_order`, `is_archived`
- `app_settings` — single-row table: `tax_rate numeric(5,2) default 0`

**Sales**

- `sales_sessions` — `name`, `location`, `notes`, `opened_by`, `opened_at`, `closed_by` nullable, `closed_at` nullable, `status` enum(`open`,`closed`)
- `sales` — `session_id`, `logged_by`, `sale_kind` enum(`single`,`group`), `payment_method_id`, `payment_method_name_snapshot`, `applies_tax_snapshot`, `tax_rate_snapshot`, `subtotal`, `tax_amount`, `total`, `note`
- `sale_items` — `sale_id`, `customer_index int` (0 for single; 0..N for group), `product_id`, `product_name_snapshot`, `product_type_snapshot`, `base_price_snapshot`, `flavor_upgrade_id` nullable, `flavor_name_snapshot`, `upgrade_price_snapshot`, `quantity int default 1`, `line_total`
- `sale_demographics` — `sale_id`, `customer_index`, `demographic_option_id`

**Realtime**: enable on `sales_sessions`, `sales`, `sale_items`, `sale_demographics`.

**RLS rules**

- `profiles`: user can read all, update own
- `user_roles`: read all (authenticated), only admins can modify
- All config tables: any authenticated user can CRUD
- `sales_sessions`: any authenticated user can insert + read; update allowed when `status='open'` for everyone, reopening (`status` open→closed transitions) restricted to `admin` via policy + db function
- `sales`, `sale_items`, `sale_demographics`: any authenticated user can CRUD (soft-delete via `deleted_at`)

---

## Build Order

1. Migrations (schema, RLS, seed data, role trigger, realtime publication)
2. Auth (signup/login, redirect-to / on session, no auto-confirm)
3. App shell + bottom nav + module hub + placeholder pages
4. Settings tabs (products, flavors, payment methods + tax flag, demographics, tax rate)
5. Sessions list + open/close session
6. Active Session live logging UI (shake row, paleta + flavor reveal, single sale flow, payment method tap with tax math, live realtime feed)
7. Group Sale stepper
8. Session close + summary report (with tax breakdown)
9. Reopen-session gated by admin role
10. Premium high-contrast design pass (tokens in src/styles.css, oversized pills, sunlight-readable)

---

## Technical Notes

- Stack: TanStack Start + Lovable Cloud (Supabase) — already wired up
- All config-driven UI fetches from DB tables; no hardcoded product/option arrays anywhere
- Price/tax/name snapshots on sale rows so editing config never alters history
- Realtime via Supabase channels on the active session
- Numeric: `numeric(10,2)` for money, `numeric(5,2)` for tax %
- React Query for caching + optimistic updates on the logging UI for sub-100ms tap feedback

Ready to build when you hit Implement.