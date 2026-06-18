import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Loader2, Mail, Smartphone, AlertCircle } from "lucide-react";
import { dimHex } from "@/hooks/usePortalBranding";

interface OTPVerificationStepProps {
  type: "email" | "sms";
  destination: string;
  currentStep: number;
  totalSteps: number;
  loading: boolean;
  onVerify: (code: string) => void;
  onResend: () => void;
  onBack: () => void;
  resendLoading: boolean;
  primaryColor: string;
  fallbackMessage?: string; // Mensaje cuando SMS falló y se envió por email
  onForceEmailFallback?: () => void; // Disponible solo para SMS - fuerza envío por email
}

const OTPVerificationStep = ({
  type,
  destination,
  currentStep,
  totalSteps,
  loading,
  onVerify,
  onResend,
  onBack,
  resendLoading,
  primaryColor,
  fallbackMessage,
  onForceEmailFallback,
}: OTPVerificationStepProps) => {
  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [resendCount, setResendCount] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (cooldown <= 0) {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      return;
    }
    timerRef.current = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [cooldown]);

  const handleResend = () => {
    setCode("");
    onResend();
    setCooldown(30);
    setResendCount((n) => n + 1);
  };

  const showEmailFallbackBtn = type === "sms" && resendCount >= 2 && !!onForceEmailFallback && !fallbackMessage;

  const icon = type === "email"
    ? <Mail className="w-8 h-8 text-primary" />
    : <Smartphone className="w-8 h-8 text-primary" />;

  const label = type === "email" ? "correo electrónico" : "teléfono";
  const maskedDest = type === "email"
    ? destination.replace(/(.{2})(.*)(@.*)/, "$1***$3")
    : destination.replace(/(.{5})(.*)(.{2})$/, "$1***$3");

  return (
    <div className="space-y-5">
      <div className="text-center space-y-2">
        <div className="flex justify-center">{icon}</div>
        <p className="text-xs font-medium text-muted-foreground">
          Paso {currentStep} de {totalSteps}
        </p>
        <h3 className="font-semibold">Verifica tu {label}</h3>
        
        {/* Mensaje de fallback cuando SMS falló */}
        {fallbackMessage ? (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="text-left">
                <p className="text-sm text-amber-800 font-medium">{fallbackMessage}</p>
                <p className="text-xs text-amber-700 mt-1">
                  Revisa tu correo <strong>{destination.replace(/(.{2})(.*)(@.*)/, "$1***$3")}</strong>
                </p>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Enviamos un código de 6 dígitos a <strong>{maskedDest}</strong>
          </p>
        )}
      </div>

      <div className="flex justify-center">
        <InputOTP maxLength={6} value={code} onChange={setCode}>
          <InputOTPGroup>
            <InputOTPSlot index={0} />
            <InputOTPSlot index={1} />
            <InputOTPSlot index={2} />
            <InputOTPSlot index={3} />
            <InputOTPSlot index={4} />
            <InputOTPSlot index={5} />
          </InputOTPGroup>
        </InputOTP>
      </div>

      <Button
        className="w-full text-white"
        style={{ backgroundColor: dimHex(primaryColor, 0.7) }}
        onClick={() => onVerify(code)}
        disabled={code.length !== 6 || loading}
      >
        {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verificando...</> : "Verificar código"}
      </Button>

      <div className="flex items-center justify-between">
        <button type="button" onClick={onBack} className="text-xs text-primary hover:underline">
          ← Volver
        </button>
        <button
          type="button"
          onClick={handleResend}
          disabled={resendLoading || cooldown > 0}
          className="text-xs text-primary hover:underline disabled:opacity-50 disabled:no-underline"
        >
          {resendLoading ? "Enviando..." : cooldown > 0 ? `Reenviar en ${cooldown}s` : "Reenviar código"}
        </button>
      </div>

      {showEmailFallbackBtn && (
        <div className="border-t pt-3">
          <p className="text-xs text-muted-foreground text-center mb-2">
            ¿No recibes el SMS? Te lo enviamos a tu correo:
          </p>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => { setCode(""); onForceEmailFallback?.(); }}
            disabled={resendLoading}
          >
            <Mail className="w-4 h-4 mr-2" /> Enviar código por email
          </Button>
        </div>
      )}
    </div>
  );
};

export default OTPVerificationStep;
