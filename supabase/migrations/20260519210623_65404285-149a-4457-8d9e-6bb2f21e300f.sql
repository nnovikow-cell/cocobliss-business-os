create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  meeting_date date not null,
  attendee_ids uuid[] not null default '{}',
  attendee_names_snapshot text[] not null default '{}',
  topics_discussed text,
  decisions jsonb not null default '[]',
  action_items jsonb not null default '[]',
  next_meeting_topics text,
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table public.meetings enable row level security;
create policy "meetings all authenticated"
  on public.meetings for all to authenticated using (true) with check (true);
create trigger trg_meetings_updated before update on public.meetings
  for each row execute function public.update_updated_at_column();