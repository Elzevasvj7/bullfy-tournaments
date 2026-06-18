import { NextResponse } from "next/server";
import { closeDemoPosition } from "@/modules/demo/tournament-demo.service";

type RouteContext = {
  params: Promise<{
    positionId: string;
    slug: string;
  }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { positionId, slug } = await context.params;

  try {
    const arena = await closeDemoPosition(slug, positionId);

    return NextResponse.json({ arena });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not close position",
      },
      { status: 500 },
    );
  }
}
