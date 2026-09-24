create or replace function public.ranking_by_difficulty(selected_difficulty public.difficulty)
returns table (display_name text, difficulty public.difficulty, occurrences bigint, best_score numeric, average_score numeric)
language sql
stable
security definer set search_path = public
as $$
  select
    split_part(trim(p.display_name), ' ', 1) || ' ' || left(regexp_replace(trim(p.display_name), '^.*[[:space:]]+', ''), 1) || '.' as display_name,
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
