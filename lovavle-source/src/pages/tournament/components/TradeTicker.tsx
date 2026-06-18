import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, TrendingDown } from "lucide-react";

type TickItem = {
  id: string;
  participant_id: string;
  name: string;
  username?: string | null;
  delta_pct: number;
  captured_at: string;
};

interface Props {
  tournamentId: string;
  participants: { id: string; user_id: string; user?: { full_name?: string; username?: string | null } }[];
  className?: string;
  max?: number;
}

/**
 * Live ticker that reacts to new equity snapshots and shows a flowing
 * marquee of the latest profit/loss deltas. Read-only — never mutates state.
 */
export default function TradeTicker({ tournamentId, participants, className = "", max = 12 }: Props) {
  const [items, setItems] = useState<TickItem[]>([]);
  const lastEquityRef = useRef<Map<string, number>>(new Map());
  const partMap = new Map(participants.map((p) => [p.id, p]));

  useEffect(() => {
    if (!tournamentId) return;
    const ch = supabase
      .channel(`tournament_ticker_${tournamentId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "tournament_equity_snapshots", filter: `tournament_id=eq.${tournamentId}` },
        (payload) => {
          const row = payload.new as any;
          const prev = lastEquityRef.current.get(row.participant_id);
          lastEquityRef.current.set(row.participant_id, Number(row.equity));
          if (prev == null || !Number.isFinite(prev) || prev === 0) return;
          const delta_pct = ((Number(row.equity) - prev) / Math.abs(prev)) * 100;
          if (Math.abs(delta_pct) < 0.05) return;
          const p = partMap.get(row.participant_id);
          if (!p) return;
          setItems((arr) => [
            {
              id: `${row.id}-${Date.now()}`,
              participant_id: row.participant_id,
              name: p.user?.full_name || p.user?.username || "Trader",
              username: p.user?.username,
              delta_pct,
              captured_at: row.captured_at,
            },
            ...arr,
          ].slice(0, max));
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tournamentId, participants.length]);

  if (items.length === 0) {
    return (
      <div className={`text-[10px] text-muted-foreground text-center py-2 ${className}`}>
        Esperando movimientos…
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <div className="flex gap-2 overflow-x-auto scrollbar-none">
        <AnimatePresence initial={false}>
          {items.map((it) => {
            const positive = it.delta_pct >= 0;
            return (
              <motion.div
                key={it.id}
                layout
                initial={{ opacity: 0, x: -30, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ type: "spring", stiffness: 260, damping: 22 }}
                className={`flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${
                  positive
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
                    : "bg-red-500/10 border-red-500/30 text-red-500"
                }`}
              >
                {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                <span className="truncate max-w-[120px]">{it.name}</span>
                <span className="font-mono font-bold">
                  {positive ? "+" : ""}{it.delta_pct.toFixed(2)}%
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
