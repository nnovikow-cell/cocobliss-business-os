-- ============================================================
-- Phase 1: Events module — schema + instance generation
-- ============================================================

-- Enums
create type public.event_recurrence as enum ('single', 'weekly', 'biweekly', 'monthly');
create type public.event_series_status as enum ('active', 'terminated');
create type public.event_instance_status as enum ('confirmed', 'not_attending', 'cancelled');

-- ---------- Event Tags ----------
create table public.event_tags (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text not null default 'teal',
  sort_order integer not null default 0,
  is_archived boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.event_tags enable row level security;
create policy "event_tags all authenticated" on public.event_tags
  for all to authenticated using (true) with check (true);
create trigger trg_event_tags_updated_at before update on public.event_tags
  for each row execute function public.update_updated_at_column();

-- ---------- Event Series ----------
create table public.event_series (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tag_id uuid references public.event_tags(id) on delete set null,
  location text,
  recurrence public.event_recurrence not null default 'single',
  start_date date not null,
  end_date date not null,
  status public.event_series_status not null default 'active',
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_series_dates_chk check (end_date >= start_date)
);
alter table public.event_series enable row level security;
create policy "event_series all authenticated" on public.event_series
  for all to authenticated using (true) with check (true);
create trigger trg_event_series_updated_at before update on public.event_series
  for each row execute function public.update_updated_at_column();
create index idx_event_series_status on public.event_series(status);

-- ---------- Event Instances ----------
create table public.event_instances (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null references public.event_series(id) on delete cascade,
  date date not null,
  status public.event_instance_status not null default 'confirmed',
  planned_staff_ids uuid[] not null default '{}',
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (series_id, date)
);
alter table public.event_instances enable row level security;
create policy "event_instances all authenticated" on public.event_instances
  for all to authenticated using (true) with check (true);
create trigger trg_event_instances_updated_at before update on public.event_instances
  for each row execute function public.update_updated_at_column();
create index idx_event_instances_date on public.event_instances(date);
create index idx_event_instances_series on public.event_instances(series_id);

-- ---------- Extend attendants → staff fields ----------
alter table public.attendants
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists role text,
  add column if not exists active boolean not null default true;

-- Backfill first_name from existing name
update public.attendants
   set first_name = coalesce(first_name, name)
 where first_name is null;

-- ---------- Add event_instance_id linkage to other modules ----------
alter table public.sales_sessions
  add column if not exists event_instance_id uuid references public.event_instances(id) on delete set null;
create index if not exists idx_sales_sessions_event_instance on public.sales_sessions(event_instance_id);

alter table public.checklist_sessions
  add column if not exists event_instance_id uuid references public.event_instances(id) on delete set null;
create index if not exists idx_checklist_sessions_event_instance on public.checklist_sessions(event_instance_id);

alter table public.inventory_logs
  add column if not exists event_instance_id uuid references public.event_instances(id) on delete set null;
create index if not exists idx_inventory_logs_event_instance on public.inventory_logs(event_instance_id);

-- ============================================================
-- Instance generation logic
-- ============================================================

create or replace function public.generate_event_instances(p_series_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s record;
  d date;
  step_days integer;
begin
  select * into s from public.event_series where id = p_series_id;
  if not found then return; end if;
  if s.status = 'terminated' then return; end if;

  if s.recurrence = 'single' then
    insert into public.event_instances (series_id, date)
    values (s.id, s.start_date)
    on conflict (series_id, date) do nothing;
    return;
  end if;

  d := s.start_date;
  if s.recurrence = 'weekly' then
    step_days := 7;
  elsif s.recurrence = 'biweekly' then
    step_days := 14;
  end if;

  while d <= s.end_date loop
    insert into public.event_instances (series_id, date)
    values (s.id, d)
    on conflict (series_id, date) do nothing;

    if s.recurrence = 'monthly' then
      d := (d + interval '1 month')::date;
    else
      d := (d + (step_days || ' days')::interval)::date;
    end if;
  end loop;
end;
$$;

-- Helper: delete future instances that have no linked data, after a cutoff date
create or replace function public.prune_unlinked_future_instances(p_series_id uuid, p_cutoff_date date)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.event_instances ei
   where ei.series_id = p_series_id
     and ei.date > p_cutoff_date
     and not exists (select 1 from public.sales_sessions     s where s.event_instance_id = ei.id)
     and not exists (select 1 from public.checklist_sessions c where c.event_instance_id = ei.id)
     and not exists (select 1 from public.inventory_logs     l where l.event_instance_id = ei.id);
end;
$$;

-- AFTER INSERT: generate all instances
create or replace function public.event_series_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.generate_event_instances(new.id);
  return new;
end;
$$;

create trigger trg_event_series_after_insert
  after insert on public.event_series
  for each row execute function public.event_series_after_insert();

-- AFTER UPDATE: extend / shrink / terminate
create or replace function public.event_series_after_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Termination: prune future unlinked instances regardless of end_date
  if new.status = 'terminated' and old.status <> 'terminated' then
    perform public.prune_unlinked_future_instances(new.id, current_date);
    return new;
  end if;

  -- Re-activated: regenerate forward
  if new.status = 'active' and old.status = 'terminated' then
    perform public.generate_event_instances(new.id);
    return new;
  end if;

  -- end_date shortened: prune future unlinked beyond new end_date
  if new.end_date < old.end_date then
    perform public.prune_unlinked_future_instances(new.id, new.end_date);
  end if;

  -- end_date extended OR start_date changed: top-up missing instances
  if new.end_date > old.end_date or new.start_date <> old.start_date or new.recurrence <> old.recurrence then
    perform public.generate_event_instances(new.id);
  end if;

  return new;
end;
$$;

create trigger trg_event_series_after_update
  after update on public.event_series
  for each row execute function public.event_series_after_update();
