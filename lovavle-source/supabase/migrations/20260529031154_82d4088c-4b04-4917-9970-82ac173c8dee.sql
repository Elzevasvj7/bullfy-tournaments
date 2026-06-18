insert into storage.buckets
  (id, name, public)
values
  ('partner-avatars', 'partner-avatars', true)
on conflict (id) do nothing;