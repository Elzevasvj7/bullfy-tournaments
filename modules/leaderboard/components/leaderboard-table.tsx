import { ArrowDown, ArrowUp, Crown, Medal, Minus } from "lucide-react";
import type { RankingEntry } from "../types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

type LeaderboardTableProps = {
  entries: RankingEntry[];
  title?: string;
  className?: string;
};

const moneyFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const percentFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function LeaderboardTable({ entries, title, className }: LeaderboardTableProps) {
  return (
    <section className={cn("overflow-hidden bg-[#04101a]/95", className)}>
      {title ? (
        <div className="border-b border-cyan-300/10 px-5 py-3">
          <h2 className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100">
            {title}
          </h2>
        </div>
      ) : null}
      {entries.length === 0 ? (
        <p className="px-5 py-8 text-sm text-slate-500">
          El ranking se actualiza cada 5 minutos. Aun no hay datos.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow  className="border-b border-cyan-300/10 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
              <TableHead className="px-5 py-3">Pos</TableHead>
              <TableHead className="px-5 py-3">Trader</TableHead>
              <TableHead className="px-5 py-3">Clan</TableHead>
              <TableHead className="px-5 py-3 text-right">Score %</TableHead>
              <TableHead className="px-5 py-3 text-right">PnL</TableHead>
              <TableHead className="px-5 py-3 text-right">Balance</TableHead>
              <TableHead className="px-5 py-3 text-right">Trades</TableHead>
              <TableHead className="px-5 py-3 text-right">W/R</TableHead>
              <TableHead className="px-5 py-3 text-right">Cambio</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => (
              <RankingRow key={entry.userId} entry={entry} />
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}

function RankingRow({ entry }: { entry: RankingEntry }) {
  const positionChange = entry.previousPosition - entry.position;
  const isPositiveScore = entry.scorePercent >= 0;
  const isPositivePnl = entry.pnl >= 0;
  const accent = getRankAccent(entry.position);

  return (
    <TableRow className="group border-t border-white/5 text-slate-300 transition hover:bg-white/[0.035]">
      <TableCell  className="px-5 py-3">
        <RankBadge accent={accent} position={entry.position} />
      </TableCell>
      <TableCell  className="px-5 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="flex size-9 shrink-0 items-center justify-center rounded-full border text-xs font-black"
            style={{
              background: `${accent}14`,
              borderColor: `${accent}40`,
              color: accent,
            }}
          >
            {entry.traderName.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-white">
              {entry.traderName}
            </p>
            <p className="t-mono mt-0.5 text-[10px] text-slate-500">
              {entry.traderId}
            </p>
          </div>
        </div>
      </TableCell>
      <TableCell  className="px-5 py-3">
        <span className="border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-bold text-slate-300">
          {entry.clanName}
        </span>
      </TableCell>
      <TableCell  className="px-5 py-3 text-right">
        <MetricValue
          positive={isPositiveScore}
          value={`${isPositiveScore ? "+" : ""}${percentFormatter.format(
            entry.scorePercent,
          )}%`}
        />
      </TableCell>
      <TableCell  className="px-5 py-3 text-right">
        <MetricValue
          positive={isPositivePnl}
          value={`${isPositivePnl ? "+" : ""}$${moneyFormatter.format(entry.pnl)}`}
        />
      </TableCell>
      <TableCell  className="t-mono px-5 py-3 text-right font-bold text-white">
        ${moneyFormatter.format(entry.balance)}
      </TableCell>
      <TableCell  className="t-mono px-5 py-3 text-right font-bold text-slate-300">
        {entry.trades}
      </TableCell>
      <TableCell  className="px-5 py-3 text-right">
        <div className="ml-auto h-2 w-20 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-[#00E5FF]"
            style={{ width: `${entry.winRate}%` }}
          />
        </div>
        <p className="t-mono mt-1 text-[11px] font-bold text-white">
          {entry.winRate}%
        </p>
      </TableCell>
      <TableCell  className="px-5 py-3 text-right">
        <PositionChange value={positionChange} />
      </TableCell>
    </TableRow>
  );
}

function RankBadge({
  accent,
  position,
}: {
  accent: string;
  position: number;
}) {
  if (position === 1) {
    return <Crown className="size-5" style={{ color: accent }} />;
  }

  if (position <= 3) {
    return <Medal className="size-5" style={{ color: accent }} />;
  }

  return <span className="t-mono text-sm font-black text-slate-400">{position}</span>;
}

function MetricValue({
  positive,
  value,
}: {
  positive: boolean;
  value: string;
}) {
  return (
    <span
      className={`t-mono font-black ${
        positive ? "text-[#B6FF3D]" : "text-[#FF514F]"
      }`}
    >
      {value}
    </span>
  );
}

function PositionChange({ value }: { value: number }) {
  if (value === 0) {
    return (
      <span className="inline-flex items-center justify-end gap-1 text-slate-500">
        <Minus className="size-3" />
        --
      </span>
    );
  }

  const positive = value > 0;

  return (
    <span
      className={`inline-flex items-center justify-end gap-1 font-black ${
        positive ? "text-[#B6FF3D]" : "text-[#FF514F]"
      }`}
    >
      {positive ? (
        <ArrowUp className="size-3" />
      ) : (
        <ArrowDown className="size-3" />
      )}
      {positive ? "+" : ""}
      {value}
    </span>
  );
}

function getRankAccent(position: number) {
  if (position === 1) return "#FFD56B";
  if (position === 2) return "#CBD5E1";
  if (position === 3) return "#F59E0B";
  return "#7a8e9f";
}
