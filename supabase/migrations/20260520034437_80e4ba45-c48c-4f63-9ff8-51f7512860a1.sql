alter table public.inventory_logs
  add constraint inventory_logs_batch_id_fkey
  foreign key (batch_id) references public.inventory_log_batches(id)
  on delete set null;