-- ============================================================================
-- P7.5 (soporte) — Retiros DEMO no requieren destino real
-- ----------------------------------------------------------------------------
-- El trigger validate_withdrawal_payout_fields exige destination_address (USDT)
-- o stripe_destination (Stripe) en cada retiro. Un retiro DEMO es simulado (sin
-- payout real), así que no tiene sentido exigir un destino. Se relaja la
-- validación para account_kind='demo' (early return). El flujo real queda igual.
-- Idempotente (CREATE OR REPLACE; el trigger sigue apuntando a esta función).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.validate_withdrawal_payout_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- P7.5: los retiros demo son simulados → no requieren destino.
  IF COALESCE(NEW.account_kind, 'real') = 'demo' THEN
    RETURN NEW;
  END IF;

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
