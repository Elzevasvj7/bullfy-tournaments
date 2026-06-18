insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tournament-avatars-3d', 'tournament-avatars-3d', true, 26214400, array['model/gltf-binary','application/octet-stream'])
on conflict (id) do update set public = true, file_size_limit = 26214400, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "tournament-avatars-3d public read" on storage.objects;
create policy "tournament-avatars-3d public read"
on storage.objects for select
using (bucket_id = 'tournament-avatars-3d');