alter table demo_traders
  add column if not exists avatar_url text,
  add column if not exists avatar_config jsonb not null default '{}'::jsonb,
  add column if not exists avatar_3d_url text,
  add column if not exists avatar_provider text,
  add column if not exists avaturn_user_id text,
  add column if not exists avaturn_avatar_id text,
  add column if not exists preferred_pose text not null default 'idle',
  add column if not exists avatar_updated_at timestamptz;

create index if not exists demo_traders_avaturn_user_idx
  on demo_traders(avaturn_user_id)
  where avaturn_user_id is not null;

create table if not exists user_avatar_events (
  id text primary key,
  trader_id text not null references demo_traders(id) on delete cascade,
  provider text not null default 'avaturn',
  event_type text not null,
  avaturn_user_id text,
  avaturn_avatar_id text,
  url_type text,
  avatar_url text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists user_avatar_events_trader_idx
  on user_avatar_events(trader_id, created_at desc);
