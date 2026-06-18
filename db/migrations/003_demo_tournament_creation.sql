alter table demo_tournaments
  add column if not exists description text not null default 'Arena demo conectada a Postgres local y bridge MT5 desacoplado.',
  add column if not exists league text not null default 'bmoney',
  add column if not exists entry_fee_bmoney numeric(14, 2) not null default 0,
  add column if not exists entry_fee_usd numeric(14, 2) not null default 0,
  add column if not exists timezone text not null default 'America/Caracas';
