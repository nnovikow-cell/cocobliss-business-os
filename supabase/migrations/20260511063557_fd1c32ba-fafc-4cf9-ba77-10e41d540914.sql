
-- ===== Enums =====
create type public.app_role as enum ('admin', 'staff');
create type public.product_type as enum ('shake', 'paleta');
create type public.session_status as enum ('open', 'closed');
create type public.sale_kind as enum ('single', 'group');

-- ===== Shared trigger fn =====
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ===== Profiles =====
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text,
  accent_color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles readable by authenticated"
  on public.profiles for select to authenticated using (true);
create policy "users update own profile"
  on public.profiles for update to authenticated using (auth.uid() = user_id);
create policy "users insert own profile"
  on public.profiles for insert to authenticated with check (auth.uid() = user_id);
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.update_updated_at_column();

-- ===== User roles =====
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  );
$$;

create policy "user_roles readable by authenticated"
  on public.user_roles for select to authenticated using (true);
create policy "admins manage roles"
  on public.user_roles for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- ===== New user trigger: profile + admin role =====
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  insert into public.user_roles (user_id, role) values (new.id, 'admin');
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ===== Config: products =====
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type public.product_type not null,
  price numeric(10,2) not null default 0,
  sort_order int not null default 0,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table public.products enable row level security;
create policy "products all authenticated" on public.products for all to authenticated using (true) with check (true);
create trigger trg_products_updated before update on public.products
  for each row execute function public.update_updated_at_column();

-- ===== Config: paleta flavor upgrades =====
create table public.paleta_flavor_upgrades (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  upgrade_price numeric(10,2) not null default 0,
  sort_order int not null default 0,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table public.paleta_flavor_upgrades enable row level security;
create policy "flavors all authenticated" on public.paleta_flavor_upgrades for all to authenticated using (true) with check (true);
create trigger trg_flavors_updated before update on public.paleta_flavor_upgrades
  for each row execute function public.update_updated_at_column();

-- ===== Config: payment methods =====
create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  applies_tax boolean not null default false,
  sort_order int not null default 0,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table public.payment_methods enable row level security;
create policy "payment_methods all authenticated" on public.payment_methods for all to authenticated using (true) with check (true);
create trigger trg_payment_methods_updated before update on public.payment_methods
  for each row execute function public.update_updated_at_column();

-- ===== Config: demographic options =====
create table public.demographic_options (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  label text not null,
  sort_order int not null default 0,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table public.demographic_options enable row level security;
create policy "demographics all authenticated" on public.demographic_options for all to authenticated using (true) with check (true);
create trigger trg_demographics_updated before update on public.demographic_options
  for each row execute function public.update_updated_at_column();

-- ===== App settings (single row) =====
create table public.app_settings (
  id uuid primary key default gen_random_uuid(),
  tax_rate numeric(5,2) not null default 0,
  is_singleton boolean not null default true unique,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;
create policy "settings readable" on public.app_settings for select to authenticated using (true);
create policy "settings updatable" on public.app_settings for update to authenticated using (true) with check (true);
create policy "settings insertable" on public.app_settings for insert to authenticated with check (true);
create trigger trg_settings_updated before update on public.app_settings
  for each row execute function public.update_updated_at_column();
insert into public.app_settings (tax_rate) values (0);

-- ===== Sales sessions =====
create table public.sales_sessions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text,
  notes text,
  status public.session_status not null default 'open',
  opened_by uuid not null references auth.users(id),
  opened_at timestamptz not null default now(),
  closed_by uuid references auth.users(id),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table public.sales_sessions enable row level security;
create policy "sessions readable" on public.sales_sessions for select to authenticated using (true);
create policy "sessions insertable" on public.sales_sessions for insert to authenticated with check (auth.uid() = opened_by);
create policy "sessions updatable open by anyone, reopen only admin"
  on public.sales_sessions for update to authenticated
  using (true)
  with check (
    -- closing or editing while open is fine for anyone
    -- reopening (closed -> open) requires admin: enforced via trigger below
    true
  );
create trigger trg_sessions_updated before update on public.sales_sessions
  for each row execute function public.update_updated_at_column();

-- Enforce reopen restriction
create or replace function public.enforce_session_reopen()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'closed' and new.status = 'open' then
    if not public.has_role(auth.uid(), 'admin') then
      raise exception 'Only admins can reopen a closed session';
    end if;
    new.closed_by := null;
    new.closed_at := null;
  end if;
  return new;
end;
$$;
create trigger trg_sessions_reopen before update on public.sales_sessions
  for each row execute function public.enforce_session_reopen();

-- ===== Sales =====
create table public.sales (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sales_sessions(id) on delete cascade,
  logged_by uuid not null references auth.users(id),
  sale_kind public.sale_kind not null default 'single',
  payment_method_id uuid references public.payment_methods(id),
  payment_method_name_snapshot text not null,
  applies_tax_snapshot boolean not null default false,
  tax_rate_snapshot numeric(5,2) not null default 0,
  subtotal numeric(10,2) not null default 0,
  tax_amount numeric(10,2) not null default 0,
  total numeric(10,2) not null default 0,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table public.sales enable row level security;
create policy "sales all authenticated" on public.sales for all to authenticated using (true) with check (true);
create trigger trg_sales_updated before update on public.sales
  for each row execute function public.update_updated_at_column();
create index idx_sales_session on public.sales(session_id);

-- ===== Sale items =====
create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  customer_index int not null default 0,
  product_id uuid references public.products(id),
  product_name_snapshot text not null,
  product_type_snapshot public.product_type not null,
  base_price_snapshot numeric(10,2) not null default 0,
  flavor_upgrade_id uuid references public.paleta_flavor_upgrades(id),
  flavor_name_snapshot text,
  upgrade_price_snapshot numeric(10,2) not null default 0,
  quantity int not null default 1,
  line_total numeric(10,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table public.sale_items enable row level security;
create policy "sale_items all authenticated" on public.sale_items for all to authenticated using (true) with check (true);
create trigger trg_sale_items_updated before update on public.sale_items
  for each row execute function public.update_updated_at_column();
create index idx_sale_items_sale on public.sale_items(sale_id);

-- ===== Sale demographics =====
create table public.sale_demographics (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  customer_index int not null default 0,
  demographic_option_id uuid not null references public.demographic_options(id),
  created_at timestamptz not null default now()
);
alter table public.sale_demographics enable row level security;
create policy "sale_demographics all authenticated" on public.sale_demographics for all to authenticated using (true) with check (true);
create index idx_sale_demographics_sale on public.sale_demographics(sale_id);

-- ===== Realtime =====
alter publication supabase_realtime add table public.sales_sessions;
alter publication supabase_realtime add table public.sales;
alter publication supabase_realtime add table public.sale_items;
alter publication supabase_realtime add table public.sale_demographics;

alter table public.sales_sessions replica identity full;
alter table public.sales replica identity full;
alter table public.sale_items replica identity full;
alter table public.sale_demographics replica identity full;

-- ===== Seed products =====
insert into public.products (name, type, price, sort_order) values
  ('Biscoff Addiction', 'shake', 8.00, 10),
  ('Berry Bliss', 'shake', 8.00, 20),
  ('Piña Cocada', 'shake', 8.00, 30),
  ('Dulce Flow', 'shake', 8.00, 40),
  ('Cocada', 'shake', 8.00, 50),
  ('Paleta', 'paleta', 5.00, 100);

insert into public.paleta_flavor_upgrades (name, upgrade_price, sort_order) values
  ('Chocolate Dip', 1.00, 10),
  ('Sprinkles', 0.50, 20);
