alter table public.access_requests add column requested_email text;

update public.access_requests request
set requested_email = users.email
from auth.users users
where users.id = request.user_id and request.requested_email is null;

alter table public.access_requests alter column requested_email set not null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), 'Usuário pendente'));
  insert into public.access_requests (user_id, requested_name, requested_email)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), 'Usuário pendente'), new.email);
  return new;
end;
$$;
