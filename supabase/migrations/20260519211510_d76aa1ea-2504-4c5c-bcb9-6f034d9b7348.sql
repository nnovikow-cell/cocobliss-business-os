create table public.sops (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null,
  steps jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.sops enable row level security;

create policy "sops all authenticated" on public.sops
  for all to authenticated using (true) with check (true);

create trigger trg_sops_updated before update on public.sops
  for each row execute function public.update_updated_at_column();