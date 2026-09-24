create or replace function public.confirm_voice_delivery(
  p_session_id uuid,
  p_turn_id uuid,
  p_interrupted boolean
)
returns table (changed boolean, finish_after_delivery boolean)
language plpgsql
security definer set search_path = public
as $$
declare
  current_session public.training_sessions;
  current_turn public.training_transcripts;
  next_state jsonb;
begin
  select * into current_session
  from public.training_sessions
  where id = p_session_id
  for update;

  if not found then
    raise exception 'Sessão inexistente';
  end if;

  select * into current_turn
  from public.training_transcripts
  where id = p_turn_id and session_id = p_session_id
  for update;

  if not found or current_turn.speaker <> 'PERSONAGEM' then
    raise exception 'Resposta de voz indisponível';
  end if;

  if current_turn.delivery_status <> 'PENDENTE' then
    return query select false, coalesce((current_turn.event_metadata ->> 'finish_after_delivery')::boolean, false);
    return;
  end if;

  update public.training_transcripts
  set delivery_status = case when p_interrupted then 'INTERROMPIDO' else 'OUVIDO' end
  where id = current_turn.id;

  next_state := coalesce(current_session.didactic_state, '{}'::jsonb);
  if p_interrupted then
    next_state := jsonb_set(
      next_state,
      '{interrupcoes}',
      to_jsonb(least(20, coalesce((next_state ->> 'interrupcoes')::integer, 0) + 1)),
      true
    );
  elsif coalesce((current_turn.event_metadata ->> 'finish_after_delivery')::boolean, false) then
    next_state := jsonb_set(next_state, '{saida_digna_aceita}', 'true'::jsonb, true);
  end if;
  next_state := jsonb_set(next_state, '{revision}', to_jsonb(current_session.didactic_state_revision + 1), true);

  update public.training_sessions
  set didactic_state = next_state,
      didactic_state_revision = didactic_state_revision + 1
  where id = current_session.id;

  if p_interrupted then
    perform public.append_training_transcript(
      p_session_id,
      'SISTEMA',
      'Fala do tentante interrompida pelo abordador.',
      'SISTEMA',
      'OUVIDO',
      jsonb_build_object('event', 'INTERRUPCAO', 'interrupted_turn_id', current_turn.id)
    );
  end if;

  return query select true, coalesce((current_turn.event_metadata ->> 'finish_after_delivery')::boolean, false);
end;
$$;

revoke all on function public.confirm_voice_delivery(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.confirm_voice_delivery(uuid, uuid, boolean) to service_role;
