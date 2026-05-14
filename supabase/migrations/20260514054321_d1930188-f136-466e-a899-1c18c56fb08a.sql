
create table public.recipe_products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  active_formula_id uuid,
  is_archived boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.recipe_products enable row level security;
create policy "recipe_products all authenticated" on public.recipe_products
  for all to authenticated using (true) with check (true);
create trigger update_recipe_products_updated_at before update on public.recipe_products
  for each row execute function public.update_updated_at_column();

create table public.recipe_formulas (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.recipe_products(id) on delete cascade,
  name text not null,
  batch_size numeric not null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.recipe_formulas enable row level security;
create policy "recipe_formulas all authenticated" on public.recipe_formulas
  for all to authenticated using (true) with check (true);
create trigger update_recipe_formulas_updated_at before update on public.recipe_formulas
  for each row execute function public.update_updated_at_column();
create index idx_recipe_formulas_product on public.recipe_formulas(product_id);

create table public.recipe_formula_ingredients (
  id uuid primary key default gen_random_uuid(),
  formula_id uuid not null references public.recipe_formulas(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete restrict,
  ratio numeric not null,
  created_at timestamptz not null default now()
);
alter table public.recipe_formula_ingredients enable row level security;
create policy "recipe_formula_ingredients all authenticated" on public.recipe_formula_ingredients
  for all to authenticated using (true) with check (true);
create index idx_recipe_formula_ingredients_formula on public.recipe_formula_ingredients(formula_id);

create table public.recipe_serving_sizes (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.recipe_products(id) on delete cascade,
  size_fl_oz numeric not null,
  disposable_kit_id uuid references public.disposable_kits(id) on delete set null,
  syrup_id uuid references public.syrups(id) on delete set null,
  syrup_fl_oz numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.recipe_serving_sizes enable row level security;
create policy "recipe_serving_sizes all authenticated" on public.recipe_serving_sizes
  for all to authenticated using (true) with check (true);
create trigger update_recipe_serving_sizes_updated_at before update on public.recipe_serving_sizes
  for each row execute function public.update_updated_at_column();
create index idx_recipe_serving_sizes_product on public.recipe_serving_sizes(product_id);

-- Seed: Classic Coconut
do $$
declare
  pid uuid;
  fid uuid;
  ing_milk uuid;
  ing_shred uuid;
  ing_cond uuid;
  kit_12 uuid;
  kit_16 uuid;
begin
  select id into ing_milk  from public.ingredients where lower(name) = 'coconut milk' limit 1;
  select id into ing_shred from public.ingredients where lower(name) = 'shredded coconut' limit 1;
  select id into ing_cond  from public.ingredients where lower(name) = 'condensed milk' limit 1;
  select id into kit_12 from public.disposable_kits where name = '12oz Kit' limit 1;
  select id into kit_16 from public.disposable_kits where name = '16oz Kit' limit 1;

  insert into public.recipe_products (name) values ('Classic Coconut') returning id into pid;
  insert into public.recipe_formulas (product_id, name, batch_size) values (pid, 'Original', 64) returning id into fid;
  update public.recipe_products set active_formula_id = fid where id = pid;

  if ing_milk is not null then
    insert into public.recipe_formula_ingredients (formula_id, ingredient_id, ratio) values (fid, ing_milk, 0.633);
  end if;
  if ing_shred is not null then
    insert into public.recipe_formula_ingredients (formula_id, ingredient_id, ratio) values (fid, ing_shred, 0.234);
  end if;
  if ing_cond is not null then
    insert into public.recipe_formula_ingredients (formula_id, ingredient_id, ratio) values (fid, ing_cond, 0.133);
  end if;

  if kit_12 is not null then
    insert into public.recipe_serving_sizes (product_id, size_fl_oz, disposable_kit_id) values (pid, 12, kit_12);
  end if;
  if kit_16 is not null then
    insert into public.recipe_serving_sizes (product_id, size_fl_oz, disposable_kit_id) values (pid, 16, kit_16);
  end if;
end $$;
