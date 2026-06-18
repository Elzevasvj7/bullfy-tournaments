import type {
  CreateTournamentInput,
  Tournament,
  TournamentStatus,
} from "../types";
import type {
  ExternalCreateTournamentRequestDto,
  ExternalTournamentDto,
  ExternalTournamentStatus,
} from "./tournament.contracts";

const statusMap: Record<ExternalTournamentStatus, TournamentStatus> = {
  DRAFT: "draft",
  SCHEDULED: "upcoming",
  RUNNING: "live",
  COMPLETED: "finished",
};

export function mapTournament(dto: ExternalTournamentDto): Tournament {
  const entryCurrency =
    dto.entry_fee?.currency ??
    (dto.league === "bmoney" || dto.entry_fee_bmoney !== undefined
      ? "BULLFY"
      : "USD");
  const entryFee =
    dto.entry_fee?.amount ??
    (entryCurrency === "BULLFY"
      ? (dto.entry_fee_bmoney ?? 0)
      : (dto.entry_fee_usd ?? 0));
  const prizeCurrency = dto.prize_pool?.currency ?? entryCurrency;

  return {
    id: dto.id ?? dto.tournament_id ?? dto.slug,
    slug: dto.slug,
    name: dto.name ?? dto.title ?? dto.slug,
    description: dto.description ?? dto.summary ?? "",
    status: statusMap[dto.status as ExternalTournamentStatus],
    startsAt: dto.starts_at ?? dto.start_time ?? "",
    endsAt: dto.ends_at ?? dto.end_time ?? "",
    participantsCount: dto.participants_count ?? 0,
    entryFee,
    entryFeeBmoney: dto.entry_fee_bmoney ?? 0,
    entryFeeUsd: dto.entry_fee_usd ?? 0,
    entryCurrency,
    prizePool: dto.prize_pool?.amount ?? dto.prize_pool_usd ?? 0,
    prizeCurrency,
    sponsor: dto.sponsor_name ?? "Bullfy Tournament",
    rules: {
      market: dto.rules?.market ?? "Forex + Crypto",
      accountMode: dto.rules?.account_mode ?? "demo",
      maxParticipants: dto.max_participants,
      minBalance: dto.rules?.min_balance ?? 10000,
      allowedAssets: dto.rules?.allowed_assets ?? ["EURUSD", "GBPUSD", "XAUUSD"],
    },
    prizes:
      dto.prizes?.map((prize) => ({
        position: prize.place,
        label: prize.label,
        amount: prize.amount,
        currency: prize.currency,
      })) ?? [],
  };
}

export function mapCreateTournamentRequest(
  input: CreateTournamentInput,
): ExternalCreateTournamentRequestDto {
  return {
    name: input.name,
    description: input.description,
    modality: input.modality,
    starts_at: input.startsAt,
    ends_at: input.endsAt,
    registration_closes_at: input.startsAt,
    timezone: input.timezone,
    max_participants: input.maxParticipants,
    starting_balance_usd: input.startingBalanceUsd,
    league: input.league,
    house_fee_pct: input.houseFeePct,
    ...(input.league === "bmoney"
      ? { entry_fee_bmoney: input.entryFeeBmoney }
      : {
          allows_funded_mt5: input.allowsFundedMt5,
          entry_fee_usd: input.entryFeeUsd,
          min_funded_equity_usd: input.allowsFundedMt5
            ? input.minFundedEquityUsd
            : undefined,
        }),
  };
}
