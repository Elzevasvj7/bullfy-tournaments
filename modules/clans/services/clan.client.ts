import type { Clan, ClanDashboard, CreateClanInput } from "../types";
import {
  clanMockDtos,
  getClanDashboardMock,
} from "./clan.mock";

export async function getClanDashboard(): Promise<ClanDashboard> {
  return getClanDashboardMock();
}

export async function getClanBySlug(slug: string): Promise<Clan | null> {
  return clanMockDtos.find((clan) => clan.slug === slug || clan.id === slug) ?? null;
}

export async function createClan(input: CreateClanInput): Promise<Clan> {
  const slug = input.name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return {
    id: `clan_${Date.now().toString(36)}`,
    slug,
    name: input.name,
    tag: input.tag,
    description: input.description,
    inviteCode: `${input.tag}-MOCK1`,
    isPublic: input.isPublic,
    isVerified: false,
    rating: 1000,
    rank: clanMockDtos.length + 1,
    membersCount: 1,
    warsWon: 0,
    totalWars: 0,
    avgMemberScore: 0,
    totalScore: 0,
    ownerId: "trader_karlos",
    createdAt: new Date().toISOString(),
    members: [
      {
        id: "trader_karlos",
        name: "Karlos Guzman",
        handle: "karlosg",
        role: "owner",
        joinedAt: new Date().toISOString(),
        score: 0,
        pnl: 0,
        trades: 0,
        winRate: 0,
        verified: true,
      },
    ],
  };
}
