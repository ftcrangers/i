-- Rangers admin learning analytics, bug reports, and moderated team registrations.
-- Safe to apply more than once.

create table if not exists public.bug_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 4 and 120),
  description text not null check (char_length(trim(description)) between 15 and 4000),
  page_path text not null default '' check (char_length(page_path) <= 500),
  status text not null default 'open' check (status in ('open','in_progress','resolved')),
  created_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz
);

create index if not exists bug_reports_status_created_idx
  on public.bug_reports(status, created_at desc);

alter table public.bug_reports enable row level security;
drop policy if exists "Users submit their own bug reports" on public.bug_reports;
create policy "Users submit their own bug reports"
  on public.bug_reports for insert to authenticated
  with check (reporter_id = auth.uid() and status = 'open' and reviewed_by is null and reviewed_at is null);
drop policy if exists "Users and admins read bug reports" on public.bug_reports;
create policy "Users and admins read bug reports"
  on public.bug_reports for select to authenticated
  using (reporter_id = auth.uid() or public.is_team_admin());
drop policy if exists "Admins update bug reports" on public.bug_reports;
create policy "Admins update bug reports"
  on public.bug_reports for update to authenticated
  using (public.is_team_admin())
  with check (public.is_team_admin());
grant select, insert, update on public.bug_reports to authenticated;

create table if not exists public.team_registrations (
  id uuid primary key default gen_random_uuid(),
  submitted_by uuid not null references public.profiles(id) on delete cascade,
  team_number integer not null check (team_number between 1 and 99999),
  team_name text not null check (char_length(trim(team_name)) between 2 and 100),
  contact_name text not null check (char_length(trim(contact_name)) between 2 and 80),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz
);

create index if not exists team_registrations_status_created_idx
  on public.team_registrations(status, created_at desc);
create unique index if not exists team_registrations_one_pending_number_idx
  on public.team_registrations(team_number) where status = 'pending';
create unique index if not exists team_registrations_one_approved_number_idx
  on public.team_registrations(team_number) where status = 'approved';

alter table public.team_registrations enable row level security;
drop policy if exists "Users submit team registrations" on public.team_registrations;
create policy "Users submit team registrations"
  on public.team_registrations for insert to authenticated
  with check (submitted_by = auth.uid() and status = 'pending' and reviewed_by is null and reviewed_at is null);
drop policy if exists "Users and admins read team registrations" on public.team_registrations;
create policy "Users and admins read team registrations"
  on public.team_registrations for select to authenticated
  using (submitted_by = auth.uid() or public.is_team_admin());
drop policy if exists "Admins review team registrations" on public.team_registrations;
create policy "Admins review team registrations"
  on public.team_registrations for update to authenticated
  using (public.is_team_admin())
  with check (public.is_team_admin());
grant select, insert, update on public.team_registrations to authenticated;

-- SECURITY DEFINER lets the aggregate read every student's progress without
-- exposing individual progress rows to admins through the normal table API.
create or replace function public.get_admin_learning_stats()
returns table (
  total_completed bigint,
  cad_completed bigint,
  programming_completed bigint,
  active_learners bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_team_admin() then
    raise exception 'Not authorized to view learning analytics';
  end if;

  return query
  select
    count(*) filter (where up.completed)::bigint,
    count(*) filter (where up.completed and up.academy = 'cad')::bigint,
    count(*) filter (where up.completed and up.academy = 'programming')::bigint,
    count(distinct up.user_id) filter (where up.completed)::bigint
  from public.user_progress up;
end;
$$;

revoke all on function public.get_admin_learning_stats() from public;
grant execute on function public.get_admin_learning_stats() to authenticated;
