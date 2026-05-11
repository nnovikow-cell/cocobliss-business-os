create table public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text,
  sort_order integer not null default 0,
  is_archived boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.events enable row level security;

create policy "events all authenticated" on public.events
  for all to authenticated using (true) with check (true);

create trigger update_events_updated_at
  before update on public.events
  for each row execute function public.update_updated_at_column();