CREATE TABLE public.trading_room_favorite_symbols (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_user_id UUID NOT NULL REFERENCES public.partner_users(id) ON DELETE CASCADE,
  portal_id UUID NOT NULL REFERENCES public.partner_portals(id) ON DELETE CASCADE,
  account_id UUID NULL REFERENCES public.trading_room_accounts(id) ON DELETE SET NULL,
  symbol TEXT NOT NULL,
  display_name TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT trading_room_favorite_symbols_symbol_check CHECK (char_length(trim(symbol)) > 0),
  CONSTRAINT trading_room_favorite_symbols_unique UNIQUE (partner_user_id, portal_id, symbol)
);

CREATE INDEX idx_trading_room_favorite_symbols_partner_user
  ON public.trading_room_favorite_symbols (partner_user_id, portal_id);

CREATE INDEX idx_trading_room_favorite_symbols_account
  ON public.trading_room_favorite_symbols (account_id);

CREATE INDEX idx_trading_room_favorite_symbols_symbol
  ON public.trading_room_favorite_symbols (symbol);

ALTER TABLE public.trading_room_favorite_symbols ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_trading_room_favorite_symbols_updated_at
BEFORE UPDATE ON public.trading_room_favorite_symbols
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();