-- Database-backed public website copy, editable by Rangers admins.
create table if not exists public.site_content (
  content_key text primary key,
  content jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.site_content enable row level security;

drop policy if exists "Public can read site content" on public.site_content;
create policy "Public can read site content"
  on public.site_content for select
  to anon, authenticated
  using (true);

drop policy if exists "Team admins manage site content" on public.site_content;
create policy "Team admins manage site content"
  on public.site_content for all
  to authenticated
  using (public.is_team_admin())
  with check (public.is_team_admin());

grant select on public.site_content to anon, authenticated;
grant insert, update, delete on public.site_content to authenticated;

insert into public.site_content (content_key, content)
values ('homepage', jsonb_build_object(
  'eyebrow', 'Plano, Texas · FIRST Tech Challenge',
  'headline', 'Built to think. Driven to build.',
  'description', 'We are the Itkan Rangers, FTC Team 28922. We design, build, and program robots while learning to solve problems, work as a team, and share what we discover.',
  'introHeadline', 'Curiosity becomes creation. Ideas become engineering.',
  'introSubtext', 'FIRST Tech Challenge · Team 28922',
  'notice', ''
))
on conflict (content_key) do nothing;
