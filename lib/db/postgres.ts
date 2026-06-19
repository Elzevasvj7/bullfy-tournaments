import "server-only";

import { Pool, type QueryResultRow } from "pg";

declare global {
  var bullfyPgPool: Pool | undefined;
}

function getDatabaseUrl() {
  return process.env.DATABASE_URL;
}

function getPoolMax() {
  const configuredMax = Number(process.env.POSTGRES_POOL_MAX);

  if (Number.isInteger(configuredMax) && configuredMax > 0) {
    return configuredMax;
  }

  return 2;
}

function shouldUseSsl(databaseUrl: string | undefined) {
  if (!databaseUrl) {
    return false;
  }

  const url = new URL(databaseUrl);
  const host = url.hostname.toLowerCase();

  return !["localhost", "127.0.0.1", "::1"].includes(host);
}

export function getPostgresPool() {
  if (!globalThis.bullfyPgPool) {
    const databaseUrl = getDatabaseUrl();

    globalThis.bullfyPgPool = new Pool({
      connectionString: databaseUrl,
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 10_000,
      max: getPoolMax(),
      ssl: shouldUseSsl(databaseUrl) ? { rejectUnauthorized: false } : undefined,
    });
  }

  return globalThis.bullfyPgPool;
}

export async function queryRows<Row extends QueryResultRow>(
  text: string,
  values: unknown[] = [],
): Promise<Row[]> {
  const result = await getPostgresPool().query<Row>(text, values);

  return result.rows;
}

export async function queryOne<Row extends QueryResultRow>(
  text: string,
  values: unknown[] = [],
): Promise<Row | null> {
  const rows = await queryRows<Row>(text, values);

  return rows[0] ?? null;
}
