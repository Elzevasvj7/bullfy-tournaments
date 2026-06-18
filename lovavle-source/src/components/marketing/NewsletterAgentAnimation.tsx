import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";

const AGENTS = [
  { emoji: "🎯", name: "Diana", role: "Reclutadora", color: "#FF6B6B" },
  { emoji: "🔍", name: "Marcus", role: "Investigador", color: "#4ECDC4" },
  { emoji: "🍷", name: "Vanessa", role: "Gossip Editor", color: "#E91E63" },
  { emoji: "✍️", name: "Sofía", role: "Copywriter Técnica", color: "#FFE66D" },
  { emoji: "🌟", name: "Valentina", role: "Copywriter Storyteller", color: "#FF9F43" },
  { emoji: "📝", name: "James", role: "Editor", color: "#A8E6CF" },
  { emoji: "🎨", name: "Yuki", role: "Diseñadora", color: "#DDA0DD" },
  { emoji: "❓", name: "Carlos", role: "Estratega CTA", color: "#FFB347" },
  { emoji: "🏆", name: "Richard", role: "Director", color: "#87CEEB" },
  { emoji: "⚖️", name: "Amara", role: "Verificadora", color: "#98FB98" },
];

const INTERACTIONS = [
  { from: 0, to: 1, desc: "Diana recluta y valida al equipo de investigación" },
  { from: 1, to: 3, desc: "Marcus entrega 6 noticias investigadas a la Copywriter" },
  { from: 2, to: 3, desc: "Vanessa comparte 3 chismes de Wall Street con la Copywriter" },
  { from: 3, to: 5, desc: "Copywriter envía los copys redactados a James para corrección" },
  { from: 5, to: 7, desc: "James entrega el texto pulido a Carlos para CTAs" },
  { from: 7, to: 6, desc: "Carlos define la predicción y Yuki diseña el layout" },
  { from: 6, to: 8, desc: "Yuki presenta el diseño final a Richard para aprobación" },
  { from: 8, to: 9, desc: "Richard aprueba y Amara prepara la verificación 24h" },
];

interface Props {
  isGenerating: boolean;
  activeLogs?: any[];
}

const NewsletterAgentAnimation = ({ isGenerating, activeLogs = [] }: Props) => {
  const [activeAgent, setActiveAgent] = useState(0);
  const [connections, setConnections] = useState<[number, number][]>([]);
  const [currentInteraction, setCurrentInteraction] = useState(0);

  useEffect(() => {
    if (!isGenerating) return;
    const interval = setInterval(() => {
      setCurrentInteraction(prev => {
        const next = (prev + 1) % INTERACTIONS.length;
        const interaction = INTERACTIONS[next];
        setActiveAgent(interaction.from);
        setConnections(p => [...p, [interaction.from, interaction.to] as [number, number]].slice(-6));
        return next;
      });
    }, 2500);
    return () => clearInterval(interval);
  }, [isGenerating]);

  // Derive active sender/receiver from current interaction
  const interaction = INTERACTIONS[currentInteraction];
  const sender = AGENTS[interaction?.from || 0];
  const receiver = AGENTS[interaction?.to || 1];

  // Position agents in a circle
  const cx = 160, cy = 130, r = 100;
  const positions = AGENTS.map((_, i) => {
    const angle = (i / AGENTS.length) * Math.PI * 2 - Math.PI / 2;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  });

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <p className="text-xs font-medium text-center mb-2">
          {isGenerating ? "🧠 Red neuronal multi-agente activa" : "Red de agentes (inactiva)"}
        </p>

        <div className="flex items-center gap-2">
          {/* Left Panel: Sender */}
          <div className="w-28 shrink-0 text-center space-y-1">
            {isGenerating ? (
              <>
                <div
                  className="w-12 h-12 rounded-full mx-auto flex items-center justify-center text-xl border-2 animate-pulse"
                  style={{ borderColor: sender.color, background: `${sender.color}15` }}
                >
                  {sender.emoji}
                </div>
                <p className="text-[10px] font-bold" style={{ color: sender.color }}>{sender.name}</p>
                <p className="text-[9px] text-muted-foreground">{sender.role}</p>
                <p className="text-[8px] text-muted-foreground/70 italic">Enviando →</p>
              </>
            ) : (
              <div className="h-20" />
            )}
          </div>

          {/* Center: Neural Network */}
          <div className="flex-1 min-w-0">
            <svg viewBox="0 0 320 260" className="w-full max-h-[220px]">
              {connections.map(([from, to], i) => (
                <line
                  key={`c-${i}`}
                  x1={positions[from].x} y1={positions[from].y}
                  x2={positions[to].x} y2={positions[to].y}
                  stroke={AGENTS[from].color}
                  strokeWidth={1.5}
                  opacity={0.3 + (i / connections.length) * 0.7}
                  className="transition-all duration-500"
                />
              ))}

              {AGENTS.map((agent, i) => {
                const pos = positions[i];
                const isActive = isGenerating && (activeAgent === i || interaction?.to === i);
                return (
                  <g key={i} className="transition-all duration-300">
                    <circle
                      cx={pos.x} cy={pos.y}
                      r={isActive ? 20 : 16}
                      fill={isActive ? agent.color + "33" : "#1a1a2e"}
                      stroke={agent.color}
                      strokeWidth={isActive ? 2.5 : 1}
                      className="transition-all duration-300"
                    />
                    {isActive && (
                      <circle
                        cx={pos.x} cy={pos.y} r={26}
                        fill="none" stroke={agent.color} strokeWidth={1} opacity={0.3}
                        className="animate-ping"
                      />
                    )}
                    <text x={pos.x} y={pos.y - 1} textAnchor="middle" fontSize="12">{agent.emoji}</text>
                    <text x={pos.x} y={pos.y + 11} textAnchor="middle" fontSize="5" fill={agent.color} fontWeight="bold">
                      {agent.name}
                    </text>
                  </g>
                );
              })}

              <text x={cx} y={cy - 3} textAnchor="middle" fontSize="18">🧠</text>
              <text x={cx} y={cy + 11} textAnchor="middle" fontSize="6" fill="#83CBFF" fontWeight="bold">
                Bullfy Brain
              </text>
            </svg>
          </div>

          {/* Right Panel: Receiver */}
          <div className="w-28 shrink-0 text-center space-y-1">
            {isGenerating ? (
              <>
                <div
                  className="w-12 h-12 rounded-full mx-auto flex items-center justify-center text-xl border-2"
                  style={{ borderColor: receiver.color, background: `${receiver.color}15` }}
                >
                  {receiver.emoji}
                </div>
                <p className="text-[10px] font-bold" style={{ color: receiver.color }}>{receiver.name}</p>
                <p className="text-[9px] text-muted-foreground">{receiver.role}</p>
                <p className="text-[8px] text-muted-foreground/70 italic">← Recibiendo</p>
              </>
            ) : (
              <div className="h-20" />
            )}
          </div>
        </div>

        {/* Current interaction description */}
        {isGenerating && (
          <div className="text-center mt-2 bg-muted/30 rounded-md py-1.5 px-3">
            <p className="text-[10px] text-muted-foreground animate-pulse">
              {interaction?.desc || "Procesando..."}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default NewsletterAgentAnimation;
