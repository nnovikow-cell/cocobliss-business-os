
-- 1. Extend inventory_items
alter table public.inventory_items
  add column if not exists category_v2 text,
  add column if not exists workflow_tags text[] not null default '{all}',
  add column if not exists package_type text,
  add column if not exists supplier_name text,
  add column if not exists purchase_url text,
  add column if not exists physical_location text,
  add column if not exists price numeric,
  add column if not exists price_updated_at timestamptz,
  add column if not exists package_size numeric,
  add column if not exists package_size_unit text,
  add column if not exists cost_per_unit numeric
    generated always as (case when package_size is not null and package_size <> 0 then price / package_size end) stored;

-- Backfill category_v2 from existing category
update public.inventory_items
set category_v2 = case
  when category::text = 'consumable' then 'ingredient'
  when category::text = 'disposable' then 'disposable'
  else 'other'
end
where category_v2 is null;

-- Backfill workflow_tags
update public.inventory_items
set workflow_tags = case
  when category::text = 'consumable' then array['production_batch','restock']
  when category::text = 'disposable' then array['log_event','restock']
  else array['all']
end
where workflow_tags = '{all}';

-- 2. Price history table
create table if not exists public.inventory_price_history (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.inventory_items(id) on delete cascade,
  price numeric,
  package_size numeric,
  package_size_unit text,
  cost_per_unit numeric,
  changed_at timestamptz not null default now(),
  changed_by uuid
);
create index if not exists idx_inv_price_history_item on public.inventory_price_history(item_id, changed_at desc);

alter table public.inventory_price_history enable row level security;

drop policy if exists "inventory_price_history all authenticated" on public.inventory_price_history;
create policy "inventory_price_history all authenticated"
  on public.inventory_price_history for all to authenticated
  using (true) with check (true);

-- Trigger to record price changes
create or replace function public.record_inventory_price_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT' and new.price is not null)
     or (tg_op = 'UPDATE' and (
          coalesce(new.price, -1) is distinct from coalesce(old.price, -1)
          or coalesce(new.package_size, -1) is distinct from coalesce(old.package_size, -1)
          or coalesce(new.package_size_unit, '') is distinct from coalesce(old.package_size_unit, '')
        )) then
    new.price_updated_at := now();
    insert into public.inventory_price_history
      (item_id, price, package_size, package_size_unit, cost_per_unit, changed_by)
    values
      (new.id, new.price, new.package_size, new.package_size_unit,
       case when new.package_size is not null and new.package_size <> 0 then new.price / new.package_size end,
       auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists trg_inventory_price_change on public.inventory_items;
create trigger trg_inventory_price_change
  before insert or update on public.inventory_items
  for each row execute function public.record_inventory_price_change();

-- 3. Extend inventory_logs enum (add new kinds)
do $$
begin
  if not exists (select 1 from pg_type t join pg_enum e on t.oid = e.enumtypid
                 where t.typname = 'inventory_log_kind' and e.enumlabel = 'production_batch') then
    alter type public.inventory_log_kind add value 'production_batch';
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_type t join pg_enum e on t.oid = e.enumtypid
                 where t.typname = 'inventory_log_kind' and e.enumlabel = 'event_use') then
    alter type public.inventory_log_kind add value 'event_use';
  end if;
end$$;

-- 4. Extend inventory_logs columns
alter table public.inventory_logs
  add column if not exists batch_id uuid,
  add column if not exists production_date date,
  add column if not exists projected_use_date date,
  add column if not exists supplier_name_snapshot text;

create index if not exists idx_inventory_logs_batch on public.inventory_logs(batch_id);

-- 5. inventory_log_batches header table
create table if not exists public.inventory_log_batches (
  id uuid primary key default gen_random_uuid(),
  kind public.inventory_log_kind not null,
  event_instance_id uuid,
  production_date date,
  projected_use_date date,
  supplier_name text,
  note text,
  logged_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists idx_inventory_log_batches_event on public.inventory_log_batches(event_instance_id);
create index if not exists idx_inventory_log_batches_created on public.inventory_log_batches(created_at desc);

alter table public.inventory_log_batches enable row level security;

drop policy if exists "inventory_log_batches all authenticated" on public.inventory_log_batches;
create policy "inventory_log_batches all authenticated"
  on public.inventory_log_batches for all to authenticated
  using (true) with check (true);
