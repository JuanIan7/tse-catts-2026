alter table public.training_sessions
  add column if not exists active_elapsed_ms bigint not null default 0 check (active_elapsed_ms >= 0),
  add column if not exists active_activity text not null default 'PAUSED'
    check (active_activity in ('PAUSED', 'VOICE_STUDENT', 'VOICE_CHARACTER', 'TEXT')),
  add column if not exists active_started_at timestamptz;

create or replace function public.set_training_clock_activity(
  p_session_id uuid,
  p_activity text
)
returns public.training_sessions
language plpgsql
security definer set search_path = public
as $$
declare
  current_session public.training_sessions;
  elapsed bigint;
begin
  if p_activity not in ('PAUSED', 'VOICE_STUDENT', 'VOICE_CHARACTER', 'TEXT') then
    raise exception 'Atividade de relógio inválida';
  end if;

  select * into current_session
  from public.training_sessions
  where id = p_session_id
  for update;

  if not found then
    raise exception 'Sessão inexistente';
  end if;

  elapsed := current_session.active_elapsed_ms;
  if current_session.active_activity <> 'PAUSED' and current_session.active_started_at is not null then
    elapsed := elapsed + greatest(0, floor(extract(epoch from (now() - current_session.active_started_at)) * 1000)::bigint);
  end if;

  update public.training_sessions
  set active_elapsed_ms = elapsed,
      active_activity = p_activity,
      active_started_at = case when p_activity = 'PAUSED' then null else now() end
  where id = p_session_id
  returning * into current_session;

  return current_session;
end;
$$;

revoke all on function public.set_training_clock_activity(uuid, text) from public, anon, authenticated;
grant execute on function public.set_training_clock_activity(uuid, text) to service_role;
