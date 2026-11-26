-- Rangers community chat, usernames, friend links, and private messages.
-- Run this migration in the Supabase SQL editor before enabling the Chat tab.

create extension if not exists pgcrypto;

alter table public.profiles
  add column if not exists username text;

update public.profiles
set username = lower(regexp_replace(coalesce(nullif(display_name,''),'ranger'), '[^a-zA-Z0-9_]+', '_', 'g')) || '_' || substr(replace(id::text,'-',''),1,5)
where username is null or btrim(username) = '';

create unique index if not exists profiles_username_lower_uidx
  on public.profiles (lower(username));

alter table public.profiles alter column username set not null;

create or replace function public.rangers_make_username()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.username is null or btrim(new.username) = '' then
    new.username := lower(regexp_replace(coalesce(nullif(new.display_name,''),'ranger'), '[^a-zA-Z0-9_]+', '_', 'g')) || '_' || substr(replace(new.id::text,'-',''),1,5);
  end if;
  return new;
end $$;

drop trigger if exists rangers_profile_username_default on public.profiles;
create trigger rangers_profile_username_default
before insert or update on public.profiles
for each row execute function public.rangers_make_username();

create table if not exists public.rangers_friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requester_id <> addressee_id),
  unique(requester_id, addressee_id)
);
alter table public.rangers_friendships enable row level security;
create index if not exists rangers_friendships_requester_idx on public.rangers_friendships(requester_id,status);
create index if not exists rangers_friendships_addressee_idx on public.rangers_friendships(addressee_id,status);

drop policy if exists "Users can view their friend links" on public.rangers_friendships;
create policy "Users can view their friend links" on public.rangers_friendships
for select to authenticated using (auth.uid() = requester_id or auth.uid() = addressee_id);

drop policy if exists "Users can send friend requests" on public.rangers_friendships;
create policy "Users can send friend requests" on public.rangers_friendships
for insert to authenticated with check (auth.uid() = requester_id and status = 'pending');

drop policy if exists "Recipients can accept friend requests" on public.rangers_friendships;
create policy "Recipients can accept friend requests" on public.rangers_friendships
for update to authenticated using (auth.uid() = addressee_id) with check (auth.uid() = addressee_id and status = 'accepted');

create or replace function public.rangers_protect_friendship_update()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.requester_id <> old.requester_id or new.addressee_id <> old.addressee_id or old.status <> 'pending' or new.status <> 'accepted' then
    raise exception 'Friend requests can only be accepted by their recipient';
  end if;
  return new;
end $$;
drop trigger if exists rangers_friendship_update_guard on public.rangers_friendships;
create trigger rangers_friendship_update_guard before update on public.rangers_friendships
for each row execute function public.rangers_protect_friendship_update();

create table if not exists public.rangers_chat_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid references auth.users(id) on delete cascade,
  sender_username text not null default '',
  sender_display_name text not null default '',
  body text not null check (char_length(body) between 1 and 1200),
  created_at timestamptz not null default now()
);
alter table public.rangers_chat_messages enable row level security;
create index if not exists rangers_chat_messages_global_idx on public.rangers_chat_messages(created_at desc) where recipient_id is null;
create index if not exists rangers_chat_messages_dm_idx on public.rangers_chat_messages(sender_id,recipient_id,created_at desc);

create or replace function public.rangers_chat_can_dm(a uuid, b uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select a = auth.uid() and (exists (
    select 1 from public.rangers_friendships f
    where f.status='accepted'
      and ((f.requester_id=a and f.addressee_id=b) or (f.requester_id=b and f.addressee_id=a))
  ) or exists (
    select 1 from public.profiles p
    where p.id=b and p.role in ('owner','co_owner')
  ));
$$;

drop policy if exists "Signed in users can read global chat" on public.rangers_chat_messages;
create policy "Signed in users can read global chat" on public.rangers_chat_messages
for select to authenticated using (recipient_id is null);

drop policy if exists "Participants can read private messages" on public.rangers_chat_messages;
create policy "Participants can read private messages" on public.rangers_chat_messages
for select to authenticated using (recipient_id is not null and auth.uid() in (sender_id, recipient_id));

drop policy if exists "Users can send global messages" on public.rangers_chat_messages;
create policy "Users can send global messages" on public.rangers_chat_messages
for insert to authenticated with check (auth.uid() = sender_id and recipient_id is null);

drop policy if exists "Users can send permitted private messages" on public.rangers_chat_messages;
create policy "Users can send permitted private messages" on public.rangers_chat_messages
for insert to authenticated with check (
  auth.uid() = sender_id and recipient_id is not null
  and public.rangers_chat_can_dm(auth.uid(), recipient_id)
);

create or replace function public.rangers_stamp_chat_message()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  select coalesce(p.username,'Ranger'), coalesce(p.display_name,'Rangers member')
  into new.sender_username, new.sender_display_name
  from public.profiles p where p.id = new.sender_id;
  return new;
end $$;
drop trigger if exists rangers_chat_message_stamp on public.rangers_chat_messages;
create trigger rangers_chat_message_stamp before insert on public.rangers_chat_messages
for each row execute function public.rangers_stamp_chat_message();

revoke all on public.rangers_friendships from anon;
revoke all on public.rangers_chat_messages from anon;
grant select, insert, update on public.rangers_friendships to authenticated;
grant select, insert on public.rangers_chat_messages to authenticated;

create or replace function public.rangers_my_chat_profile()
returns table(id uuid, username text, display_name text, role text)
language sql stable security definer set search_path=public as $$
  select p.id,p.username,p.display_name,p.role::text from public.profiles p where p.id=auth.uid();
$$;

create or replace function public.rangers_find_chat_users(p_username text)
returns table(id uuid, username text, display_name text, role text)
language sql stable security definer set search_path=public as $$
  select p.id,p.username,p.display_name,p.role::text
  from public.profiles p
  where auth.uid() is not null
    and p.id <> auth.uid()
    and lower(p.username) = lower(trim(p_username))
  limit 1;
$$;

create or replace function public.rangers_chat_people()
returns table(id uuid, username text, display_name text, role text, relationship_status text, request_direction text)
language sql stable security definer set search_path=public as $$
  select distinct p.id,p.username,p.display_name,p.role::text,
    f.status,
    case when f.requester_id=auth.uid() then 'outgoing' else 'incoming' end
  from public.rangers_friendships f
  join public.profiles p on p.id = case when f.requester_id=auth.uid() then f.addressee_id else f.requester_id end
  where auth.uid() in (f.requester_id,f.addressee_id)
  union
  select p.id,p.username,p.display_name,p.role::text,'accepted'::text,'team'::text
  from public.profiles p
  where p.role in ('owner','co_owner') and p.id <> auth.uid();
$$;

grant execute on function public.rangers_my_chat_profile() to authenticated;
grant execute on function public.rangers_find_chat_users(text) to authenticated;
grant execute on function public.rangers_chat_people() to authenticated;
grant execute on function public.rangers_chat_can_dm(uuid,uuid) to authenticated;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='rangers_chat_messages') then
    alter publication supabase_realtime add table public.rangers_chat_messages;
  end if;
end $$;
