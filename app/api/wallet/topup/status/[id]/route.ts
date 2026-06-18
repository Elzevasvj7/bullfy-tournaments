import { NextResponse } from "next/server";
import { getCurrentDemoTraderId } from "@/modules/demo/demo-session";
import { getPaymentIntentForTrader } from "@/modules/wallet/services/wallet.server";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const traderId = await getCurrentDemoTraderId();
  const paymentIntent = await getPaymentIntentForTrader({
    paymentIntentId: id,
    traderId,
  });

  if (!paymentIntent) {
    return NextResponse.json(
      { error: "Payment intent not found." },
      { status: 404 },
    );
  }

  return NextResponse.json({
    amountUsd: Number(paymentIntent.amount_usd),
    createdAt: paymentIntent.created_at.toISOString(),
    invoiceUrl: paymentIntent.invoice_url,
    paymentIntentId: paymentIntent.id,
    providerInvoiceId: paymentIntent.provider_invoice_id,
    providerPaymentId: paymentIntent.provider_payment_id,
    providerStatus: paymentIntent.provider_status,
    status: paymentIntent.status,
  });
}
