import { bullfyEnv } from "@/shared/config";
import { httpClient } from "@/shared/services/http-client";
import type { CreateTournamentInput, Tournament } from "../types";
import type { ExternalCreateTournamentResponseDto } from "./tournament.contracts";
import {
  mapCreateTournamentRequest,
  mapTournament,
} from "./tournament.mapper";
import {
  getTournamentMockDtoBySlug,
  getTournamentMockDtos,
} from "./tournament.mock";

export async function getTournaments(): Promise<Tournament[]> {
  return getTournamentMockDtos().map(mapTournament);
}

export async function getTournamentBySlug(
  slug: string,
): Promise<Tournament | null> {
  const tournament = getTournamentMockDtoBySlug(slug);
    
  return tournament ? mapTournament(tournament) : null;
}

export async function createTournament(
  input: CreateTournamentInput,
): Promise<Tournament> {
  const payload = mapCreateTournamentRequest(input);

  if (bullfyEnv.apiBaseUrl) {
    const response =
      await httpClient.post<ExternalCreateTournamentResponseDto>(
        "/tournaments",
        payload,
      );

    return mapTournament(response.tournament);
  }

  const response = await fetch("/api/tournaments", {
    body: JSON.stringify(input),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("Mock tournament create failed");
  }

  const body = (await response.json()) as ExternalCreateTournamentResponseDto;

  return isTournament(body.tournament)
    ? body.tournament
    : mapTournament(body.tournament);
}

function isTournament(value: unknown): value is Tournament {
  if (!value || typeof value !== "object") {
    return false;
  }

  return (
    "startsAt" in value &&
    "endsAt" in value &&
    "participantsCount" in value
  );
}
