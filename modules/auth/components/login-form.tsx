"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, LogIn, Shield, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginTournamentUserAction } from "../services/auth.action";

type FormState = {
  email: string;
  password: string;
};

type LoginFormProps = {
  redirectTo?: string;
};

const initialState: FormState = {
  email: "",
  password: "",
};

export function LoginForm({ redirectTo = "/" }: LoginFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(initialState);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    try {
      setIsSubmitting(true);
      const result = await loginTournamentUserAction(form);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      router.push(redirectTo);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "No se pudo iniciar sesion.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <CardHeader className="gap-3">
        <div className="flex size-11 items-center justify-center rounded-lg border border-bullfy-neon-blue/25 bg-bullfy-neon-blue/10 text-bullfy-neon-blue">
          <LogIn className="size-5" />
        </div>
        <div>
          <CardTitle className="text-2xl font-black uppercase text-white">
            Entrar
          </CardTitle>
          <CardDescription className="mt-2 text-sm leading-6 text-slate-400">
            Acceso demo con usuario MT5 o email. Luego podras entrar al torneo y operar.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="email">Usuario o email</Label>
            <div className="relative">
              <UserRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
              <Input
                id="email"
                type="text"
                value={form.email}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
                placeholder="valentina"
                required
                className="h-11 border-white/10 bg-black/20 pl-9 text-white"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="password">Contrasena</Label>
            <div className="relative">
              <Shield className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
              <Input
                id="password"
                type="password"
                value={form.password}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    password: event.target.value,
                  }))
                }
                placeholder="Minimo 8 caracteres"
                required
                className="h-11 border-white/10 bg-black/20 pl-9 text-white"
              />
            </div>
          </div>

          {error ? (
            <div className="flex gap-2 rounded-lg border border-bullfy-neon-red/30 bg-bullfy-neon-red/10 p-3 text-sm text-red-100">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-bullfy-neon-red" />
              {error}
            </div>
          ) : null}

          <Button
            type="submit"
            size="lg"
            disabled={isSubmitting}
            className="h-11 justify-center"
          >
            {isSubmitting ? "Entrando..." : "Entrar al torneo"}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-slate-400">
          No tienes cuenta?{" "}
          <Link href="/register" className="font-bold text-bullfy-neon-blue">
            Registrate
          </Link>
        </p>
      </CardContent>
    </>
  );
}
