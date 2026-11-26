-- Rangers group chats, leadership quick contacts, editable usernames, and mandatory XP leaderboard.
-- Run once in the Supabase SQL Editor after deploying the matching website update.

-- Every account with an XP record is included in the leaderboard. No opt-out.
alter table public.profiles
  add column if not exists leaderboard_opt_in boolean not null default true;
alter table public.profiles alter column leaderboard_opt_in set default true;
update public.profiles set leaderboard_opt_in = true where leaderboard_opt_in is distinct from true;

drop view if exists public.public_leaderboard;
create view public.public_leaderboard
with (security_barrier = true)
as
select p.display_name, coalesce(ux.xp,0) as xp, coalesce(ux.level,1) as level
from public.profiles p
left join public.user_xp ux on ux.user_id = p.id;

revoke all on public.public_leaderboard from public;
grant select on public.public_leaderboard to anon, authenticated;

-- Group chat tables.
create table if not exists public.rangers_chat_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 60),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.rangers_chat_group_members (
  group_id uuid not null references public.rangers_chat_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  added_by uuid references auth.users(id) on delete set null,
  joined_at timestamptz not null default now(),
  primary key (group_id,user_id)
);

alter table public.rangers_chat_messages
  add column if not exists group_id uuid references public.rangers_chat_groups(id) on delete cascade;

create index if not exists rangers_chat_group_members_user_idx
  on public.rangers_chat_group_members(user_id,group_id);
create index if not exists rangers_chat_messages_group_idx
  on public.rangers_chat_messages(group_id,created_at desc)
  where group_id is not null;

alter table public.rangers_chat_groups enable row level security;
alter table public.rangers_chat_group_members enable row level security;

-- SECURITY DEFINER avoids recursive RLS when policies check group membership.
create or replace function public.rangers_is_chat_group_member(p_group_id uuid)
returns boolean
language sql stable security definer set search_path=public as $$
  select exists (
    select 1 from public.rangers_chat_group_members gm
    where gm.group_id=p_group_id and gm.user_id=auth.uid()
  );
$$;
revoke all on function public.rangers_is_chat_group_member(uuid) from public,anon;
grant execute on function public.rangers_is_chat_group_member(uuid) to authenticated;

drop policy if exists "Group members can view their groups" on public.rangers_chat_groups;
create policy "Group members can view their groups"
on public.rangers_chat_groups for select to authenticated
using (public.rangers_is_chat_group_member(id));

drop policy if exists "Members can view group membership" on public.rangers_chat_group_members;
create policy "Members can view group membership"
on public.rangers_chat_group_members for select to authenticated
using (public.rangers_is_chat_group_member(group_id));

-- Keep global and private messages separate from group messages.
drop policy if exists "Signed in users can read global chat" on public.rangers_chat_messages;
create policy "Signed in users can read global chat"
on public.rangers_chat_messages for select to authenticated
using (recipient_id is null and group_id is null);

drop policy if exists "Participants can read private messages" on public.rangers_chat_messages;
create policy "Participants can read private messages"
on public.rangers_chat_messages for select to authenticated
using (group_id is null and recipient_id is not null and auth.uid() in (sender_id,recipient_id));

drop policy if exists "Users can send global messages" on public.rangers_chat_messages;
create policy "Users can send global messages"
on public.rangers_chat_messages for insert to authenticated
with check (auth.uid() = sender_id and recipient_id is null and group_id is null);

drop policy if exists "Users can send permitted private messages" on public.rangers_chat_messages;
create policy "Users can send permitted private messages"
on public.rangers_chat_messages for insert to authenticated
with check (
  auth.uid() = sender_id and group_id is null and recipient_id is not null
  and public.rangers_chat_can_dm(auth.uid(),recipient_id)
);

drop policy if exists "Group members can read group messages" on public.rangers_chat_messages;
create policy "Group members can read group messages"
on public.rangers_chat_messages for select to authenticated
using (group_id is not null and public.rangers_is_chat_group_member(group_id));

drop policy if exists "Group members can send group messages" on public.rangers_chat_messages;
create policy "Group members can send group messages"
on public.rangers_chat_messages for insert to authenticated
with check (
  auth.uid() = sender_id and group_id is not null and recipient_id is null
  and public.rangers_is_chat_group_member(group_id)
);

revoke all on public.rangers_chat_groups from anon;
revoke all on public.rangers_chat_group_members from anon;
grant select on public.rangers_chat_groups to authenticated;
grant select on public.rangers_chat_group_members to authenticated;

create or replace function public.rangers_create_chat_group(p_name text,p_member_ids uuid[] default '{}')
returns uuid
language plpgsql security definer set search_path=public as $$
declare
  v_group_id uuid;
  v_member uuid;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if char_length(trim(coalesce(p_name,''))) < 2 or char_length(trim(p_name)) > 60 then
    raise exception 'Group name must be 2–60 characters';
  end if;
  insert into public.rangers_chat_groups(name,created_by)
  values(trim(p_name),auth.uid()) returning id into v_group_id;
  insert into public.rangers_chat_group_members(group_id,user_id,added_by)
  values(v_group_id,auth.uid(),auth.uid());
  foreach v_member in array coalesce(p_member_ids,'{}'::uuid[]) loop
    if v_member <> auth.uid() then
      insert into public.rangers_chat_group_members(group_id,user_id,added_by)
      values(v_group_id,v_member,auth.uid()) on conflict do nothing;
    end if;
  end loop;
  return v_group_id;
end $$;

create or replace function public.rangers_add_chat_group_members(p_group_id uuid,p_member_ids uuid[])
returns integer
language plpgsql security definer set search_path=public as $$
declare
  v_added integer := 0;
  v_member uuid;
begin
  if not public.rangers_is_chat_group_member(p_group_id) then
    raise exception 'Only group members can invite people';
  end if;
  foreach v_member in array coalesce(p_member_ids,'{}'::uuid[]) loop
    insert into public.rangers_chat_group_members(group_id,user_id,added_by)
    values(p_group_id,v_member,auth.uid()) on conflict do nothing;
    if found then v_added := v_added + 1; end if;
  end loop;
  return v_added;
end $$;

create or replace function public.rangers_my_chat_groups()
returns table(id uuid,name text,created_by uuid,member_count bigint)
language sql stable security definer set search_path=public as $$
  select g.id,g.name,g.created_by,count(gm2.user_id)
  from public.rangers_chat_groups g
  join public.rangers_chat_group_members mine on mine.group_id=g.id and mine.user_id=auth.uid()
  join public.rangers_chat_group_members gm2 on gm2.group_id=g.id
  group by g.id,g.name,g.created_by,g.created_at
  order by g.created_at desc;
$$;

revoke all on function public.rangers_create_chat_group(text,uuid[]) from public,anon;
revoke all on function public.rangers_add_chat_group_members(uuid,uuid[]) from public,anon;
revoke all on function public.rangers_my_chat_groups() from public,anon;
grant execute on function public.rangers_create_chat_group(text,uuid[]) to authenticated;
grant execute on function public.rangers_add_chat_group_members(uuid,uuid[]) to authenticated;
grant execute on function public.rangers_my_chat_groups() to authenticated;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='rangers_chat_groups') then
    alter publication supabase_realtime add table public.rangers_chat_groups;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='rangers_chat_group_members') then
    alter publication supabase_realtime add table public.rangers_chat_group_members;
  end if;
end $$;
