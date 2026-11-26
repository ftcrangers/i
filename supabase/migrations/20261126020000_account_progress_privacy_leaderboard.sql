-- Prevent learning data from crossing accounts and make leaderboard participation opt-in.
-- Existing leaderboard entries are opted out once so nobody stays public by default.

alter table public.profiles
  add column if not exists profile_public boolean not null default false,
  add column if not exists leaderboard_opt_in boolean not null default false;

alter table public.profiles
  alter column profile_public set default false,
  alter column leaderboard_opt_in set default false;

update public.profiles
set leaderboard_opt_in = false
where leaderboard_opt_in is distinct from false;

-- Lesson progress must only be readable or writable by the account that owns it.
alter table public.user_progress enable row level security;
do $$
declare p record;
begin
  for p in select policyname from pg_policies
    where schemaname='public' and tablename='user_progress'
  loop
    execute format('drop policy %I on public.user_progress',p.policyname);
  end loop;
end $$;
create policy "Users manage only their own lesson progress"
  on public.user_progress for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
revoke all on public.user_progress from anon;
grant select, insert, update, delete on public.user_progress to authenticated;

-- XP records are private; the public leaderboard uses a filtered view below.
alter table public.user_xp enable row level security;
do $$
declare p record;
begin
  for p in select policyname from pg_policies
    where schemaname='public' and tablename='user_xp'
  loop
    execute format('drop policy %I on public.user_xp',p.policyname);
  end loop;
end $$;
create policy "Users can read only their own XP"
  on public.user_xp for select to authenticated
  using (auth.uid() = user_id);
revoke all on public.user_xp from anon;
revoke insert, update, delete on public.user_xp from authenticated;
grant select on public.user_xp to authenticated;

-- The view exposes only the fields needed for ranking, and only after BOTH
-- profile visibility and leaderboard opt-in have been explicitly enabled.
drop view if exists public.public_leaderboard;
create view public.public_leaderboard
with (security_barrier = true)
as
select p.display_name, ux.xp, ux.level
from public.profiles p
join public.user_xp ux on ux.user_id = p.id
where p.profile_public is true
  and p.leaderboard_opt_in is true;

revoke all on public.public_leaderboard from public;
grant select on public.public_leaderboard to anon, authenticated;
