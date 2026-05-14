create table public.ingredients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  package_qty numeric not null,
  package_price numeric not null,
  item_size numeric not null,
  unit text not null check (unit in ('fl oz','ml','g','kg','lb')),
  density numeric,
  density_source text check (density_source in ('table','manual')),
  supplier_name text,
  source_url text,
  source_address text,
  is_archived boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ingredients enable row level security;

create policy "ingredients all authenticated"
on public.ingredients for all
to authenticated
using (true)
with check (true);

create trigger ingredients_set_updated_at
before update on public.ingredients
for each row execute function public.update_updated_at_column();