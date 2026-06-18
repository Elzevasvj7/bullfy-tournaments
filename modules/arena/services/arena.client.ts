import type { ArenaState } from "../types";
import { getDemoArenaState } from "@/modules/demo/tournament-demo.service";
import { mapArenaState } from "./arena.mapper";
import { arenaMockDtos, createEmptyArenaMockDto } from "./arena.mock";

export async function getArenaState(
  tournamentSlug: string,
): Promise<ArenaState | null> {
  try {
    const demoArena = await getDemoArenaState(tournamentSlug);

    if (demoArena) {
      return demoArena;
    }
  } catch {
    // Local DB is optional for now. Keep the existing mock arena as fallback.
  }

  const arenaState = arenaMockDtos.find(
    (item) => item.tournament_slug === tournamentSlug,
  );

  return mapArenaState(arenaState ?? createEmptyArenaMockDto(tournamentSlug));
}
