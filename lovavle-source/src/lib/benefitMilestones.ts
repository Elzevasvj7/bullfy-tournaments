import benefit7000 from "@/assets/benefits/7000.png";
import benefit16000 from "@/assets/benefits/16000.png";
import benefit35000 from "@/assets/benefits/35000.png";
import benefit50000 from "@/assets/benefits/50000.png";
import benefit51000 from "@/assets/benefits/51000.png";
import benefit52000 from "@/assets/benefits/52000.png";
import benefit55000 from "@/assets/benefits/55000.png";
import benefit70000 from "@/assets/benefits/70000.png";
import benefit90000 from "@/assets/benefits/90000.png";
import benefit100000 from "@/assets/benefits/100000.png";
import benefit200000 from "@/assets/benefits/200000.png";
import benefit400000 from "@/assets/benefits/400000.png";

export interface BenefitMilestone {
  threshold: number;
  image: string;
}

export const BENEFIT_MILESTONES: BenefitMilestone[] = [
  { threshold: 7000, image: benefit7000 },
  { threshold: 16000, image: benefit16000 },
  { threshold: 35000, image: benefit35000 },
  { threshold: 50000, image: benefit50000 },
  { threshold: 51000, image: benefit51000 },
  { threshold: 52000, image: benefit52000 },
  { threshold: 55000, image: benefit55000 },
  { threshold: 70000, image: benefit70000 },
  { threshold: 90000, image: benefit90000 },
  { threshold: 100000, image: benefit100000 },
  { threshold: 200000, image: benefit200000 },
  { threshold: 400000, image: benefit400000 },
];

export const getBenefitMilestoneByThreshold = (threshold: number) =>
  BENEFIT_MILESTONES.find((milestone) => milestone.threshold === threshold) ?? null;

export const getHighestMilestoneForRevenue = (estimatedRevenueUSD: number) => {
  if (!Number.isFinite(estimatedRevenueUSD) || estimatedRevenueUSD <= 0) return null;

  const sorted = [...BENEFIT_MILESTONES].sort((a, b) => a.threshold - b.threshold);
  let matched: BenefitMilestone | null = null;

  for (const milestone of sorted) {
    if (estimatedRevenueUSD >= milestone.threshold) matched = milestone;
    else break;
  }

  return matched;
};

/** Returns all milestones the revenue qualifies for */
export const getAllMilestonesForRevenue = (estimatedRevenueUSD: number): BenefitMilestone[] => {
  if (!Number.isFinite(estimatedRevenueUSD) || estimatedRevenueUSD <= 0) return [];
  return BENEFIT_MILESTONES
    .filter((m) => estimatedRevenueUSD >= m.threshold)
    .sort((a, b) => a.threshold - b.threshold);
};
