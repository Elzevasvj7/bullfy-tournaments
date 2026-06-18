import { NextResponse } from "next/server";
import { createDemoTournament } from "@/modules/demo/tournament-demo.service";
import type { CreateTournamentInput } from "@/modules/tournaments";
import { createStoredMockTournamentDto } from "@/modules/tournaments/services/tournament.mock";

export async function POST(request: Request) {
  const input = (await request.json()) as CreateTournamentInput;

  try {
    const tournament = await createDemoTournament(input);

    return NextResponse.json({ tournament });
  } catch {
    // Local Postgres demo DB is optional; keep the existing mock fallback.
  }

  const tournament = createStoredMockTournamentDto(input);

  return NextResponse.json({ tournament });
}
