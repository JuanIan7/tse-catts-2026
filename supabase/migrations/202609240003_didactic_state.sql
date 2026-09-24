alter table public.training_sessions
  add column if not exists didactic_state jsonb not null default '{"version":1,"revision":0,"turnos":0,"rapport":0,"categorias_reveladas":{"risco":0,"protecao":0,"vinculo":0},"interrupcoes":0,"saida_digna_aceita":false,"itens":{},"erros_graves":{}}'::jsonb,
  add column if not exists didactic_state_revision integer not null default 0 check (didactic_state_revision >= 0);

create or replace function public.save_training_didactic_state(
  p_session_id uuid,
  p_expected_revision integer,
  p_state jsonb
)
returns public.training_sessions
language plpgsql
security definer set search_path = public
as $$
declare
  updated public.training_sessions;
begin
  update public.training_sessions
  set didactic_state = p_state,
      didactic_state_revision = didactic_state_revision + 1
  where id = p_session_id
    and didactic_state_revision = p_expected_revision
  returning * into updated;

  if not found then
    raise exception 'O estado da sessão foi alterado em outra conexão. Atualize e tente novamente.';
  end if;

  return updated;
end;
$$;

revoke all on function public.save_training_didactic_state(uuid, integer, jsonb) from public, anon, authenticated;
grant execute on function public.save_training_didactic_state(uuid, integer, jsonb) to service_role;
