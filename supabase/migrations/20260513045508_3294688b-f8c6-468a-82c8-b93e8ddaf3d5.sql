create type public.inventory_category as enum ('consumable','disposable');
create type public.inventory_log_kind as enum ('use','restock');

create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category public.inventory_category not null,
  subcategory text,
  unit text not null default 'unit',
  current_quantity numeric not null default 0,
  par_level numeric not null default 0,
  last_restocked_at timestamptz,
  notes text,
  is_archived boolean not null default false,
  deleted_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.inventory_logs (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.inventory_items(id) on delete cascade,
  kind public.inventory_log_kind not null,
  quantity numeric not null,
  quantity_after numeric not null,
  note text,
  logged_by uuid,
  created_at timestamptz not null default now()
);

create index idx_inventory_logs_item on public.inventory_logs(item_id, created_at desc);

alter table public.inventory_items enable row level security;
alter table public.inventory_logs enable row level security;

create policy "inventory_items all authenticated" on public.inventory_items
  for all to authenticated using (true) with check (true);
create policy "inventory_items admin delete" on public.inventory_items
  for delete to authenticated using (public.has_role(auth.uid(),'admin'));

create policy "inventory_logs all authenticated" on public.inventory_logs
  for all to authenticated using (true) with check (true);

create trigger update_inventory_items_updated_at
  before update on public.inventory_items
  for each row execute function public.update_updated_at_column();
