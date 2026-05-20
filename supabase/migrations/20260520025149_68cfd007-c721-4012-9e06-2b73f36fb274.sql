alter table public.inventory_log_batches
  add column if not exists status text not null default 'received',
  add column if not exists order_number text,
  add column if not exists order_date date,
  add column if not exists projected_received_date date,
  add column if not exists received_at timestamptz,
  add column if not exists received_by uuid references auth.users(id);

update public.inventory_log_batches
  set status = 'received', received_at = created_at
  where kind = 'restock' and status = 'received' and received_at is null;