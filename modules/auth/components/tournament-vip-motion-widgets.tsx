"use client";

import type { CSSProperties, ReactNode } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import { Crown, Radio, ShieldCheck, TrendingUp } from "lucide-react";

export function MagneticButton({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const x = useSpring(rawX, { damping: 18, stiffness: 170 });
  const y = useSpring(rawY, { damping: 18, stiffness: 170 });

  return (
    <motion.div
      className={className}
      style={{ x, y }}
      onMouseMove={(event) => {
        if (reduceMotion) {
          return;
        }

        const rect = event.currentTarget.getBoundingClientRect();
        rawX.set((event.clientX - rect.left - rect.width / 2) * 0.12);
        rawY.set((event.clientY - rect.top - rect.height / 2) * 0.16);
      }}
      onMouseLeave={() => {
        rawX.set(0);
        rawY.set(0);
      }}
    >
      {children}
    </motion.div>
  );
}

export function LiveBadge({
  children,
  tone = "cyan",
}: {
  children: ReactNode;
  tone?: "cyan" | "lime";
}) {
  const color = tone === "lime" ? "#B6FF3D" : "#00E5FF";

  return (
    <motion.span
      className="vip-live-badge"
      style={{ ["--vip-live-badge" as string]: color } as CSSProperties}
    >
      <Radio className="size-3" />
      {children}
    </motion.span>
  );
}

export function AnimatedLeaderboard() {
  const rows = [
    { rank: "01", trader: "NEXUS", clan: "VIP", score: "+12.8%" },
    { rank: "02", trader: "ALPHA", clan: "ARENA", score: "+9.4%" },
    { rank: "03", trader: "KAI", clan: "BULL", score: "+7.1%" },
  ];

  return (
    <div data-gsap="leaderboard" className="vip-leaderboard" aria-label="Leaderboard live">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
          <Crown className="size-4 text-[#B6FF3D]" />
          live ranking
        </div>
        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[#00E5FF]">
          sync
        </div>
      </div>
      <div className="grid gap-2">
        {rows.map((row, index) => (
          <motion.div
            key={row.trader}
            className="vip-leaderboard-row"
            animate={{ y: [0, index === 1 ? -3 : 2, 0] }}
            transition={{
              delay: index * 0.2,
              duration: 2.4,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            <span className="text-[#B6FF3D]">{row.rank}</span>
            <span>{row.trader}</span>
            <span className="text-slate-500">{row.clan}</span>
            <span className="text-right text-[#00E5FF]">{row.score}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export function MarketPulse() {
  const bars = [34, 58, 44, 72, 39, 84, 62, 48, 78, 54, 68, 46];
  const path =
    "M2 46 C 34 18, 58 70, 90 40 S 152 22, 184 52 S 238 76, 286 28";

  return (
    <div data-gsap="market-pulse" className="vip-market-pulse" aria-label="Mercado vivo">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
          <TrendingUp className="size-4 text-[#00E5FF]" />
          market pulse
        </div>
        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[#B6FF3D]">
          +4.62%
        </div>
      </div>
      <svg className="mt-4 h-24 w-full overflow-visible" viewBox="0 0 288 96" role="img">
        <path
          data-gsap="market-line"
          d={path}
          fill="none"
          stroke="#00E5FF"
          strokeLinecap="round"
          strokeWidth="3"
        />
        <path
          d={`${path} L286 96 L2 96 Z`}
          fill="url(#marketPulseGradient)"
          opacity="0.28"
        />
        <defs>
          <linearGradient id="marketPulseGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#00E5FF" />
            <stop offset="100%" stopColor="#00E5FF" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
      <div className="vip-market-bars">
        {bars.map((height, index) => (
          <motion.span
            key={`${height}-${index}`}
            style={{ height: `${height}%` }}
            animate={{ scaleY: [0.74, 1, 0.82] }}
            transition={{
              delay: index * 0.07,
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>
    </div>
  );
}

export function FinalArenaStatus() {
  return (
    <motion.div
      data-gsap="final-status"
      className="vip-final-status"
      animate={{ opacity: [0.78, 1, 0.78] }}
      transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
    >
      <ShieldCheck className="size-4 text-[#071102]" />
      <span>Arena cierra cuando se llenen los slots VIP</span>
    </motion.div>
  );
}
