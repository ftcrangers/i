-- Shared authorization helper used by site content and admin tools.
-- SECURITY DEFINER avoids recursive profile RLS checks when policies call this function.
create or replace function public.is_team_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('owner', 'co_owner', 'admin')
  );
$$;

revoke all on function public.is_team_admin() from public;
grant execute on function public.is_team_admin() to authenticated;
