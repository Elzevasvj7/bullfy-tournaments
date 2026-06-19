update demo_traders
set
  login = 'nando',
  password = 'TestPass123!',
  mt5_login = '121734',
  mt5_password = 'TestPass123!'
where id = 'trader_nando';

insert into demo_traders (
  id,
  name,
  handle,
  email,
  clan,
  country,
  membership,
  login,
  password,
  mt5_login,
  mt5_password
) values
  (
    'trader_120631',
    'Valentina Rojas',
    'valentina',
    'valentina@bullfy.demo',
    'Bullfy Clan',
    'VE',
    'free',
    'valentina',
    'DemoTrader1!',
    '121827',
    'TestPass123!'
  ),
  (
    'trader_118315',
    'Mateo Torres',
    'mateo',
    'mateo@bullfy.demo',
    'Bullfy Clan',
    'VE',
    'free',
    'mateo',
    'DemoTrader2!',
    '121828',
    'TestPass123!'
  )
on conflict (id) do update set
  name = excluded.name,
  handle = excluded.handle,
  email = excluded.email,
  clan = excluded.clan,
  country = excluded.country,
  membership = excluded.membership,
  login = excluded.login,
  password = excluded.password,
  mt5_login = excluded.mt5_login,
  mt5_password = excluded.mt5_password;

insert into wallet_accounts (trader_id, demo_balance, bullfy_points)
select id, 1680, 538
from demo_traders
on conflict (trader_id) do nothing;

delete from demo_trade_positions pos
using demo_tournament_participants participant
where pos.participant_id = participant.id
  and participant.trader_id in ('trader_120631', 'trader_118315');

delete from demo_trade_orders ord
using demo_tournament_participants participant
where ord.participant_id = participant.id
  and participant.trader_id in ('trader_120631', 'trader_118315');

delete from demo_mt5_accounts account
using demo_tournament_participants participant
where account.participant_id = participant.id
  and participant.trader_id in ('trader_120631', 'trader_118315');
