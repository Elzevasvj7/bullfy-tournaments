"use client";

import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Check,
  Mail,
  MessageSquareText,
  Phone,
  ShieldCheck,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  persistTournamentSession,
  registerTournamentUser,
  requestRegistrationOtp,
  verifyRegistrationOtp,
} from "../services/auth.client";
import type { AuthVerificationChannel } from "../types";
import { createBrowserSupabaseClient } from "@/lib/supabase";

type FormState = {
  fullName: string;
  email: string;
  phone: string;
  country: string;
  password: string;
  referredByCode: string;
  emailCode: string;
  smsCode: string;
};

const initialState: FormState = {
  fullName: "",
  email: "",
  phone: "",
  country: "VE",
  password: "",
  referredByCode: "",
  emailCode: "",
  smsCode: "",
};

export function RegisterForm() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(initialState);
  const [emailVerified, setEmailVerified] = useState(false);
  const [smsVerified, setSmsVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const supabase = createBrowserSupabaseClient();
  const canRegister = useMemo(
    () => emailVerified && smsVerified,
    [emailVerified, smsVerified],
  );

  async function handleOtp(channel: AuthVerificationChannel) {
    setError(null);
    setPendingAction(`request-${channel}`);

    try {
      await requestRegistrationOtp({
        email: form.email,
        phone: form.phone,
        channel,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo enviar.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleVerify(channel: AuthVerificationChannel) {
    setError(null);
    setPendingAction(`verify-${channel}`);

    try {
      await verifyRegistrationOtp({
        email: form.email,
        phone: form.phone,
        channel,
        code: channel === "email" ? form.emailCode : form.smsCode,
      });

      if (channel === "email") {
        setEmailVerified(true);
      } else {
        setSmsVerified(true);
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No se pudo verificar el codigo.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!canRegister) {
      setError("Verifica email y telefono antes de crear la cuenta.");
      return;
    }

    try {
      setPendingAction("register");
      const { data, error } = await supabase.auth.signUp({
        email: form.email,
        phone: form.phone,
        password: form.password,
      });
      if (error) {
        setError(error.message);
        return;
      }
      router.push("/profile");
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No se pudo crear la cuenta.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <>
      <CardHeader className="gap-3">
        <div>
          <CardTitle className="text-2xl font-black uppercase text-white flex items-center gap-5">
            <div className="flex size-11 items-center justify-center rounded-lg border border-bullfy-neon-green/25 bg-bullfy-neon-green/10 text-bullfy-neon-green">
              <ShieldCheck className="size-5" />
            </div>
            Registro
          </CardTitle>
          <CardDescription className="mt-2 text-sm leading-6 text-slate-400">
            Flujo preparado para OTP email/SMS. Codigo mock: 123456.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <Field label="Nombre completo" htmlFor="fullName" icon={User}>
            <Input
              id="fullName"
              value={form.fullName}
              onChange={(event) => updateForm("fullName", event.target.value)}
              placeholder="Karlos Guzman"
              required
              className="h-11 border-white/10 bg-black/20 pl-9 text-white"
            />
          </Field>

          <Field label="Email" htmlFor="email" icon={Mail}>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(event) => {
                updateForm("email", event.target.value);
                setEmailVerified(false);
              }}
              placeholder="trader@bullfy.com"
              required
              className="h-11 border-white/10 bg-black/20 pl-9 text-white"
            />
          </Field>
          <Field label="Telefono" htmlFor="phone" icon={Phone}>
            <Input
              id="phone"
              value={form.phone}
              onChange={(event) => {
                updateForm("phone", event.target.value);
                setSmsVerified(false);
              }}
              placeholder="+584121234567"
              required
              className="h-11 border-white/10 bg-black/20 pl-9 text-white"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Pais" htmlFor="country">
              <Input
                id="country"
                value={form.country}
                onChange={(event) => updateForm("country", event.target.value)}
                placeholder="VE"
                className="h-11 border-white/10 bg-black/20 text-white"
              />
            </Field>
            <Field label="Codigo referido" htmlFor="referredByCode">
              <Input
                id="referredByCode"
                value={form.referredByCode}
                onChange={(event) =>
                  updateForm("referredByCode", event.target.value)
                }
                placeholder="Opcional"
                className="h-11 border-white/10 bg-black/20 text-white"
              />
            </Field>
          </div>

          <Field label="Contrasena" htmlFor="password">
            <Input
              id="password"
              type="password"
              value={form.password}
              onChange={(event) => updateForm("password", event.target.value)}
              placeholder="Minimo 8 caracteres"
              required
              className="h-11 border-white/10 bg-black/20 text-white"
            />
          </Field>

          <OtpRow
            buttonLabel="Email"
            code={form.emailCode}
            disabled={!form.email}
            isPending={
              pendingAction === "request-email" ||
              pendingAction === "verify-email"
            }
            isVerified={emailVerified}
            onCodeChange={(value) => updateForm("emailCode", value)}
            onRequest={() => handleOtp("email")}
            onVerify={() => handleVerify("email")}
          />
          <OtpRow
            buttonLabel="SMS"
            code={form.smsCode}
            disabled={!form.phone}
            isPending={
              pendingAction === "request-sms" || pendingAction === "verify-sms"
            }
            isVerified={smsVerified}
            onCodeChange={(value) => updateForm("smsCode", value)}
            onRequest={() => handleOtp("sms")}
            onVerify={() => handleVerify("sms")}
          />

          {error ? (
            <div className="flex gap-2 rounded-lg border border-bullfy-neon-red/30 bg-bullfy-neon-red/10 p-3 text-sm text-red-100">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-bullfy-neon-red" />
              {error}
            </div>
          ) : null}

          <Button
            type="submit"
            size="lg"
            disabled={pendingAction === "register"}
            className="h-11 justify-center"
          >
            {pendingAction === "register" ? "Creando..." : "Crear cuenta"}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-slate-400">
          Ya tienes cuenta?{" "}
          <Link href="/login" className="font-bold text-bullfy-neon-blue">
            Entrar
          </Link>
        </p>
      </CardContent>
    </>
  );

  function updateForm<Key extends keyof FormState>(
    key: Key,
    value: FormState[Key],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }
}

function Field({
  children,
  htmlFor,
  icon: Icon,
  label,
}: {
  children: React.ReactNode;
  htmlFor?: string;
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      <div className="relative">
        {Icon ? (
          <Icon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
        ) : null}
        {children}
      </div>
    </div>
  );
}

function OtpRow({
  buttonLabel,
  code,
  disabled,
  isPending,
  isVerified,
  onCodeChange,
  onRequest,
  onVerify,
}: {
  buttonLabel: string;
  code: string;
  disabled: boolean;
  isPending: boolean;
  isVerified: boolean;
  onCodeChange: (value: string) => void;
  onRequest: () => void;
  onVerify: () => void;
}) {
  return (
    <div className="grid gap-2 rounded-lg border border-white/10 bg-black/20 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-bold text-white">
          {isVerified ? (
            <Check className="size-4 text-bullfy-neon-green" />
          ) : (
            <MessageSquareText className="size-4 text-bullfy-neon-blue" />
          )}
          Verificar {buttonLabel}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled || isPending}
          onClick={onRequest}
          className="h-8 px-2 text-[11px]"
        >
          Enviar
        </Button>
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <Input
          inputMode="numeric"
          maxLength={6}
          value={code}
          onChange={(event) => onCodeChange(event.target.value)}
          placeholder="123456"
          className="h-10 border-white/10 bg-black/20 text-white"
        />
        <Button
          type="button"
          variant={isVerified ? "neonGreen" : "outline"}
          disabled={disabled || isPending || isVerified}
          onClick={onVerify}
          className="h-10 justify-center"
        >
          {isVerified ? "Verificado" : "Validar"}
        </Button>
      </div>
    </div>
  );
}
