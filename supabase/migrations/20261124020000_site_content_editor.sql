-- Owner/co-owner managed homepage content. Public visitors can read homepage content.
create table if not exists public.site_content (
  id text primary key check (id = 'global'),
  content jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.site_content enable row level security;
drop policy if exists "Public can read homepage content" on public.site_content;
create policy "Public can read homepage content" on public.site_content for select to anon, authenticated using (true);
drop policy if exists "Team leads manage homepage content" on public.site_content;
create policy "Team leads manage homepage content" on public.site_content for all to authenticated using (public.is_team_admin()) with check (public.is_team_admin());
insert into public.site_content (id, content) values ('global','{"hero_title":"Built to think.","hero_subtitle":"Driven to build.","hero_description":"We are the Itkan Rangers, FTC Team 28922. We design, build, and program robots while learning to solve problems, work as a team, and share what we discover.","announcement_enabled":false,"announcement_title":"Rangers update","announcement_body":""}'::jsonb) on conflict (id) do nothing;
grant select on public.site_content to anon, authenticated;
grant insert, update, delete on public.site_content to authenticated;
