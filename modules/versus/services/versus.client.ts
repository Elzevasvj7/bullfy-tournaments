import type { CreateVersusInput, VersusChallenge, VersusDashboard } from "../types";
import {
  currentVersusUserId,
  getVersusDashboardMock,
  versusTradersMock,
} from "./versus.mock";

export async function getVersusDashboard(): Promise<VersusDashboard> {
  return getVersusDashboardMock();
}

export async function createVersusChallenge(
  input: CreateVersusInput,
): Promise<VersusChallenge> {
  const challenger = versusTradersMock.find(
    (trader) => trader.id === currentVersusUserId,
  )!;
  const opponent = input.opponentUsername
    ? versusTradersMock.find(
        (trader) =>
          trader.username.toLowerCase() ===
          input.opponentUsername?.replace("@", "").toLowerCase(),
      )
    : undefined;

  return {
    id: `versus_${Date.now().toString(36)}`,
    challenger,
    challengerScore: 0,
    createdAt: new Date().toISOString(),
    durationMinutes: input.durationMinutes,
    inviteToken: `vs_${Date.now().toString(36)}`,
    message: input.message,
    opponent,
    opponentEmail: input.opponentEmail,
    opponentScore: 0,
    opponentUsernameHint: input.opponentUsername,
    stakeUsd: input.stakeUsd,
    status: "pending",
  };
}
