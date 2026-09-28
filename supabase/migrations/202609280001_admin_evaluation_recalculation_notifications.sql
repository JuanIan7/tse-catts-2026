create table public.evaluation_manual_reviews (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.training_sessions(id) on delete cascade,
  previous_score numeric(3,1) not null check (previous_score between 0 and 10),
  recalculated_score numeric(3,1) not null check (recalculated_score between 0 and 10),
  previous_calculation jsonb not null,
  recalculated_calculation jsonb not null,
  reviewed_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.evaluation_review_requests (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.training_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  tools text[] not null check (cardinality(tools) between 1 and 10),
  created_at timestamptz not null default now()
);

create table public.evaluation_notification_log (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.training_sessions(id) on delete cascade,
  kind text not null check (kind in ('ADMIN_FINISHED', 'ADMIN_REVIEW_REQUEST', 'STUDENT_RECALCULATED')),
  recipient text not null,
  status text not null check (status in ('SENT', 'PENDING', 'FAILED')),
  error_message text,
  created_at timestamptz not null default now()
);

create index evaluation_manual_reviews_session_idx on public.evaluation_manual_reviews (session_id, created_at desc);
create index evaluation_review_requests_session_idx on public.evaluation_review_requests (session_id, created_at desc);
create index evaluation_notification_log_session_idx on public.evaluation_notification_log (session_id, created_at desc);

alter table public.evaluation_manual_reviews enable row level security;
alter table public.evaluation_review_requests enable row level security;
alter table public.evaluation_notification_log enable row level security;

create policy "admin manual reviews only" on public.evaluation_manual_reviews for all using (public.is_admin()) with check (public.is_admin());
create policy "student creates own review requests" on public.evaluation_review_requests for insert with check (auth.uid() = user_id);
create policy "student reads own review requests" on public.evaluation_review_requests for select using (auth.uid() = user_id or public.is_admin());
create policy "admin notification logs only" on public.evaluation_notification_log for all using (public.is_admin()) with check (public.is_admin());

-- A ação usa a sessão autenticada do administrador (não a service role).
-- A função é fechada para anônimo e confirma a função administrativa antes
-- de executar as duas gravações na mesma transação.
create or replace function public.apply_admin_evaluation_recalculation(
  p_session_id uuid,
  p_previous_score numeric,
  p_recalculated_score numeric,
  p_previous_calculation jsonb,
  p_recalculated_calculation jsonb,
  p_reviewed_by uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() or auth.uid() is distinct from p_reviewed_by then
    raise exception 'Acesso administrativo necessário';
  end if;

  insert into public.evaluation_manual_reviews (
    session_id, previous_score, recalculated_score, previous_calculation,
    recalculated_calculation, reviewed_by
  ) values (
    p_session_id, p_previous_score, p_recalculated_score, p_previous_calculation,
    p_recalculated_calculation, p_reviewed_by
  );

  update public.evaluations
  set final_score = p_recalculated_score,
      calculation = p_recalculated_calculation,
      item_states = p_recalculated_calculation -> 'itens',
      grave_errors = p_recalculated_calculation -> 'erros_graves'
  where session_id = p_session_id;

  if not found then raise exception 'Avaliação não encontrada'; end if;
end;
$$;
revoke all on function public.apply_admin_evaluation_recalculation(uuid, numeric, numeric, jsonb, jsonb, uuid) from public, anon;
grant execute on function public.apply_admin_evaluation_recalculation(uuid, numeric, numeric, jsonb, jsonb, uuid) to authenticated;
