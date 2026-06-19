alter table demo_traders
  add column if not exists avatar_storage_bucket text,
  add column if not exists avatar_storage_path text;

create index if not exists demo_traders_avatar_storage_idx
  on demo_traders(avatar_storage_bucket, avatar_storage_path)
  where avatar_storage_path is not null;
