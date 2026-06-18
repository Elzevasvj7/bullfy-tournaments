import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { queryOne, queryRows } from "@/lib/db/postgres";
import {
  fetchNowPaymentsPayment,
  getPaymentIntentIdFromOrderId,
  verifyNowPaymentsSignature,
} from "@/modules/wallet/services/nowpayments";
import {
  completeWalletTopUp,
  failPaymentIntent,
  getPaymentIntentById,
  updatePaymentIntentProviderStatus,
} from "@/modules/wallet/services/wallet.server";

export const runtime = "nodejs";

type NowPaymentsWebhookPayload = {
  invoice_id?: number | string;
  order_id?: string;
  payment_id?: number | string;
  payment_status?: string;
  price_amount?: number | string;
};

const completedStatuses = new Set(["confirmed", "finished"]);
const failedStatuses = new Set(["expired", "failed", "refunded"]);

export async function POST(request: Request) {
  const ipnSecret = process.env.NOWPAYMENTS_IPN_SECRET;

  if (!ipnSecret) {
    return NextResponse.json(
      { error: "NOWPAYMENTS_IPN_SECRET is missing." },
      { status: 500 },
    );
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-nowpayments-sig");

  if (!verifyNowPaymentsSignature({ ipnSecret, rawBody, signature })) {
    return NextResponse.json(
      { error: "Invalid NOWPayments signature." },
      { status: 401 },
    );
  }

  let payload: NowPaymentsWebhookPayload;

  try {
    payload = JSON.parse(rawBody) as NowPaymentsWebhookPayload;
  } catch {
    return NextResponse.json(
      { error: "Invalid NOWPayments webhook JSON." },
      { status: 400 },
    );
  }
  const eventKey = getWebhookEventKey(payload, rawBody);
  const insertedEvent = await queryOne<{ id: string }>(
    `
      insert into webhook_events (id, provider, event_key, headers, payload)
      values ($1, 'nowpayments', $2, $3::jsonb, $4::jsonb)
      on conflict (provider, event_key) do nothing
      returning id
    `,
    [
      `wh_${randomUUID()}`,
      eventKey,
      JSON.stringify(headersToObject(request.headers)),
      rawBody,
    ],
  );

  if (!insertedEvent) {
    return NextResponse.json({ duplicate: true, ok: true });
  }

  const paymentIntentId = getPaymentIntentIdFromOrderId(payload.order_id);

  if (!paymentIntentId) {
    await markWebhookProcessed(insertedEvent.id);

    return NextResponse.json(
      { error: "NOWPayments order_id is not a Bullfy wallet order." },
      { status: 202 },
    );
  }

  const paymentIntent = await getPaymentIntentById(paymentIntentId);

  if (!paymentIntent) {
    await markWebhookProcessed(insertedEvent.id);

    return NextResponse.json(
      { error: "Payment intent not found." },
      { status: 202 },
    );
  }

  const providerPaymentId = payload.payment_id?.toString();
  let providerStatus = payload.payment_status ?? "unknown";

  if (providerPaymentId) {
    const verifiedPayment = await fetchNowPaymentsPayment(providerPaymentId);
    const expectedAmount = Number(paymentIntent.amount_usd);
    providerStatus = verifiedPayment.status ?? providerStatus;

    if (verifiedPayment.orderId !== payload.order_id) {
      await markWebhookProcessed(insertedEvent.id);

      return NextResponse.json(
        { error: "NOWPayments order verification failed." },
        { status: 409 },
      );
    }

    if (
      verifiedPayment.priceAmount !== undefined &&
      Math.abs(verifiedPayment.priceAmount - expectedAmount) > 0.01
    ) {
      await failPaymentIntent({
        paymentIntentId,
        providerPaymentId,
        providerStatus: "amount_mismatch",
        rawPayload: payload,
      });
      await markWebhookProcessed(insertedEvent.id);

      return NextResponse.json(
        { error: "NOWPayments amount verification failed." },
        { status: 409 },
      );
    }
  }

  if (completedStatuses.has(providerStatus)) {
    await completeWalletTopUp({
      amountUsd: Number(paymentIntent.amount_usd),
      paymentIntentId,
      providerPaymentId,
      providerStatus,
      rawPayload: payload,
      traderId: paymentIntent.trader_id,
    });
    await markWebhookProcessed(insertedEvent.id);

    return NextResponse.json({ credited: true, ok: true });
  }

  if (failedStatuses.has(providerStatus)) {
    await failPaymentIntent({
      paymentIntentId,
      providerPaymentId,
      providerStatus,
      rawPayload: payload,
    });
  } else {
    await updatePaymentIntentProviderStatus({
      paymentIntentId,
      providerPaymentId,
      providerStatus,
      rawPayload: payload,
    });
  }

  await markWebhookProcessed(insertedEvent.id);

  return NextResponse.json({ ok: true, providerStatus });
}

async function markWebhookProcessed(webhookEventId: string) {
  await queryRows(
    `
      update webhook_events
      set processed_at = now()
      where id = $1
    `,
    [webhookEventId],
  );
}

function getWebhookEventKey(
  payload: NowPaymentsWebhookPayload,
  rawBody: string,
) {
  const naturalKey =
    payload.payment_id?.toString() ??
    payload.invoice_id?.toString() ??
    payload.order_id;

  if (naturalKey) {
    return `${naturalKey}:${payload.payment_status ?? "unknown"}`;
  }

  return createHash("sha256").update(rawBody).digest("hex");
}

function headersToObject(headers: Headers) {
  return Object.fromEntries(headers.entries());
}
