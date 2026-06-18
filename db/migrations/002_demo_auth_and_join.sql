alter table demo_traders
  add column if not exists login text,
  add column if not exists password text,
  add column if not exists mt5_login text,
  add column if not exists mt5_password text;

create unique index if not exists demo_traders_login_unique
  on demo_traders(login)
  where login is not null;

create index if not exists demo_traders_auth_lookup_idx
  on demo_traders(login, email, handle);
