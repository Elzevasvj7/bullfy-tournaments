-- Add payout_method column with default usdt_trc20
ALTER TABLE public.portal_withdrawal_requests
  ADD COLUMN IF NOT EXISTS payout_method text NOT NULL DEFAULT 'usdt_trc20',
  ADD COLUMN IF NOT EXISTS stripe_destination text,
  ADD COLUMN IF NOT EXISTS stripe_transfer_id text,
  ADD COLUMN IF NOT EXISTS stripe_response jsonb;

-- Drop strict network check & destination_address NOT NULL since stripe doesn't need them
ALTER TABLE public.portal_withdrawal_requests
  DROP CONSTRAINT IF EXISTS portal_withdrawal_requests_network_check;

ALTER TABLE public.portal_withdrawal_requests
  ALTER COLUMN destination_address DROP NOT NULL,
  ALTER COLUMN network DROP NOT NULL;

-- Add payout_method check
ALTER TABLE public.portal_withdrawal_requests
  ADD CONSTRAINT portal_withdrawal_requests_payout_method_check
  CHECK (payout_method IN ('usdt_trc20','stripe'));

-- Validation trigger: require fields based on method
CREATE OR REPLACE FUNCTION public.validate_withdrawal_payout_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.payout_method = 'usdt_trc20' THEN
    IF NEW.destination_address IS NULL OR length(NEW.destination_address) < 30 THEN
      RAISE EXCEPTION 'destination_address requerido para retiros USDT TRC20';
    END IF;
    IF NEW.network IS NULL THEN
      NEW.network := 'TRC20';
    END IF;
    IF NEW.network <> 'TRC20' THEN
      RAISE EXCEPTION 'network debe ser TRC20 para retiros usdt_trc20';
    END IF;
  ELSIF NEW.payout_method = 'stripe' THEN
    IF NEW.stripe_destination IS NULL OR length(NEW.stripe_destination) < 3 THEN
      RAISE EXCEPTION 'stripe_destination (email o account id) requerido para retiros Stripe';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_withdrawal_payout ON public.portal_withdrawal_requests;
CREATE TRIGGER trg_validate_withdrawal_payout
  BEFORE INSERT OR UPDATE ON public.portal_withdrawal_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_withdrawal_payout_fields();

-- Add stripe_destination preference on wallet
ALTER TABLE public.portal_user_wallets
  ADD COLUMN IF NOT EXISTS stripe_destination text;