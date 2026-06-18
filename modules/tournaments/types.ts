export type TournamentStatus = "draft" | "upcoming" | "live" | "finished";

export type TournamentLeague = "bmoney" | "elite";

export type TournamentModality = "standard";

export type TournamentPrize = {
  position: number;
  label: string;
  amount: number;
  currency: "USD" | "BULLFY";
};

export type TournamentRules = {
  market: string;
  accountMode: "demo" | "real";
  maxParticipants: number;
  minBalance: number;
  allowedAssets: string[];
};

export type Tournament = {
  id: string;
  slug: string;
  name: string;
  description: string;
  status: TournamentStatus;
  startsAt: string;
  endsAt: string;
  participantsCount: number;
  entryFee: number;
  entryFeeBmoney: number;
  entryFeeUsd: number;
  entryCurrency: "USD" | "BULLFY";
  prizePool: number;
  prizeCurrency: "USD" | "BULLFY";
  sponsor: string;
  rules: TournamentRules;
  prizes: TournamentPrize[];
};

export type CreateTournamentInput = {
  name: string;
  description: string;
  modality: TournamentModality;
  startsAt: string;
  endsAt: string;
  timezone: string;
  maxParticipants: number;
  startingBalanceUsd: number;
  league: TournamentLeague;
  entryFeeBmoney: number;
  entryFeeUsd: number;
  allowsFundedMt5: boolean;
  minFundedEquityUsd: number;
  houseFeePct: number;
};
