insert into public.inventory_items (
  name, notes, price, package_size, package_size_unit, unit,
  category, category_v2, workflow_tags,
  supplier_name, purchase_url, package_qty, current_quantity, par_level
)
select
  s.name,
  s.description,
  s.bottle_price,
  s.bottle_size,
  'fl oz',
  'fl oz',
  'consumable'::inventory_category,
  'syrup',
  array['production_batch']::text[],
  s.supplier_name,
  s.source_url,
  1,
  0,
  0
from public.syrups s
where s.deleted_at is null
  and not exists (
    select 1 from public.inventory_items i
    where i.category_v2 = 'syrup' and lower(i.name) = lower(s.name)
  );