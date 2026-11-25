-- FTC Rangers Supabase foundation
-- Run this file in Supabase SQL Editor. All user-owned data is protected by RLS.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null default 'Rangers Student',
  avatar_url text,
  role text not null default 'student' check (role in ('student','admin','co_owner','owner')),
  profile_public boolean not null default false,
  leaderboard_opt_in boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.team_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  membership_status text not null default 'pending' check (membership_status in ('pending','active','suspended')),
  joined_at timestamptz not null default now()
);

create table if not exists public.user_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  academy text not null check (academy in ('cad','programming')),
  lesson_id text not null,
  completed boolean not null default false,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(user_id, academy, lesson_id)
);

create table if not exists public.user_xp (
  user_id uuid primary key references auth.users(id) on delete cascade,
  xp integer not null default 0 check (xp >= 0),
  level integer not null default 1 check (level >= 1),
  updated_at timestamptz not null default now()
);

create table if not exists public.achievements (
  id text primary key,
  title text not null,
  description text not null,
  icon text not null default '🏆'
);

create table if not exists public.user_achievements (
  user_id uuid not null references auth.users(id) on delete cascade,
  achievement_id text not null references public.achievements(id) on delete cascade,
  earned_at timestamptz not null default now(),
  primary key(user_id, achievement_id)
);

create table if not exists public.saved_code (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  language text not null default 'java',
  code text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_applications (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references auth.users(id) on delete cascade,
  applicant_email text not null,
  display_name text not null,
  reason text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  assigned_role text check (assigned_role in ('admin','co_owner')),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.scouting_records (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id),
  event_name text not null,
  match_number text not null,
  team_number integer not null,
  autonomous_score integer not null default 0,
  teleop_score integer not null default 0,
  endgame_score integer not null default 0,
  reliability text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.maintenance_logs (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id),
  subsystem text not null,
  status text not null,
  notes text,
  service_date date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists public.parts_lists (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id),
  part_name text not null,
  quantity integer not null default 1 check (quantity > 0),
  acquired boolean not null default false,
  notes text,
  updated_at timestamptz not null default now()
);

create table if not exists public.notebook_entries (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id),
  entry_type text not null default 'engineering',
  title text not null,
  work text,
  result text,
  next_steps text,
  entry_date date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id),
  title text not null,
  body text not null,
  published boolean not null default false,
  created_at timestamptz not null default now()
);

create or replace function public.current_user_role()
returns text language sql stable security definer set search_path = public
as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'student');
$$;

create or replace function public.is_team_member()
returns boolean language sql stable security definer set search_path = public
as $
  select public.current_user_role() in ('admin','co_owner','owner')
    or exists (select 1 from public.team_members where user_id = auth.uid() and membership_status = 'active');
$;

create or replace function public.is_team_admin()
returns boolean language sql stable security definer set search_path = public
as $$
  select public.current_user_role() in ('admin','co_owner','owner');
$$;

create or replace function public.is_team_lead()
returns boolean language sql stable security definer set search_path = public
as $$
  select public.current_user_role() in ('co_owner','owner');
$$;

create or replace function public.create_profile_for_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles(id, email, display_name, role)
  values (
    new.id,
    lower(new.email),
    coalesce(nullif(new.raw_user_meta_data->>'display_name',''), split_part(new.email,'@',1)),
    case when lower(new.email) = 'humzanagaria@gmail.com' then 'owner' else 'student' end
  )
  on conflict (id) do nothing;

  if lower(new.email) = 'humzanagaria@gmail.com' then
    insert into public.team_members(user_id, membership_status) values (new.id, 'active')
    on conflict (user_id) do update set membership_status = 'active';
  end if;

  insert into public.user_xp(user_id, xp, level)
  values (new.id, 0, 1)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_rangers on auth.users;
create trigger on_auth_user_created_rangers
after insert on auth.users
for each row execute procedure public.create_profile_for_new_user();

-- Also bootstrap the owner if their Auth account existed before this schema was installed.
insert into public.profiles(id, email, display_name, role)
select id, lower(email), coalesce(nullif(raw_user_meta_data->>'display_name',''), 'Rangers Owner'), 'owner'
from auth.users where lower(email) = 'humzanagaria@gmail.com'
on conflict (id) do update set role = 'owner', email = excluded.email;

insert into public.team_members(user_id, membership_status)
select id, 'active' from auth.users where lower(email) = 'humzanagaria@gmail.com'
on conflict (user_id) do update set membership_status = 'active';

insert into public.user_xp(user_id, xp, level)
select id, 0, 1 from auth.users where lower(email) = 'humzanagaria@gmail.com'
on conflict (user_id) do nothing;

-- Prevent users from editing their own role, email, or moderation flags directly.
create or replace function public.protect_profile_privileged_fields()
returns trigger language plpgsql set search_path = public
as $$
begin
  if auth.uid() is not null and auth.uid() = old.id then
    new.role := old.role;
    new.email := old.email;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists protect_profile_privileged_fields on public.profiles;
create trigger protect_profile_privileged_fields
before update on public.profiles
for each row execute procedure public.protect_profile_privileged_fields();

create or replace function public.review_admin_application(
  p_application_id uuid,
  p_decision text,
  p_role text default null
)
returns void language plpgsql security definer set search_path = public
as $$
declare
  app public.admin_applications%rowtype;
  reviewer_role text;
begin
  reviewer_role := public.current_user_role();
  if reviewer_role not in ('owner','co_owner') then
    raise exception 'Not authorized to review applications';
  end if;
  if p_decision not in ('approve','reject') then
    raise exception 'Invalid decision';
  end if;
  if p_decision = 'approve' and p_role not in ('admin','co_owner') then
    raise exception 'Choose admin or co_owner';
  end if;
  if reviewer_role = 'co_owner' and p_role = 'co_owner' then
    raise exception 'Only the owner can appoint a co-owner';
  end if;

  select * into app from public.admin_applications
  where id = p_application_id and status = 'pending'
  for update;
  if not found then raise exception 'Application not found or already reviewed'; end if;

  if p_decision = 'approve' then
    update public.profiles set role = p_role where id = app.applicant_id;
    update public.admin_applications
      set status = 'approved', assigned_role = p_role,
          reviewed_by = auth.uid(), reviewed_at = now()
      where id = p_application_id;
  else
    update public.admin_applications
      set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now()
      where id = p_application_id;
  end if;
end;
$$;

create or replace function public.set_member_role(p_user_id uuid, p_role text)
returns void language plpgsql security definer set search_path = public
as $$
declare caller_role text := public.current_user_role();
declare target_role text;
begin
  if caller_role not in ('owner','co_owner') then raise exception 'Not authorized'; end if;
  if p_role not in ('student','admin','co_owner') then raise exception 'Invalid role'; end if;
  select role into target_role from public.profiles where id = p_user_id for update;
  if target_role is null then raise exception 'User not found'; end if;
  if target_role = 'owner' then raise exception 'Owner role cannot be changed here'; end if;
  if caller_role = 'co_owner' and (p_role = 'co_owner' or target_role = 'co_owner') then
    raise exception 'Only the owner can manage co-owners';
  end if;
  update public.profiles set role = p_role where id = p_user_id;
end;
$$;

alter table public.profiles enable row level security;
alter table public.team_members enable row level security;
alter table public.user_progress enable row level security;
alter table public.user_xp enable row level security;
alter table public.achievements enable row level security;
alter table public.user_achievements enable row level security;
alter table public.saved_code enable row level security;
alter table public.admin_applications enable row level security;
alter table public.scouting_records enable row level security;
alter table public.maintenance_logs enable row level security;
alter table public.parts_lists enable row level security;
alter table public.notebook_entries enable row level security;
alter table public.announcements enable row level security;

create policy "Profiles readable by signed in users" on public.profiles for select to authenticated using (true);
create policy "Users update own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "Users manage own progress" on public.user_progress for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users read own XP" on public.user_xp for select to authenticated using (user_id = auth.uid());
create policy "Opted-in XP is visible for leaderboard" on public.user_xp for select to authenticated
using (exists (select 1 from public.profiles p where p.id = user_id and p.profile_public = true and p.leaderboard_opt_in = true));
create policy "Team leads read XP for leaderboard" on public.user_xp for select to authenticated using (public.is_team_admin());
create policy "Achievements visible to signed in users" on public.achievements for select to authenticated using (true);
create policy "Users read own achievements" on public.user_achievements for select to authenticated using (user_id = auth.uid());
create policy "Users manage own saved code" on public.saved_code for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "Users submit own applications" on public.admin_applications for insert to authenticated with check (applicant_id = auth.uid() and lower(applicant_email) = lower(auth.jwt()->>'email'));
create policy "Applicants and team leads read applications" on public.admin_applications for select to authenticated using (applicant_id = auth.uid() or public.is_team_lead());

create policy "Members read team membership" on public.team_members for select to authenticated using (user_id = auth.uid() or public.is_team_admin());
create policy "Leads manage team membership" on public.team_members for all to authenticated using (public.is_team_lead()) with check (public.is_team_lead());
create policy "Team members read scouting" on public.scouting_records for select to authenticated using (public.is_team_member());
create policy "Admins manage scouting" on public.scouting_records for all to authenticated using (public.is_team_admin()) with check (public.is_team_admin());
create policy "Team members read maintenance" on public.maintenance_logs for select to authenticated using (public.is_team_member());
create policy "Admins manage maintenance" on public.maintenance_logs for all to authenticated using (public.is_team_admin() and public.is_team_member()) with check (public.is_team_admin() and public.is_team_member());
create policy "Team members read parts lists" on public.parts_lists for select to authenticated using (public.is_team_member());
create policy "Admins manage parts lists" on public.parts_lists for all to authenticated using (public.is_team_admin() and public.is_team_member()) with check (public.is_team_admin() and public.is_team_member());
create policy "Team members read notebook" on public.notebook_entries for select to authenticated using (public.is_team_member());
create policy "Admins manage notebook" on public.notebook_entries for all to authenticated using (public.is_team_admin() and public.is_team_member()) with check (public.is_team_admin() and public.is_team_member());
create policy "Published announcements readable" on public.announcements for select to authenticated using (public.is_team_member() and (published = true or public.is_team_admin()));
create policy "Admins manage announcements" on public.announcements for all to authenticated using (public.is_team_admin()) with check (public.is_team_admin());

grant execute on function public.review_admin_application(uuid,text,text) to authenticated;
grant execute on function public.set_member_role(uuid,text) to authenticated;
grant execute on function public.current_user_role() to authenticated;\ngrant execute on function public.is_team_member() to authenticated;
grant execute on function public.is_team_admin() to authenticated;
grant execute on function public.is_team_lead() to authenticated;

insert into public.achievements(id,title,description,icon) values
('first_lesson','First Steps','Complete your first Academy lesson.','🎯'),
('cad_builder','CAD Builder','Complete 10 CAD lessons.','🧩'),
('java_starter','Java Starter','Complete 10 Programming lessons.','💻'),
('rangers_engineer','Rangers Engineer','Complete 50 Academy lessons.','🤖')
on conflict (id) do nothing;

-- Public leaderboard view: only profiles that explicitly opt in are included.
create or replace view public.public_leaderboard
with (security_invoker = true) as
select p.id, p.display_name, p.avatar_url, x.xp, x.level
from public.profiles p
join public.user_xp x on x.user_id = p.id
where p.profile_public = true and p.leaderboard_opt_in = true;

grant select on public.public_leaderboard to authenticated;

create or replace view public.public_student_profiles
with (security_invoker = true) as
select id, display_name, avatar_url
from public.profiles
where profile_public = true;

grant select on public.public_student_profiles to authenticated;
