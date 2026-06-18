import { create } from "zustand";
import { persist } from "zustand/middleware";
import { getAllMilestonesForRevenue } from "@/lib/benefitMilestones";

const LEVELS = ["Explorer", "Prospect Builder", "Growth Partner", "Strategic IB", "Elite Candidate"] as const;
const STAGES = ["Explorando Bullfy", "Analizando tu potencial", "Modelando tu negocio", "Perfil listo para contacto"] as const;

const MOTIVATIONAL_MESSAGES = [
  "Veo que eres un profesional, mereces estar en Bullfy",
  "Tus números muestran potencial real",
  "Esto ya parece estructura de negocio",
  "Bullfy busca perfiles con visión",
  "No todos piensan en grande. Tú sí",
  "Esto merece atención de un Business Developer",
  "Esto ya no parece curiosidad, parece ambición real",
  "Estás modelando algo serio",
];

interface ExperienceState {
  level: string;
  badges: string[];
  toolsUsed: string[];
  simulationsCount: number;
  progressStage: number;
  opportunityScore: number;
  currentMessage: string;
  currentBenefitMilestones: number[];
  seenBenefitMilestones: number[];
  addToolUsed: (tool: string) => void;
  addBadge: (badge: string) => void;
  incrementSimulations: () => void;
  triggerBenefitMilestone: (estimatedRevenueUSD: number) => void;
  closeBenefitMilestone: () => void;
  resetSeenMilestones: () => void;
  resetAll: () => void;
  recalculate: () => void;
}

const calcLevel = (sims: number, tools: number): string => {
  const score = sims * 2 + tools * 3;
  if (score >= 25) return LEVELS[4];
  if (score >= 18) return LEVELS[3];
  if (score >= 12) return LEVELS[2];
  if (score >= 5) return LEVELS[1];
  return LEVELS[0];
};

const calcStage = (sims: number, tools: number): number => {
  const score = sims + tools;
  if (score >= 8) return 3;
  if (score >= 5) return 2;
  if (score >= 2) return 1;
  return 0;
};

const randomMessage = () => MOTIVATIONAL_MESSAGES[Math.floor(Math.random() * MOTIVATIONAL_MESSAGES.length)];

export const useExperienceStore = create<ExperienceState>()(
  persist(
    (set, get) => ({
      level: LEVELS[0],
      badges: [],
      toolsUsed: [],
      simulationsCount: 0,
      progressStage: 0,
      opportunityScore: 0,
      currentMessage: MOTIVATIONAL_MESSAGES[0],
      currentBenefitMilestones: [],
      seenBenefitMilestones: [],
      addToolUsed: (tool) => {
        const { toolsUsed } = get();
        if (!toolsUsed.includes(tool)) {
          set({ toolsUsed: [...toolsUsed, tool] });
          get().recalculate();
        }
      },
      addBadge: (badge) => {
        const { badges } = get();
        if (!badges.includes(badge)) {
          set({ badges: [...badges, badge] });
        }
      },
      incrementSimulations: () => {
        set((s) => ({ simulationsCount: s.simulationsCount + 1 }));
        get().recalculate();
      },
      triggerBenefitMilestone: (estimatedRevenueUSD) => {
        const allMatched = getAllMilestonesForRevenue(estimatedRevenueUSD);
        if (allMatched.length === 0) return;

        const { seenBenefitMilestones } = get();
        const unseen = allMatched.filter((m) => !seenBenefitMilestones.includes(m.threshold));
        if (unseen.length === 0) return;

        const unseenThresholds = unseen.map((m) => m.threshold);
        set({
          currentBenefitMilestones: unseenThresholds,
          seenBenefitMilestones: [...seenBenefitMilestones, ...unseenThresholds],
        });
      },
      closeBenefitMilestone: () => set({ currentBenefitMilestones: [] }),
      resetSeenMilestones: () => set({ seenBenefitMilestones: [] }),
      resetAll: () => set({
        level: LEVELS[0],
        badges: [],
        toolsUsed: [],
        simulationsCount: 0,
        progressStage: 0,
        opportunityScore: 0,
        currentMessage: MOTIVATIONAL_MESSAGES[0],
        currentBenefitMilestones: [],
        seenBenefitMilestones: [],
      }),
      recalculate: () => {
        const { simulationsCount, toolsUsed, badges } = get();
        const newScore = Math.min(100, simulationsCount * 8 + toolsUsed.length * 12);
        
        // Auto-award badges
        if (simulationsCount >= 1 && !badges.includes("Primera simulación")) {
          set({ badges: [...get().badges, "Primera simulación"] });
        }
        if (toolsUsed.includes("score") && !badges.includes("Potencial detectado")) {
          set({ badges: [...get().badges, "Potencial detectado"] });
        }
        if (toolsUsed.includes("revenue") && !badges.includes("Perfil analizado")) {
          set({ badges: [...get().badges, "Perfil analizado"] });
        }
        if (toolsUsed.includes("funnel") && !badges.includes("Funnel construido")) {
          set({ badges: [...get().badges, "Funnel construido"] });
        }
        if (newScore >= 50 && !get().badges.includes("Lead calificado")) {
          set({ badges: [...get().badges, "Lead calificado"] });
        }

        set({
          level: calcLevel(simulationsCount, toolsUsed.length),
          progressStage: calcStage(simulationsCount, toolsUsed.length),
          opportunityScore: newScore,
          currentMessage: randomMessage(),
        });
      },
    }),
    { name: "bullfy-experience" }
  )
);

export { LEVELS, STAGES, MOTIVATIONAL_MESSAGES };
