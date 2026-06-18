/**
 * Bullfy Avatar animation library.
 *
 * Uses Ready Player Me's public animation library (Mixamo-rigged GLB files
 * with the same skeleton Avaturn exports), served via jsDelivr.
 * https://github.com/readyplayerme/animation-library
 */
export type AvatarGender = "masculine" | "feminine";

const BASE = "https://cdn.jsdelivr.net/gh/readyplayerme/animation-library@master";

export const AVATAR_ANIMATIONS = {
  masculine: {
    idle: `${BASE}/masculine/glb/idle/M_Standing_Idle_001.glb`,
    weight_shift: `${BASE}/masculine/glb/idle/M_Standing_Idle_Variations_001.glb`,
    thinking: `${BASE}/masculine/glb/idle/M_Standing_Idle_Variations_002.glb`,
    crossed_arms: `${BASE}/masculine/glb/idle/M_Standing_Idle_Variations_003.glb`,
    victory: `${BASE}/masculine/glb/expression/M_Standing_Expressions_001.glb`,
    cheer: `${BASE}/masculine/glb/expression/M_Standing_Expressions_004.glb`,
    wave: `${BASE}/masculine/glb/expression/M_Standing_Expressions_011.glb`,
    clapping: `${BASE}/masculine/glb/expression/M_Standing_Expressions_012.glb`,
    bow: `${BASE}/masculine/glb/expression/M_Standing_Expressions_013.glb`,
    salute: `${BASE}/masculine/glb/expression/M_Standing_Expressions_014.glb`,
    yelling: `${BASE}/masculine/glb/expression/M_Standing_Expressions_016.glb`,
    hip_hop_dance: `${BASE}/masculine/glb/dance/M_Dances_001.glb`,
    samba_dance: `${BASE}/masculine/glb/dance/M_Dances_006.glb`,
  },
  feminine: {
    idle: `${BASE}/feminine/glb/idle/F_Standing_Idle_001.glb`,
    weight_shift: `${BASE}/feminine/glb/idle/F_Standing_Idle_Variations_001.glb`,
    thinking: `${BASE}/feminine/glb/idle/F_Standing_Idle_Variations_002.glb`,
    crossed_arms: `${BASE}/feminine/glb/idle/F_Standing_Idle_Variations_003.glb`,
    victory: `${BASE}/feminine/glb/expression/F_Standing_Expressions_001.glb`,
    cheer: `${BASE}/feminine/glb/expression/F_Standing_Expressions_006.glb`,
    wave: `${BASE}/feminine/glb/expression/F_Standing_Expressions_008.glb`,
    clapping: `${BASE}/feminine/glb/expression/F_Standing_Expressions_012.glb`,
    bow: `${BASE}/feminine/glb/expression/F_Standing_Expressions_013.glb`,
    salute: `${BASE}/feminine/glb/expression/F_Standing_Expressions_014.glb`,
    yelling: `${BASE}/feminine/glb/expression/F_Standing_Expressions_016.glb`,
    hip_hop_dance: `${BASE}/feminine/glb/dance/F_Dances_001.glb`,
    samba_dance: `${BASE}/feminine/glb/dance/F_Dances_006.glb`,
  },
} as const;

export type AvatarAnimationKey = keyof typeof AVATAR_ANIMATIONS["masculine"];

export function resolveAnimationUrl(
  key: AvatarAnimationKey,
  gender: AvatarGender = "masculine",
): string {
  const set = AVATAR_ANIMATIONS[gender] || AVATAR_ANIMATIONS.masculine;
  return (set as any)[key] || AVATAR_ANIMATIONS.masculine[key] || AVATAR_ANIMATIONS.masculine.idle;
}

/**
 * Catalog of user-selectable poses with BP cost.
 * Free poses are always available (cost = 0). Paid poses must be unlocked
 * via `tournament-pose-action` edge function.
 */
import poseIdle from "@/assets/poses/idle.jpg";
import poseWave from "@/assets/poses/wave.jpg";
import poseWeightShift from "@/assets/poses/weight_shift.jpg";
import poseCrossedArms from "@/assets/poses/crossed_arms.jpg";
import poseBow from "@/assets/poses/bow.jpg";
import poseSalute from "@/assets/poses/salute.jpg";
import poseThinking from "@/assets/poses/thinking.jpg";
import poseClapping from "@/assets/poses/clapping.jpg";
import poseYelling from "@/assets/poses/yelling.jpg";
import poseCheer from "@/assets/poses/cheer.jpg";
import poseVictory from "@/assets/poses/victory.jpg";
import poseHipHop from "@/assets/poses/hip_hop_dance.jpg";
import poseSamba from "@/assets/poses/samba_dance.jpg";

export type PoseCatalogItem = {
  key: AvatarAnimationKey;
  label: string;
  description: string;
  cost: number;
  category: "idle" | "expression" | "dance";
  thumbnail: string;
};

export const POSE_CATALOG: PoseCatalogItem[] = [
  { key: "idle", label: "Reposo", description: "Pose neutra, respiración natural", cost: 0, category: "idle", thumbnail: poseIdle },
  { key: "wave", label: "Saludo", description: "Saluda con la mano", cost: 0, category: "expression", thumbnail: poseWave },
  { key: "weight_shift", label: "Casual", description: "Cambia el peso de un pie a otro", cost: 0, category: "idle", thumbnail: poseWeightShift },
  { key: "crossed_arms", label: "Brazos cruzados", description: "Postura confiada", cost: 0, category: "idle", thumbnail: poseCrossedArms },
  { key: "bow", label: "Reverencia", description: "Inclinación respetuosa", cost: 50, category: "expression", thumbnail: poseBow },
  { key: "salute", label: "Saludo militar", description: "Saludo formal", cost: 100, category: "expression", thumbnail: poseSalute },
  { key: "thinking", label: "Pensativo", description: "Reflexionando", cost: 100, category: "idle", thumbnail: poseThinking },
  { key: "clapping", label: "Aplauso", description: "Aplauso continuo", cost: 150, category: "expression", thumbnail: poseClapping },
  { key: "yelling", label: "Grito de hype", description: "Energía máxima", cost: 200, category: "expression", thumbnail: poseYelling },
  { key: "cheer", label: "Celebración", description: "Festejo intenso", cost: 300, category: "expression", thumbnail: poseCheer },
  { key: "hip_hop_dance", label: "Hip-Hop", description: "Baile hip-hop", cost: 500, category: "dance", thumbnail: poseHipHop },
  { key: "samba_dance", label: "Samba", description: "Baile de samba", cost: 800, category: "dance", thumbnail: poseSamba },
];

// victory image is currently unused in catalog (no "victory" key), keep reference to avoid tree-shake confusion
export const POSE_VICTORY_THUMBNAIL = poseVictory;

export const FREE_POSE_KEYS: string[] = POSE_CATALOG.filter(p => p.cost === 0).map(p => p.key);

export function getPoseCost(key: string): number | null {
  const item = POSE_CATALOG.find(p => p.key === key);
  return item ? item.cost : null;
}
