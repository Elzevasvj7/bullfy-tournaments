import { NextResponse } from "next/server";
import { getCurrentDemoTraderId } from "@/modules/demo/demo-session";
import {
  createNowPaymentsInvoice,
  getTopUpAmountUsd,
  NowPaymentsApiError,
  NowPaymentsConfigError,
} from "@/modules/wallet/services/nowpayments";
import {
  createWalletTopUpIntent,
  markTopUpCreationFailed,
  markTopUpInvoiceCreated,
} from "@/modules/wallet/services/wallet.server";

export const runtime = "nodejs";

export async function POST() {
  const traderId = await getCurrentDemoTraderId();
  const amountUsd = getTopUpAmountUsd();
  const paymentIntentId = await createWalletTopUpIntent({ amountUsd, traderId });

  try {
    const invoice = await createNowPaymentsInvoice({
      amountUsd,
      paymentIntentId,
    });

    await markTopUpInvoiceCreated({
      invoiceId: invoice.id,
      invoiceUrl: invoice.invoiceUrl,
      metadata: invoice.raw,
      paymentIntentId,
    });

    return NextResponse.json({
      amountUsd,
      invoiceUrl: invoice.invoiceUrl,
      paymentIntentId,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invoice creation failed.";

    await markTopUpCreationFailed({
      error: message,
      paymentIntentId,
    });

    if (error instanceof NowPaymentsConfigError) {
      return NextResponse.json(
        {
          error: error.message,
          paymentIntentId,
        },
        { status: 503 },
      );
    }

    if (error instanceof NowPaymentsApiError) {
      return NextResponse.json(
        {
          error: error.message,
          paymentIntentId,
        },
        { status: error.status >= 400 ? 502 : 500 },
      );
    }

    return NextResponse.json(
      {
        error: "Could not create NOWPayments invoice.",
        paymentIntentId,
      },
      { status: 500 },
    );
  }
}
