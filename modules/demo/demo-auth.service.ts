import "server-only";

import { queryOne } from "@/lib/db/postgres";
import { setDemoSession } from "./demo-session";

type DemoAuthTraderRow = {
  id: string;
  name: string;
  email: string;
  handle: string;
  login: string | null;
  password: string | null;
};

export async function loginDemoTrader(identifier: string, password: string) {
  const normalized = identifier.trim().toLowerCase();

  if (!normalized || !password) {
    return null;
  }

  const trader = await queryOne<DemoAuthTraderRow>(
    `
      select id, name, email, handle, login, password
      from demo_traders
      where lower(coalesce(login, '')) = $1
        or lower(email) = $1
        or lower(handle) = $1
      limit 1
    `,
    [normalized],
  );

  if (!trader || trader.password !== password) {
    return null;
  }

  await setDemoSession({
    email: trader.email,
    login: trader.login ?? trader.handle,
    name: trader.name,
    traderId: trader.id,
  });

  return trader;
}
