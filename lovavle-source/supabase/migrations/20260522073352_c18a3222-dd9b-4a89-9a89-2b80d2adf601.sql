-- 1) trading_chart_layouts
CREATE TABLE public.trading_chart_layouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  symbol TEXT NOT NULL,
  timeframe TEXT NOT NULL DEFAULT 'M15',
  indicators_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  drawings_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_trading_layouts_user ON public.trading_chart_layouts(user_id);
ALTER TABLE public.trading_chart_layouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own chart layouts"
ON public.trading_chart_layouts FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 2) trading_watchlist
CREATE TABLE public.trading_watchlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  symbol TEXT NOT NULL,
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, symbol)
);
CREATE INDEX idx_trading_watchlist_user ON public.trading_watchlist(user_id, order_index);
ALTER TABLE public.trading_watchlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own watchlist"
ON public.trading_watchlist FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 3) trading_journal
CREATE TABLE public.trading_journal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  account_login TEXT,
  action TEXT NOT NULL,
  payload_json JSONB,
  result_json JSONB,
  ok BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_trading_journal_user ON public.trading_journal(user_id, created_at DESC);
ALTER TABLE public.trading_journal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own journal"
ON public.trading_journal FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users insert own journal"
ON public.trading_journal FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 4) trading_platform_access
CREATE TABLE public.trading_platform_access (
  user_id UUID PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT true,
  granted_by UUID,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.trading_platform_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own access"
ON public.trading_platform_access FOR SELECT
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'global_admin'));

CREATE POLICY "Global admins manage access"
ON public.trading_platform_access FOR ALL
USING (public.has_role(auth.uid(), 'global_admin'))
WITH CHECK (public.has_role(auth.uid(), 'global_admin'));

-- updated_at trigger for layouts
CREATE TRIGGER update_trading_chart_layouts_updated_at
BEFORE UPDATE ON public.trading_chart_layouts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();