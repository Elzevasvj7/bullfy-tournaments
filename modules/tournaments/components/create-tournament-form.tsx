"use client";

import type { Dispatch, FormEvent, ReactNode, SetStateAction } from "react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CalendarClock, Trophy, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type {
  CreateTournamentInput,
  TournamentLeague,
} from "../types";
import { createTournament } from "../services/tournament.client";

const timezones = [
  "America/Caracas",
  "America/Bogota",
  "America/Mexico_City",
  "America/New_York",
  "America/Los_Angeles",
  "Europe/Madrid",
  "UTC",
];

type FormState = {
  name: string;
  description: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  maxParticipants: string;
  startingBalanceUsd: string;
  league: TournamentLeague;
  entryFeeBmoney: string;
  entryFeeUsd: string;
  allowsFundedMt5: boolean;
  minFundedEquityUsd: string;
  houseFeePct: string;
};

const initialState: FormState = {
  name: "",
  description: "",
  startsAt: "",
  endsAt: "",
  timezone: "America/Caracas",
  maxParticipants: "20",
  startingBalanceUsd: "10000",
  league: "bmoney",
  entryFeeBmoney: "100",
  entryFeeUsd: "0",
  allowsFundedMt5: false,
  minFundedEquityUsd: "1000",
  houseFeePct: "25",
};

export function CreateTournamentForm() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(initialState);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const projectedPool = useMemo(() => {
    const participants = toNumber(form.maxParticipants);
    const fee =
      form.league === "bmoney"
        ? toNumber(form.entryFeeBmoney)
        : toNumber(form.entryFeeUsd);
    const houseFee = toNumber(form.houseFeePct);

    return Math.max(0, Math.round(participants * fee * (1 - houseFee / 100)));
  }, [
    form.entryFeeBmoney,
    form.entryFeeUsd,
    form.houseFeePct,
    form.league,
    form.maxParticipants,
  ]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const input = parseForm(form);
    const validationError = validateInput(input);

    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setIsSubmitting(true);
      const tournament = await createTournament(input);
      router.push(`/tournaments/${tournament.slug}`);
      router.refresh();
    } catch {
      setError("No se pudo crear el torneo. Revisa la conexion o el contrato del servicio.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-330 flex-1 flex-col px-4 py-8 sm:px-6 lg:px-8">
      <form onSubmit={handleSubmit} className="grid gap-5 lg:grid-cols-[1fr_22rem]">
        <Card className="gap-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-black uppercase text-white">
              <Trophy className="size-5 text-bullfy-neon-blue" />
              Crear torneo
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Elige liga BMoney (ficticio) o Élite (dinero real). Máx 2 torneos por día.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className="grid gap-2">
              <Label htmlFor="name">Nombre</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(event) => updateForm(setForm, "name", event.target.value)}
                placeholder="Scalp Night"
                required
                className="h-11 border-white/10 bg-black/20 text-white"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Descripcion</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(event) =>
                  updateForm(setForm, "description", event.target.value)
                }
                placeholder="Describe la dinamica, mercado y condiciones del torneo."
                required
                className="min-h-28 border-white/10 bg-black/20 text-white"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Inicio" htmlFor="startsAt">
                <Input
                  id="startsAt"
                  type="datetime-local"
                  value={form.startsAt}
                  onChange={(event) =>
                    updateForm(setForm, "startsAt", event.target.value)
                  }
                  required
                  className="h-11 border-white/10 bg-black/20 text-white"
                />
              </Field>
              <Field label="Fin" htmlFor="endsAt">
                <Input
                  id="endsAt"
                  type="datetime-local"
                  value={form.endsAt}
                  onChange={(event) =>
                    updateForm(setForm, "endsAt", event.target.value)
                  }
                  required
                  className="h-11 border-white/10 bg-black/20 text-white"
                />
              </Field>
            </div>

            <Field label="Zona horaria">
              <Select
                value={form.timezone}
                onValueChange={(value) => {
                  if (value) {
                    updateForm(setForm, "timezone", value);
                  }
                }}
              >
                <SelectTrigger className="h-11 w-full border-white/10 bg-black/20 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-white/10 bg-bullfy-panel text-white">
                  {timezones.map((timezone) => (
                    <SelectItem key={timezone} value={timezone}>
                      {timezone}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Participantes maximos" htmlFor="maxParticipants">
                <Input
                  id="maxParticipants"
                  type="number"
                  min="2"
                  value={form.maxParticipants}
                  onChange={(event) =>
                    updateForm(setForm, "maxParticipants", event.target.value)
                  }
                  className="h-11 border-white/10 bg-black/20 text-white"
                />
              </Field>
              <Field label="Balance inicial USD" htmlFor="startingBalanceUsd">
                <Input
                  id="startingBalanceUsd"
                  type="number"
                  min="0"
                  value={form.startingBalanceUsd}
                  onChange={(event) =>
                    updateForm(setForm, "startingBalanceUsd", event.target.value)
                  }
                  className="h-11 border-white/10 bg-black/20 text-white"
                />
              </Field>
            </div>
          </CardContent>
        </Card>

        <aside className="grid content-start gap-5">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-black uppercase text-white">
                <Zap className="size-4 text-bullfy-neon-green" />
                Liga
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 pt-3">
              <LeagueOption
                league={form.league}
                active={form.league === "bmoney"}
                description="Entrada con Bullfy Points y cuenta demo."
                label="BMoney"
                onClick={() => updateForm(setForm, "league", "bmoney")}
              />
              <LeagueOption
                league={form.league}
                active={form.league === "elite"}
                description="Entrada en USD y opcion de MT5 fondeado."
                label="Elite"
                onClick={() => updateForm(setForm, "league", "elite")}
              />
            </CardContent>
          </Card>

          <Card >
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-black uppercase text-white">
                <CalendarClock className="size-4 text-bullfy-neon-blue" />
                Economia
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              {form.league === "bmoney" ? (
                <Field label="Fee Bullfy Points" htmlFor="entryFeeBmoney">
                  <Input
                    id="entryFeeBmoney"
                    type="number"
                    min="0"
                    value={form.entryFeeBmoney}
                    onChange={(event) =>
                      updateForm(setForm, "entryFeeBmoney", event.target.value)
                    }
                    className="h-11 border-white/10 bg-black/20 text-white"
                  />
                </Field>
              ) : (
                <>
                  <Field label="Fee USD" htmlFor="entryFeeUsd">
                    <Input
                      id="entryFeeUsd"
                      type="number"
                      min="0"
                      value={form.entryFeeUsd}
                      onChange={(event) =>
                        updateForm(setForm, "entryFeeUsd", event.target.value)
                      }
                      className="h-11 border-white/10 bg-black/20 text-white"
                    />
                  </Field>
                  <div className="flex items-center justify-between gap-4 rounded-lg border border-white/10 bg-black/20 p-3">
                    <Label htmlFor="allowsFundedMt5" className="grid gap-1">
                      <span>Permitir MT5 fondeado</span>
                      <span className="text-xs font-normal text-slate-400">
                        Valida equity minimo para cuentas reales.
                      </span>
                    </Label>
                    <Switch
                      id="allowsFundedMt5"
                      checked={form.allowsFundedMt5}
                      onCheckedChange={(checked) =>
                        updateForm(setForm, "allowsFundedMt5", checked)
                      }
                      className="data-checked:bg-bullfy-neon-green"
                    />
                  </div>
                  {form.allowsFundedMt5 ? (
                    <Field label="Equity minimo USD" htmlFor="minFundedEquityUsd">
                      <Input
                        id="minFundedEquityUsd"
                        type="number"
                        min="0"
                        value={form.minFundedEquityUsd}
                        onChange={(event) =>
                          updateForm(
                            setForm,
                            "minFundedEquityUsd",
                            event.target.value,
                          )
                        }
                        className="h-11 border-white/10 bg-black/20 text-white"
                      />
                    </Field>
                  ) : null}
                </>
              )}

              <Field label="House fee %" htmlFor="houseFeePct">
                <Input
                  id="houseFeePct"
                  type="number"
                  min="0"
                  max="100"
                  value={form.houseFeePct}
                  onChange={(event) =>
                    updateForm(setForm, "houseFeePct", event.target.value)
                  }
                  className="h-11 border-white/10 bg-black/20 text-white"
                />
              </Field>

              <div className="rounded-lg border border-bullfy-neon-blue/20 bg-bullfy-neon-blue/5 p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-bullfy-neon-blue">
                  Prize pool estimado
                </p>
                <p className="mt-2 text-2xl font-black text-white">
                  {projectedPool.toLocaleString("en-US")}{" "}
                  <span className="text-sm text-slate-400">
                    {form.league === "bmoney" ? "BULLFY" : "USD"}
                  </span>
                </p>
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
                {isSubmitting ? "Creando..." : "Crear torneo"}
              </Button>
            </CardContent>
          </Card>
        </aside>
      </form>
    </main>
  );
}

function Field({
  children,
  htmlFor,
  label,
}: {
  children: ReactNode;
  htmlFor?: string;
  label: string;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={htmlFor}>
        {label}
      </Label>
      {children}
    </div>
  );
}

function LeagueOption({
  league,
  active,
  description,
  label,
  onClick,
}: {
  league: TournamentLeague;
  active: boolean;
  description: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg border p-3 text-left transition cursor-pointer",
        active && league === "bmoney" && "border-bullfy-neon-green/60 bg-bullfy-neon-green/10 shadow-neon-green",
        active && league === "elite" && "border-bullfy-neon-blue/60 bg-bullfy-neon-blue/10 shadow-neon-blue",
      )}
    >
      <span className="block text-sm font-black uppercase text-white">{label}</span>
      <span className="mt-1 block text-xs leading-5 text-slate-400">{description}</span>
    </button>
  );
}

function updateForm<Key extends keyof FormState>(
  setForm: Dispatch<SetStateAction<FormState>>,
  key: Key,
  value: FormState[Key],
) {
  setForm((current) => ({ ...current, [key]: value }));
}

function parseForm(form: FormState): CreateTournamentInput {
  return {
    name: form.name.trim(),
    description: form.description.trim(),
    modality: "standard",
    startsAt: localDateTimeToUtcIso(form.startsAt, form.timezone),
    endsAt: localDateTimeToUtcIso(form.endsAt, form.timezone),
    timezone: form.timezone,
    maxParticipants: toNumber(form.maxParticipants),
    startingBalanceUsd: toNumber(form.startingBalanceUsd),
    league: form.league,
    entryFeeBmoney: toNumber(form.entryFeeBmoney),
    entryFeeUsd: toNumber(form.entryFeeUsd),
    allowsFundedMt5: form.allowsFundedMt5,
    minFundedEquityUsd: toNumber(form.minFundedEquityUsd),
    houseFeePct: toNumber(form.houseFeePct),
  };
}

function validateInput(input: CreateTournamentInput): string | null {
  if (!input.name || !input.description) {
    return "Completa el nombre y la descripcion del torneo.";
  }

  if (!input.startsAt || !input.endsAt) {
    return "Selecciona fecha de inicio y fecha de cierre.";
  }

  if (new Date(input.endsAt) <= new Date(input.startsAt)) {
    return "La fecha de cierre debe ser posterior al inicio.";
  }

  if (input.maxParticipants < 2) {
    return "El torneo necesita al menos 2 participantes.";
  }

  if (input.houseFeePct < 0 || input.houseFeePct > 100) {
    return "El house fee debe estar entre 0 y 100.";
  }

  return null;
}

function toNumber(value: string): number {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
}

function localDateTimeToUtcIso(value: string, timeZone: string): string {
  if (!value) {
    return "";
  }

  const [date, time] = value.split("T");
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute);
  const zonedOffset = getTimezoneOffsetMs(new Date(utcGuess), timeZone);

  return new Date(utcGuess - zonedOffset).toISOString();
}

function getTimezoneOffsetMs(date: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone,
    year: "numeric",
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value]),
  );
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );

  return asUtc - date.getTime();
}
