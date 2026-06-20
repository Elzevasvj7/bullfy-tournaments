"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Crown,
  Eye,
  Lock,
  Shield,
  Sparkles,
  Swords,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { CurrentSessionUser } from "@/modules/auth/types";
import { createClan } from "../services/clan.client";
import { ClanShell } from "./clan-shell";

export function ClanCreateView({
  sessionUser = null,
}: {
  sessionUser?: CurrentSessionUser | null;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [busy, setBusy] = useState(false);
  const previewName = name.trim() || "NOMBRE DEL CLAN";
  const previewTag = tag.trim() || "TAG";
  const previewDescription =
    description.trim() ||
    "Una mesa competitiva con reglas claras, liderazgo activo y hambre de guerras limpias.";

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const clan = await createClan({ description, isPublic, name, tag });
    setBusy(false);
    router.push(`/clans/${clan.slug}`);
  }

  return (
    <ClanShell sessionUser={sessionUser}>
      <header className="relative overflow-hidden rounded-[2.5rem] border border-white/5 bg-[#0a1129]/35 p-6 shadow-2xl backdrop-blur-sm md:p-10">
        <div className="t-scanlines z-10" />
        <div
          className="absolute right-0 top-0 h-56 w-56 bg-[#00E5FF]/10 blur-3xl"
          aria-hidden
        />
        <div
          className="absolute -bottom-24 left-16 h-56 w-56 bg-[#B6FF3D]/10 blur-3xl"
          aria-hidden
        />
        <div className="relative z-20 grid gap-8 lg:grid-cols-[1fr_24rem] lg:items-end">
          <div>
            <div className="mb-5 inline-flex items-center gap-3 rounded-full border border-[#B6FF3D]/30 bg-[#B6FF3D]/10 px-5 py-2 text-[10px] font-black uppercase tracking-[0.28em] text-[#B6FF3D]">
              <Sparkles className="size-4" />
              Nuevo cuartel
            </div>
            <h1 className="t-display max-w-3xl text-4xl font-black leading-[0.95] md:text-6xl">
              CREA TU CLAN <span className="t-shimmer">DE ELITE.</span>
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-gray-400">
              Levanta una identidad publica, define un tag reconocible y deja
              listo el primer espacio para reclutar traders antes de entrar a
              guerras.
            </p>
            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              <LaunchStat label="Tag maximo" value="6" />
              <LaunchStat label="Roster inicial" value="1" />
              <LaunchStat label="Estado" value={isPublic ? "Publico" : "Privado"} />
            </div>
          </div>

          <div className="relative rounded-none border border-[#00E5FF]/20 bg-black/30 p-5 shadow-[0_0_34px_rgba(0,229,255,0.12)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-gray-500">
                  Vista previa
                </p>
                <h2 className="t-display mt-2 text-2xl font-black text-white">
                  [{previewTag}] {previewName}
                </h2>
              </div>
              <div className="flex size-14 shrink-0 items-center justify-center rounded-none border border-[#00E5FF]/30 bg-[#00E5FF]/10 text-lg font-black text-[#00E5FF]">
                {previewTag.slice(0, 2)}
              </div>
            </div>
            <p className="mt-4 line-clamp-3 text-sm leading-6 text-gray-400">
              {previewDescription}
            </p>
            <div className="mt-5 grid grid-cols-3 gap-2">
              <PreviewMetric label="Rating" value="Nuevo" />
              <PreviewMetric label="Guerras" value="0/0" />
              <PreviewMetric label="Modo" value={isPublic ? "Open" : "Key"} />
            </div>
          </div>
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-[1fr_23rem]">
        <Card className="self-start border-[#00E5FF]/20 bg-[#0a1129]/65 p-5 shadow-[0_0_32px_rgba(0,229,255,0.08)] md:p-6">
          <div className="flex flex-col gap-4 border-b border-white/10 pb-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#00E5FF]">
                Registro de identidad
              </p>
              <h2 className="t-display mt-2 flex items-center gap-2 text-2xl font-black">
                <Shield className="size-6 text-[#00E5FF]" />
                Fundar clan
              </h2>
            </div>
            <div className="rounded-none border border-white/10 bg-black/25 px-4 py-3 text-right">
              <p className="t-mono text-lg font-black text-[#B6FF3D]">
                {previewTag}
              </p>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-500">
                Firma publica
              </p>
            </div>
          </div>

          <form className="mt-6" onSubmit={submit}>
            <div className="grid gap-5">
              <div className="grid gap-5 md:grid-cols-[1fr_12rem]">
                <div>
                  <Label htmlFor="clan-name">Nombre</Label>
                  <Input
                    id="clan-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    maxLength={32}
                    required
                    placeholder="Ej. Bullfy Syndicate"
                    className="mt-2 h-12 border-white/10 bg-black/25 text-white placeholder:text-gray-600"
                  />
                </div>
                <div>
                  <Label htmlFor="clan-tag">Tag</Label>
                  <Input
                    id="clan-tag"
                    value={tag}
                    onChange={(event) =>
                      setTag(
                        event.target.value
                          .toUpperCase()
                          .replace(/[^A-Z0-9]/g, ""),
                      )
                    }
                    maxLength={6}
                    required
                    placeholder="BULL"
                    className="t-mono mt-2 h-12 border-white/10 bg-black/25 text-white placeholder:text-gray-600"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="clan-description">Descripcion</Label>
                <Textarea
                  id="clan-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  required
                  placeholder="Describe el estilo competitivo, reglas y personalidad del clan."
                  className="mt-2 min-h-32 border-white/10 bg-black/25 text-white placeholder:text-gray-600"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
                <div className="flex items-center justify-between gap-4 rounded-none border border-white/10 bg-black/25 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-none border border-[#00E5FF]/25 bg-[#00E5FF]/10 text-[#00E5FF]">
                      {isPublic ? (
                        <Eye className="size-5" />
                      ) : (
                        <Lock className="size-5" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">
                        Clan {isPublic ? "publico" : "privado"}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-gray-500">
                        {isPublic
                          ? "Aparece en busqueda y ranking publico."
                          : "Solo entra quien tenga invitacion."}
                      </p>
                    </div>
                  </div>
                  <Switch checked={isPublic} onCheckedChange={setIsPublic} />
                </div>
                <Button
                  type="submit"
                  disabled={busy || !name || !tag}
                  variant="neonGreenSolid"
                  className="h-12 justify-center px-6"
                >
                  {busy ? "Creando..." : "Crear clan"}
                </Button>
              </div>
            </div>
          </form>
        </Card>

        <aside className="space-y-5">
          <Card className="border-[#B6FF3D]/20 bg-[#0a1129]/65">
            <h2 className="t-display flex items-center gap-2 text-lg font-black">
              <Crown className="size-5 text-[#B6FF3D]" />
              Checklist de fundador
            </h2>
            <div className="mt-5 space-y-3">
              <FounderCheck text="Nombre corto y facil de recordar" />
              <FounderCheck text="Tag limpio para rankings y retos" />
              <FounderCheck text="Descripcion con tono competitivo" />
              <FounderCheck text={isPublic ? "Reclutamiento publico activo" : "Acceso controlado por invitacion"} />
            </div>
          </Card>
        </aside>
      </section>
    </ClanShell>
  );
}

function LaunchStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-none border border-white/10 bg-black/25 p-4">
      <p className="t-display text-2xl font-black text-white">{value}</p>
      <p className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-gray-500">
        {label}
      </p>
    </div>
  );
}

function PreviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-none border border-white/10 bg-[#060B1F]/60 p-3 text-center">
      <p className="t-display text-base font-black text-white">{value}</p>
      <p className="mt-1 text-[9px] font-black uppercase tracking-[0.14em] text-gray-500">
        {label}
      </p>
    </div>
  );
}

function FounderCheck({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-none border border-white/5 bg-black/20 p-3 text-sm text-gray-300">
      <CheckCircle2 className="size-4 shrink-0 text-[#B6FF3D]" />
      <span>{text}</span>
    </div>
  );
}

function WarPrep({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-none border border-white/5 bg-black/20 p-3">
      <div className="flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-none border border-[#00E5FF]/25 bg-[#00E5FF]/10 text-[#00E5FF]">
          <Icon className="size-4" />
        </div>
        <p className="text-sm font-bold text-white">{label}</p>
      </div>
      <p className="text-right text-xs font-black uppercase tracking-[0.12em] text-gray-500">
        {value}
      </p>
    </div>
  );
}
