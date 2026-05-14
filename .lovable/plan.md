## Inventory Module Upgrade — Plan

This is an **incremental upgrade** of the existing module. All current tables, item rows, and existing restock/use logs stay intact. We only extend schema, add new pages/flows, and refactor the home page.

---

### 1. Database changes (single migration)

**`inventory_items` — add columns** (all nullable to preserve existing data):
- `category_v2` text — `ingredient` / `topping` / `disposable` / `other` (new richer category; existing `category` enum kept for back-compat). Backfill: `consumable → ingredient`, `disposable → disposable`.
- `workflow_tags` text[] — values from `production_batch` / `log_event` / `restock` / `all`. Default `{all}`. Backfill: ingredients → `{production_batch, restock}`, disposables/toppings → `{log_event, restock}`.
- `package_type` text (e.g. "bag", "case")
- `supplier_name` text
- `purchase_url` text
- `physical_location` text
- `price` numeric (current price)
- `price_updated_at` timestamptz (auto-set via trigger when `price` changes)
- `package_size` numeric, `package_size_unit` text
- `cost_per_unit` numeric — **generated column** = `price / nullif(package_size,0)`

**`inventory_price_history`** (new) — `id, item_id, price, package_size, package_size_unit, cost_per_unit, changed_at, changed_by`. Trigger on `inventory_items` price/package_size change inserts a row.

**`inventory_logs` — extend**:
- `kind` enum: add new values `production_batch` and `event_use` (keep existing `use` / `restock` for back-compat).
- `batch_id` uuid (nullable) — groups multiple `inventory_logs` rows that were saved together as one batch operation.
- `production_date` date (nullable)
- `projected_use_date` date (nullable)
- `supplier_name_snapshot` text (nullable)
- `event_instance_id` already exists ✅

**`inventory_log_batches`** (new) — header row per multi-item submission: `id, kind (production_batch | restock | event_use), event_instance_id, production_date, projected_use_date, supplier_name, note, logged_by, created_at`. Each child row in `inventory_logs` carries `batch_id`.

RLS: same `all authenticated` pattern as existing tables.

---

### 2. Routes & file layout

```
src/routes/inventory.tsx                  layout w/ <Outlet/> (NEW)
src/routes/inventory.index.tsx            REWORK → Home command center
src/routes/inventory.list.tsx             NEW → master library (current list UI, polished)
src/routes/inventory.$itemId.tsx          KEEP, extend detail+edit form & history
src/routes/inventory.new.tsx              NEW → full create form (rich fields)
src/routes/inventory.log.batch.tsx        NEW → 3-step Production Batch flow
src/routes/inventory.log.restock.tsx      NEW → 3-step Restock flow
src/routes/inventory.log.event.tsx        NEW → 3-step Event flow
```

Side-nav entry stays "Inventory" → `/inventory`.

---

### 3. Home page (`inventory.index.tsx`)

- **Top row**: 3 tappable status cards (Reorder Now / Low Stock / Good to Go) with counts. Each links to `/inventory/list?status=out|low|ok`.
- **Bottom**: 4 action cards → View Inventory, Log Production Batch, Log Restock, Log Event.
- Mobile single-column, desktop 3-up status row + 2x2 action grid.

### 4. Master library (`inventory.list.tsx`)

Reuses current list UI, plus:
- Reads `?status=`, `?category=`, `?workflow=` from URL.
- Filter chips: category (Ingredient/Topping/Disposable/Other), workflow tag, stock status. Sort: name / stock level / last restocked.
- Each card: name, category + workflow tag pills, qty + unit, status badge, last restocked date, quick edit pencil → opens detail.

### 5. Item create/edit form

Rebuilt as full page (`/inventory/new`) and inline edit on detail page. Sections: Identity, Purchasing, Stock, Notes — exactly the fields in the spec. `cost_per_unit` shown read-only (generated). Price changes auto-stamped to history.

### 6. Three log flows (shared component)

Create `src/components/inventory/log-flow.tsx` — generic 3-step wizard taking a `kind` and a filter for which items to show. Each step:

- **Step 1 — Quantities**: items grouped by category, only those whose `workflow_tags` include the flow kind (or `all`). Numeric stepper per item (− / input / +). Search box.
- **Step 2 — Details** (varies by flow):
  - Production Batch: event dropdown (event_instances joined w/ event_series, shown as `name · date · location`, excluding cancelled/not-attending), production date, projected use date.
  - Restock: supplier name, date received.
  - Event: event dropdown, date of event (auto-fill from instance).
- **Step 3 — Confirm & Save**: summary list + Save. On save, insert one `inventory_log_batches` row + N `inventory_logs` rows in a single RPC (or sequential insert wrapped client-side), update each item's `current_quantity` (and `last_restocked_at` for restock). Toast confirmation, navigate home.

### 7. Item detail history

Extend existing log list to show:
- Log type icon + label (Production Batch / Restock / Event Use / legacy Use)
- Quantity delta + new total
- Linked event name + date (when present)
- Supplier (restock), production/projected dates (batch)
- Timestamp + user
Sorted newest first. Existing delete-entry control kept.

### 8. Design

Tailwind responsive, semantic tokens only, card-based, color-coded badges (reuse `statusMeta`). Numeric steppers reused across all 3 flows. No new color literals.

### Out of scope (unchanged)
- Existing inventory rows, current_quantity, par_level, existing logs.
- Events module, side-nav, auth.
- Hard delete behavior (still admin-only).

---

### Sequencing

1. **Migration** (schema + backfill + price-history trigger) — apply, await approval.
2. **Routes scaffolding** + home page rework + master list extraction.
3. **Item form** (new + edit) with new fields + price history.
4. **Shared log-flow wizard** + 3 flow routes.
5. **Detail page history** enrichment.
6. QA on mobile (726px) and desktop.

Confirm and I'll start with the migration.