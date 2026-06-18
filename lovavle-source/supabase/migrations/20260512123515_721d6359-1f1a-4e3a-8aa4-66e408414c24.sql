ALTER TABLE public.trading_room_accounts
  ADD COLUMN IF NOT EXISTS bridge_login text;

CREATE INDEX IF NOT EXISTS idx_trading_room_accounts_bridge_login
  ON public.trading_room_accounts (bridge_login)
  WHERE bridge_login IS NOT NULL;

COMMENT ON COLUMN public.trading_room_accounts.bridge_login IS
  'MT5 login for Bridge MT5 Bullfy provider. Mutually exclusive with metaapi_account_id (provider switch).';