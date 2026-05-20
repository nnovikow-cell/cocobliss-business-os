alter table public.inventory_logs
  add column if not exists reverted_at timestamptz,
  add column if not exists reverted_by uuid references auth.users(id);