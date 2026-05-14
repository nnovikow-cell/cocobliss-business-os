
create table public.disposable_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  package_qty numeric not null,
  package_price numeric not null,
  is_archived boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.disposable_items enable row level security;
create policy "disposable_items all authenticated" on public.disposable_items
  for all to authenticated using (true) with check (true);

create trigger update_disposable_items_updated_at
before update on public.disposable_items
for each row execute function public.update_updated_at_column();

create table public.disposable_kits (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  target_size numeric not null,
  is_archived boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.disposable_kits enable row level security;
create policy "disposable_kits all authenticated" on public.disposable_kits
  for all to authenticated using (true) with check (true);

create trigger update_disposable_kits_updated_at
before update on public.disposable_kits
for each row execute function public.update_updated_at_column();

create table public.disposable_kit_items (
  id uuid primary key default gen_random_uuid(),
  kit_id uuid not null references public.disposable_kits(id) on delete cascade,
  disposable_item_id uuid not null references public.disposable_items(id) on delete restrict,
  qty numeric not null default 1,
  created_at timestamptz not null default now()
);

alter table public.disposable_kit_items enable row level security;
create policy "disposable_kit_items all authenticated" on public.disposable_kit_items
  for all to authenticated using (true) with check (true);

create index idx_disposable_kit_items_kit on public.disposable_kit_items(kit_id);

-- Seed items
insert into public.disposable_items (name, package_qty, package_price) values
  ('12oz Cup', 1000, 28.00),
  ('16oz Cup', 1000, 32.00),
  ('Lid',      1000, 18.00),
  ('Straw',     500,  9.00);

-- Seed kits with items
with k12 as (
  insert into public.disposable_kits (name, target_size) values ('12oz Kit', 12) returning id
), k16 as (
  insert into public.disposable_kits (name, target_size) values ('16oz Kit', 16) returning id
)
insert into public.disposable_kit_items (kit_id, disposable_item_id, qty)
select (select id from k12), i.id, 1 from public.disposable_items i where i.name in ('12oz Cup','Lid','Straw')
union all
select (select id from k16), i.id, 1 from public.disposable_items i where i.name in ('16oz Cup','Lid','Straw');
