"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  getDemoTournamentBySlug,
  getDemoTournaments,
} from "@/modules/demo/tournament-demo.service";
import type { Tournament } from "../types";
import { mapTournament } from "./tournament.mapper";
import {
  getTournamentMockDtoBySlug,
  getTournamentMockDtos,
} from "./tournament.mock";

export async function getTournamentsAction(): Promise<Tournament[]> {
  try {
    const demoTournaments = await getDemoTournaments();

    if (demoTournaments.length > 0) {
      return demoTournaments;
    }
  } catch {
    // Local Postgres demo DB is optional; continue with Supabase/mock fallback.
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("tournaments")
      .select(
        "id, slug, name, description, type, modality, status, starts_at, ends_at, entry_fee_usd, max_participants, banner_url, prize_pool_usd, bullfy_points_pool",
      );
    if (error) {
      return getTournamentMockDtos().map(mapTournament);
    }

    return data.length > 0
      ? data.map(mapTournament)
      : getTournamentMockDtos().map(mapTournament);
  } catch {
    return getTournamentMockDtos().map(mapTournament);
  }
}

export async function getTournamentBySlugAction(
  slug: string,
): Promise<Tournament | null> {
  try {
    const demoTournament = await getDemoTournamentBySlug(slug);

    if (demoTournament) {
      return demoTournament;
    }
  } catch {
    // Local Postgres demo DB is optional; continue with Supabase/mock fallback.
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data: tour } = await supabase
      .from("tournaments")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();

    return tour
      ? mapTournament(tour)
      : mapMockTournamentBySlug(slug);
  } catch {
    return mapMockTournamentBySlug(slug);
  }
}

function mapMockTournamentBySlug(slug: string): Tournament | null {
  const tournament = getTournamentMockDtoBySlug(slug);

  return tournament ? mapTournament(tournament) : null;
}
