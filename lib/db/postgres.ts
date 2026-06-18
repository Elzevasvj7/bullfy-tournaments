import "server-only";

import { Pool, type QueryResultRow } from "pg";

declare global {
  var bullfyPgPool: Pool | undefined;
}

function getDatabaseUrl() {
  return (
    process.env.DATABASE_URL ??
    "postgres://bullfy:bullfy_dev@localhost:54329/bullfy_tournaments"
  );
}

export function getPostgresPool() {
  if (!globalThis.bullfyPgPool) {
    globalThis.bullfyPgPool = new Pool({
      connectionString: getDatabaseUrl(),
      max: 8,
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
