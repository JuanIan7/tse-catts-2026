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
