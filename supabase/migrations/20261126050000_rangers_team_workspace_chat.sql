-- Automatically create one private group chat for every team workspace.
-- Keep chat membership synchronized with the team roster.

alter table public.rangers_chat_groups
  add column if not exists team_id uuid references public.rangers_teams(id) on delete cascade;

create unique index if not exists rangers_chat_groups_team_id_uidx
  on public.rangers_chat_groups(team_id)
  where team_id is not null;

create or replace function public.rangers_sync_team_chat_member()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_group_id uuid;
begin
  if tg_op = 'INSERT' then
    insert into public.rangers_chat_groups(name,created_by,team_id)
    select left(trim(t.name),53) || ' Chat',t.created_by,t.id
    from public.rangers_teams t
    where t.id=new.team_id
    on conflict (team_id) where team_id is not null do nothing;

    select id into v_group_id
    from public.rangers_chat_groups
    where team_id=new.team_id;

    insert into public.rangers_chat_group_members(group_id,user_id,added_by)
    values(v_group_id,new.user_id,new.user_id)
    on conflict(group_id,user_id) do nothing;

    return new;
  elsif tg_op = 'UPDATE' then
    update public.rangers_chat_groups g
    set name=left(trim(new.name),53) || ' Chat'
    where g.team_id=new.id;
    return new;
  else
    delete from public.rangers_chat_group_members gm
    using public.rangers_chat_groups g
    where gm.group_id=g.id
      and g.team_id=old.team_id
      and gm.user_id=old.user_id;
    return old;
  end if;
end;
$$;

drop trigger if exists rangers_team_chat_member_sync on public.rangers_team_members;
create trigger rangers_team_chat_member_sync
after insert or delete on public.rangers_team_members
for each row execute function public.rangers_sync_team_chat_member();

drop trigger if exists rangers_team_chat_name_sync on public.rangers_teams;
create trigger rangers_team_chat_name_sync
after update of name on public.rangers_teams
for each row execute function public.rangers_sync_team_chat_member();

-- Backfill one chat for every existing workspace and add its current roster.
insert into public.rangers_chat_groups(name,created_by,team_id)
select left(trim(t.name),53) || ' Chat',t.created_by,t.id
from public.rangers_teams t
on conflict (team_id) where team_id is not null do nothing;

insert into public.rangers_chat_group_members(group_id,user_id,added_by)
select g.id,m.user_id,m.user_id
from public.rangers_team_members m
join public.rangers_chat_groups g on g.team_id=m.team_id
on conflict(group_id,user_id) do nothing;

create or replace function public.rangers_my_team_chat(p_team_id uuid)
returns table(group_id uuid,group_name text,member_count bigint)
language plpgsql
stable
security definer
set search_path=public
as $$
begin
  if auth.uid() is null or not public.rangers_is_team_member(p_team_id) then
    raise exception 'You must be a member of this team to open its chat';
  end if;

  return query
  select g.id,g.name,count(gm.user_id)::bigint
  from public.rangers_chat_groups g
  join public.rangers_chat_group_members gm on gm.group_id=g.id
  where g.team_id=p_team_id
  group by g.id,g.name;
end;
$$;

revoke all on function public.rangers_sync_team_chat_member() from public,anon,authenticated;
revoke all on function public.rangers_my_team_chat(uuid) from public,anon;
grant execute on function public.rangers_my_team_chat(uuid) to authenticated;
