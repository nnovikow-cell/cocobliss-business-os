insert into public.inventory_items (
  name, category, category_v2, unit, current_quantity, par_level,
  library_code, supplier_name, purchase_url, package_type, package_qty,
  package_size, package_size_unit, price, workflow_tags
)
select * from (values
  (
    'Coconut Milk, Classic, 17% Fat, No Guar, Organic',
    'consumable'::inventory_category, 'ingredient', 'fl oz',
    0::numeric, 0::numeric, 'GY1433', 'Azure Standard',
    'https://www.azurestandard.com/shop/product/food/canned/coconut/milk/liquid/coconut-milk-17-fat-no-guar-organic/30618?package=GY1433',
    'Can', 12::numeric, 13.5::numeric, 'fl oz', 19.77::numeric,
    array['production_batch','all']::text[]
  ),
  (
    'Coconut Milk, Premium, 17-19% Fat, No Guar, Organic',
    'consumable'::inventory_category, 'ingredient', 'fl oz',
    0::numeric, 0::numeric, 'GY1457', 'Azure Standard',
    'https://www.azurestandard.com/shop/product/food/canned/coconut/milk/liquid/coconut-milk-17-19-fat-no-guar-organic/30660?package=GY1457',
    'Can', 12::numeric, 13.5::numeric, 'fl oz', 17.89::numeric,
    array['production_batch','all']::text[]
  ),
  (
    'Sweetened Condensed Milk, Organic',
    'consumable'::inventory_category, 'ingredient', 'oz',
    0::numeric, 0::numeric, 'GY902', 'Azure Standard',
    'https://www.azurestandard.com/shop/product/food/dairy/milk/sweetened-condensed-milk/sweetened-condensed-milk-organic/11108?package=GY902',
    'Can', 24::numeric, 14::numeric, 'oz', 99.74::numeric,
    array['production_batch','all']::text[]
  ),
  (
    'Shredded Coconut, Unsweetened, Organic',
    'consumable'::inventory_category, 'ingredient', 'oz',
    0::numeric, 0::numeric, 'BP152', 'Azure Standard',
    'https://www.azurestandard.com/shop/product/food/dried-fruit/coconut/shredded/shredded-coconut-organic/7802?package=BP152',
    'Bag', 12::numeric, 8::numeric, 'oz', 42.52::numeric,
    array['production_batch','all']::text[]
  )
) as v(name, category, category_v2, unit, current_quantity, par_level,
       library_code, supplier_name, purchase_url, package_type, package_qty,
       package_size, package_size_unit, price, workflow_tags)
where not exists (
  select 1 from public.inventory_items i where i.library_code = v.library_code
);

update public.inventory_items
set package_size = 13.5, package_type = coalesce(package_type, 'Can')
where library_code in ('GY1433','GY1457') and package_size = 162;

update public.inventory_items
set package_size = 14, package_type = coalesce(package_type, 'Can')
where library_code = 'GY902' and package_size = 336;

update public.inventory_items
set package_size = 8, package_type = coalesce(package_type, 'Bag')
where library_code = 'BP152' and package_size = 96;