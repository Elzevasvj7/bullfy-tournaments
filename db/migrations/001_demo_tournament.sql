create table if not exists demo_traders (
  id text primary key,
  name text not null,
  handle text not null unique,
  email text not null unique,
  clan text,
  country text,
  membership text not null default 'free',
  created_at timestamptz not null default now()
);

create table if not exists demo_tournaments (
  id text primary key,
  slug text not null unique,
  name text not null,
  status text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  prize_pool numeric(14, 2) not null default 0,
  max_participants integer not null default 10,
  initial_balance numeric(14, 2) not null default 10000,
  max_drawdown_pct numeric(8, 2) not null default 8,
  max_daily_loss_pct numeric(8, 2) not null default 4,
  max_open_positions integer not null default 3,
  max_total_lots numeric(10, 2) not null default 2,
  allowed_symbols text[] not null default array['EURUSD', 'GBPUSD', 'XAUUSD'],
  created_at timestamptz not null default now()
);

create table if not exists demo_tournament_participants (
  id text primary key,
  tournament_id text not null references demo_tournaments(id) on delete cascade,
  trader_id text not null references demo_traders(id) on delete cascade,
  status text not null default 'active',
  rank integer not null default 1,
  score_pct numeric(10, 2) not null default 0,
  pnl numeric(14, 2) not null default 0,
  balance numeric(14, 2) not null default 10000,
  trades_count integer not null default 0,
  win_rate_pct numeric(8, 2) not null default 0,
  created_at timestamptz not null default now(),
  unique (tournament_id, trader_id)
);

create table if not exists demo_mt5_accounts (
  id text primary key,
  participant_id text not null references demo_tournament_participants(id) on delete cascade,
  login text,
  server text not null default 'Bullfy-Bridge',
  status text not null default 'disconnected',
  balance numeric(14, 2) not null default 0,
  equity numeric(14, 2) not null default 0,
  margin numeric(14, 2) not null default 0,
  free_margin numeric(14, 2) not null default 0,
  margin_level_pct numeric(14, 2) not null default 0,
  bridge_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists demo_trade_orders (
  id text primary key,
  participant_id text not null references demo_tournament_participants(id) on delete cascade,
  mt5_account_id text references demo_mt5_accounts(id) on delete set null,
  bridge_deal_id text,
  bridge_order_id text,
  symbol text not null,
  side text not null,
  volume numeric(10, 2) not null,
  requested_price numeric(14, 5),
  executed_price numeric(14, 5),
  stop_loss numeric(14, 5),
  take_profit numeric(14, 5),
  status text not null default 'pending',
  error_message text,
  bridge_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists demo_trade_positions (
  id text primary key,
  participant_id text not null references demo_tournament_participants(id) on delete cascade,
  mt5_account_id text references demo_mt5_accounts(id) on delete set null,
  order_id text references demo_trade_orders(id) on delete set null,
  bridge_position_id text,
  symbol text not null,
  side text not null,
  volume numeric(10, 2) not null,
  entry_price numeric(14, 5) not null,
  current_price numeric(14, 5) not null,
  stop_loss numeric(14, 5),
  take_profit numeric(14, 5),
  pnl numeric(14, 2) not null default 0,
  pnl_pct numeric(10, 2) not null default 0,
  status text not null default 'open',
  opened_at timestamptz not null default now(),
  closed_at timestamptz
);

create table if not exists demo_arena_events (
  id text primary key,
  tournament_id text not null references demo_tournaments(id) on delete cascade,
  participant_id text references demo_tournament_participants(id) on delete set null,
  trader_name text not null,
  message text not null,
  asset text not null default '-',
  pnl_pct numeric(10, 2) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists demo_participants_tournament_idx
  on demo_tournament_participants(tournament_id);

create index if not exists demo_positions_participant_idx
  on demo_trade_positions(participant_id, status);

create index if not exists demo_events_tournament_idx
  on demo_arena_events(tournament_id, created_at desc);
