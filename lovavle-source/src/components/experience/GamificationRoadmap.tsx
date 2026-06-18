import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useExperienceStore } from "@/stores/experienceStore";

import charWalking from "@/assets/roadmap/character-walking.png";
import charThinking from "@/assets/roadmap/character-thinking.png";
import charRunning from "@/assets/roadmap/character-running.png";
import charCelebrating from "@/assets/roadmap/character-celebrating.png";
import charEmpire from "@/assets/roadmap/character-empire.png";

interface Milestone {
  id: number;
  label: string;
  description: string;
  icon: string;
  characterImg: string;
  check: (state: ReturnType<typeof useExperienceStore.getState>) => boolean;
}

const MILESTONES: Milestone[] = [
  { id: 1, label: "Inicio", description: "Comienza tu viaje IB", icon: "🚀", characterImg: charWalking, check: () => true },
  { id: 2, label: "Primera simulación", description: "Completa tu primera simulación", icon: "🎯", characterImg: charWalking, check: (s) => s.simulationsCount >= 1 },
  { id: 3, label: "Explorador activo", description: "Usa 2+ herramientas", icon: "🔍", characterImg: charThinking, check: (s) => s.toolsUsed.length >= 2 },
  { id: 4, label: "Potencial detectado", description: "Analiza tu potencial IB", icon: "📊", characterImg: charThinking, check: (s) => s.badges.includes("Potencial detectado") },
  { id: 5, label: "Constructor", description: "Usa 4+ herramientas", icon: "🏗️", characterImg: charRunning, check: (s) => s.toolsUsed.length >= 4 },
  { id: 6, label: "Lead calificado", description: "Score ≥ 50", icon: "⭐", characterImg: charRunning, check: (s) => s.opportunityScore >= 50 },
  { id: 7, label: "Estratega IB", description: "Alcanza nivel Strategic IB", icon: "🏆", characterImg: charCelebrating, check: (s) => ["Strategic IB", "Elite Candidate"].includes(s.level) },
  { id: 8, label: "Conquista Imperial", description: "Alcanza Elite Candidate", icon: "👑", characterImg: charEmpire, check: (s) => s.level === "Elite Candidate" },
];

const GamificationRoadmap = () => {
  const state = useExperienceStore();

  const { currentMilestone, completedCount } = useMemo(() => {
    let last = 0;
    for (let i = 0; i < MILESTONES.length; i++) {
      if (MILESTONES[i].check(state)) last = i;
      else break;
    }
    return { currentMilestone: last, completedCount: last + 1 };
  }, [state]);

  const progressPercent = (completedCount / MILESTONES.length) * 100;
  const currentChar = MILESTONES[currentMilestone].characterImg;
  const isEmpire = currentMilestone === MILESTONES.length - 1;

  return (
    <div className="relative w-full rounded-2xl border border-border/50 bg-card/30 backdrop-blur-sm overflow-hidden p-6">
      {/* Empire background glow for final stage */}
      <AnimatePresence>
        {isEmpire && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-gradient-to-t from-primary/10 via-transparent to-transparent pointer-events-none"
          />
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-foreground">Tu Camino al Imperio IB</h3>
          <p className="text-xs text-muted-foreground">{completedCount}/{MILESTONES.length} hitos completados</p>
        </div>
        <motion.div
          key={currentMilestone}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="text-2xl"
        >
          {MILESTONES[currentMilestone].icon}
        </motion.div>
      </div>

      {/* Roadmap track */}
      <div className="relative">
        {/* SVG curved path */}
        <svg
          viewBox="0 0 800 100"
          className="w-full h-16 md:h-20"
          preserveAspectRatio="none"
        >
          {/* Background path */}
          <path
            d="M 20 50 C 120 20, 200 80, 300 50 C 400 20, 500 80, 600 50 C 700 20, 760 50, 780 50"
            fill="none"
            stroke="hsl(var(--border))"
            strokeWidth="4"
            strokeLinecap="round"
          />
          {/* Animated progress path */}
          <motion.path
            d="M 20 50 C 120 20, 200 80, 300 50 C 400 20, 500 80, 600 50 C 700 20, 760 50, 780 50"
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="4"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: progressPercent / 100 }}
            transition={{ duration: 1.5, ease: "easeInOut" }}
          />
          {/* Milestone dots */}
          {MILESTONES.map((m, i) => {
            const x = 20 + (i / (MILESTONES.length - 1)) * 760;
            // Calculate y based on the curve
            const t = i / (MILESTONES.length - 1);
            const y = 50 + Math.sin(t * Math.PI * 2.5) * 25;
            const reached = i <= currentMilestone;
            return (
              <motion.circle
                key={m.id}
                cx={x}
                cy={y}
                r={reached ? 8 : 5}
                fill={reached ? "hsl(var(--primary))" : "hsl(var(--muted))"}
                stroke={reached ? "hsl(var(--primary-foreground))" : "hsl(var(--border))"}
                strokeWidth="2"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: i * 0.1 }}
              />
            );
          })}
        </svg>

        {/* Character */}
        {isEmpire ? (
          <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
            <motion.img
              key={currentChar}
              src={currentChar}
              alt="Tu personaje celebrando"
              className="w-48 h-48 md:w-64 md:h-64 object-contain drop-shadow-lg"
              initial={{ y: 10, opacity: 0, scale: 0.6 }}
              animate={{
                y: [0, -10, 0],
                opacity: 1,
                scale: 1,
              }}
              transition={{
                y: { repeat: Infinity, duration: 1.4, ease: "easeInOut" },
                opacity: { duration: 0.4 },
                scale: { duration: 0.7, type: "spring", stiffness: 220 },
              }}
            />
          </div>
        ) : (
          <motion.div
            className="absolute -top-16 md:-top-20 z-20"
            initial={{ x: "0%" }}
            animate={{
              left: `${(currentMilestone / (MILESTONES.length - 1)) * 100}%`,
            }}
            transition={{ duration: 1.2, ease: "easeInOut" }}
            style={{ transform: "translateX(-50%)" }}
          >
            <motion.img
              key={currentChar}
              src={currentChar}
              alt="Tu personaje"
              className="w-20 h-20 md:w-28 md:h-28 object-contain drop-shadow-lg"
              initial={{ y: -10, opacity: 0, scale: 1 }}
              animate={{
                y: [0, -6, 0],
                opacity: 1,
                scale: 1,
              }}
              transition={{
                y: { repeat: Infinity, duration: 2, ease: "easeInOut" },
                opacity: { duration: 0.5 },
                scale: { duration: 0.8, type: "spring", stiffness: 200 },
              }}
            />
          </motion.div>
        )}
      </div>

      {/* Milestone labels */}
      <div className="grid gap-1 mt-4" style={{ gridTemplateColumns: `repeat(${MILESTONES.length}, 1fr)` }}>
        {MILESTONES.map((m, i) => {
          const reached = i <= currentMilestone;
          const isCurrent = i === currentMilestone;
          return (
            <motion.div
              key={m.id}
              className="text-center"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
            >
              <span className="text-sm block mb-0.5">{m.icon}</span>
              <p className={`text-[9px] md:text-[10px] font-medium leading-tight ${
                isCurrent ? "text-primary" : reached ? "text-foreground" : "text-muted-foreground/40"
              }`}>
                {m.label}
              </p>
            </motion.div>
          );
        })}
      </div>

      {/* Current milestone message */}
      <motion.div
        key={currentMilestone}
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-4 text-center"
      >
        <p className="text-xs text-muted-foreground">
          {currentMilestone < MILESTONES.length - 1
            ? `Próximo: ${MILESTONES[currentMilestone + 1].label} — ${MILESTONES[currentMilestone + 1].description}`
            : "🎉 ¡Has conquistado tu imperio IB!"}
        </p>
      </motion.div>

      {/* Confetti-like particles for celebration */}
      <AnimatePresence>
        {isEmpire && (
          <>
            {[...Array(12)].map((_, i) => (
              <motion.div
                key={`particle-${i}`}
                className="absolute w-2 h-2 rounded-full"
                style={{
                  backgroundColor: i % 3 === 0 ? "hsl(var(--primary))" : i % 3 === 1 ? "hsl(var(--accent))" : "#D4AF37",
                  left: `${10 + Math.random() * 80}%`,
                  top: `${Math.random() * 60}%`,
                }}
                initial={{ opacity: 0, scale: 0 }}
                animate={{
                  opacity: [0, 1, 0],
                  scale: [0, 1.5, 0],
                  y: [0, -30, -60],
                }}
                transition={{
                  duration: 2,
                  delay: i * 0.2,
                  repeat: Infinity,
                  repeatDelay: 1,
                }}
              />
            ))}
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default GamificationRoadmap;
