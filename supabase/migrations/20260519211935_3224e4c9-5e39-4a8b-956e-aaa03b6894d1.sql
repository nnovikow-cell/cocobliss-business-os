create table public.credentials (
  id uuid primary key default gen_random_uuid(),
  service_name text not null,
  url text,
  username text,
  password text,
  category text not null default 'Other',
  notes text,
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.credentials enable row level security;

create policy "credentials all authenticated"
  on public.credentials for all to authenticated using (true) with check (true);

create trigger trg_credentials_updated before update on public.credentials
  for each row execute function public.update_updated_at_column();