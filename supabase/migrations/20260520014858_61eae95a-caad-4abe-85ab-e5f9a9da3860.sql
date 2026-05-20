alter table public.inventory_items
  add column if not exists is_active boolean not null default true;