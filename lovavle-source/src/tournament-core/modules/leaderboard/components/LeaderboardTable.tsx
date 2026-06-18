import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, Minus, Trophy } from "lucide-react";
import { tournamentRoutes } from "@/tournament-core/shared/routes";
import {
  formatMoney,
  formatSignedMoney,
  formatSignedPercent,
  integerFormatter,
} from "@/tournament-core/lib/formatters";
import type { RankingEntry } from "../types";
import { Card, CardContent } from "@/components/ui/card";

type LeaderboardTableProps = {
  entries: RankingEntry[];
  title?: string;
  loading?: boolean;
};

export function LeaderboardTable({
  entries,
  loading = false,
  title = "Ranking global",
}: LeaderboardTableProps) {
  return (
    <Card>
      <div className="flex flex-col gap-3 border-b border-white/10 px-5 py-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black text-slate-100">
            <Trophy className="h-6 w-6 text-[#178CFF]" />
            {title}
          </h1>
          <p className="mt-1 text-xs uppercase tracking-[0.24em] text-slate-500">
            Capital, score, ejecucion y cambio de posicion
          </p>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#178CFF]">
            All time
          </p>
          <p className="text-sm font-bold text-slate-300">
            {integerFormatter.format(entries.length)} contendientes
          </p>
        </div>
      </div>

      {loading ? <LeaderboardEmpty text="Cargando ranking..." /> : null}

      {!loading && entries.length === 0 ? (
        <LeaderboardEmpty text="El ranking se actualiza cada 5 minutos. Aun no hay datos." />
      ) : null}

      {!loading && entries.length > 0 ? (
        <CardContent>
          <div className="hidden grid-cols-[76px_minmax(220px,1.3fr)_120px_repeat(5,minmax(92px,1fr))] border-b border-white/10 px-5 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 xl:grid">
            <div>Pos</div>
            <div>Trader</div>
            <div>Clan</div>
            <div className="text-right">Score</div>
            <div className="text-right">PnL</div>
            <div className="text-right">Balance</div>
            <div className="text-right">Trades</div>
            <div className="text-right">Cambio</div>
          </div>

          <div className="divide-y divide-white/10">
            {entries.map((entry) => (
              <RankingRow key={entry.userId} entry={entry} />
            ))}
          </div>
        </CardContent>
      ) : null}
    </Card>
  );
}

function RankingRow({ entry }: { entry: RankingEntry }) {
  const positionChange = entry.previousPosition - entry.position;
  const isPositiveScore = entry.scorePercent >= 0;
  const isPositivePnl = entry.pnl >= 0;
  const accent = getRankAccent(entry.position);

  return (
    <div className="group grid gap-4 px-5 py-4 text-slate-300 transition hover:bg-white/[0.035] xl:grid-cols-[76px_minmax(220px,1.3fr)_120px_repeat(5,minmax(92px,1fr))] xl:items-center">
      <div
        className="t-mono flex h-11 w-14 items-center justify-center border text-sm font-black"
        style={{
          background: `${accent}1a`,
          borderColor: `${accent}33`,
          color: accent,
          boxShadow: entry.position <= 3 ? `0 0 20px ${accent}22` : undefined,
        }}
      >
        #{entry.position}
      </div>

      <div className="flex min-w-0 items-center gap-3">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border text-xs font-black"
          style={{
            background: `${accent}14`,
            borderColor: `${accent}33`,
            color: accent,
          }}
        >
          {entry.avatarUrl ? (
            <img
              src={entry.avatarUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            entry.traderName.slice(0, 2).toUpperCase()
          )}
        </div>
        <div className="min-w-0">
          <TraderName entry={entry} />
          <p className="t-mono mt-0.5 text-[10px] text-slate-500">
            {entry.traderId}
            {entry.country ? ` / ${entry.country}` : ""}
          </p>
        </div>
      </div>

      <div>
        <span className="inline-flex border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-bold text-slate-300">
          {entry.clanName}
        </span>
      </div>

      <Metric label="Score">
        <MetricValue positive={isPositiveScore} value={formatSignedPercent(entry.scorePercent)} />
      </Metric>
      <Metric label="PnL">
        <MetricValue positive={isPositivePnl} value={formatSignedMoney(entry.pnl)} />
      </Metric>
      <Metric label="Balance" valueClassName="text-white">
        {formatMoney(entry.balance)}
      </Metric>
      <Metric label="Trades" valueClassName="text-slate-200">
        {integerFormatter.format(entry.trades)}
      </Metric>
      <Metric label="Cambio">
        <PositionChange value={positionChange} />
      </Metric>
    </div>
  );
}

function TraderName({ entry }: { entry: RankingEntry }) {
  if (entry.username && entry.publicProfile) {
    return (
      <Link
        to={tournamentRoutes.publicProfile(entry.username)}
        className="truncate text-sm font-black text-slate-100 transition hover:text-[#178CFF]"
      >
        {entry.traderName}
      </Link>
    );
  }

  return <p className="truncate text-sm font-black text-slate-100">{entry.traderName}</p>;
}

function Metric({
  children,
  label,
  valueClassName = "",
}: {
  children: ReactNode;
  label: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 xl:block xl:text-right">
      <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 xl:hidden">
        {label}
      </span>
      <span className={`t-mono text-sm font-black ${valueClassName}`}>
        {children}
      </span>
    </div>
  );
}

function MetricValue({ positive, value }: { positive: boolean; value: string }) {
  return (
    <span className={positive ? "text-[#B6FF3D]" : "text-[#FF7A1A]"}>
      {value}
    </span>
  );
}

function PositionChange({ value }: { value: number }) {
  if (value === 0) {
    return (
      <span className="inline-flex items-center justify-end gap-1 text-slate-500">
        <Minus className="h-3 w-3" />0
      </span>
    );
  }

  const positive = value > 0;

  return (
    <span
      className={`inline-flex items-center justify-end gap-1 ${
        positive ? "text-[#B6FF3D]" : "text-[#FF7A1A]"
      }`}
    >
      {positive ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      {positive ? "+" : ""}
      {value}
    </span>
  );
}

function LeaderboardEmpty({ text }: { text: string }) {
  return (
    <div className="px-5 py-10 text-sm font-medium text-slate-400">
      {text}
    </div>
  );
}

function getRankAccent(position: number) {
  if (position === 1) return "#B6FF3D";
  if (position === 2) return "#178CFF";
  if (position === 3) return "#FF7A1A";
  return "#64748B";
}
