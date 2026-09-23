insert into storage.buckets (id, name, public)
values ('tse-session-images', 'tse-session-images', false)
on conflict (id) do nothing;
