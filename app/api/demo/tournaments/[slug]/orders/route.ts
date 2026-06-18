import { NextResponse } from "next/server";
import { openDemoTrade } from "@/modules/demo/tournament-demo.service";

type RouteContext = {
  params: Promise<{
    slug: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { slug } = await context.params;

  try {
    const body = (await request.json()) as {
      symbol?: string;
      side?: "buy" | "sell";
      volume?: number;
      price?: number;
      stopLoss?: number;
      takeProfit?: number;
    };

    if (!body.symbol || !body.side || !body.volume) {
      return NextResponse.json(
        { error: "symbol, side and volume are required" },
        { status: 400 },
      );
    }

    const arena = await openDemoTrade(slug, {
      price: body.price,
      side: body.side,
      stopLoss: body.stopLoss,
      symbol: body.symbol,
      takeProfit: body.takeProfit,
      volume: body.volume,
    });

    return NextResponse.json({ arena });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Could not open order",
      },
      { status: 500 },
    );
  }
}
