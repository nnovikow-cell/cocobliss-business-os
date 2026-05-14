create table public.syrups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  bottle_size numeric not null,
  bottle_price numeric not null,
  supplier_name text,
  source_url text,
  source_address text,
  is_archived boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.syrups enable row level security;

create policy "syrups all authenticated"
on public.syrups for all
to authenticated
using (true)
with check (true);

create trigger syrups_set_updated_at
before update on public.syrups
for each row execute function public.update_updated_at_column();