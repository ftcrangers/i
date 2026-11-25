-- Add per-account website preferences for Rangers users.
-- Safe to run more than once.
alter table public.profiles
  add column if not exists preferences jsonb not null default '{}'::jsonb;
