insert into demo_traders (
  id,
  name,
  handle,
  email,
  clan,
  country,
  membership
) values (
  'trader_nando',
  'Nando Trader',
  'nando',
  'nando@bullfy.com',
  'Bullfy Clan',
  'VE',
  'elite'
) on conflict (id) do update set
  name = excluded.name,
  handle = excluded.handle,
  email = excluded.email,
  clan = excluded.clan,
  country = excluded.country,
  membership = excluded.membership;

insert into demo_tournaments (
  id,
  slug,
  name,
  status,
  starts_at,
  ends_at,
  prize_pool,
  max_participants,
  initial_balance,
  max_drawdown_pct,
  max_daily_loss_pct,
  max_open_positions,
  max_total_lots,
  allowed_symbols
) values (
  'tournament_bullfy_open',
  'bullfy-tournament-open',
  'Bullfy Tournament Open',
  'live',
  now() - interval '10 minutes',
  now() + interval '50 minutes',
  10000,
  10,
  10000,
  8,
  4,
  3,
  2,
  array['EURUSD', 'GBPUSD', 'XAUUSD']
) on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  status = excluded.status,
  starts_at = excluded.starts_at,
  ends_at = excluded.ends_at,
  prize_pool = excluded.prize_pool,
  max_participants = excluded.max_participants,
  initial_balance = excluded.initial_balance,
  max_drawdown_pct = excluded.max_drawdown_pct,
  max_daily_loss_pct = excluded.max_daily_loss_pct,
  max_open_positions = excluded.max_open_positions,
  max_total_lots = excluded.max_total_lots,
  allowed_symbols = excluded.allowed_symbols;

insert into demo_tournament_participants (
  id,
  tournament_id,
  trader_id,
  status,
  rank,
  score_pct,
  pnl,
  balance,
  trades_count,
  win_rate_pct
) values (
  'participant_nando_open',
  'tournament_bullfy_open',
  'trader_nando',
  'active',
  1,
  0,
  0,
  10000,
  0,
  0
) on conflict (id) do update set
  status = excluded.status,
  rank = excluded.rank,
  score_pct = excluded.score_pct,
  pnl = excluded.pnl,
  balance = excluded.balance,
  trades_count = excluded.trades_count,
  win_rate_pct = excluded.win_rate_pct;

insert into demo_mt5_accounts (
  id,
  participant_id,
  login,
  server,
  status,
  balance,
  equity,
  margin,
  free_margin,
  margin_level_pct
) values (
  'mt5_nando_open',
  'participant_nando_open',
  null,
  'Bullfy-Bridge',
  'disconnected',
  10000,
  10000,
  0,
  10000,
  0
) on conflict (id) do update set
  participant_id = excluded.participant_id,
  server = excluded.server,
  balance = excluded.balance,
  equity = excluded.equity,
  margin = excluded.margin,
  free_margin = excluded.free_margin,
  margin_level_pct = excluded.margin_level_pct;

insert into demo_arena_events (
  id,
  tournament_id,
  participant_id,
  trader_name,
  message,
  asset,
  pnl_pct,
  created_at
) values
  (
    'event_demo_ready',
    'tournament_bullfy_open',
    'participant_nando_open',
    'Nando Trader',
    'entro al cockpit',
    'ARENA',
    0,
    now() - interval '5 minutes'
  ),
  (
    'event_demo_live',
    'tournament_bullfy_open',
    'participant_nando_open',
    'Bullfy System',
    'activo la arena',
    'SYSTEM',
    0,
    now() - interval '4 minutes'
  )
on conflict (id) do update set
  created_at = excluded.created_at;
