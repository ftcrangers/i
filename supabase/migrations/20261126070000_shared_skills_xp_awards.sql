-- Store Skills XP awards in Supabase exactly once per member and lesson.
-- The browser cannot write user_xp directly; this function validates a completed
-- cloud lesson and performs the award under the authenticated user's identity.

create table if not exists public.user_xp_awards (
  user_id uuid not null references auth.users(id) on delete cascade,
  award_key text not null check (char_length(award_key) between 1 and 120),
  xp_amount integer not null check (xp_amount > 0),
  created_at timestamptz not null default now(),
  primary key (user_id, award_key)
);

alter table public.user_xp_awards enable row level security;
revoke all on public.user_xp_awards from anon, authenticated;

insert into public.user_xp(user_id, xp, level)
select id, 0, 1 from auth.users
on conflict (user_id) do nothing;

create or replace function public.rangers_award_skills_xp(
  p_award_key text,
  p_academy text,
  p_lesson_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_xp integer;
  v_level integer;
begin
  if v_user_id is null then
    raise exception 'Sign in to earn shared Skills XP';
  end if;

  if p_academy not in ('cad','programming')
     or p_lesson_id !~ '^(CAD|Programming)-[0-9]+$'
     or p_award_key <> 'advanced-v2-' || p_lesson_id
     or (p_academy = 'cad' and p_lesson_id not like 'CAD-%')
     or (p_academy = 'programming' and p_lesson_id not like 'Programming-%') then
    raise exception 'Invalid Skills XP award';
  end if;

  if not exists (
    select 1 from public.user_progress
    where user_id = v_user_id
      and academy = p_academy
      and lesson_id = p_lesson_id
      and completed is true
  ) then
    raise exception 'Complete and sync this Skills lesson before earning XP';
  end if;

  insert into public.user_xp_awards(user_id, award_key, xp_amount)
  values (v_user_id, p_award_key, 60)
  on conflict (user_id, award_key) do nothing;

  if not found then
    select xp, level into v_xp, v_level
    from public.user_xp where user_id = v_user_id;
    return jsonb_build_object('xp', coalesce(v_xp,0), 'level', coalesce(v_level,1), 'awarded', false);
  end if;

  insert into public.user_xp(user_id, xp, level)
  values (v_user_id, 0, 1)
  on conflict (user_id) do nothing;

  update public.user_xp
  set xp = xp + 60,
      level = floor((xp + 60)::numeric / 250)::integer + 1,
      updated_at = now()
  where user_id = v_user_id
  returning xp, level into v_xp, v_level;

  return jsonb_build_object('xp', v_xp, 'level', v_level, 'awarded', true);
end;
$$;

revoke all on function public.rangers_award_skills_xp(text,text,text) from public, anon;
grant execute on function public.rangers_award_skills_xp(text,text,text) to authenticated;
