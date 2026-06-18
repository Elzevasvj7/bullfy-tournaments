
CREATE OR REPLACE FUNCTION public.reset_otp_on_lead_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete OTP records by email
  IF OLD.correo IS NOT NULL AND OLD.correo <> '' THEN
    DELETE FROM public.partner_otp_codes WHERE email = OLD.correo;
  END IF;

  -- Delete OTP records by phone
  IF OLD.telefono IS NOT NULL AND OLD.telefono <> '' THEN
    DELETE FROM public.partner_otp_codes WHERE phone = OLD.telefono;
  END IF;

  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_reset_otp_on_lead_delete
  BEFORE DELETE ON public.stream_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.reset_otp_on_lead_delete();
