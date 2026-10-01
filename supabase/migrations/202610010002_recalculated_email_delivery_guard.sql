alter table public.evaluation_notification_log
  add column if not exists manual_review_id uuid references public.evaluation_manual_reviews(id) on delete cascade,
  add column if not exists sent_at timestamptz,
  add column if not exists provider text check (provider in ('BREVO', 'RESEND'));

create unique index if not exists evaluation_notification_log_student_recalculated_review_uidx
  on public.evaluation_notification_log (manual_review_id)
  where kind = 'STUDENT_RECALCULATED' and manual_review_id is not null;

create or replace function public.claim_recalculated_evaluation_email(
  p_session_id uuid,
  p_manual_review_id uuid,
  p_recipient text,
  p_provider text
)
returns table (
  claimed boolean,
  status text,
  recipient text,
  sent_at timestamptz,
  created_at timestamptz,
  recalculated_score numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_log public.evaluation_notification_log%rowtype;
  latest_review_id uuid;
  latest_review_score numeric;
begin
  if not public.is_admin() then
    raise exception 'Acesso administrativo necessário';
  end if;

  if p_provider not in ('BREVO', 'RESEND') then
    raise exception 'Provedor de e-mail inválido';
  end if;

  select id, recalculated_score into latest_review_id, latest_review_score
  from public.evaluation_manual_reviews
  where session_id = p_session_id
  order by created_at desc, id desc
  limit 1;

  if latest_review_id is distinct from p_manual_review_id then
    raise exception 'Recálculo não encontrado';
  end if;

  if not exists (
    select 1
    from public.evaluation_manual_reviews
    where id = p_manual_review_id and session_id = p_session_id
  ) then
    raise exception 'Recálculo não encontrado';
  end if;

  insert into public.evaluation_notification_log (
    session_id, kind, recipient, status, manual_review_id, provider
  ) values (
    p_session_id, 'STUDENT_RECALCULATED', p_recipient, 'PENDING', p_manual_review_id, p_provider
  ) on conflict do nothing;

  if found then
    return query select true, 'PENDING'::text, p_recipient, null::timestamptz, now(), latest_review_score;
    return;
  end if;

  select * into current_log
  from public.evaluation_notification_log
  where manual_review_id = p_manual_review_id and kind = 'STUDENT_RECALCULATED'
  limit 1
  for update;

  if current_log.status = 'FAILED' then
    update public.evaluation_notification_log
    set status = 'PENDING', recipient = p_recipient, provider = p_provider, error_message = null, sent_at = null, created_at = now()
    where id = current_log.id
    returning * into current_log;

    return query select true, current_log.status, current_log.recipient, current_log.sent_at, current_log.created_at, latest_review_score;
    return;
  end if;

  -- Ambos os provedores recebem a mesma chave de idempotência (o UUID do
  -- recálculo). Uma reserva sem resposta pode ser repetida com segurança por
  -- até 15 minutos, menor janela documentada entre os provedores utilizados.
  if current_log.status = 'PENDING'
    and current_log.provider = p_provider
    and current_log.created_at >= now() - interval '15 minutes'
    and current_log.created_at <= now() - interval '30 seconds' then
    return query select true, current_log.status, current_log.recipient, current_log.sent_at, current_log.created_at, latest_review_score;
    return;
  end if;

  return query select false, current_log.status, current_log.recipient, current_log.sent_at, current_log.created_at, latest_review_score;
end;
$$;

revoke all on function public.claim_recalculated_evaluation_email(uuid, uuid, text, text) from public, anon;
grant execute on function public.claim_recalculated_evaluation_email(uuid, uuid, text, text) to authenticated;
notify pgrst, 'reload schema';
