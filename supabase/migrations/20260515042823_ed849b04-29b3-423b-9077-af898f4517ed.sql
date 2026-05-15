
alter table public.inventory_items
  add column if not exists library_code text,
  add column if not exists package_qty numeric,
  add column if not exists density numeric,
  add column if not exists density_source text;

alter table public.inventory_items
  alter column workflow_tags set default '{restock}';

alter table public.inventory_price_history
  add column if not exists note text;

alter table public.inventory_items disable trigger trg_inventory_price_change;
