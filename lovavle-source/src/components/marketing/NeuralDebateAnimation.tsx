import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface AgentNode {
  id: string;
  name: string;
  emoji: string;
  color: string;
  role: "expert" | "persona";
  done: boolean;
}

interface NeuralDebateProps {
  agents: AgentNode[];
  phase: "thinking" | "debating" | "consensus" | "done";
  currentAgentId?: string;
}

const NeuralDebateAnimation = ({ agents, phase, currentAgentId }: NeuralDebateProps) => {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (phase === "done") return;
    const iv = setInterval(() => setTick(t => t + 1), 120);
    return () => clearInterval(iv);
  }, [phase]);

  // Place agents in a circle
  const positions = useMemo(() => {
    const cx = 200, cy = 180, r = 140;
    return agents.map((_, i) => {
      const angle = (2 * Math.PI * i) / agents.length - Math.PI / 2;
      return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
    });
  }, [agents.length]);

  // Generate connections between agents
  const connections = useMemo(() => {
    const conns: { from: number; to: number }[] = [];
    for (let i = 0; i < agents.length; i++) {
      for (let j = i + 1; j < agents.length; j++) {
        // Connect nearby agents and some random cross-connections
        if (j - i <= 2 || (i + agents.length - j) <= 2 || (i + j) % 5 === 0) {
          conns.push({ from: i, to: j });
        }
      }
    }
    return conns;
  }, [agents.length]);

  const phaseLabel = phase === "thinking" ? "Agentes analizando..." 
    : phase === "debating" ? "Debate en progreso..." 
    : phase === "consensus" ? "Generando consenso..."
    : "Análisis completo";

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="text-sm font-medium text-primary animate-pulse">
        {phaseLabel}
      </div>
      <svg viewBox="0 0 400 360" className="w-full max-w-md" style={{ filter: "drop-shadow(0 0 20px hsl(var(--primary) / 0.1))" }}>
        {/* Connection lines */}
        {connections.map(({ from, to }, i) => {
          const p1 = positions[from];
          const p2 = positions[to];
          const a1Done = agents[from]?.done;
          const a2Done = agents[to]?.done;
          const active = a1Done && a2Done;
          const pulsing = phase !== "done" && ((tick + i) % 8 < 4);

          return (
            <line
              key={`c-${i}`}
              x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
              stroke={active ? "hsl(var(--primary))" : "hsl(var(--muted-foreground) / 0.15)"}
              strokeWidth={active ? (pulsing ? 2 : 1.2) : 0.5}
              opacity={active ? (pulsing ? 0.8 : 0.4) : 0.2}
              style={{ transition: "all 0.3s ease" }}
            />
          );
        })}

        {/* Data packets traveling on active lines */}
        {phase !== "done" && connections.map(({ from, to }, i) => {
          const a1Done = agents[from]?.done;
          const a2Done = agents[to]?.done;
          if (!a1Done || !a2Done) return null;
          const p1 = positions[from];
          const p2 = positions[to];
          const t = ((tick * 3 + i * 17) % 100) / 100;
          const px = p1.x + (p2.x - p1.x) * t;
          const py = p1.y + (p2.y - p1.y) * t;

          return (
            <circle key={`pkt-${i}`} cx={px} cy={py} r={2} fill="hsl(var(--primary))" opacity={0.7} />
          );
        })}

        {/* Agent nodes */}
        {agents.map((agent, i) => {
          const pos = positions[i];
          const isActive = agent.id === currentAgentId;
          const baseR = agent.role === "expert" ? 20 : 16;

          return (
            <g key={agent.id}>
              {/* Glow ring for active agent */}
              {isActive && phase !== "done" && (
                <circle
                  cx={pos.x} cy={pos.y} r={baseR + 6}
                  fill="none" stroke={agent.color} strokeWidth={2} opacity={0.5}
                  style={{ animation: "pulse 1s ease-in-out infinite" }}
                />
              )}

              {/* Node circle */}
              <circle
                cx={pos.x} cy={pos.y} r={baseR}
                fill={agent.done ? agent.color : "hsl(var(--muted))"}
                opacity={agent.done ? 1 : 0.4}
                stroke={agent.done ? "white" : "hsl(var(--border))"}
                strokeWidth={1.5}
                style={{ transition: "all 0.5s ease" }}
              />

              {/* Emoji */}
              <text
                x={pos.x} y={pos.y + 1}
                textAnchor="middle" dominantBaseline="central"
                fontSize={agent.role === "expert" ? 14 : 11}
                style={{ pointerEvents: "none" }}
              >
                {agent.emoji}
              </text>

              {/* Name label */}
              <text
                x={pos.x} y={pos.y + baseR + 12}
                textAnchor="middle" dominantBaseline="central"
                fontSize={7}
                fill="hsl(var(--muted-foreground))"
                fontWeight={agent.done ? 600 : 400}
                opacity={agent.done ? 1 : 0.5}
              >
                {agent.name.split(" ")[0]}
              </text>

              {/* Done checkmark */}
              {agent.done && (
                <circle cx={pos.x + baseR - 4} cy={pos.y - baseR + 4} r={5} fill="#22c55e" />
              )}
            </g>
          );
        })}

        {/* Center moderator node */}
        {phase === "consensus" || phase === "done" ? (
          <g>
            <circle
              cx={200} cy={180} r={28}
              fill={phase === "done" ? "hsl(var(--primary))" : "hsl(var(--muted))"}
              stroke="hsl(var(--primary))" strokeWidth={2}
              style={{ transition: "all 0.5s ease" }}
            />
            <text x={200} y={177} textAnchor="middle" dominantBaseline="central" fontSize={16}>🧠</text>
            <text x={200} y={195} textAnchor="middle" fontSize={7} fill="white" fontWeight={600}>
              Moderador
            </text>
          </g>
        ) : null}
      </svg>

      {/* Agent completion counter */}
      <div className="text-xs text-muted-foreground">
        {agents.filter(a => a.done).length} / {agents.length} agentes completados
      </div>
    </div>
  );
};

export default NeuralDebateAnimation;
