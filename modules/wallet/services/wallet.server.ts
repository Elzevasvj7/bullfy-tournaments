import "server-only";

import { randomUUID } from "node:crypto";
import { getPostgresPool, queryOne, queryRows } from "@/lib/db/postgres";
import { getCurrentDemoTraderId } from "@/modules/demo/demo-session";
import type { WalletAccount, WalletMovement } from "../types";

type WalletAccountRow = {
  balance_usd: string;
  bullfy_points: string;
  claimable_rewards_usd: string;
  demo_balance: string;
  pending_rewards_usd: string;
  trader_id: string;
};

type WalletMovementRow = {
  amount_usd: string;
  created_at: Date;
  currency: "USD";
  description: string;
  id: string;
  movement_type: "topup" | "entry_fee" | "reward" | "adjustment";
  provider_status: string | null;
  status: "pending" | "completed" | "failed";
  title: string;
};

type PaymentIntentRow = {
  amount_usd: string;
  created_at: Date;
  id: string;
  invoice_url: string | null;
  provider_invoice_id: string | null;
  provider_payment_id: string | null;
  provider_status: string | null;
  status: "pending" | "completed" | "failed" | "expired" | "cancelled";
  trader_id: string;
};

export async function getWalletAccount(): Promise<WalletAccount> {
  const traderId = await getCurrentDemoTraderId();
  const [account, movements] = await Promise.all([
    getOrCreateWalletAccount(traderId),
    getWalletMovements(traderId),
  ]);

  return {
    balances: {
      bullfyPoints: Number(account.bullfy_points),
      claimableRewards: Number(account.claimable_rewards_usd),
      demoBalance: Number(account.demo_balance),
      pendingRewards: Number(account.pending_rewards_usd),
      realBalance: Number(account.balance_usd),
    },
    movements: movements.map(mapWalletMovement),
    paymentMethods: [
      {
        id: "method_nowpayments_sandbox",
        label: "NOWPayments Sandbox",
        lastFour: "TEST",
        network: "Crypto",
        status: "active",
      },
      {
        id: "method_demo_credit",
        label: "Demo Credit",
        lastFour: "DEMO",
        network: "Bullfy",
        status: "active",
      },
    ],
    traderId: account.trader_id,
  };
}

export async function createWalletTopUpIntent({
  amountUsd,
  traderId,
}: {
  amountUsd: number;
  traderId: string;
}) {
  await ensureWalletAccount(traderId);

  const paymentIntentId = `pay_${randomUUID()}`;

  await queryRows(
    `
      insert into payment_intents (
        id,
        trader_id,
        provider,
        purpose,
        amount_usd,
        status
      )
      values ($1, $2, 'nowpayments', 'wallet_topup', $3, 'pending')
    `,
    [paymentIntentId, traderId, amountUsd],
  );
  await queryRows(
    `
      insert into wallet_movements (
        id,
        trader_id,
        payment_intent_id,
        movement_type,
        status,
        amount_usd,
        currency,
        title,
        description,
        metadata
      )
      values (
        $1,
        $2,
        $3,
        'topup',
        'pending',
        $4,
        'USD',
        'Recarga NOWPayments',
        'Pago iniciado. Esperando confirmacion de la pasarela.',
        $5::jsonb
      )
      on conflict do nothing
    `,
    [
      `mov_${randomUUID()}`,
      traderId,
      paymentIntentId,
      amountUsd,
      JSON.stringify({ provider: "nowpayments" }),
    ],
  );

  return paymentIntentId;
}

export async function markTopUpInvoiceCreated({
  invoiceId,
  invoiceUrl,
  metadata,
  paymentIntentId,
}: {
  invoiceId: string;
  invoiceUrl: string;
  metadata: unknown;
  paymentIntentId: string;
}) {
  await queryRows(
    `
      update payment_intents
      set
        provider_invoice_id = $2,
        invoice_url = $3,
        metadata = metadata || $4::jsonb,
        updated_at = now()
      where id = $1
    `,
    [
      paymentIntentId,
      invoiceId,
      invoiceUrl,
      JSON.stringify({ invoice: metadata }),
    ],
  );
  await queryRows(
    `
      update wallet_movements
      set
        description = 'Invoice creado. Esperando pago confirmado.',
        metadata = metadata || $2::jsonb
      where payment_intent_id = $1 and movement_type = 'topup' and status = 'pending'
    `,
    [
      paymentIntentId,
      JSON.stringify({ invoiceId, invoiceUrl }),
    ],
  );
}

export async function markTopUpCreationFailed({
  error,
  paymentIntentId,
}: {
  error: string;
  paymentIntentId: string;
}) {
  await queryRows(
    `
      update payment_intents
      set
        status = 'failed',
        provider_status = 'invoice_creation_failed',
        metadata = metadata || $2::jsonb,
        updated_at = now()
      where id = $1
    `,
    [paymentIntentId, JSON.stringify({ error })],
  );
  await markTopUpMovementFailed({
    description: "No se pudo crear el invoice en NOWPayments.",
    metadata: { error },
    paymentIntentId,
  });
}

export async function getPaymentIntentForTrader({
  paymentIntentId,
  traderId,
}: {
  paymentIntentId: string;
  traderId: string;
}) {
  return queryOne<PaymentIntentRow>(
    `
      select
        id,
        trader_id,
        amount_usd::text,
        status,
        provider_invoice_id,
        provider_payment_id,
        provider_status,
        invoice_url,
        created_at
      from payment_intents
      where id = $1 and trader_id = $2
      limit 1
    `,
    [paymentIntentId, traderId],
  );
}

export async function getPaymentIntentById(paymentIntentId: string) {
  return queryOne<PaymentIntentRow>(
    `
      select
        id,
        trader_id,
        amount_usd::text,
        status,
        provider_invoice_id,
        provider_payment_id,
        provider_status,
        invoice_url,
        created_at
      from payment_intents
      where id = $1
      limit 1
    `,
    [paymentIntentId],
  );
}

export async function updatePaymentIntentProviderStatus({
  paymentIntentId,
  providerPaymentId,
  providerStatus,
  rawPayload,
}: {
  paymentIntentId: string;
  providerPaymentId?: string;
  providerStatus: string;
  rawPayload: unknown;
}) {
  await queryRows(
    `
      update payment_intents
      set
        provider_payment_id = coalesce($2, provider_payment_id),
        provider_status = $3,
        metadata = metadata || $4::jsonb,
        updated_at = now()
      where id = $1
    `,
    [
      paymentIntentId,
      providerPaymentId ?? null,
      providerStatus,
      JSON.stringify({ latestWebhook: rawPayload }),
    ],
  );
  await queryRows(
    `
      update wallet_movements
      set
        description = $2,
        metadata = metadata || $3::jsonb
      where payment_intent_id = $1 and movement_type = 'topup' and status = 'pending'
    `,
    [
      paymentIntentId,
      `Pago en proceso (${providerStatus}). Esperando confirmacion final.`,
      JSON.stringify({ providerPaymentId, providerStatus }),
    ],
  );
}

export async function failPaymentIntent({
  paymentIntentId,
  providerPaymentId,
  providerStatus,
  rawPayload,
}: {
  paymentIntentId: string;
  providerPaymentId?: string;
  providerStatus: string;
  rawPayload: unknown;
}) {
  await queryRows(
    `
      update payment_intents
      set
        provider_payment_id = coalesce($2, provider_payment_id),
        provider_status = $3,
        status = case
          when $3 = 'expired' then 'expired'
          when $3 = 'refunded' then 'cancelled'
          else 'failed'
        end,
        metadata = metadata || $4::jsonb,
        updated_at = now()
      where id = $1 and status = 'pending'
    `,
    [
      paymentIntentId,
      providerPaymentId ?? null,
      providerStatus,
      JSON.stringify({ latestWebhook: rawPayload }),
    ],
  );
  await markTopUpMovementFailed({
    description: `Pago no acreditado (${providerStatus}).`,
    metadata: { providerPaymentId, providerStatus },
    paymentIntentId,
  });
}

export async function completeWalletTopUp({
  amountUsd,
  paymentIntentId,
  providerPaymentId,
  providerStatus,
  rawPayload,
  traderId,
}: {
  amountUsd: number;
  paymentIntentId: string;
  providerPaymentId?: string;
  providerStatus: string;
  rawPayload: unknown;
  traderId: string;
}) {
  const db = await getPostgresPool().connect();

  try {
    await db.query("begin");
    const intentResult = await db.query<PaymentIntentRow>(
      `
        select
          id,
          trader_id,
          amount_usd::text,
          status,
          provider_invoice_id,
          provider_payment_id,
          provider_status,
          invoice_url,
          created_at
        from payment_intents
        where id = $1
        for update
      `,
      [paymentIntentId],
    );
    const intent = intentResult.rows[0];

    if (!intent || intent.status !== "pending" || intent.trader_id !== traderId) {
      await db.query("commit");
      return { credited: false };
    }

    await db.query(
      `
        insert into wallet_accounts (trader_id)
        values ($1)
        on conflict (trader_id) do nothing
      `,
      [traderId],
    );
    await db.query(
      `
        update wallet_accounts
        set
          balance_usd = balance_usd + $2,
          updated_at = now()
        where trader_id = $1
      `,
      [traderId, amountUsd],
    );
    await db.query(
      `
        insert into wallet_movements (
          id,
          trader_id,
          payment_intent_id,
          movement_type,
          status,
          amount_usd,
          currency,
          title,
          description,
          metadata
        )
        values (
          $1,
          $2,
          $3,
          'topup',
          'completed',
          $4,
          'USD',
          'Recarga NOWPayments',
          'Recarga acreditada al balance real.',
          $5::jsonb
        )
        on conflict (payment_intent_id)
        where payment_intent_id is not null and movement_type = 'topup'
        do update set
          status = 'completed',
          amount_usd = excluded.amount_usd,
          currency = excluded.currency,
          title = excluded.title,
          description = excluded.description,
          metadata = wallet_movements.metadata || excluded.metadata
      `,
      [
        `mov_${randomUUID()}`,
        traderId,
        paymentIntentId,
        amountUsd,
        JSON.stringify({ providerPaymentId, providerStatus }),
      ],
    );
    await db.query(
      `
        update payment_intents
        set
          status = 'completed',
          provider_payment_id = coalesce($2, provider_payment_id),
          provider_status = $3,
          metadata = metadata || $4::jsonb,
          completed_at = now(),
          updated_at = now()
        where id = $1
      `,
      [
        paymentIntentId,
        providerPaymentId ?? null,
        providerStatus,
        JSON.stringify({ latestWebhook: rawPayload }),
      ],
    );
    await db.query("commit");

    return { credited: true };
  } catch (error) {
    await db.query("rollback");
    throw error;
  } finally {
    db.release();
  }
}

async function markTopUpMovementFailed({
  description,
  metadata,
  paymentIntentId,
}: {
  description: string;
  metadata: Record<string, unknown>;
  paymentIntentId: string;
}) {
  await queryRows(
    `
      update wallet_movements
      set
        status = 'failed',
        description = $2,
        metadata = metadata || $3::jsonb
      where payment_intent_id = $1 and movement_type = 'topup' and status = 'pending'
    `,
    [paymentIntentId, description, JSON.stringify(metadata)],
  );
}

async function getOrCreateWalletAccount(traderId: string) {
  await ensureWalletAccount(traderId);

  const account = await queryOne<WalletAccountRow>(
    `
      select
        trader_id,
        balance_usd::text,
        demo_balance::text,
        bullfy_points::text,
        pending_rewards_usd::text,
        claimable_rewards_usd::text
      from wallet_accounts
      where trader_id = $1
      limit 1
    `,
    [traderId],
  );

  if (!account) {
    throw new Error("Wallet account could not be created.");
  }

  return account;
}

async function getWalletMovements(traderId: string) {
  return queryRows<WalletMovementRow>(
    `
      select
        wm.id,
        wm.movement_type,
        wm.status,
        wm.title,
        wm.description,
        wm.amount_usd::text,
        wm.currency,
        wm.created_at,
        pi.provider_status
      from wallet_movements wm
      left join payment_intents pi on pi.id = wm.payment_intent_id
      where wm.trader_id = $1
      order by wm.created_at desc
      limit 30
    `,
    [traderId],
  );
}

async function ensureWalletAccount(traderId: string) {
  await queryRows(
    `
      insert into wallet_accounts (trader_id)
      values ($1)
      on conflict (trader_id) do nothing
    `,
    [traderId],
  );
}

function mapWalletMovement(row: WalletMovementRow): WalletMovement {
  const type =
    row.movement_type === "topup"
      ? "deposit"
      : row.movement_type === "entry_fee"
        ? "entryFee"
        : row.movement_type;

  return {
    amount: Number(row.amount_usd),
    createdAt: row.created_at.toISOString(),
    currency: row.currency,
    description: row.description,
    id: row.id,
    status: row.status,
    title: row.title,
    type,
  };
}
