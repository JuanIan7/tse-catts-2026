create extension if not exists btree_gist;

create table public.admin_evaluation_annotations (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.training_sessions(id) on delete cascade,
  transcript_id uuid not null references public.training_transcripts(id) on delete cascade,
  annotation_type text not null check (annotation_type in (
    'PARAFRASE', 'MEMORIA_LINKADA', 'MAIEUTICA_TED', 'SAIDA_DIGNA',
    'PERGUNTA_SIMPLES', 'PERGUNTA_COMPLEXA', 'FATOR_PROTECAO',
    'FATOR_RISCO', 'FATOR_PRINCIPAL', 'OBSERVACAO'
  )),
  start_offset integer not null check (start_offset >= 0),
  end_offset integer not null check (end_offset > start_offset),
  selected_text text not null check (char_length(selected_text) between 1 and 500),
  note text check (char_length(note) <= 1500),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (transcript_id, start_offset, end_offset, annotation_type),
  exclude using gist (
    transcript_id with =,
    int4range(start_offset, end_offset, '[)') with &&
  )
);

create table public.admin_evaluation_notes (
  session_id uuid primary key references public.training_sessions(id) on delete cascade,
  note text not null check (char_length(trim(note)) between 1 and 3000),
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index admin_evaluation_annotations_session_idx
  on public.admin_evaluation_annotations (session_id, created_at asc);
create index admin_evaluation_annotations_transcript_idx
  on public.admin_evaluation_annotations (transcript_id, start_offset asc);

create trigger admin_evaluation_annotations_set_updated_at
before update on public.admin_evaluation_annotations
for each row execute function public.set_updated_at();

create or replace function public.validate_admin_evaluation_annotation()
returns trigger
language plpgsql
as $$
declare
  transcript_session_id uuid;
  transcript_content text;
begin
  select session_id, content into transcript_session_id, transcript_content
  from public.training_transcripts where id = new.transcript_id;

  if transcript_session_id is null or transcript_session_id <> new.session_id then
    raise exception 'A fala não pertence à sessão informada';
  end if;
  if new.end_offset > char_length(transcript_content) then
    raise exception 'Os limites da marcação excedem a fala';
  end if;
  if substring(transcript_content from new.start_offset + 1 for new.end_offset - new.start_offset) <> new.selected_text then
    raise exception 'O texto da marcação não corresponde à transcrição';
  end if;
  return new;
end;
$$;

create trigger admin_evaluation_annotations_validate
before insert or update on public.admin_evaluation_annotations
for each row execute function public.validate_admin_evaluation_annotation();

create trigger admin_evaluation_notes_set_updated_at
before update on public.admin_evaluation_notes
for each row execute function public.set_updated_at();

alter table public.admin_evaluation_annotations enable row level security;
alter table public.admin_evaluation_notes enable row level security;

create policy "admin annotations only" on public.admin_evaluation_annotations
for all using (public.is_admin()) with check (public.is_admin());

create policy "admin evaluation notes only" on public.admin_evaluation_notes
for all using (public.is_admin()) with check (public.is_admin());
