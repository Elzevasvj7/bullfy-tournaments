import { NextResponse } from "next/server";
import { getDemoArenaState } from "@/modules/demo/tournament-demo.service";

type RouteContext = {
  params: Promise<{
    slug: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { slug } = await context.params;

  try {
    const arena = await getDemoArenaState(slug);

    if (!arena) {
      return NextResponse.json({ error: "Arena not found" }, { status: 404 });
    }

    return NextResponse.json({ arena });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not load arena state",
      },
      { status: 500 },
    );
  }
}
