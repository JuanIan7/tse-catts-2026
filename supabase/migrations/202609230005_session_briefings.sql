alter table public.training_sessions
  add column public_briefing jsonb not null default '{}'::jsonb;

drop policy "sessions insert own approved" on public.training_sessions;
drop policy "sessions update own or admin" on public.training_sessions;

create policy "sessions admin writes" on public.training_sessions
for all using (public.is_admin()) with check (public.is_admin());
