import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

export type NowPaymentsEnvironment = "sandbox" | "live";

export type NowPaymentsInvoice = {
  id: string;
  invoiceUrl: string;
  raw: unknown;
};

export type NowPaymentsPayment = {
  actuallyPaid?: number;
  orderId?: string;
  paymentId?: string;
  priceAmount?: number;
  priceCurrency?: string;
  status?: string;
  raw: unknown;
};

type NowPaymentsInvoiceResponse = {
  id?: string | number;
  invoice_url?: string;
  payment_id?: string | number;
  message?: string;
};

type NowPaymentsPaymentResponse = {
  actually_paid?: number | string;
  actually_paid_at_fiat?: number | string;
  order_id?: string;
  payment_id?: string | number;
  payment_status?: string;
  price_amount?: number | string;
  price_currency?: string;
};

export class NowPaymentsConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NowPaymentsConfigError";
  }
}

export class NowPaymentsApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly payload: unknown,
  ) {
    super(message);
    this.name = "NowPaymentsApiError";
  }
}

export function getTopUpAmountUsd() {
  const configuredAmount = Number(process.env.NOWPAYMENTS_TOPUP_AMOUNT_USD);

  if (Number.isFinite(configuredAmount) && configuredAmount > 0) {
    return Number(configuredAmount.toFixed(2));
  }

  return 20;
}

export function getNowPaymentsOrderId(paymentIntentId: string) {
  return `bullfy-wallet:${paymentIntentId}`;
}

export function getPaymentIntentIdFromOrderId(orderId: string | undefined) {
  const prefix = "bullfy-wallet:";

  if (!orderId?.startsWith(prefix)) {
    return null;
  }

  return orderId.slice(prefix.length);
}

export async function createNowPaymentsInvoice({
  amountUsd,
  paymentIntentId,
}: {
  amountUsd: number;
  paymentIntentId: string;
}): Promise<NowPaymentsInvoice> {
  const config = getNowPaymentsConfig();
  const orderId = getNowPaymentsOrderId(paymentIntentId);
  const successUrl = `${config.appUrl}/wallet?payment=success&pid=${encodeURIComponent(
    paymentIntentId,
  )}`;
  const cancelUrl = `${config.appUrl}/wallet?payment=cancel&pid=${encodeURIComponent(
    paymentIntentId,
  )}`;

  const response = await fetch(`${config.baseUrl}/invoice`, {
    body: JSON.stringify({
      cancel_url: cancelUrl,
      ipn_callback_url: `${config.appUrl}/api/webhooks/nowpayments`,
      is_fee_paid_by_user: true,
      is_fixed_rate: true,
      order_description: `Bullfy wallet top-up ${amountUsd.toFixed(2)} USD`,
      order_id: orderId,
      price_amount: amountUsd,
      price_currency: "usd",
      success_url: successUrl,
    }),
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      "x-api-key": config.apiKey,
    },
    method: "POST",
  });

  const payload = (await response.json().catch(() => null)) as
    | NowPaymentsInvoiceResponse
    | null;

  if (!response.ok) {
    throw new NowPaymentsApiError(
      payload?.message ?? "NOWPayments rejected the invoice request.",
      response.status,
      payload,
    );
  }

  const invoiceId = payload?.id?.toString();
  const invoiceUrl = payload?.invoice_url;

  if (!invoiceId || !invoiceUrl) {
    throw new NowPaymentsApiError(
      "NOWPayments response did not include an invoice id and URL.",
      response.status,
      payload,
    );
  }

  return {
    id: invoiceId,
    invoiceUrl,
    raw: payload,
  };
}

export async function fetchNowPaymentsPayment(
  paymentId: string,
): Promise<NowPaymentsPayment> {
  const config = getNowPaymentsConfig();
  const response = await fetch(`${config.baseUrl}/payment/${paymentId}`, {
    cache: "no-store",
    headers: {
      "x-api-key": config.apiKey,
    },
  });
  const payload = (await response.json().catch(() => null)) as
    | NowPaymentsPaymentResponse
    | null;

  if (!response.ok) {
    throw new NowPaymentsApiError(
      "Could not verify NOWPayments payment status.",
      response.status,
      payload,
    );
  }

  return {
    actuallyPaid: toNumber(
      payload?.actually_paid_at_fiat ?? payload?.actually_paid,
    ),
    orderId: payload?.order_id,
    paymentId: payload?.payment_id?.toString(),
    priceAmount: toNumber(payload?.price_amount),
    priceCurrency: payload?.price_currency?.toLowerCase(),
    raw: payload,
    status: payload?.payment_status,
  };
}

export function verifyNowPaymentsSignature({
  ipnSecret,
  rawBody,
  signature,
}: {
  ipnSecret: string;
  rawBody: string;
  signature: string | null;
}) {
  if (!signature) {
    return false;
  }

  let payload: unknown;

  try {
    payload = JSON.parse(rawBody);
  } catch {
    return false;
  }

  const expected = createHmac("sha512", ipnSecret)
    .update(JSON.stringify(sortSignaturePayload(payload)))
    .digest("hex");
  const provided = signature.toLowerCase();

  if (expected.length !== provided.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
}

function getNowPaymentsConfig() {
  const apiKey = process.env.NOWPAYMENTS_API_KEY;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "");
  const environment: NowPaymentsEnvironment =
    process.env.NOWPAYMENTS_ENV === "live" ? "live" : "sandbox";

  if (!apiKey) {
    throw new NowPaymentsConfigError("NOWPAYMENTS_API_KEY is missing.");
  }

  if (!appUrl) {
    throw new NowPaymentsConfigError("NEXT_PUBLIC_APP_URL is missing.");
  }

  return {
    apiKey,
    appUrl,
    baseUrl:
      environment === "live"
        ? "https://api.nowpayments.io/v1"
        : "https://api-sandbox.nowpayments.io/v1",
    environment,
  };
}

function sortSignaturePayload(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortSignaturePayload);
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;

    return Object.fromEntries(
      Object.entries(record)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nestedValue]) => [key, sortSignaturePayload(nestedValue)]),
    );
  }

  return value;
}

function toNumber(value: number | string | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === "string") {
    const numericValue = Number(value);

    return Number.isFinite(numericValue) ? numericValue : undefined;
  }

  return undefined;
}
