create table public.evaluation_appeals (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.training_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'PENDENTE' check (status in ('PENDENTE', 'ACEITO', 'PARCIAL', 'REJEITADO')),
  administrator_note text check (char_length(administrator_note) <= 3000),
  previous_score numeric(3,1) not null check (previous_score between 0 and 10),
  recalculated_score numeric(3,1) check (recalculated_score between 0 and 10),
  reviewed_by uuid references auth.users(id) on delete restrict,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.evaluation_appeal_items (
  id uuid primary key default gen_random_uuid(),
  appeal_id uuid not null references public.evaluation_appeals(id) on delete cascade,
  transcript_id uuid not null references public.training_transcripts(id) on delete cascade,
  annotation_type text not null check (annotation_type in (
    'PARAFRASE', 'MEMORIA_LINKADA', 'MAIEUTICA_TED', 'SAIDA_DIGNA',
    'PERGUNTA_SIMPLES', 'PERGUNTA_COMPLEXA', 'FATOR_PROTECAO',
    'FATOR_RISCO', 'FATOR_PRINCIPAL'
  )),
  selected_text text not null check (char_length(selected_text) between 1 and 3000),
  decision text not null default 'PENDENTE' check (decision in ('PENDENTE', 'ACEITO', 'REJEITADO')),
  decision_note text check (char_length(decision_note) <= 1500),
  accepted_annotation_id uuid references public.admin_evaluation_annotations(id) on delete set null,
  decided_by uuid references auth.users(id) on delete restrict,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  unique (appeal_id, transcript_id, annotation_type)
);

create index evaluation_appeals_created_idx on public.evaluation_appeals (created_at desc);
create index evaluation_appeals_session_idx on public.evaluation_appeals (session_id, created_at desc);
create index evaluation_appeal_items_appeal_idx on public.evaluation_appeal_items (appeal_id, created_at asc);

-- A revisão pode registrar ferramentas diferentes sobre a mesma fala inteira.
-- A unicidade já existente por tipo de ferramenta é preservada.
do $$
declare
  exclusion_name text;
begin
  select conname into exclusion_name
  from pg_constraint
  where conrelid = 'public.admin_evaluation_annotations'::regclass
    and contype = 'x'
  limit 1;

  if exclusion_name is not null then
    execute format('alter table public.admin_evaluation_annotations drop constraint %I', exclusion_name);
  end if;
end;
$$;

create trigger evaluation_appeals_set_updated_at
before update on public.evaluation_appeals
for each row execute function public.set_updated_at();

create or replace function public.validate_evaluation_appeal_item()
returns trigger
language plpgsql
as $$
declare
  appeal_session_id uuid;
  appeal_user_id uuid;
  transcript_session_id uuid;
  transcript_content text;
begin
  select session_id, user_id into appeal_session_id, appeal_user_id
  from public.evaluation_appeals where id = new.appeal_id;
  select session_id, content into transcript_session_id, transcript_content
  from public.training_transcripts where id = new.transcript_id;
  if appeal_session_id is null or transcript_session_id is null or appeal_session_id <> transcript_session_id then
    raise exception 'A fala não pertence ao recurso informado';
  end if;
  if transcript_content <> new.selected_text then
    raise exception 'O texto do recurso não corresponde à transcrição';
  end if;
  return new;
end;
$$;

create trigger evaluation_appeal_items_validate
before insert or update on public.evaluation_appeal_items
for each row execute function public.validate_evaluation_appeal_item();

alter table public.evaluation_appeals enable row level security;
alter table public.evaluation_appeal_items enable row level security;

create policy "student creates own appeals" on public.evaluation_appeals
for insert with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.training_sessions session
    join public.evaluations evaluation on evaluation.session_id = session.id
    where session.id = public.evaluation_appeals.session_id
      and session.user_id = auth.uid()
  )
);
create policy "student reads own appeals" on public.evaluation_appeals
for select using (auth.uid() = user_id or public.is_admin());
create policy "admin manages appeals" on public.evaluation_appeals
for update using (public.is_admin()) with check (public.is_admin());

create policy "student creates own appeal items" on public.evaluation_appeal_items
for insert with check (exists (
  select 1 from public.evaluation_appeals appeal
  where appeal.id = appeal_id and appeal.user_id = auth.uid()
));
create policy "student reads own appeal items" on public.evaluation_appeal_items
for select using (exists (
  select 1 from public.evaluation_appeals appeal
  where appeal.id = appeal_id and (appeal.user_id = auth.uid() or public.is_admin())
));
create policy "admin manages appeal items" on public.evaluation_appeal_items
for update using (public.is_admin()) with check (public.is_admin());
