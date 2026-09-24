alter table public.profiles
  add column if not exists voice_consent_at timestamptz,
  add column if not exists voice_consent_version text;

alter table public.training_sessions
  add column if not exists voice_mode text not null default 'PRESSIONAR_PARA_FALAR'
    check (voice_mode in ('PRESSIONAR_PARA_FALAR', 'MICROFONE_ABERTO')),
  add column if not exists next_transcript_sequence integer not null default 1
    check (next_transcript_sequence > 0),
  add column if not exists scenario_version text,
  add column if not exists retention_expires_at timestamptz not null default (now() + interval '180 days');

alter table public.training_transcripts
  add column if not exists source text not null default 'TEXTO'
    check (source in ('TEXTO', 'VOZ', 'SISTEMA')),
  add column if not exists delivery_status text not null default 'OUVIDO'
    check (delivery_status in ('PENDENTE', 'OUVIDO', 'INTERROMPIDO')),
  add column if not exists event_metadata jsonb not null default '{}'::jsonb;

create table if not exists public.scenario_library (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 3 and 140),
  didactic_context text not null check (char_length(trim(didactic_context)) between 20 and 6000),
  lesson text not null check (char_length(trim(lesson)) between 20 and 4000),
  safe_case jsonb not null,
  version integer not null default 1 check (version > 0),
  status text not null default 'RASCUNHO' check (status in ('RASCUNHO', 'PUBLICADO', 'ARQUIVADO')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (title, version)
);

drop trigger if exists scenario_library_set_updated_at on public.scenario_library;
create trigger scenario_library_set_updated_at
before update on public.scenario_library
for each row execute function public.set_updated_at();

alter table public.scenario_library enable row level security;
create policy "scenario library admin only" on public.scenario_library
for all using (public.is_admin()) with check (public.is_admin());

create or replace function public.append_training_transcript(
  p_session_id uuid,
  p_speaker text,
  p_content text,
  p_source text default 'TEXTO',
  p_delivery_status text default 'OUVIDO',
  p_event_metadata jsonb default '{}'::jsonb
)
returns public.training_transcripts
language plpgsql
security definer set search_path = public
as $$
declare
  next_sequence integer;
  inserted public.training_transcripts;
begin
  update public.training_sessions
  set next_transcript_sequence = next_transcript_sequence + 1
  where id = p_session_id
  returning next_transcript_sequence - 1 into next_sequence;

  if next_sequence is null then
    raise exception 'Sessão inexistente';
  end if;

  insert into public.training_transcripts (
    session_id, speaker, content, sequence_number, source, delivery_status, event_metadata
  ) values (
    p_session_id, p_speaker, p_content, next_sequence, p_source, p_delivery_status, coalesce(p_event_metadata, '{}'::jsonb)
  ) returning * into inserted;

  return inserted;
end;
$$;

revoke all on function public.append_training_transcript(uuid, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.append_training_transcript(uuid, text, text, text, text, jsonb) to service_role;

create or replace function public.transition_training_session(
  p_session_id uuid,
  p_next public.training_status
)
returns public.training_sessions
language plpgsql
security definer set search_path = public
as $$
declare
  current_session public.training_sessions;
  allowed boolean := false;
begin
  select * into current_session from public.training_sessions where id = p_session_id for update;
  if not found then
    raise exception 'Sessão inexistente';
  end if;

  allowed :=
    (current_session.status = 'CRIADA' and p_next in ('EM_ANDAMENTO', 'CANCELADA')) or
    (current_session.status = 'EM_ANDAMENTO' and p_next in ('RECONEXAO', 'AVALIACAO_PENDENTE', 'ENCERRADA_COM_EXITO', 'ENCERRADA_SEM_EXITO', 'CANCELADA')) or
    (current_session.status = 'RECONEXAO' and p_next in ('EM_ANDAMENTO', 'CANCELADA')) or
    (current_session.status = 'AVALIACAO_PENDENTE' and p_next in ('ENCERRADA_COM_EXITO', 'ENCERRADA_SEM_EXITO'));

  if not allowed then
    raise exception 'Transição de sessão inválida: % para %', current_session.status, p_next;
  end if;

  update public.training_sessions
  set status = p_next,
      started_at = case when p_next = 'EM_ANDAMENTO' then coalesce(started_at, now()) else started_at end,
      ended_at = case when p_next in ('ENCERRADA_COM_EXITO', 'ENCERRADA_SEM_EXITO', 'CANCELADA') then coalesce(ended_at, now()) else ended_at end
  where id = p_session_id
  returning * into current_session;

  return current_session;
end;
$$;

revoke all on function public.transition_training_session(uuid, public.training_status) from public, anon, authenticated;
grant execute on function public.transition_training_session(uuid, public.training_status) to service_role;

create or replace function public.ranking_by_difficulty(selected_difficulty public.difficulty)
returns table (display_name text, difficulty public.difficulty, occurrences bigint, best_score numeric, average_score numeric)
language sql
stable
security definer set search_path = public
as $$
  select
    split_part(trim(p.display_name), ' ', 1) || ' ' || left(regexp_replace(trim(p.display_name), '^.*\\s+', ''), 1) || '.' as display_name,
    s.difficulty,
    count(e.id),
    max(e.final_score),
    round(avg(e.final_score), 1)
  from public.evaluations e
  join public.training_sessions s on s.id = e.session_id
  join public.profiles p on p.user_id = e.user_id
  where s.difficulty = selected_difficulty
    and not e.partial
    and exists (
      select 1 from public.profiles viewer
      where viewer.user_id = auth.uid() and viewer.access_status = 'APROVADO'
    )
  group by p.user_id, p.display_name, s.difficulty
  order by max(e.final_score) desc, avg(e.final_score) desc, count(e.id) desc;
$$;

create index if not exists training_sessions_retention_idx on public.training_sessions (retention_expires_at);
create index if not exists transcripts_session_sequence_idx on public.training_transcripts (session_id, sequence_number);
create index if not exists scenario_library_status_idx on public.scenario_library (status, updated_at desc);
