alter table public.training_sessions
  add column if not exists character_image_path text;
