-- Repair profile rows for authenticated users whose accounts predate the signup trigger.
-- Safe to run more than once.

create or replace function public.ensure_my_profile()
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  auth_user auth.users%rowtype;
  profile_row public.profiles%rowtype;
  chosen_name text;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to create your profile';
  end if;

  select * into auth_user
  from auth.users
  where id = auth.uid();

  if auth_user.id is null then
    raise exception 'Authenticated user record was not found';
  end if;

  chosen_name := coalesce(
    nullif(auth_user.raw_user_meta_data->>'display_name', ''),
    split_part(auth_user.email, '@', 1),
    'Rangers Student'
  );

  insert into public.profiles (id, email, display_name, role)
  values (
    auth_user.id,
    lower(auth_user.email),
    chosen_name,
    case when lower(auth_user.email) = 'humzanagaria@gmail.com' then 'owner' else 'student' end
  )
  on conflict (id) do update
    set email = excluded.email,
        role = case
          when lower(auth_user.email) = 'humzanagaria@gmail.com' then 'owner'
          else public.profiles.role
        end,
        display_name = case
          when public.profiles.display_name = 'Rangers Student' then excluded.display_name
          else public.profiles.display_name
        end
  returning * into profile_row;

  insert into public.user_xp (user_id, xp, level)
  values (auth_user.id, 0, 1)
  on conflict (user_id) do nothing;

  if lower(auth_user.email) = 'humzanagaria@gmail.com' then
    insert into public.team_members (user_id, membership_status)
    values (auth_user.id, 'active')
    on conflict (user_id) do update set membership_status = 'active';
  end if;

  return profile_row;
end;
$$;

revoke all on function public.ensure_my_profile() from public;
grant execute on function public.ensure_my_profile() to authenticated;
