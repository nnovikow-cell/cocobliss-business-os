delete from public.disposable_kit_items
where disposable_item_id not in (
  select id from public.inventory_items
);

alter table public.disposable_kit_items
  drop constraint if exists disposable_kit_items_disposable_item_id_fkey;

alter table public.disposable_kit_items
  add constraint disposable_kit_items_disposable_item_id_fkey
  foreign key (disposable_item_id) references public.inventory_items(id) on delete restrict;