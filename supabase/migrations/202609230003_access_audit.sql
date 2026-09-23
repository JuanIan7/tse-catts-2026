create or replace function public.record_authenticated_access()
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update public.profiles
  set first_access_at = coalesce(first_access_at, now()), last_access_at = now()
  where user_id = auth.uid() and access_status = 'APROVADO';
end;
$$;

revoke all on function public.record_authenticated_access() from public;
grant execute on function public.record_authenticated_access() to authenticated;
