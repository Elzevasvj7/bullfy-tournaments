import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { hashPassword } from "@/lib/partnerPassword";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/lib/toastUtils";
import PhoneInput, { validatePhone, getFullPhone } from "@/components/shared/PhoneInput";
import OTPVerificationStep from "@/components/shared/OTPVerificationStep";
import { PasswordInput } from "@/components/shared/PasswordInput";
import { CheckCircle2, Loader2 } from "lucide-react";
import { dimHex } from "@/hooks/usePortalBranding";

interface PartnerRegisterFormProps {
  portalId: string;
  primaryColor: string;
}

type Step = "form" | "verify_email" | "verify_sms" | "done";

const PartnerRegisterForm = ({ portalId, primaryColor }: PartnerRegisterFormProps) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [countryCode, setCountryCode] = useState("CO");
  const [step, setStep] = useState<Step>("form");
  const [loading, setLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [fallbackMessage, setFallbackMessage] = useState<string | undefined>(undefined);

  const phoneValidation = validatePhone(phone, countryCode);
  const formValid = name.trim() && email.trim() && password.trim().length >= 6 && phoneValidation.valid;

  const sendEmailOTP = async () => {
    const { data, error } = await supabase.functions.invoke("send-email-otp", {
      body: { email: email.trim(), purpose: "registration_email", portal_id: portalId },
    });
    return !error && data?.success;
  };

  const sendSmsOTP = async (forceEmail = false): Promise<{ success: boolean; fallback?: 'email' }> => {
    const fullPhone = getFullPhone(phone, countryCode);
    const { data, error } = await supabase.functions.invoke("send-sms-otp", {
      body: { email: email.trim(), phone: fullPhone, purpose: "registration_sms", portal_id: portalId, force_email_fallback: forceEmail },
    });
    if (error || !data?.success) return { success: false };
    return { success: true, fallback: data.fallback };
  };

  const handleStartVerification = async () => {
    if (!formValid) {
      toast.error("Completa todos los campos correctamente");
      return;
    }
    setLoading(true);
    const ok = await sendEmailOTP();
    if (ok) {
      toast.success("Código enviado a tu correo electrónico");
      setStep("verify_email");
    } else {
      toast.error("Error al enviar código por email");
    }
    setLoading(false);
  };

  const handleVerifyEmail = async (code: string) => {
    setVerifyLoading(true);
    const { data, error } = await supabase.functions.invoke("verify-otp", {
      body: { email: email.trim(), code, purpose: "registration_email" },
    });
    if (error || !data?.ok) {
      const errMsg = data?.error || (error instanceof Error ? error.message : null) || "Código inválido";
      toast.error(errMsg);
    } else {
      toast.success("Email verificado ✓ Enviando código a tu teléfono...");
      const smsResult = await sendSmsOTP();
      if (smsResult.success) {
        if (smsResult.fallback === 'email') {
          // SMS falló pero fallback a email funcionó - mostrar mensaje especial
          setFallbackMessage("No pudimos enviar el SMS a tu teléfono. Te enviamos un código de respaldo a tu correo.");
          toast.success("Código de respaldo enviado a tu email");
        } else {
          setFallbackMessage(undefined);
          toast.success("Código enviado a tu teléfono");
        }
        setStep("verify_sms");
      } else {
        toast.error("Error al enviar SMS. Intenta de nuevo.");
      }
    }
    setVerifyLoading(false);
  };

  const handleVerifySms = async (code: string) => {
    setVerifyLoading(true);
    const { data, error } = await supabase.functions.invoke("verify-otp", {
      body: { email: email.trim(), code, purpose: "registration_sms" },
    });
    if (error || !data?.ok) {
      const errMsg = data?.error || (error instanceof Error ? error.message : null) || "Código inválido";
      toast.error(errMsg);
    } else {
      await handleRegister();
    }
    setVerifyLoading(false);
  };

  const handleRegister = async () => {
    const fullPhone = getFullPhone(phone, countryCode);
    const normalizedEmail = email.trim().toLowerCase();

    // QA C1: hashear la contraseña en el cliente (PBKDF2) antes de insertar.
    // Mismo esquema/formato que el backend, por lo que el login la verifica.
    const passwordHash = await hashPassword(password);

    // ---- Referido simple (NO MLM) ----
    // Determinamos QUIÉN refirió a este usuario para guardarlo en referred_by.
    // Aceptamos `?invite=` (link de referido simple de cualquier usuario) y
    // también `?ref=` (link MLM existente), de modo que el panel de referidos
    // del IB capture el origen sin importar qué link se usó. La lógica MLM
    // (más abajo) sigue dependiendo SOLO de `?ref=`.
    let referredBy: string | null = null;
    try {
      const params = new URLSearchParams(window.location.search);
      const refId = params.get("invite") || params.get("ref");
      if (refId) {
        const { data: referrer } = await supabase
          .from("partner_users")
          .select("id")
          .eq("id", refId)
          .eq("portal_id", portalId)
          .maybeSingle();
        if (referrer) referredBy = refId;
      }
    } catch { /* best-effort: si falla, registro directo */ }

    const { data: inserted, error } = await supabase
      .from("partner_users")
      .insert({
        portal_id: portalId,
        email: normalizedEmail,
        password_hash: passwordHash,
        nombre: name.trim(),
        telefono: fullPhone,
        status: "pending",
        ...(referredBy ? { referred_by: referredBy, referred_at: new Date().toISOString() } : {}),
      } as any)
      .select("id")
      .maybeSingle();

    if (error) {
      if (error.code === "23505") toast.error("Este email ya está registrado");
      else toast.error("Error: " + error.message);
      setStep("form");
      return;
    }

    // C7: avisar al IB que hay un usuario nuevo por aprobar — best-effort.
    {
      const newUserId = (inserted as any)?.id as string | undefined;
      if (newUserId) {
        supabase.functions.invoke("portal-notifications", {
          body: { event: "approval_pending", portal_id: portalId, partner_user_id: newUserId },
        }).catch(() => {});
      }
    }

    // ---- MLM referral capture (best-effort, non-blocking) ----
    try {
      const params = new URLSearchParams(window.location.search);
      const sponsorId = params.get("ref");
      const newUserId = (inserted as any)?.id as string | undefined;
      if (sponsorId && newUserId) {
        // Verify sponsor exists in same portal
        const { data: sponsor } = await supabase
          .from("partner_users")
          .select("id")
          .eq("id", sponsorId)
          .eq("portal_id", portalId)
          .maybeSingle();

        if (sponsor) {
          // Build upline chain from sponsor's existing chain
          const { data: sponsorRef } = await supabase
            .from("portal_mlm_referrals")
            .select("upline_chain")
            .eq("portal_id", portalId)
            .eq("user_id", sponsorId)
            .maybeSingle();

          const sponsorChain: string[] = (sponsorRef?.upline_chain as string[]) || [];
          const upline_chain = [sponsorId, ...sponsorChain];

          await supabase.from("portal_mlm_referrals").insert({
            portal_id: portalId,
            user_id: newUserId,
            sponsor_id: sponsorId,
            upline_chain,
          } as any);
        }
      }
    } catch (e) {
      console.warn("MLM referral capture skipped:", e);
    }

    setStep("done");
    toast.success("¡Registro exitoso!");
  };

  const handleResendEmail = async () => {
    setResendLoading(true);
    const ok = await sendEmailOTP();
    if (ok) toast.success("Nuevo código enviado a tu correo");
    else toast.error("Error al reenviar");
    setResendLoading(false);
  };

  const handleResendSms = async () => {
    setResendLoading(true);
    const r = await sendSmsOTP();
    if (r.success) {
      if (r.fallback === 'email') {
        setFallbackMessage("No pudimos enviar el SMS. Te enviamos un código de respaldo a tu correo.");
        toast.success("Código enviado a tu email (SMS no disponible)");
      } else {
        toast.success("Nuevo código enviado a tu teléfono");
      }
    } else toast.error("Error al reenviar");
    setResendLoading(false);
  };

  const handleForceEmailFallback = async () => {
    setResendLoading(true);
    const r = await sendSmsOTP(true);
    if (r.success) {
      setFallbackMessage("Te enviamos el código a tu correo electrónico.");
      toast.success("Código enviado a tu email");
    } else toast.error("Error al enviar por email. Intenta de nuevo.");
    setResendLoading(false);
  };

  const resetForm = () => {
    setStep("form");
    setName("");
    setEmail("");
    setPassword("");
    setPhone("");
  };

  if (step === "done") {
    return (
      <div className="text-center space-y-3 py-4">
        <CheckCircle2 className="w-12 h-12 mx-auto text-primary" />
        <h3 className="font-semibold text-lg">¡Registro completo!</h3>
        <p className="text-sm text-muted-foreground">Tu cuenta está pendiente de aprobación por el administrador.</p>
        <Button variant="outline" className="mt-2" onClick={resetForm}>Volver al inicio</Button>
      </div>
    );
  }

  if (step === "verify_email") {
    return (
      <OTPVerificationStep
        type="email"
        destination={email.trim()}
        currentStep={1}
        totalSteps={2}
        loading={verifyLoading}
        onVerify={handleVerifyEmail}
        onResend={handleResendEmail}
        onBack={() => setStep("form")}
        resendLoading={resendLoading}
        primaryColor={primaryColor}
      />
    );
  }

  if (step === "verify_sms") {
    return (
      <OTPVerificationStep
        type="sms"
        destination={getFullPhone(phone, countryCode)}
        currentStep={2}
        totalSteps={2}
        loading={verifyLoading}
        onVerify={handleVerifySms}
        onResend={handleResendSms}
        onBack={() => setStep("verify_email")}
        resendLoading={resendLoading}
        primaryColor={primaryColor}
        fallbackMessage={fallbackMessage}
        onForceEmailFallback={handleForceEmailFallback}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div><Label>Nombre</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Tu nombre" /></div>
      <div><Label>Email</Label><Input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="tu@email.com" /></div>
      <div><Label>Contraseña</Label><PasswordInput value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" /></div>

      <PhoneInput
        value={phone}
        countryCode={countryCode}
        onPhoneChange={setPhone}
        onCountryChange={setCountryCode}
      />

      <Button
        className="w-full text-white"
        style={{ backgroundColor: dimHex(primaryColor, 0.7) }}
        onClick={handleStartVerification}
        disabled={loading || !formValid}
      >
        {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando código...</> : "Registrarse"}
      </Button>
      <p className="text-xs text-muted-foreground text-center">Verificaremos tu email y teléfono antes de completar el registro</p>
    </div>
  );
};

export default PartnerRegisterForm;
