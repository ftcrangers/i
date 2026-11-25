create table if not exists public.academy_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  academy text not null check (academy in ('cad','programming')),
  lesson_id text not null,
  content text not null default '',
  updated_at timestamptz not null default now(),
  unique (user_id, academy, lesson_id)
);
alter table public.academy_notes enable row level security;
drop policy if exists "Users can read their own academy notes" on public.academy_notes;
create policy "Users can read their own academy notes"
  on public.academy_notes for select to authenticated
  using (auth.uid() = user_id);
drop policy if exists "Users can insert their own academy notes" on public.academy_notes;
create policy "Users can insert their own academy notes"
  on public.academy_notes for insert to authenticated
  with check (auth.uid() = user_id);
drop policy if exists "Users can update their own academy notes" on public.academy_notes;
create policy "Users can update their own academy notes"
  on public.academy_notes for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
