create extension if not exists pgcrypto;

create type public.tse_role as enum ('ALUNO', 'ADMINISTRADOR');
create type public.access_status as enum ('PENDENTE', 'APROVADO', 'BLOQUEADO', 'RECUSADO');
create type public.difficulty as enum ('FACIL', 'MEDIA', 'DIFICIL');
create type public.training_status as enum ('CRIADA', 'EM_ANDAMENTO', 'ENCERRADA_COM_EXITO', 'ENCERRADA_SEM_EXITO', 'CANCELADA');

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 2 and 120),
  role public.tse_role not null default 'ALUNO',
  access_status public.access_status not null default 'PENDENTE',
  first_access_at timestamptz,
  last_access_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.access_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  requested_name text not null check (char_length(trim(requested_name)) between 2 and 120),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  decision public.access_status not null default 'PENDENTE',
  admin_note text check (char_length(admin_note) <= 1000)
);

create table public.training_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  difficulty public.difficulty not null,
  status public.training_status not null default 'CRIADA',
  image_path text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  ended_at timestamptz
);

-- Segredos pedagógicos permanecem em tabela separada, sem política de leitura
-- para alunos. Apenas rotas de servidor com service role podem acessá-la.
create table public.training_session_secrets (
  session_id uuid primary key references public.training_sessions(id) on delete cascade,
  internal_case jsonb not null,
  model_instructions text not null,
  prompt_version text not null,
  created_at timestamptz not null default now()
);

create table public.training_transcripts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.training_sessions(id) on delete cascade,
  speaker text not null check (speaker in ('NARRADOR', 'ALUNO', 'PERSONAGEM', 'SISTEMA')),
  content text not null check (char_length(content) between 1 and 10000),
  sequence_number integer not null check (sequence_number > 0),
  created_at timestamptz not null default now(),
  unique (session_id, sequence_number)
);

create table public.evaluations (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.training_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete restrict,
  partial boolean not null default false,
  result text not null check (result in ('EXITO', 'EM_ANDAMENTO', 'SEM_EXITO')),
  rubric_version text not null,
  item_states jsonb not null,
  grave_errors jsonb not null,
  calculation jsonb not null,
  final_score numeric(3,1) not null check (final_score between 0 and 10),
  created_at timestamptz not null default now()
);

create index training_sessions_user_created_idx on public.training_sessions (user_id, created_at desc);
create index evaluations_user_created_idx on public.evaluations (user_id, created_at desc);
create index evaluations_score_idx on public.evaluations (final_score desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), 'Usuário pendente'));
  insert into public.access_requests (user_id, requested_name)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), 'Usuário pendente'));
  return new;
end;
$$;

create trigger auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where user_id = auth.uid()
      and role = 'ADMINISTRADOR'
      and access_status = 'APROVADO'
  );
$$;

alter table public.profiles enable row level security;
alter table public.access_requests enable row level security;
alter table public.training_sessions enable row level security;
alter table public.training_session_secrets enable row level security;
alter table public.training_transcripts enable row level security;
alter table public.evaluations enable row level security;

create policy "profiles select own or admin" on public.profiles
for select using (user_id = auth.uid() or public.is_admin());
create policy "profiles admin update" on public.profiles
for update using (public.is_admin()) with check (public.is_admin());

create policy "requests select own or admin" on public.access_requests
for select using (user_id = auth.uid() or public.is_admin());
create policy "requests admin update" on public.access_requests
for update using (public.is_admin()) with check (public.is_admin());

create policy "sessions select own or admin" on public.training_sessions
for select using (user_id = auth.uid() or public.is_admin());
create policy "sessions insert own approved" on public.training_sessions
for insert with check (
  user_id = auth.uid()
  and exists (select 1 from public.profiles where user_id = auth.uid() and access_status = 'APROVADO')
);
create policy "sessions update own or admin" on public.training_sessions
for update using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());

create policy "transcripts select session owner or admin" on public.training_transcripts
for select using (
  public.is_admin() or exists (
    select 1 from public.training_sessions s where s.id = session_id and s.user_id = auth.uid()
  )
);

create policy "evaluations select own or admin" on public.evaluations
for select using (user_id = auth.uid() or public.is_admin());

-- Não há políticas para training_session_secrets: o cliente não pode lê-la,
-- nem inserir/alterar ficha, prompts ou gabaritos diretamente.

create or replace function public.ranking_by_difficulty(selected_difficulty public.difficulty)
returns table (display_name text, difficulty public.difficulty, occurrences bigint, best_score numeric, average_score numeric)
language sql
stable
security definer set search_path = public
as $$
  select p.display_name, s.difficulty, count(e.id), max(e.final_score), round(avg(e.final_score), 1)
  from public.evaluations e
  join public.training_sessions s on s.id = e.session_id
  join public.profiles p on p.user_id = e.user_id
  where s.difficulty = selected_difficulty and not e.partial
  group by p.display_name, s.difficulty
  order by max(e.final_score) desc, avg(e.final_score) desc, count(e.id) desc;
$$;

revoke all on function public.ranking_by_difficulty(public.difficulty) from public;
grant execute on function public.ranking_by_difficulty(public.difficulty) to authenticated;
