-- Bug 1: repoint FKs to inventory_items
alter table public.recipe_formula_ingredients
  drop constraint if exists recipe_formula_ingredients_ingredient_id_fkey;

alter table public.recipe_formula_ingredients
  add constraint recipe_formula_ingredients_ingredient_id_fkey
  foreign key (ingredient_id) references public.inventory_items(id) on delete restrict;

alter table public.recipe_serving_sizes
  drop constraint if exists recipe_serving_sizes_syrup_id_fkey;

alter table public.recipe_serving_sizes
  add constraint recipe_serving_sizes_syrup_id_fkey
  foreign key (syrup_id) references public.inventory_items(id) on delete set null;
