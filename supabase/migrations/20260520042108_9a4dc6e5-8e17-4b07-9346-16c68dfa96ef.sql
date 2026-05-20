create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null,
  amount numeric not null default 0,
  due_date date not null,
  paid_at timestamptz,
  event_instance_id uuid references public.event_instances(id) on delete set null,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table public.invoices enable row level security;
create policy "invoices all authenticated" on public.invoices
  for all to authenticated using (true) with check (true);