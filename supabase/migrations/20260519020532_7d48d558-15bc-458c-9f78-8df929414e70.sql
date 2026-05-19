-- Migrate disposable_items into inventory_items, preserving ids so existing
-- disposable_kit_items.disposable_item_id keeps resolving.
insert into public.inventory_items (
  id, name, category, category_v2, unit, current_quantity, par_level,
  package_qty, price, workflow_tags
)
select
  di.id,
  di.name,
  'disposable'::inventory_category,
  'disposable',
  'unit',
  0,
  0,
  di.package_qty,
  di.package_price,
  array['restock','all']::text[]
from public.disposable_items di
where di.deleted_at is null
  and not exists (select 1 from public.inventory_items ii where ii.id = di.id);