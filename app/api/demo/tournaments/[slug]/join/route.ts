import { NextResponse } from "next/server";
import { joinDemoTournament } from "@/modules/demo/tournament-demo.service";

type RouteContext = {
  params: Promise<{
    slug: string;
  }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { slug } = await context.params;

  try {
    const arena = await joinDemoTournament(slug);

    return NextResponse.json({ arena });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Could not join arena",
      },
      { status: 500 },
    );
  }
}
