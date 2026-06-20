import { BadgeCheck, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AuthVerificationChannel } from "../../../types";

export function OtpPanel({
  channel,
  code,
  disabled,
  isPending,
  isVerified,
  label,
  target,
  onCodeChange,
  onRequest,
  onVerify,
}: {
  channel: AuthVerificationChannel;
  code: string;
  disabled: boolean;
  isPending: boolean;
  isVerified: boolean;
  label: string;
  target: string;
  onCodeChange: (value: string) => void;
  onRequest: () => void;
  onVerify: () => void;
}) {
  return (
    <div className="border border-white/10 bg-black/25 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
            canal {channel}
          </p>
          <h2 className="mt-2 flex items-center gap-2 text-xl font-black uppercase">
            {isVerified ? (
              <BadgeCheck className="size-5 text-[#B6FF3D]" />
            ) : (
              <Mail className="size-5 text-[#00E5FF]" />
            )}
            {label}
          </h2>
          <p className="mt-1 text-xs text-slate-500">{target}</p>
        </div>
        <Button
          type="button"
          variant="neonBlue"
          disabled={disabled || isPending}
          onClick={onRequest}
          className="h-9"
        >
          Enviar
        </Button>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
        <Input
          inputMode="numeric"
          maxLength={6}
          value={code}
          onChange={(event) => onCodeChange(event.target.value)}
          placeholder="123456"
          className="h-11 border-white/10 bg-black/25 text-white placeholder:text-slate-600"
        />
        <Button
          type="button"
          variant={isVerified ? "neonGreen" : "outline"}
          disabled={disabled || isPending || isVerified}
          onClick={onVerify}
          className="h-11 justify-center border-white/15 bg-black/20 text-white"
        >
          {isVerified ? "Verificado" : "Validar"}
        </Button>
      </div>
    </div>
  );
}
