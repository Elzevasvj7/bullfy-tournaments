import { useEffect, useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useTournamentAuth } from "@/hooks/useTournamentAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { CheckCircle2, Mail, Smartphone } from "lucide-react";
import PhoneInput, { validatePhone, getFullPhone, COUNTRY_CODES } from "@/components/shared/PhoneInput";

type Step = "form" | "verify" | "password";

export default function TournamentRegister() {
  const { setSession } = useTournamentAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [step, setStep] = useState<Step>("form");
  const [loading, setLoading] = useState(false);
  const [refCode, setRefCode] = useState("");
  useEffect(() => {
    const r = params.get("ref"); if (r) setRefCode(r.toUpperCase().trim());
  }, [params]);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneLocal, setPhoneLocal] = useState("");
  const [countryCode, setCountryCode] = useState("EC");
  const phone = getFullPhone(phoneLocal, countryCode);
  const country = COUNTRY_CODES.find(c => c.code === countryCode)?.name || "";

  const [emailCode, setEmailCode] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [smsVerified, setSmsVerified] = useState(false);
  const [smsResendCount, setSmsResendCount] = useState(0);
  const [smsSentByEmail, setSmsSentByEmail] = useState(false);

  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");

  const sendOtp = async (channel: "email" | "sms", opts?: { fallbackToEmail?: boolean }) => {
    setLoading(true);
    try {
      const body: any = channel === "email" ? { email, channel } : { phone, channel };
      if (channel === "sms" && opts?.fallbackToEmail) {
        body.email = email;
        body.fallback_to_email = true;
      }
      const { data, error } = await supabase.functions.invoke("tournament-auth-request-otp", { body });
      if (error || !data?.ok) { toast.error(data?.error || "Error enviando código"); return false; }
      if (channel === "sms" && opts?.fallbackToEmail) {
        setSmsSentByEmail(true);
        toast.success("Código del SMS enviado a tu email");
      } else {
        toast.success(`Código enviado por ${channel === "email" ? "email" : "SMS"}`);
      }
      return true;
    } finally { setLoading(false); }
  };

  const resendSms = async () => {
    const sentOk = await sendOtp("sms");
    if (sentOk) setSmsResendCount((n) => n + 1);
  };

  const verifyOtp = async (channel: "email" | "sms") => {
    setLoading(true);
    try {
      const body = channel === "email"
        ? { email, code: emailCode, purpose: "registration_email" }
        : { phone, code: smsCode, purpose: "registration_sms" };
      const { data, error } = await supabase.functions.invoke("tournament-auth-verify-otp", { body });
      if (error || !data?.ok) { toast.error(data?.error || "Código inválido"); return; }
      if (channel === "email") setEmailVerified(true); else setSmsVerified(true);
      toast.success(`${channel === "email" ? "Email" : "Teléfono"} verificado`);
    } finally { setLoading(false); }
  };

  const startVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !email || !phoneLocal) { toast.error("Completa todos los campos"); return; }
    const v = validatePhone(phoneLocal, countryCode);
    if (!v.valid) { toast.error(v.message); return; }
    const e1 = await sendOtp("email"); if (!e1) return;
    const s1 = await sendOtp("sms"); if (!s1) return;
    setStep("verify");
  };

  const finishRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { toast.error("La contraseña debe tener al menos 8 caracteres"); return; }
    if (password !== password2) { toast.error("Las contraseñas no coinciden"); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("tournament-auth-register", {
        body: { email, phone, full_name: fullName, password, country, referred_by_code: refCode || null },
      });
      if (error || !data?.ok) { toast.error(data?.error || "Error creando cuenta"); return; }
      setSession(data.token, data.user);
      toast.success("¡Cuenta creada!");
      nav("/tournament/dashboard");
    } finally { setLoading(false); }
  };

  return (
    <div className="max-w-md mx-auto pt-8">
      <Card>
        <CardHeader>
          <CardTitle>Crear cuenta</CardTitle>
          <CardDescription>Verifica email y teléfono una sola vez. Después ingresas con contraseña.</CardDescription>
        </CardHeader>
        <CardContent>
          {step === "form" && (
            <form onSubmit={startVerification} className="space-y-4">
              <div className="space-y-2"><Label>Nombre completo</Label>
                <Input required value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
              <div className="space-y-2"><Label>Email</Label>
                <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <PhoneInput
                value={phoneLocal}
                countryCode={countryCode}
                onPhoneChange={setPhoneLocal}
                onCountryChange={setCountryCode}
              />
              <div className="space-y-2"><Label>Código de invitación (opcional)</Label>
                <Input value={refCode} onChange={(e) => setRefCode(e.target.value.toUpperCase())} maxLength={8} placeholder="ABCD1234" /></div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Enviando códigos..." : "Enviar códigos de verificación"}
              </Button>
              <p className="text-sm text-center text-muted-foreground">
                ¿Ya tienes cuenta? <Link to="/tournament/login" className="text-primary">Ingresar</Link>
              </p>
            </form>
          )}

          {step === "verify" && (
            <div className="space-y-4">
              <div className="space-y-2 p-3 border border-border rounded-lg">
                <Label className="flex items-center gap-2"><Mail className="h-4 w-4" /> Código por email
                  {emailVerified && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}</Label>
                <div className="flex gap-2">
                  <Input value={emailCode} onChange={(e) => setEmailCode(e.target.value)} maxLength={6} disabled={emailVerified} />
                  <Button type="button" onClick={() => verifyOtp("email")} disabled={loading || emailVerified || !emailCode}>Verificar</Button>
                </div>
                {!emailVerified && <button type="button" onClick={() => sendOtp("email")} className="text-xs text-primary">Reenviar email</button>}
              </div>

              <div className="space-y-2 p-3 border border-border rounded-lg">
                <Label className="flex items-center gap-2"><Smartphone className="h-4 w-4" /> Código por SMS
                  {smsVerified && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}</Label>
                {smsSentByEmail && !smsVerified && (
                  <p className="text-xs text-amber-500">📧 Te enviamos el código del SMS a tu email. Revisa tu bandeja (y spam).</p>
                )}
                <div className="flex gap-2">
                  <Input value={smsCode} onChange={(e) => setSmsCode(e.target.value)} maxLength={6} disabled={smsVerified} />
                  <Button type="button" onClick={() => verifyOtp("sms")} disabled={loading || smsVerified || !smsCode}>Verificar</Button>
                </div>
                {!smsVerified && (
                  <div className="flex flex-col gap-1">
                    <button type="button" onClick={resendSms} disabled={loading} className="text-xs text-primary text-left">
                      Reenviar SMS{smsResendCount > 0 ? ` (${smsResendCount})` : ""}
                    </button>
                    {smsResendCount >= 2 && (
                      <button
                        type="button"
                        onClick={() => sendOtp("sms", { fallbackToEmail: true })}
                        disabled={loading}
                        className="text-xs text-primary text-left underline"
                      >
                        ¿No te llega el SMS? Enviar código por email
                      </button>
                    )}
                  </div>
                )}
              </div>

              <Button className="w-full" disabled={!emailVerified || !smsVerified} onClick={() => setStep("password")}>
                Continuar
              </Button>
            </div>
          )}

          {step === "password" && (
            <form onSubmit={finishRegister} className="space-y-4">
              <div className="space-y-2"><Label>Contraseña (mín. 8 caracteres)</Label>
                <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
              <div className="space-y-2"><Label>Confirmar contraseña</Label>
                <Input type="password" required value={password2} onChange={(e) => setPassword2(e.target.value)} /></div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Creando cuenta..." : "Crear cuenta"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
