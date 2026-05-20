create table public.balance_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('checking', 'savings', 'credit')),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table public.balance_accounts enable row level security;
create policy "balance_accounts all authenticated" on public.balance_accounts
  for all to authenticated using (true) with check (true);

create table public.balance_entries (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.balance_accounts(id) on delete cascade,
  balance numeric not null,
  logged_at date not null,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table public.balance_entries enable row level security;
create policy "balance_entries all authenticated" on public.balance_entries
  for all to authenticated using (true) with check (true);