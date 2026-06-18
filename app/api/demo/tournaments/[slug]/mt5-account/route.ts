import { NextResponse } from "next/server";
import {
  ensureDemoMt5Account,
  getDemoArenaState,
} from "@/modules/demo/tournament-demo.service";

type RouteContext = {
  params: Promise<{
    slug: string;
  }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { slug } = await context.params;

  try {
    await ensureDemoMt5Account(slug);
    const arena = await getDemoArenaState(slug);

    return NextResponse.json({ arena });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not create account",
      },
      { status: 500 },
    );
  }
}
