-- Make the shared leaderboard reflect Skills Academy completions stored in Supabase.
-- Each passed CAD or Programming Academy lesson is worth 60 XP.
-- The leaderboard view continues to require explicit profile + leaderboard opt-in.

create table if not exists public.user_xp (
  user_id uuid primary key references auth.users(id) on delete cascade,
  xp integer not null default 0 check (xp >= 0),
  level integer not null default 1 check (level >= 1)
);

create unique index if not exists user_xp_user_id_unique_idx
  on public.user_xp(user_id);

create or replace function public.refresh_user_skill_xp(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_xp integer;
begin
  if p_user_id is null then
    return;
  end if;

  select (count(*) filter (where completed) * 60)::integer
    into v_xp
  from public.user_progress
  where user_id = p_user_id
    and academy in ('cad', 'programming');

  v_xp := coalesce(v_xp, 0);

  insert into public.user_xp(user_id, xp, level)
  values (p_user_id, v_xp, greatest(1, (v_xp / 250) + 1))
  on conflict (user_id) do update
    set xp = excluded.xp,
        level = excluded.level;
end;
$$;

create or replace function public.sync_user_skill_xp_from_progress()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_user_skill_xp(old.user_id);
    return old;
  end if;

  perform public.refresh_user_skill_xp(new.user_id);

  if tg_op = 'UPDATE' and old.user_id is distinct from new.user_id then
    perform public.refresh_user_skill_xp(old.user_id);
  end if;

  return new;
end;
$$;

drop trigger if exists sync_user_skill_xp_from_progress on public.user_progress;
create trigger sync_user_skill_xp_from_progress
after insert or update or delete on public.user_progress
for each row execute function public.sync_user_skill_xp_from_progress();

-- Backfill existing Academy completions so current learners appear immediately.
do $$
declare
  v_user record;
begin
  for v_user in
    select user_id from public.user_progress
    union
    select user_id from public.user_xp
  loop
    perform public.refresh_user_skill_xp(v_user.user_id);
  end loop;
end;
$$;

revoke all on function public.refresh_user_skill_xp(uuid) from public, anon, authenticated;
revoke all on function public.sync_user_skill_xp_from_progress() from public, anon, authenticated;
