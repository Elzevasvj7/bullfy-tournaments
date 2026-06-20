"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Copy,
  Crown,
  LogOut,
  Settings,
  Shield,
  ShieldCheck,
  Swords,
  Trophy,
  UserMinus,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { CurrentSessionUser } from "@/modules/auth/types";
import type { Clan, ClanDashboard, ClanMember, ClanWar } from "../types";
import { ClanShell } from "./clan-shell";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

type ClanDetailViewProps = {
  clan: Clan;
  dashboard: ClanDashboard;
  sessionUser?: CurrentSessionUser | null;
};

type DetailTab = "members" | "wars" | "settings";

export function ClanDetailView({
  clan,
  dashboard,
  sessionUser = null,
}: ClanDetailViewProps) {
  const [tab, setTab] = useState<DetailTab>("members");
  const currentMember = clan.members.find(
    (member) => member.id === dashboard.currentUserId,
  );
  const isMine = Boolean(currentMember);
  const canManage = currentMember?.role === "owner" || currentMember?.role === "officer";
  const clanWars = dashboard.wars.filter(
    (war) => war.challengerClanId === clan.id || war.defenderClanId === clan.id,
  );
  const rankedMembers = useMemo(
    () => [...clan.members].sort((a, b) => b.score - a.score),
    [clan.members],
  );

  return (
    <ClanShell sessionUser={sessionUser}>
      <section className="relative overflow-hidden rounded-[2.5rem] border border-white/5 bg-[#0a1129]/35 p-8 shadow-2xl backdrop-blur-sm md:p-10">
        <div className="t-scanlines z-10" />
        <div className="relative z-20 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Link
              href="/clans"
              className="text-[11px] font-black uppercase tracking-[0.2em] text-[#00E5FF] transition hover:text-white"
            >
              Volver a clanes
            </Link>
            <h1 className="t-display mt-5 flex flex-wrap items-center gap-3 text-4xl font-black leading-[0.95] md:text-6xl">
              [{clan.tag}] {clan.name}
              {clan.isVerified ? <ShieldCheck className="size-7 text-[#00E5FF]" /> : null}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-gray-400">
              {clan.description}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <ClanStat label="Rating" value={String(clan.rating)} />
            <ClanStat label="Miembros" value={String(clan.membersCount)} />
            <ClanStat label="Guerras" value={`${clan.warsWon}/${clan.totalWars}`} />
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">
            <TabButton active={tab === "members"} onClick={() => setTab("members")}>
              <Users className="size-4" />
              Miembros
            </TabButton>
            <TabButton active={tab === "wars"} onClick={() => setTab("wars")}>
              <Swords className="size-4" />
              Guerras
            </TabButton>
            <TabButton active={tab === "settings"} onClick={() => setTab("settings")}>
              <Settings className="size-4" />
              Configuracion
            </TabButton>
          </div>

          {tab === "members" ? (
            <MembersPanel members={rankedMembers} canManage={canManage} currentUserId={dashboard.currentUserId} />
          ) : null}
          {tab === "wars" ? (
            <WarsPanel clans={dashboard.clans} currentClan={clan} wars={clanWars} canManage={canManage} />
          ) : null}
          {tab === "settings" ? (
            <SettingsPanel clan={clan} canManage={canManage} isMine={isMine} />
          ) : null}
        </div>

        <aside className="space-y-5">
          <Card>
            <CardHeader>
              <h2 className="t-display flex items-center gap-2 text-lg font-black">
                <Shield className="size-5 text-[#00E5FF]" />
                Acciones
              </h2>
            </CardHeader>
            <CardContent>
              <div className="mt-4 space-y-3">
                {isMine ? (
                  <>
                    <Button variant="neonBlue" className="w-full justify-center">
                      <Copy className="size-4" />
                      Codigo {clan.inviteCode}
                    </Button>
                    {currentMember?.role !== "owner" ? (
                      <Button variant="neonRed" className="w-full justify-center">
                        <LogOut className="size-4" />
                        Salirme del clan
                      </Button>
                    ) : null}
                  </>
                ) : (
                  <Button variant="neonGreenSolid" className="w-full justify-center">
                    Unirme con codigo
                  </Button>
                )}
                {canManage ? (
                  <Button variant="neonGreen" className="w-full justify-center">
                    <Swords className="size-4" />
                    Retar clan
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </aside>
      </section>
    </ClanShell>
  );
}

function ClanStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-none border border-white/5 bg-black/20 p-4 text-center">
      <p className="t-display text-2xl font-black text-white">{value}</p>
      <p className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-gray-500">
        {label}
      </p>
    </div>
  );
}

function TabButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-11 items-center gap-2 rounded-none border px-4 text-xs font-black uppercase tracking-[0.14em] transition",
        active
          ? "border-[#00E5FF]/50 bg-[#00E5FF]/15 text-white shadow-[0_0_20px_rgba(0,229,255,0.16)]"
          : "border-white/10 bg-black/20 text-gray-400 hover:text-white",
      )}
    >
      {children}
    </button>
  );
}

function MembersPanel({
  canManage,
  currentUserId,
  members,
}: {
  canManage: boolean;
  currentUserId: string;
  members: ClanMember[];
}) {
  return (
    <Card>
      <CardHeader>
        <div className="border-b border-white/10 pb-4">
          <h2 className="t-display flex items-center gap-2 text-sm font-black uppercase tracking-[0.18em]">
            <Trophy className="size-4 text-[#B6FF3D]" />
            Ranking de miembros
          </h2>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-left text-xs">
            <thead className="bg-[#060B1F]/70 text-[10px] uppercase tracking-[0.16em] text-gray-500">
              <tr>
                <th className="px-5 py-4">Rank</th>
                <th className="px-5 py-4">Miembro</th>
                <th className="px-5 py-4">Rol</th>
                <th className="px-5 py-4 text-right">Score</th>
                <th className="px-5 py-4 text-right">PnL</th>
                <th className="px-5 py-4 text-right">Trades</th>
                <th className="px-5 py-4 text-right">WR</th>
                {canManage ? <th className="px-5 py-4 text-right">Accion</th> : null}
              </tr>
            </thead>
            <tbody>
              {members.map((member, index) => (
                <tr key={member.id} className="border-t border-white/5 hover:bg-white/[0.035]">
                  <td className="px-5 py-4 font-black text-[#00E5FF]">#{index + 1}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 items-center justify-center rounded-full border border-[#00E5FF]/25 bg-[#00E5FF]/15 text-xs font-black text-[#00E5FF]">
                        {member.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-white">
                          {member.name} {member.verified ? <ShieldCheck className="inline size-3 text-[#00E5FF]" /> : null}
                        </p>
                        <p className="text-[10px] text-gray-500">@{member.handle}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <RoleBadge role={member.role} />
                  </td>
                  <td className="t-mono px-5 py-4 text-right font-black text-[#B6FF3D]">
                    {member.score.toFixed(2)}%
                  </td>
                  <td className="t-mono px-5 py-4 text-right font-black text-white">
                    ${member.pnl.toFixed(2)}
                  </td>
                  <td className="t-mono px-5 py-4 text-right">{member.trades}</td>
                  <td className="t-mono px-5 py-4 text-right">{member.winRate}%</td>
                  {canManage ? (
                    <td className="px-5 py-4 text-right">
                      {member.id !== currentUserId && member.role !== "owner" ? (
                        <button className="text-[#FF2EC4]">
                          <UserMinus className="inline size-4" /> Expulsar
                        </button>
                      ) : (
                        <span className="text-gray-600">-</span>
                      )}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function RoleBadge({ role }: { role: ClanMember["role"] }) {
  const icon = role === "owner" ? Crown : role === "officer" ? Shield : Users;
  const Icon = icon;
  return (
    <span className="inline-flex items-center gap-1 rounded-none border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-black uppercase text-gray-300">
      <Icon className="size-3 text-[#B6FF3D]" />
      {role}
    </span>
  );
}

function WarsPanel({
  canManage,
  clans,
  currentClan,
  wars,
}: {
  canManage: boolean;
  clans: Clan[];
  currentClan: Clan;
  wars: ClanWar[];
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="t-display flex items-center gap-2 text-sm font-black uppercase tracking-[0.18em]">
            <Swords className="size-4 text-[#B6FF3D]" />
            Historial de guerras
          </h2>
          {canManage ? (
            <Button variant="neonGreen" size="sm">
              Nuevo reto
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <div className="mt-5 grid gap-3">
        {wars.map((war) => {
          const rivalId =
            war.challengerClanId === currentClan.id
              ? war.defenderClanId
              : war.challengerClanId;
          const rival = clans.find((clan) => clan.id === rivalId);
          const won = war.winnerClanId === currentClan.id;

          return (
            <div key={war.id} className="rounded-none border border-white/5 bg-black/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-500">
                    vs {rival?.name ?? "Clan rival"}
                  </p>
                  <p className="mt-1 font-bold text-white">
                    {war.status === "finished" ? (won ? "Victoria" : "Derrota") : war.status.replace("_", " ")}
                  </p>
                </div>
                <div className="text-right">
                  <p className="t-mono font-black text-[#B6FF3D]">${war.stakeUsd}</p>
                  <p className="text-[10px] text-gray-500">{war.minParticipants} min.</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function SettingsPanel({
  canManage,
  clan,
  isMine,
}: {
  canManage: boolean;
  clan: Clan;
  isMine: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <h2 className="t-display flex items-center gap-2 text-sm font-black uppercase tracking-[0.18em]">
          <Settings className="size-4 text-[#00E5FF]" />
          Configuracion
        </h2>
      </CardHeader>
      {canManage ? (
        <div className="mt-5 grid gap-4">
          <div>
            <Label>Nombre</Label>
            <Input defaultValue={clan.name} className="mt-2 border-white/10 bg-black/25 text-white" />
          </div>
          <div>
            <Label>Tag</Label>
            <Input defaultValue={clan.tag} className="mt-2 border-white/10 bg-black/25 text-white" />
          </div>
          <div className="rounded-none border border-[#00E5FF]/20 bg-[#00E5FF]/10 p-4 text-sm text-gray-300">
            Codigo de invitacion:{" "}
            <span className="t-mono font-black text-[#00E5FF]">{clan.inviteCode}</span>
          </div>
          <Button variant="neonBlueSolid">Guardar cambios</Button>
        </div>
      ) : (
        <p className="mt-5 text-sm text-gray-400">
          {isMine
            ? "Solo owner u officers pueden editar la configuracion."
            : "Debes pertenecer al clan para ver opciones de gestion."}
        </p>
      )}
    </Card>
  );
}
