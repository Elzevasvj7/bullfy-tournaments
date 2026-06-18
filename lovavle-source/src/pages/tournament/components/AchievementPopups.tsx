import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Zap, Crown, Flame } from "lucide-react";
import confetti from "canvas-confetti";

type Achievement = {
  id: string;
  kind: "leader" | "milestone" | "streak" | "huge_trade";
  title: string;
  subtitle: string;
};

interface Props {
  tournamentId: string;
  participants: { id: string; user_id: string; rank: number; profit_pct: number; trades_count: number; current_equity: number; user?: { full_name?: string } }[];
}

/**
 * Listens to participant updates and emits ephemeral achievement popups.
 * Pure UI — does not write to DB and does not touch engine state.
 */
export default function AchievementPopups({ tournamentId, participants }: Props) {
  const [popups, setPopups] = useState<Achievement[]>([]);
  const seenRef = useRef<Map<string, { rank: number; profit_pct: number; equity: number }>>(new Map());
  const milestoneSeen = useRef<Set<string>>(new Set());

  const push = (a: Achievement) => {
    setPopups((arr) => [...arr, a].slice(-3));
    setTimeout(() => {
      setPopups((arr) => arr.filter((x) => x.id !== a.id));
    }, 5500);
  };

  // Detect milestones from participants prop changes
  useEffect(() => {
    participants.forEach((p) => {
      const prev = seenRef.current.get(p.id);
      const name = p.user?.full_name || "Trader";

      if (prev) {
        // Climbed to #1
        if (p.rank === 1 && prev.rank !== 1) {
          push({
            id: `lead-${p.id}-${Date.now()}`,
            kind: "leader",
            title: `${name} toma el liderato`,
            subtitle: "¡Nuevo #1!",
          });
          confetti({ particleCount: 80, spread: 70, origin: { y: 0.3 }, colors: ["#FFD56B", "#146EF5"] });
        }
        // Huge equity jump (>2% in one tick)
        const eqDelta = prev.equity > 0 ? ((p.current_equity - prev.equity) / prev.equity) * 100 : 0;
        if (eqDelta >= 2) {
          const key = `huge-${p.id}-${Math.floor(Date.now() / 60000)}`;
          if (!milestoneSeen.current.has(key)) {
            milestoneSeen.current.add(key);
            push({
              id: key,
              kind: "huge_trade",
              title: `${name} +${eqDelta.toFixed(2)}%`,
              subtitle: "¡Trade brutal!",
            });
          }
        }
      }

      // Profit milestones (+5, +10, +20)
      for (const m of [5, 10, 20, 50]) {
        const key = `milestone-${p.id}-${m}`;
        if (p.profit_pct >= m && !milestoneSeen.current.has(key)) {
          milestoneSeen.current.add(key);
          push({
            id: key,
            kind: "milestone",
            title: `${name} cruza +${m}%`,
            subtitle: "Hot streak 🔥",
          });
        }
      }
      // Trades milestone
      const tradeKey = `trades-${p.id}-${Math.floor(p.trades_count / 10) * 10}`;
      if (p.trades_count >= 10 && !milestoneSeen.current.has(tradeKey)) {
        milestoneSeen.current.add(tradeKey);
        push({
          id: tradeKey,
          kind: "streak",
          title: `${name} · ${Math.floor(p.trades_count / 10) * 10} trades`,
          subtitle: "En racha",
        });
      }

      seenRef.current.set(p.id, { rank: p.rank, profit_pct: Number(p.profit_pct), equity: Number(p.current_equity) });
    });
  }, [participants]);

  const iconFor = (k: Achievement["kind"]) => {
    if (k === "leader") return <Crown className="h-5 w-5" />;
    if (k === "huge_trade") return <Zap className="h-5 w-5" />;
    if (k === "streak") return <Flame className="h-5 w-5" />;
    return <Trophy className="h-5 w-5" />;
  };

  return (
    <div className="fixed top-20 right-4 z-50 flex flex-col gap-2 pointer-events-none max-w-xs">
      <AnimatePresence>
        {popups.map((p) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, x: 100, scale: 0.8 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.8 }}
            transition={{ type: "spring", stiffness: 300, damping: 24 }}
            className="bg-gradient-to-r from-primary/90 to-bullfy-blue/90 text-white rounded-xl shadow-2xl p-3 flex items-center gap-3 backdrop-blur-sm border border-white/20"
          >
            <div className="bg-white/20 rounded-full p-2 flex-shrink-0">{iconFor(p.kind)}</div>
            <div className="min-w-0">
              <div className="font-bold text-sm truncate">{p.title}</div>
              <div className="text-[11px] opacity-80 truncate">{p.subtitle}</div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
