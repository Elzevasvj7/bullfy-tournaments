create table if not exists wallet_accounts (
  trader_id text primary key references demo_traders(id) on delete cascade,
  balance_usd numeric(14, 2) not null default 0,
  locked_usd numeric(14, 2) not null default 0,
  demo_balance numeric(14, 2) not null default 1680,
  bullfy_points numeric(14, 2) not null default 538,
  pending_rewards_usd numeric(14, 2) not null default 0,
  claimable_rewards_usd numeric(14, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists payment_intents (
  id text primary key,
  trader_id text not null references demo_traders(id) on delete cascade,
  provider text not null check (provider in ('nowpayments')),
  purpose text not null check (purpose in ('wallet_topup', 'tournament_entry')) default 'wallet_topup',
  amount_usd numeric(14, 2) not null check (amount_usd > 0),
  status text not null check (status in ('pending', 'completed', 'failed', 'expired', 'cancelled')) default 'pending',
  provider_invoice_id text,
  provider_payment_id text,
  provider_status text,
  invoice_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists payment_intents_trader_idx
  on payment_intents(trader_id, created_at desc);

create index if not exists payment_intents_status_idx
  on payment_intents(status);

create index if not exists payment_intents_provider_invoice_idx
  on payment_intents(provider_invoice_id)
  where provider_invoice_id is not null;

create index if not exists payment_intents_provider_payment_idx
  on payment_intents(provider_payment_id)
  where provider_payment_id is not null;

create table if not exists wallet_movements (
  id text primary key,
  trader_id text not null references demo_traders(id) on delete cascade,
  payment_intent_id text references payment_intents(id) on delete set null,
  movement_type text not null check (movement_type in ('topup', 'entry_fee', 'reward', 'adjustment')),
  status text not null check (status in ('pending', 'completed', 'failed')) default 'completed',
  amount_usd numeric(14, 2) not null,
  currency text not null default 'USD',
  title text not null,
  description text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists wallet_movements_trader_idx
  on wallet_movements(trader_id, created_at desc);

create unique index if not exists wallet_movements_topup_intent_uidx
  on wallet_movements(payment_intent_id)
  where payment_intent_id is not null and movement_type = 'topup';

create table if not exists webhook_events (
  id text primary key,
  provider text not null,
  event_key text not null,
  headers jsonb not null default '{}'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (provider, event_key)
);

insert into wallet_accounts (trader_id, demo_balance, bullfy_points)
select id, 1680, 538
from demo_traders
on conflict (trader_id) do nothing;
