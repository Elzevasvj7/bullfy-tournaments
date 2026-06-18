-- Streamer wallets for USDT TRC20 payouts
CREATE TABLE public.streamer_wallets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  host_id UUID NOT NULL,
  wallet_address TEXT NOT NULL DEFAULT '',
  network TEXT NOT NULL DEFAULT 'TRC20',
  currency TEXT NOT NULL DEFAULT 'USDT',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (host_id)
);

ALTER TABLE public.streamer_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can manage own wallet"
  ON public.streamer_wallets FOR ALL
  USING (host_id = auth.uid())
  WITH CHECK (host_id = auth.uid());

CREATE POLICY "Admins can read all wallets"
  ON public.streamer_wallets FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'global_admin'::app_role));

-- Withdrawal requests
CREATE TABLE public.withdrawal_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  host_id UUID NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  wallet_address TEXT NOT NULL,
  network TEXT NOT NULL DEFAULT 'TRC20',
  currency TEXT NOT NULL DEFAULT 'USDT',
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can read own requests"
  ON public.withdrawal_requests FOR SELECT
  USING (host_id = auth.uid());

CREATE POLICY "Owner can insert own requests"
  ON public.withdrawal_requests FOR INSERT
  WITH CHECK (host_id = auth.uid());

CREATE POLICY "Admins can manage all requests"
  ON public.withdrawal_requests FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'global_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'global_admin'::app_role));