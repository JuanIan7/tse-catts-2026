-- Amplia as marcações disponíveis sem invalidar recursos já existentes.
alter table public.evaluation_appeal_items
  drop constraint if exists evaluation_appeal_items_annotation_type_check;
alter table public.evaluation_appeal_items
  add constraint evaluation_appeal_items_annotation_type_check check (annotation_type in (
    'PARAFRASE', 'MEMORIA_LINKADA', 'MAIEUTICA_TED', 'SAIDA_DIGNA',
    'DOMINOU_DIALOGO', 'CONDUZIU_SOLUCAO',
    'PERGUNTA_SIMPLES', 'PERGUNTA_COMPLEXA', 'FATOR_PROTECAO',
    'FATOR_RISCO', 'FATOR_PRINCIPAL'
  ));

alter table public.admin_evaluation_annotations
  drop constraint if exists admin_evaluation_annotations_annotation_type_check;
alter table public.admin_evaluation_annotations
  add constraint admin_evaluation_annotations_annotation_type_check check (annotation_type in (
    'PARAFRASE', 'MEMORIA_LINKADA', 'MAIEUTICA_TED', 'SAIDA_DIGNA',
    'DOMINOU_DIALOGO', 'CONDUZIU_SOLUCAO',
    'PERGUNTA_SIMPLES', 'PERGUNTA_COMPLEXA', 'FATOR_PROTECAO',
    'FATOR_RISCO', 'FATOR_PRINCIPAL', 'OBSERVACAO'
  ));

-- Recurso e itens são gravados na mesma transação. O aluno autenticado só
-- pode indicar falas integrais da própria avaliação concluída.
create or replace function public.create_evaluation_appeal(
  p_session_id uuid,
  p_transcript_ids uuid[],
  p_annotation_types text[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  appeal_id uuid;
  current_user_id uuid := auth.uid();
  previous_score numeric;
  requested_turns integer;
  matched_turns integer;
begin
  if current_user_id is null then
    raise exception 'Autenticação obrigatória';
  end if;
  if coalesce(cardinality(p_transcript_ids), 0) = 0 or coalesce(cardinality(p_annotation_types), 0) = 0 then
    raise exception 'Selecione ao menos uma fala e uma ferramenta para enviar o recurso.';
  end if;
  if exists (
    select 1 from unnest(p_annotation_types) as requested_type(value)
    where value not in (
      'PARAFRASE', 'MEMORIA_LINKADA', 'MAIEUTICA_TED', 'SAIDA_DIGNA',
      'DOMINOU_DIALOGO', 'CONDUZIU_SOLUCAO',
      'PERGUNTA_SIMPLES', 'PERGUNTA_COMPLEXA', 'FATOR_PROTECAO',
      'FATOR_RISCO', 'FATOR_PRINCIPAL'
    )
  ) then
    raise exception 'Ferramenta de recurso inválida';
  end if;

  select evaluation.final_score into previous_score
  from public.evaluations evaluation
  join public.training_sessions session on session.id = evaluation.session_id
  where evaluation.session_id = p_session_id and session.user_id = current_user_id;
  if previous_score is null then
    raise exception 'Avaliação indisponível';
  end if;

  select count(distinct requested_turn.transcript_id) into requested_turns
  from unnest(p_transcript_ids) as requested_turn(transcript_id);
  select count(*) into matched_turns
  from public.training_transcripts transcript
  where transcript.session_id = p_session_id
    and transcript.id = any(p_transcript_ids)
    and transcript.speaker in ('ALUNO', 'PERSONAGEM');
  if requested_turns <> matched_turns then
    raise exception 'As falas selecionadas não pertencem a esta avaliação';
  end if;

  insert into public.evaluation_appeals (session_id, user_id, previous_score)
  values (p_session_id, current_user_id, previous_score)
  returning id into appeal_id;

  insert into public.evaluation_appeal_items (appeal_id, transcript_id, annotation_type, selected_text)
  select appeal_id, transcript.id, requested_type, transcript.content
  from public.training_transcripts transcript
  cross join (
    select distinct requested_type.value as requested_type
    from unnest(p_annotation_types) as requested_type(value)
  ) requested
  where transcript.session_id = p_session_id
    and transcript.id = any(p_transcript_ids)
    and transcript.speaker in ('ALUNO', 'PERSONAGEM');

  return appeal_id;
end;
$$;

revoke all on function public.create_evaluation_appeal(uuid, uuid[], text[]) from public, anon;
grant execute on function public.create_evaluation_appeal(uuid, uuid[], text[]) to authenticated;
notify pgrst, 'reload schema';
