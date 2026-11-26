create extension if not exists pgcrypto;
create table if not exists public.rangers_teams(id uuid primary key default gen_random_uuid(),name text not null check(char_length(trim(name)) between 2 and 80),team_number integer check(team_number is null or team_number between 1 and 99999),created_by uuid not null references auth.users(id) on delete restrict,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists public.rangers_team_members(team_id uuid not null references public.rangers_teams(id) on delete cascade,user_id uuid not null references auth.users(id) on delete cascade,role text not null check(role in ('owner','coach','student')),joined_at timestamptz not null default now(),primary key(team_id,user_id));
create table if not exists public.rangers_team_invites(id uuid primary key default gen_random_uuid(),team_id uuid not null references public.rangers_teams(id) on delete cascade,email text not null,role text not null check(role in ('coach','student')),token_hash text not null unique,invited_by uuid not null references auth.users(id) on delete cascade,expires_at timestamptz not null default(now()+interval '14 days'),accepted_at timestamptz,created_at timestamptz not null default now());
create index if not exists rangers_team_members_user_idx on public.rangers_team_members(user_id);
alter table public.rangers_teams enable row level security;
alter table public.rangers_team_members enable row level security;
alter table public.rangers_team_invites enable row level security;
create or replace function public.rangers_is_team_member(p_team_id uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.rangers_team_members where team_id=p_team_id and user_id=auth.uid()); $$;
create or replace function public.rangers_team_role(p_team_id uuid) returns text language sql stable security definer set search_path=public as $$ select role from public.rangers_team_members where team_id=p_team_id and user_id=auth.uid() limit 1; $$;
revoke all on function public.rangers_is_team_member(uuid) from public,anon;
revoke all on function public.rangers_team_role(uuid) from public,anon;
grant execute on function public.rangers_is_team_member(uuid),public.rangers_team_role(uuid) to authenticated;
drop policy if exists "Team members can view their teams" on public.rangers_teams;
create policy "Team members can view their teams" on public.rangers_teams for select to authenticated using(public.rangers_is_team_member(id));
drop policy if exists "Team members can view their roster" on public.rangers_team_members;
create policy "Team members can view their roster" on public.rangers_team_members for select to authenticated using(public.rangers_is_team_member(team_id));
revoke all on public.rangers_teams,public.rangers_team_members,public.rangers_team_invites from anon,authenticated;
grant select on public.rangers_teams,public.rangers_team_members to authenticated;
create or replace function public.rangers_create_team(p_name text,p_team_number integer default null) returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 if char_length(trim(coalesce(p_name,'')))<2 or char_length(trim(p_name))>80 then raise exception 'Team name must be 2–80 characters'; end if;
 if p_team_number is not null and p_team_number not between 1 and 99999 then raise exception 'Enter a valid team number'; end if;
 insert into public.rangers_teams(name,team_number,created_by) values(trim(p_name),p_team_number,auth.uid()) returning id into v_id;
 insert into public.rangers_team_members(team_id,user_id,role) values(v_id,auth.uid(),'owner');
 return v_id;
end $$;
create or replace function public.rangers_claim_signup_team() returns uuid language plpgsql security definer set search_path=public as $$
declare v_name text; v_number integer; v_id uuid;
begin
 if auth.uid() is null then return null; end if;
 select nullif(trim(raw_user_meta_data->>'team_name'),''),case when coalesce(raw_user_meta_data->>'team_number','') ~ '^[0-9]{1,5}
 if v_name is null then return null; end if;
 if exists(select 1 from public.rangers_team_members where user_id=auth.uid()) then select team_id into v_id from public.rangers_team_members where user_id=auth.uid() order by joined_at limit 1; return v_id; end if;
 return public.rangers_create_team(v_name,v_number);
end $$;
create or replace function public.rangers_my_teams() returns table(id uuid,name text,team_number integer,role text,member_count bigint) language sql stable security definer set search_path=public as $$
 select t.id,t.name,t.team_number,m.role,count(mm.user_id) from public.rangers_teams t join public.rangers_team_members m on m.team_id=t.id and m.user_id=auth.uid() join public.rangers_team_members mm on mm.team_id=t.id group by t.id,t.name,t.team_number,m.role,t.created_at order by t.created_at desc;
$$;
create or replace function public.rangers_team_roster(p_team_id uuid) returns table(user_id uuid,display_name text,username text,role text,joined_at timestamptz) language sql stable security definer set search_path=public as $$
 select m.user_id,coalesce(p.display_name,'Rangers member'),coalesce(p.username,''),m.role,m.joined_at from public.rangers_team_members m left join public.profiles p on p.id=m.user_id where m.team_id=p_team_id and public.rangers_is_team_member(p_team_id) order by case m.role when 'owner' then 1 when 'coach' then 2 else 3 end,m.joined_at;
$$;
create or replace function public.rangers_invite_team_member(p_team_id uuid,p_email text,p_role text) returns text language plpgsql security definer set search_path=public as $$
declare v_role text:=lower(trim(p_role)); v_email text:=lower(trim(p_email)); v_token text;
begin
 if v_role not in ('coach','student') then raise exception 'Choose coach or student'; end if;
 if v_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then raise exception 'Enter a valid email address'; end if;
 if public.rangers_team_role(p_team_id) not in ('owner','coach') then raise exception 'Only team owners and coaches can invite members'; end if;
 if public.rangers_team_role(p_team_id)='coach' and v_role<>'student' then raise exception 'Coaches can invite students, but only owners can invite coaches'; end if;
 v_token:=encode(gen_random_bytes(24),'hex');
 insert into public.rangers_team_invites(team_id,email,role,token_hash,invited_by) values(p_team_id,v_email,v_role,encode(digest(v_token,'sha256'),'hex'),auth.uid());
 return v_token;
end $$;
create or replace function public.rangers_accept_team_invite(p_token text) returns uuid language plpgsql security definer set search_path=public as $$
declare v_inv public.rangers_team_invites%rowtype; v_email text;
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 v_email:=lower(coalesce(auth.jwt()->>'email',''));
 select * into v_inv from public.rangers_team_invites where token_hash=encode(digest(coalesce(p_token,''),'sha256'),'hex') and accepted_at is null and expires_at>now() limit 1 for update;
 if not found then raise exception 'This invitation is invalid, expired, or already used'; end if;
 if v_inv.email<>v_email then raise exception 'Sign in with the email address this invitation was sent to'; end if;
 insert into public.rangers_team_members(team_id,user_id,role) values(v_inv.team_id,auth.uid(),v_inv.role) on conflict(team_id,user_id) do nothing;
 update public.rangers_team_invites set accepted_at=now() where id=v_inv.id;
 return v_inv.team_id;
end $$;
create or replace function public.rangers_remove_team_member(p_team_id uuid,p_user_id uuid) returns boolean language plpgsql security definer set search_path=public as $$
declare v_target text;
begin
 if public.rangers_team_role(p_team_id)<>'owner' then raise exception 'Only the team owner can remove members'; end if;
 select role into v_target from public.rangers_team_members where team_id=p_team_id and user_id=p_user_id;
 if v_target='owner' then raise exception 'The team owner cannot be removed'; end if;
 delete from public.rangers_team_members where team_id=p_team_id and user_id=p_user_id;
 return found;
end $$;
create or replace function public.rangers_change_team_member_role(p_team_id uuid,p_user_id uuid,p_role text) returns boolean language plpgsql security definer set search_path=public as $$
declare v_target text; v_role text:=lower(trim(p_role));
begin
 if public.rangers_team_role(p_team_id)<>'owner' then raise exception 'Only the team owner can change member roles'; end if;
 if v_role not in ('coach','student') then raise exception 'Role must be coach or student'; end if;
 select role into v_target from public.rangers_team_members where team_id=p_team_id and user_id=p_user_id;
 if v_target='owner' then raise exception 'The owner role is protected'; end if;
 update public.rangers_team_members set role=v_role where team_id=p_team_id and user_id=p_user_id;
 return found;
end $$;
create or replace function public.rangers_update_team(p_team_id uuid,p_name text,p_team_number integer) returns boolean language plpgsql security definer set search_path=public as $$
begin
 if public.rangers_team_role(p_team_id)<>'owner' then raise exception 'Only the team owner can edit team details'; end if;
 if char_length(trim(coalesce(p_name,'')))<2 or char_length(trim(p_name))>80 then raise exception 'Team name must be 2–80 characters'; end if;
 if p_team_number is not null and p_team_number not between 1 and 99999 then raise exception 'Enter a valid team number'; end if;
 update public.rangers_teams set name=trim(p_name),team_number=p_team_number,updated_at=now() where id=p_team_id; return found;
end $$;
revoke all on function public.rangers_create_team(text,integer),public.rangers_claim_signup_team(),public.rangers_my_teams(),public.rangers_team_roster(uuid),public.rangers_invite_team_member(uuid,text,text),public.rangers_accept_team_invite(text),public.rangers_remove_team_member(uuid,uuid),public.rangers_change_team_member_role(uuid,uuid,text),public.rangers_update_team(uuid,text,integer) from public,anon;
grant execute on function public.rangers_create_team(text,integer),public.rangers_claim_signup_team(),public.rangers_my_teams(),public.rangers_team_roster(uuid),public.rangers_invite_team_member(uuid,text,text),public.rangers_accept_team_invite(text),public.rangers_remove_team_member(uuid,uuid),public.rangers_change_team_member_role(uuid,uuid,text),public.rangers_update_team(uuid,text,integer) to authenticated;
 then (raw_user_meta_data->>'team_number')::integer else null end into v_name,v_number from auth.users where id=auth.uid();
 if v_name is null then return null; end if;
 if exists(select 1 from public.rangers_team_members where user_id=auth.uid()) then select team_id into v_id from public.rangers_team_members where user_id=auth.uid() order by joined_at limit 1; return v_id; end if;
 return public.rangers_create_team(v_name,v_number);
end $$;
create or replace function public.rangers_my_teams() returns table(id uuid,name text,team_number integer,role text,member_count bigint) language sql stable security definer set search_path=public as $$
 select t.id,t.name,t.team_number,m.role,count(mm.user_id) from public.rangers_teams t join public.rangers_team_members m on m.team_id=t.id and m.user_id=auth.uid() join public.rangers_team_members mm on mm.team_id=t.id group by t.id,t.name,t.team_number,m.role,t.created_at order by t.created_at desc;
$$;
create or replace function public.rangers_team_roster(p_team_id uuid) returns table(user_id uuid,display_name text,username text,role text,joined_at timestamptz) language sql stable security definer set search_path=public as $$
 select m.user_id,coalesce(p.display_name,'Rangers member'),coalesce(p.username,''),m.role,m.joined_at from public.rangers_team_members m left join public.profiles p on p.id=m.user_id where m.team_id=p_team_id and public.rangers_is_team_member(p_team_id) order by case m.role when 'owner' then 1 when 'coach' then 2 else 3 end,m.joined_at;
$$;
create or replace function public.rangers_invite_team_member(p_team_id uuid,p_email text,p_role text) returns text language plpgsql security definer set search_path=public as $$
declare v_role text:=lower(trim(p_role)); v_email text:=lower(trim(p_email)); v_token text;
begin
 if v_role not in ('coach','student') then raise exception 'Choose coach or student'; end if;
 if v_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then raise exception 'Enter a valid email address'; end if;
 if public.rangers_team_role(p_team_id) not in ('owner','coach') then raise exception 'Only team owners and coaches can invite members'; end if;
 if public.rangers_team_role(p_team_id)='coach' and v_role<>'student' then raise exception 'Coaches can invite students, but only owners can invite coaches'; end if;
 v_token:=encode(gen_random_bytes(24),'hex');
 insert into public.rangers_team_invites(team_id,email,role,token_hash,invited_by) values(p_team_id,v_email,v_role,encode(digest(v_token,'sha256'),'hex'),auth.uid());
 return v_token;
end $$;
create or replace function public.rangers_accept_team_invite(p_token text) returns uuid language plpgsql security definer set search_path=public as $$
declare v_inv public.rangers_team_invites%rowtype; v_email text;
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 v_email:=lower(coalesce(auth.jwt()->>'email',''));
 select * into v_inv from public.rangers_team_invites where token_hash=encode(digest(coalesce(p_token,''),'sha256'),'hex') and accepted_at is null and expires_at>now() limit 1 for update;
 if not found then raise exception 'This invitation is invalid, expired, or already used'; end if;
 if v_inv.email<>v_email then raise exception 'Sign in with the email address this invitation was sent to'; end if;
 insert into public.rangers_team_members(team_id,user_id,role) values(v_inv.team_id,auth.uid(),v_inv.role) on conflict(team_id,user_id) do update set role=excluded.role;
 update public.rangers_team_invites set accepted_at=now() where id=v_inv.id;
 return v_inv.team_id;
end $$;
create or replace function public.rangers_remove_team_member(p_team_id uuid,p_user_id uuid) returns boolean language plpgsql security definer set search_path=public as $$
declare v_target text;
begin
 if public.rangers_team_role(p_team_id)<>'owner' then raise exception 'Only the team owner can remove members'; end if;
 select role into v_target from public.rangers_team_members where team_id=p_team_id and user_id=p_user_id;
 if v_target='owner' then raise exception 'The team owner cannot be removed'; end if;
 delete from public.rangers_team_members where team_id=p_team_id and user_id=p_user_id;
 return found;
end $$;
create or replace function public.rangers_change_team_member_role(p_team_id uuid,p_user_id uuid,p_role text) returns boolean language plpgsql security definer set search_path=public as $$
declare v_target text; v_role text:=lower(trim(p_role));
begin
 if public.rangers_team_role(p_team_id)<>'owner' then raise exception 'Only the team owner can change member roles'; end if;
 if v_role not in ('coach','student') then raise exception 'Role must be coach or student'; end if;
 select role into v_target from public.rangers_team_members where team_id=p_team_id and user_id=p_user_id;
 if v_target='owner' then raise exception 'The owner role is protected'; end if;
 update public.rangers_team_members set role=v_role where team_id=p_team_id and user_id=p_user_id;
 return found;
end $$;
create or replace function public.rangers_update_team(p_team_id uuid,p_name text,p_team_number integer) returns boolean language plpgsql security definer set search_path=public as $$
begin
 if public.rangers_team_role(p_team_id)<>'owner' then raise exception 'Only the team owner can edit team details'; end if;
 if char_length(trim(coalesce(p_name,'')))<2 or char_length(trim(p_name))>80 then raise exception 'Team name must be 2–80 characters'; end if;
 if p_team_number is not null and p_team_number not between 1 and 99999 then raise exception 'Enter a valid team number'; end if;
 update public.rangers_teams set name=trim(p_name),team_number=p_team_number,updated_at=now() where id=p_team_id; return found;
end $$;
revoke all on function public.rangers_create_team(text,integer),public.rangers_claim_signup_team(),public.rangers_my_teams(),public.rangers_team_roster(uuid),public.rangers_invite_team_member(uuid,text,text),public.rangers_accept_team_invite(text),public.rangers_remove_team_member(uuid,uuid),public.rangers_change_team_member_role(uuid,uuid,text),public.rangers_update_team(uuid,text,integer) from public,anon;
grant execute on function public.rangers_create_team(text,integer),public.rangers_claim_signup_team(),public.rangers_my_teams(),public.rangers_team_roster(uuid),public.rangers_invite_team_member(uuid,text,text),public.rangers_accept_team_invite(text),public.rangers_remove_team_member(uuid,uuid),public.rangers_change_team_member_role(uuid,uuid,text),public.rangers_update_team(uuid,text,integer) to authenticated;
