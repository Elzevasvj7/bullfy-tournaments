import type { ExternalTournamentDto } from "./tournament.contracts";
import type { CreateTournamentInput } from "../types";

const createdTournamentMockDtos: ExternalTournamentDto[] = [];

const tournamentMockDtos: ExternalTournamentDto[] = [
  {
    tournament_id: "trn_devtest3",
    slug: "devtest3",
    title: "devtest3",
    summary: "Battle royale de 20 traders con ranking PnL en vivo.",
    status: "RUNNING",
    start_time: "2026-06-04T17:00:00.000Z",
    end_time: "2026-06-04T20:36:45.000Z",
    participants_count: 20,
    max_participants: 20,
    entry_fee: {
      amount: 0,
      currency: "USD",
    },
    prize_pool: {
      amount: 1680,
      currency: "USD",
    },
    sponsor_name: "Bullfy Tournament",
    rules: {
      market: "Forex + Crypto",
      account_mode: "demo",
      min_balance: 10000,
      allowed_assets: ["EURUSD", "GBPUSD", "XAUUSD", "BTCUSD"],
    },
    prizes: [
      { place: 1, label: "Champion", amount: 900, currency: "USD" },
      { place: 2, label: "Runner up", amount: 520, currency: "USD" },
      { place: 3, label: "Podium", amount: 260, currency: "USD" },
    ],
  },
  {
    tournament_id: "trn_scalp_night",
    slug: "scalp-night",
    title: "Scalp Night",
    summary: "Torneo nocturno para operaciones rápidas con límite de riesgo.",
    status: "SCHEDULED",
    start_time: "2026-06-05T01:00:00.000Z",
    end_time: "2026-06-05T04:00:00.000Z",
    participants_count: 42,
    max_participants: 80,
    entry_fee: {
      amount: 250,
      currency: "BULLFY",
    },
    prize_pool: {
      amount: 30000,
      currency: "BULLFY",
    },
    sponsor_name: "Bullfy Points",
    rules: {
      market: "Forex",
      account_mode: "demo",
      min_balance: 5000,
      allowed_assets: ["EURUSD", "GBPUSD", "USDJPY"],
    },
    prizes: [
      { place: 1, label: "Top scalper", amount: 18000, currency: "BULLFY" },
      { place: 2, label: "Second place", amount: 8000, currency: "BULLFY" },
      { place: 3, label: "Third place", amount: 4000, currency: "BULLFY" },
    ],
  },
  {
    tournament_id: "trn_gold_rush",
    slug: "gold-rush",
    title: "Gold Rush",
    summary: "Competencia especializada en XAUUSD con drawdown controlado.",
    status: "SCHEDULED",
    start_time: "2026-06-06T14:00:00.000Z",
    end_time: "2026-06-06T18:00:00.000Z",
    participants_count: 17,
    max_participants: 50,
    entry_fee: {
      amount: 10,
      currency: "USD",
    },
    prize_pool: {
      amount: 500,
      currency: "USD",
    },
    sponsor_name: "Bullfy Clan League",
    rules: {
      market: "Metals",
      account_mode: "real",
      min_balance: 1000,
      allowed_assets: ["XAUUSD"],
    },
    prizes: [
      { place: 1, label: "Gold master", amount: 300, currency: "USD" },
      { place: 2, label: "Silver hand", amount: 140, currency: "USD" },
      { place: 3, label: "Bronze entry", amount: 60, currency: "USD" },
    ],
  },
];

export function getTournamentMockDtos(): ExternalTournamentDto[] {
  return [...createdTournamentMockDtos, ...tournamentMockDtos];
}

export function getTournamentMockDtoBySlug(
  slug: string,
): ExternalTournamentDto | undefined {
  return getTournamentMockDtos().find((item) => item.slug === slug);
}

export function createStoredMockTournamentDto(
  input: CreateTournamentInput,
): ExternalTournamentDto {
  const tournament = createMockTournamentDto(input);

  createdTournamentMockDtos.unshift(tournament);

  return tournament;
}

export function createMockTournamentDto(
  input: CreateTournamentInput,
): ExternalTournamentDto {
  const slug = slugify(input.name);
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}`;
  const entryFee =
    input.league === "bmoney"
      ? { amount: input.entryFeeBmoney, currency: "BULLFY" as const }
      : { amount: input.entryFeeUsd, currency: "USD" as const };
  const prizePoolAmount = Math.max(
    0,
    Math.round(
      input.maxParticipants *
        entryFee.amount *
        (1 - input.houseFeePct / 100),
    ),
  );

  return {
    tournament_id: `trn_${id}`,
    slug: ensureUniqueSlug(slug),
    title: input.name,
    summary: input.description,
    status: "SCHEDULED",
    start_time: input.startsAt,
    end_time: input.endsAt,
    participants_count: 0,
    max_participants: input.maxParticipants,
    entry_fee: entryFee,
    prize_pool: {
      amount: prizePoolAmount,
      currency: entryFee.currency,
    },
    sponsor_name: input.league === "elite" ? "Bullfy Elite" : "Bullfy Points",
    rules: {
      market: input.league === "elite" ? "Forex + Crypto" : "Forex",
      account_mode: input.allowsFundedMt5 ? "real" : "demo",
      min_balance: input.startingBalanceUsd,
      allowed_assets:
        input.league === "elite"
          ? ["EURUSD", "GBPUSD", "XAUUSD", "BTCUSD"]
          : ["EURUSD", "GBPUSD", "USDJPY"],
    },
    prizes: [
      {
        place: 1,
        label: "Champion",
        amount: Math.round(prizePoolAmount * 0.6),
        currency: entryFee.currency,
      },
      {
        place: 2,
        label: "Runner up",
        amount: Math.round(prizePoolAmount * 0.3),
        currency: entryFee.currency,
      },
      {
        place: 3,
        label: "Podium",
        amount: Math.max(
          0,
          prizePoolAmount -
            Math.round(prizePoolAmount * 0.6) -
            Math.round(prizePoolAmount * 0.3),
        ),
        currency: entryFee.currency,
      },
    ],
  };
}

function ensureUniqueSlug(slug: string): string {
  const fallback = slug || "torneo";
  const exists = getTournamentMockDtos().some((item) => item.slug === fallback);

  return exists ? `${fallback}-${Date.now().toString(36)}` : fallback;
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}
