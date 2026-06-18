import "server-only";

import { getPostgresPool, queryOne, queryRows } from "@/lib/db/postgres";
import type { ArenaState } from "@/modules/arena";
import { createMt5BridgeClient } from "@/modules/mt5/bridge.client";
import type { Mt5OpenOrderInput } from "@/modules/mt5";
import type { Mt5Position } from "@/modules/mt5/types";
import type { CreateTournamentInput, Tournament } from "@/modules/tournaments";
import { getCurrentDemoTraderId } from "./demo-session";

type TournamentRow = {
  id: string;
  slug: string;
  name: string;
  description: string;
  status: string;
  starts_at: Date;
  ends_at: Date;
  league: string;
  entry_fee_bmoney: string;
  entry_fee_usd: string;
  timezone: string;
  prize_pool: string;
  max_participants: number;
  initial_balance: string;
  max_drawdown_pct: string;
  max_daily_loss_pct: string;
  max_open_positions: number;
  max_total_lots: string;
  allowed_symbols: string[];
  participants_count: string;
};

type ParticipantRow = {
  id: string;
  trader_id: string;
  trader_name: string;
  clan: string | null;
  rank: number;
  score_pct: string;
  pnl: string;
  balance: string;
  trades_count: number;
  win_rate_pct: string;
};

type DemoParticipantRow = ParticipantRow & {
  tournament_id: string;
  trader_email: string;
  trader_password: string | null;
  mt5_login: string | null;
  mt5_password: string | null;
};

type DemoTraderRow = {
  id: string;
  name: string;
  email: string;
  clan: string | null;
  mt5_login: string | null;
  mt5_password: string | null;
};

type Mt5AccountRow = {
  id: string;
  login: string | null;
  server: string;
  status: string;
  balance: string;
  equity: string;
  margin: string;
  free_margin: string;
  margin_level_pct: string;
};

type PositionRow = {
  id: string;
  bridge_deal_id?: string | null;
  bridge_position_id: string | null;
  symbol: string;
  side: string;
  volume: string;
  entry_price: string;
  current_price: string;
  stop_loss: string | null;
  take_profit: string | null;
  pnl: string;
  pnl_pct: string;
  opened_at: Date;
};

type EventRow = {
  id: string;
  trader_name: string;
  message: string;
  asset: string;
  pnl_pct: string;
  created_at: Date;
};

export type DemoOpenTradeInput = {
  symbol: string;
  side: "buy" | "sell";
  volume: number;
  price?: number;
  stopLoss?: number;
  takeProfit?: number;
};

export async function getDemoTournaments(): Promise<Tournament[]> {
  const rows = await queryRows<TournamentRow>(`
    select
      t.*,
      count(p.id)::text as participants_count
    from demo_tournaments t
    left join demo_tournament_participants p on p.tournament_id = t.id
    group by t.id
    order by t.starts_at desc
  `);

  return rows.map(mapTournamentRow);
}

export async function getDemoTournamentBySlug(
  slug: string,
): Promise<Tournament | null> {
  const row = await queryOne<TournamentRow>(
    `
      select
        t.*,
        count(p.id)::text as participants_count
      from demo_tournaments t
      left join demo_tournament_participants p on p.tournament_id = t.id
      where t.slug = $1
      group by t.id
    `,
    [slug],
  );

  return row ? mapTournamentRow(row) : null;
}

export async function createDemoTournament(
  input: CreateTournamentInput,
): Promise<Tournament> {
  const id = `tournament_${crypto.randomUUID()}`;
  const slug = await createUniqueTournamentSlug(input.name);
  const prizePool = calculatePrizePool(input);
  const status = mapDemoStatusFromDates(input.startsAt, input.endsAt);

  const row = await queryOne<TournamentRow>(
    `
      insert into demo_tournaments (
        id,
        slug,
        name,
        description,
        status,
        starts_at,
        ends_at,
        league,
        entry_fee_bmoney,
        entry_fee_usd,
        timezone,
        prize_pool,
        max_participants,
        initial_balance,
        max_drawdown_pct,
        max_daily_loss_pct,
        max_open_positions,
        max_total_lots,
        allowed_symbols
      ) values (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, 8, 4, 3, 2, array['EURUSD', 'GBPUSD', 'XAUUSD']
      )
      returning *, '0'::text as participants_count
    `,
    [
      id,
      slug,
      input.name,
      input.description,
      status,
      input.startsAt,
      input.endsAt,
      input.league,
      input.entryFeeBmoney,
      input.entryFeeUsd,
      input.timezone,
      prizePool,
      input.maxParticipants,
      input.startingBalanceUsd,
    ],
  );

  if (!row) {
    throw new Error("Could not create demo tournament");
  }

  return mapTournamentRow(row);
}

export async function getDemoArenaState(
  slug: string,
): Promise<ArenaState | null> {
  const tournament = await getTournamentRow(slug);

  if (!tournament) {
    return null;
  }

  const currentTraderId = await getCurrentDemoTraderId();
  const participants = await getParticipants(tournament.id);
  const participant = participants.find(
    (item) => item.trader_id === currentTraderId,
  );
  const account = participant
    ? await ensureMt5Account(participant.id, Number(tournament.initial_balance))
    : null;
  const positions = participant && account
    ? await getSyncedOpenPositions(participant.id, account)
    : [];
  const events = await getEvents(tournament.id);

  return {
    activity: events.map((event) => ({
      asset: event.asset,
      id: event.id,
      message: event.message,
      occurredAt: event.created_at.toISOString(),
      pnlPercent: Number(event.pnl_pct),
      traderName: event.trader_name,
    })),
    metrics: [
      {
        label: "Volumen total",
        trend: "up",
        value: `$${Math.round(sumPositionsVolume(positions) * 100000).toLocaleString("en-US")}`,
      },
      {
        label: "Trades activos",
        trend: "flat",
        value: String(positions.length),
      },
      {
        label: "Drawdown max",
        trend: "down",
        value: `${Number(tournament.max_drawdown_pct).toFixed(0)}%`,
      },
      {
        label: "Lotaje max",
        trend: "flat",
        value: String(Number(tournament.max_total_lots)),
      },
    ],
    mt5Account: account
      ? {
          balance: Number(account.balance),
          equity: Number(account.equity),
          freeMargin: Number(account.free_margin),
          login: account.login ?? "-",
          margin: Number(account.margin),
          marginLevelPercent: Number(account.margin_level_pct),
          server: account.server,
          status: mapAccountStatus(account.status),
        }
      : {
          balance: Number(tournament.initial_balance),
          equity: Number(tournament.initial_balance),
          freeMargin: Number(tournament.initial_balance),
          login: "-",
          margin: 0,
          marginLevelPercent: 0,
          server: "Bullfy-Bridge",
          status: "disconnected",
        },
    openPositions: positions.map((position) => ({
      currentPrice: Number(position.current_price),
      entryPrice: Number(position.entry_price),
      id: position.id,
      lots: Number(position.volume),
      openedAt: position.opened_at.toISOString(),
      pnl: Number(position.pnl),
      pnlPercent: Number(position.pnl_pct),
      side: position.side === "sell" ? "sell" : "buy",
      stopLoss: position.stop_loss ? Number(position.stop_loss) : undefined,
      symbol: position.symbol,
      takeProfit: position.take_profit ? Number(position.take_profit) : undefined,
    })),
    currentParticipant: participant
      ? mapArenaParticipant(participant)
      : await getDemoTraderPreview(currentTraderId, tournament),
    currentParticipantJoined: Boolean(participant),
    participants: participants.map(mapArenaParticipant),
    serverTime: new Date().toISOString(),
    spectators: 124,
    tournamentSlug: tournament.slug,
    tradeTicket: {
      availableSymbols: tournament.allowed_symbols,
      defaultLots: 0.1,
      defaultSymbol: tournament.allowed_symbols[0] ?? "EURUSD",
      maxLots: 1,
      maxRiskPercent: 2,
      minLots: 0.01,
    },
  };
}

export async function ensureDemoMt5Account(slug: string) {
  const participant = await getDemoParticipant(slug);
  const account = await ensureMt5Account(participant.id);

  if (account.login) {
    return syncMt5AccountSnapshot(account, account.login, {
      existing: true,
      login: account.login,
      refreshed: true,
    });
  }

  const bridge = createMt5BridgeClient();
  const created = participant.mt5_login
    ? {
        email: participant.trader_email,
        group: "broker\\TEST-B NUEVO ERICK CRM",
        leverage: 100,
        login: participant.mt5_login,
        name: participant.trader_name,
        raw: { existing: true, login: participant.mt5_login },
      }
    : await bridge.createAccount({
        email: participant.trader_email,
        group: "broker\\TEST-B NUEVO ERICK CRM",
        leverage: 100,
        name: participant.trader_name,
        password: participant.trader_password ?? "TestPass123!",
      });

  await syncMt5AccountSnapshot(account, created.login, created.raw);

  await createEvent(participant.tournament_id, participant.id, {
    asset: "MT5",
    message: "creo una cuenta MT5",
    pnlPercent: 0,
    traderName: participant.trader_name,
  });

  return ensureMt5Account(participant.id);
}

export async function joinDemoTournament(slug: string) {
  const tournament = await getTournamentRow(slug);

  if (!tournament) {
    throw new Error("Tournament not found");
  }

  const traderId = await getCurrentDemoTraderId();
  const trader = await getDemoTrader(traderId);

  if (!trader) {
    throw new Error("Demo trader not found. Login again.");
  }

  const existing = await getDemoParticipant(slug, traderId);

  if (existing) {
    return getDemoArenaState(slug);
  }

  const rankRow = await queryOne<{ next_rank: string }>(
    `
      select (count(*) + 1)::text as next_rank
      from demo_tournament_participants
      where tournament_id = $1
    `,
    [tournament.id],
  );
  const participantId = `participant_${crypto.randomUUID()}`;
  const rank = Number(rankRow?.next_rank ?? 1);

  await queryRows(
    `
      insert into demo_tournament_participants (
        id,
        tournament_id,
        trader_id,
        status,
        rank,
        balance
      ) values ($1, $2, $3, 'active', $4, $5)
    `,
    [
      participantId,
      tournament.id,
      trader.id,
      rank,
      Number(tournament.initial_balance),
    ],
  );

  await ensureMt5Account(participantId, Number(tournament.initial_balance));
  await createEvent(tournament.id, participantId, {
    asset: "ARENA",
    message: "se unio al torneo",
    pnlPercent: 0,
    traderName: trader.name,
  });

  return getDemoArenaState(slug);
}

export async function openDemoTrade(slug: string, input: DemoOpenTradeInput) {
  const participant = await getDemoParticipant(slug);
  const tournament = await getTournamentRow(slug);

  if (!tournament) {
    throw new Error("Tournament not found");
  }

  validateTradeInput(tournament, input);

  const account = await ensureDemoMt5Account(slug);
  const login = account.login;

  if (!login) {
    throw new Error("MT5 account is not connected");
  }

  const bridge = createMt5BridgeClient();
  const orderInput: Mt5OpenOrderInput = {
    comment: `Bullfy ${slug}`,
    login,
    price: input.price,
    side: input.side,
    stopLoss: input.stopLoss,
    symbol: input.symbol,
    takeProfit: input.takeProfit,
    volume: input.volume,
  };
  let opened: Awaited<ReturnType<typeof bridge.openOrder>>;

  try {
    opened = await bridge.openOrder(orderInput);
  } catch (error) {
    console.log(error, "Bridge MT5 Creacion Fallida");
    throw new Error(
      error instanceof Error
        ? `Bridge MT5 rechazo la orden: ${error.message}`
        : "Bridge MT5 rechazo la orden.",
    );
  }

  if (!opened.dealId) {
    throw new Error("Bridge MT5 no devolvio deal id para la orden.");
  }

  const bridgePositionId = await resolveBridgePositionId({
    bridge,
    fallbackPositionId: opened.positionId ?? null,
    login,
    orderDealId: opened.dealId,
    retries: 4,
  });
  const orderId = `order_${crypto.randomUUID()}`;
  const positionId = `position_${crypto.randomUUID()}`;
  const entryPrice = opened.price || input.price || 1.16;
  const simulatedPnl = simulatePnl(input.side, input.volume);
  const simulatedPnlPct = Number((simulatedPnl / Number(tournament.initial_balance) * 100).toFixed(2));
  const db = await getPostgresPool().connect();

  try {
    await db.query("begin");
    await db.query(
      `
        insert into demo_trade_orders (
          id,
          participant_id,
          mt5_account_id,
          bridge_deal_id,
          bridge_order_id,
          symbol,
          side,
          volume,
          requested_price,
          executed_price,
          stop_loss,
          take_profit,
          status,
          bridge_payload
        ) values (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'executed', $13::jsonb
        )
      `,
      [
        orderId,
        participant.id,
        account.id,
        opened.dealId,
        opened.orderId ?? null,
        input.symbol,
        input.side,
        input.volume,
        input.price ?? null,
        entryPrice,
        input.stopLoss ?? null,
        input.takeProfit ?? null,
        JSON.stringify(opened.raw),
      ],
    );

    await db.query(
      `
        insert into demo_trade_positions (
          id,
          participant_id,
          mt5_account_id,
          order_id,
          bridge_position_id,
          symbol,
          side,
          volume,
          entry_price,
          current_price,
          stop_loss,
          take_profit,
          pnl,
          pnl_pct,
          status
        ) values (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'open'
        )
      `,
      [
        positionId,
        participant.id,
        account.id,
        orderId,
        bridgePositionId,
        input.symbol,
        input.side,
        input.volume,
        entryPrice,
        entryPrice,
        input.stopLoss ?? null,
        input.takeProfit ?? null,
        simulatedPnl,
        simulatedPnlPct,
      ],
    );

    await db.query("commit");
  } catch (error) {
    await db.query("rollback");
    try {
      await bridge.closePosition(login, bridgePositionId);
    } catch {
      // Best effort cleanup: the UI must not create a local open position if DB persistence failed.
    }
    throw new Error(
      error instanceof Error
        ? `No se pudo guardar la orden local: ${error.message}`
        : "No se pudo guardar la orden local.",
    );
  } finally {
    db.release();
  }

  try {
    await recalculateParticipant(participant.id);
    await createEvent(tournament.id, participant.id, {
      asset: input.symbol,
      message: `abrio ${input.side.toUpperCase()} ${input.volume} lotes`,
      pnlPercent: 0,
      traderName: participant.trader_name,
    });
  } catch {
    // La orden ya existe en MT5 y DB. No conviertas fallos secundarios en error de apertura.
  }

  return getDemoArenaState(slug);
}

export async function closeDemoPosition(slug: string, positionId: string) {
  const participant = await getDemoParticipant(slug);
  const account = await ensureMt5Account(participant.id);
  const position = await queryOne<PositionRow>(
    `
      select
        pos.*,
        ord.bridge_deal_id
      from demo_trade_positions pos
      left join demo_trade_orders ord on ord.id = pos.order_id
      where pos.id = $1 and pos.participant_id = $2 and pos.status = 'open'
    `,
    [positionId, participant.id],
  );

  if (!position) {
    throw new Error("Open position not found");
  }

  if (account.login) {
    try {
      const bridge = createMt5BridgeClient();
      const bridgePositionId =
        position.bridge_position_id ??
        (await resolveBridgePositionId({
          bridge,
          fallbackPositionId: null,
          login: account.login,
          orderDealId: position.bridge_deal_id,
        }));

      try {
        await bridge.closePosition(account.login, bridgePositionId);
      } catch (closeError) {
        const stillOpen = await isBridgePositionStillOpen({
          bridge,
          bridgePositionId,
          login: account.login,
          orderDealId: position.bridge_deal_id,
        });

        if (stillOpen) {
          throw closeError;
        }
      }

      if (bridgePositionId !== position.bridge_position_id) {
        await queryRows(
          `
            update demo_trade_positions
            set bridge_position_id = $2
            where id = $1
          `,
          [position.id, bridgePositionId],
        );
      }
    } catch (error) {
      throw new Error(
        error instanceof Error
          ? `Bridge MT5 rechazo el cierre: ${error.message}`
          : "Bridge MT5 rechazo el cierre.",
      );
    }
  }

  await markLocalPositionClosed(positionId);

  await recalculateParticipant(participant.id);
  await createEvent(participant.tournament_id, participant.id, {
    asset: position.symbol,
    message: "cerro una operacion",
    pnlPercent: Number(position.pnl_pct),
    traderName: participant.trader_name,
  });

  return getDemoArenaState(slug);
}

export async function syncDemoOpenPositions(slug: string) {
  return getDemoArenaState(slug);
}

async function getTournamentRow(slug: string) {
  return queryOne<TournamentRow>(
    `
      select
        t.*,
        count(p.id)::text as participants_count
      from demo_tournaments t
      left join demo_tournament_participants p on p.tournament_id = t.id
      where t.slug = $1
      group by t.id
    `,
    [slug],
  );
}

async function getDemoParticipant(slug: string): Promise<DemoParticipantRow>;
async function getDemoParticipant(
  slug: string,
  traderId: string,
): Promise<DemoParticipantRow | null>;
async function getDemoParticipant(slug: string, traderId?: string) {
  const currentTraderId = traderId ?? (await getCurrentDemoTraderId());
  const participant = await queryOne<DemoParticipantRow>(
    `
      select
        p.*,
        p.tournament_id,
        tr.id as trader_id,
        tr.name as trader_name,
        tr.email as trader_email,
        tr.password as trader_password,
        tr.clan,
        tr.mt5_login,
        tr.mt5_password
      from demo_tournament_participants p
      join demo_tournaments t on t.id = p.tournament_id
      join demo_traders tr on tr.id = p.trader_id
      where t.slug = $1 and tr.id = $2
      limit 1
    `,
    [slug, currentTraderId],
  );

  if (!participant && !traderId) {
    throw new Error("Demo participant not found. Run db seed first.");
  }

  return participant;
}

async function getDemoTrader(traderId: string) {
  return queryOne<DemoTraderRow>(
    `
      select id, name, email, clan, mt5_login, mt5_password
      from demo_traders
      where id = $1
      limit 1
    `,
    [traderId],
  );
}

async function getDemoTraderPreview(
  traderId: string,
  tournament: TournamentRow,
) {
  const trader = await getDemoTrader(traderId);

  if (!trader) {
    return undefined;
  }

  return {
    avatarUrl: "/avatars/karlos.svg",
    balance: Number(tournament.initial_balance),
    clan: trader.clan ?? "Sin clan",
    id: trader.id,
    name: trader.name,
    pnl: 0,
    position: 0,
    previousPosition: 0,
    scoreChange: 0,
    trades: 0,
    winRate: 0,
  };
}

async function getParticipants(tournamentId: string) {
  return queryRows<ParticipantRow>(
    `
      select
        p.id,
        tr.id as trader_id,
        tr.name as trader_name,
        tr.clan,
        p.rank,
        p.score_pct,
        p.pnl,
        p.balance,
        p.trades_count,
        p.win_rate_pct
      from demo_tournament_participants p
      join demo_traders tr on tr.id = p.trader_id
      where p.tournament_id = $1
      order by p.rank asc
    `,
    [tournamentId],
  );
}

async function ensureMt5Account(participantId: string, initialBalance = 10000) {
  const existing = await queryOne<Mt5AccountRow>(
    `
      select *
      from demo_mt5_accounts
      where participant_id = $1
      limit 1
    `,
    [participantId],
  );

  if (existing) {
    return existing;
  }

  const id = `mt5_${crypto.randomUUID()}`;

  await queryRows(
    `
      insert into demo_mt5_accounts (
        id,
        participant_id,
        status,
        balance,
        equity,
        margin,
        free_margin,
        margin_level_pct
      ) values ($1, $2, 'disconnected', $3, $3, 0, $3, 0)
    `,
    [id, participantId, initialBalance],
  );

  const created = await queryOne<Mt5AccountRow>(
    "select * from demo_mt5_accounts where id = $1",
    [id],
  );

  if (!created) {
    throw new Error("Could not create MT5 account row");
  }

  return created;
}

async function syncMt5AccountSnapshot(
  account: Mt5AccountRow,
  login: string,
  payload: unknown,
) {
  const snapshot = await createMt5BridgeClient().getAccount(login);

  await queryRows(
    `
      update demo_mt5_accounts
      set
        login = $2,
        server = $3,
        status = 'connected',
        balance = $4,
        equity = $5,
        margin = $6,
        free_margin = $7,
        margin_level_pct = $8,
        bridge_payload = $9::jsonb,
        updated_at = now()
      where id = $1
    `,
    [
      account.id,
      login,
      snapshot.server,
      snapshot.balance,
      snapshot.equity,
      snapshot.margin,
      snapshot.freeMargin,
      snapshot.marginLevelPercent,
      JSON.stringify(payload),
    ],
  );

  const updated = await queryOne<Mt5AccountRow>(
    "select * from demo_mt5_accounts where id = $1",
    [account.id],
  );

  if (!updated) {
    throw new Error("Could not refresh MT5 account row");
  }

  return updated;
}

async function resolveBridgePositionId({
  bridge,
  fallbackPositionId,
  login,
  orderDealId,
  retries = 1,
}: {
  bridge: ReturnType<typeof createMt5BridgeClient>;
  fallbackPositionId: string | null;
  login: string;
  orderDealId?: string | null;
  retries?: number;
}) {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    if (orderDealId) {
      const deals = await bridge.listDeals(login);
      const deal = deals.find((item) => item.dealId === orderDealId);

      if (deal?.positionId) {
        return deal.positionId;
      }
    }

    if (fallbackPositionId) {
      const positions = await bridge.listPositions(login);
      const position = positions.find(
        (item) => item.positionId === fallbackPositionId,
      );

      if (position) {
        return fallbackPositionId;
      }
    }

    if (attempt < retries - 1) {
      await wait(250);
    }
  }

  if (fallbackPositionId && !shouldReconcileWithBridge()) {
    return fallbackPositionId;
  }

  throw new Error("No se encontro el position_id para cerrar en MT5.");
}

async function isBridgePositionStillOpen({
  bridge,
  bridgePositionId,
  login,
  orderDealId,
}: {
  bridge: ReturnType<typeof createMt5BridgeClient>;
  bridgePositionId: string;
  login: string;
  orderDealId?: string | null;
}) {
  try {
    const positions = await bridge.listPositions(login);

    if (positions.some((position) => position.positionId === bridgePositionId)) {
      return true;
    }

    const deals = await bridge.listDeals(login);
    const deal = deals.find((item) => item.dealId === orderDealId);

    if (
      deal?.positionId &&
      positions.some((position) => position.positionId === deal.positionId)
    ) {
      return true;
    }

    return false;
  } catch {
    return true;
  }
}

async function getOpenPositions(participantId: string) {
  return queryRows<PositionRow>(
    `
      select
        pos.*,
        ord.bridge_deal_id
      from demo_trade_positions pos
      left join demo_trade_orders ord on ord.id = pos.order_id
      where pos.participant_id = $1 and pos.status = 'open'
      order by pos.opened_at desc
    `,
    [participantId],
  );
}

async function getSyncedOpenPositions(
  participantId: string,
  account: Mt5AccountRow,
) {
  const positions = await getOpenPositions(participantId);

  if (!account.login || !shouldReconcileWithBridge() || positions.length === 0) {
    return positions;
  }

  try {
    return await syncOpenPositionsFromBridge(participantId, account, positions);
  } catch {
    return positions;
  }
}

async function syncOpenPositionsFromBridge(
  participantId: string,
  account: Mt5AccountRow,
  positions: PositionRow[],
) {
  if (!account.login) {
    return positions;
  }

  const bridge = createMt5BridgeClient();
  const bridgePositions = await bridge.listPositions(account.login);
  const synced: PositionRow[] = [];
  const stalePositionIds: string[] = [];
  let changed = false;

  for (const position of positions) {
    const bridgePosition = await findBridgePositionForLocal({
      bridge,
      bridgePositions,
      login: account.login,
      position,
    });

    if (!bridgePosition) {
      stalePositionIds.push(position.id);
      continue;
    }

    const syncedPosition = toSyncedPositionRow(position, bridgePosition, account);
    synced.push(syncedPosition);

    if (hasPositionSyncChanged(position, syncedPosition)) {
      changed = true;
      await updateLocalPositionFromBridge(syncedPosition);
    }
  }

  if (stalePositionIds.length > 0) {
    changed = true;
    await markLocalPositionsClosed(stalePositionIds);
  }

  if (changed) {
    await recalculateParticipant(participantId);
  }

  return synced;
}

async function findBridgePositionForLocal({
  bridge,
  bridgePositions,
  login,
  position,
}: {
  bridge: ReturnType<typeof createMt5BridgeClient>;
  bridgePositions: Mt5Position[];
  login: string;
  position: PositionRow;
}) {
  if (position.bridge_position_id) {
    const directPosition = bridgePositions.find(
      (item) => item.positionId === position.bridge_position_id,
    );

    if (directPosition) {
      return directPosition;
    }
  }

  const resolvedPositionId = await resolveLocalBridgePositionId({
    bridge,
    bridgePositions,
    login,
    position,
  });

  return bridgePositions.find((item) => item.positionId === resolvedPositionId);
}

function toSyncedPositionRow(
  position: PositionRow,
  bridgePosition: Mt5Position,
  account: Mt5AccountRow,
): PositionRow {
  const pnl = Number(bridgePosition.profit);
  const baseBalance = Number(account.balance) || 10000;
  const pnlPct = baseBalance > 0 ? Number(((pnl / baseBalance) * 100).toFixed(2)) : 0;
  const currentPrice =
    bridgePosition.currentPrice ?? Number(position.current_price);

  return {
    ...position,
    bridge_position_id: bridgePosition.positionId,
    current_price: String(currentPrice),
    entry_price: bridgePosition.price
      ? String(bridgePosition.price)
      : position.entry_price,
    pnl: String(Number(pnl.toFixed(2))),
    pnl_pct: String(pnlPct),
    side: bridgePosition.side,
    symbol: bridgePosition.symbol,
    volume: String(bridgePosition.volume),
  };
}

function hasPositionSyncChanged(current: PositionRow, next: PositionRow) {
  return (
    current.bridge_position_id !== next.bridge_position_id ||
    Number(current.current_price) !== Number(next.current_price) ||
    Number(current.entry_price) !== Number(next.entry_price) ||
    Number(current.pnl) !== Number(next.pnl) ||
    Number(current.pnl_pct) !== Number(next.pnl_pct) ||
    current.side !== next.side ||
    current.symbol !== next.symbol ||
    Number(current.volume) !== Number(next.volume)
  );
}

async function updateLocalPositionFromBridge(position: PositionRow) {
  await queryRows(
    `
      update demo_trade_positions
      set
        bridge_position_id = $2,
        symbol = $3,
        side = $4,
        volume = $5,
        entry_price = $6,
        current_price = $7,
        pnl = $8,
        pnl_pct = $9
      where id = $1 and status = 'open'
    `,
    [
      position.id,
      position.bridge_position_id,
      position.symbol,
      position.side,
      Number(position.volume),
      Number(position.entry_price),
      Number(position.current_price),
      Number(position.pnl),
      Number(position.pnl_pct),
    ],
  );
}

async function resolveLocalBridgePositionId({
  bridge,
  bridgePositions,
  login,
  position,
}: {
  bridge: ReturnType<typeof createMt5BridgeClient>;
  bridgePositions: Mt5Position[];
  login: string;
  position: PositionRow;
}) {
  if (
    position.bridge_position_id &&
    bridgePositions.some((item) => item.positionId === position.bridge_position_id)
  ) {
    return position.bridge_position_id;
  }

  if (!position.bridge_deal_id) {
    return position.bridge_position_id;
  }

  const resolvedPositionId = await resolveBridgePositionId({
    bridge,
    fallbackPositionId: null,
    login,
    orderDealId: position.bridge_deal_id,
  }).catch(() => null);

  if (resolvedPositionId && resolvedPositionId !== position.bridge_position_id) {
    await queryRows(
      `
        update demo_trade_positions
        set bridge_position_id = $2
        where id = $1
      `,
      [position.id, resolvedPositionId],
    );
  }

  return resolvedPositionId ?? position.bridge_position_id;
}

async function markLocalPositionClosed(positionId: string) {
  await markLocalPositionsClosed([positionId]);
}

async function markLocalPositionsClosed(positionIds: string[]) {
  if (positionIds.length === 0) {
    return;
  }

  await queryRows(
    `
      update demo_trade_positions
      set status = 'closed', closed_at = coalesce(closed_at, now())
      where id = any($1::text[]) and status = 'open'
    `,
    [positionIds],
  );
}

function shouldReconcileWithBridge() {
  return (
    process.env.MT5_BRIDGE_USE_MOCK !== "true" &&
    Boolean(process.env.MT5_BRIDGE_BASE_URL && process.env.MT5_BRIDGE_TOKEN)
  );
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getEvents(tournamentId: string) {
  return queryRows<EventRow>(
    `
      select *
      from demo_arena_events
      where tournament_id = $1
      order by created_at desc
      limit 12
    `,
    [tournamentId],
  );
}

async function createEvent(
  tournamentId: string,
  participantId: string,
  event: {
    traderName: string;
    message: string;
    asset: string;
    pnlPercent: number;
  },
) {
  await queryRows(
    `
      insert into demo_arena_events (
        id,
        tournament_id,
        participant_id,
        trader_name,
        message,
        asset,
        pnl_pct
      ) values ($1, $2, $3, $4, $5, $6, $7)
    `,
    [
      `event_${crypto.randomUUID()}`,
      tournamentId,
      participantId,
      event.traderName,
      event.message,
      event.asset,
      event.pnlPercent,
    ],
  );
}

async function recalculateParticipant(participantId: string) {
  const summary = await queryOne<{
    pnl: string;
    trades_count: string;
    wins_count: string;
  }>(
    `
      select
        coalesce(sum(pnl), 0)::text as pnl,
        count(*)::text as trades_count,
        count(*) filter (where pnl > 0)::text as wins_count
      from demo_trade_positions
      where participant_id = $1
    `,
    [participantId],
  );

  const pnl = Number(summary?.pnl ?? 0);
  const trades = Number(summary?.trades_count ?? 0);
  const wins = Number(summary?.wins_count ?? 0);
  const winRate = trades > 0 ? (wins / trades) * 100 : 0;
  const balance = 10000 + pnl;
  const score = (pnl / 10000) * 100;

  await queryRows(
    `
      update demo_tournament_participants
      set
        pnl = $2,
        balance = $3,
        score_pct = $4,
        trades_count = $5,
        win_rate_pct = $6,
        rank = 1
      where id = $1
    `,
    [participantId, pnl, balance, score, trades, winRate],
  );

  await queryRows(
    `
      update demo_mt5_accounts
      set
        balance = $2,
        equity = $2,
        free_margin = greatest($2 - margin, 0),
        updated_at = now()
      where participant_id = $1
    `,
    [participantId, balance],
  );

  await queryRows(
    `
      with ranked as (
        select
          id,
          row_number() over (order by score_pct desc, pnl desc, trades_count desc, created_at asc) as rank
        from demo_tournament_participants
        where tournament_id = (
          select tournament_id
          from demo_tournament_participants
          where id = $1
        )
      )
      update demo_tournament_participants p
      set rank = ranked.rank
      from ranked
      where p.id = ranked.id
    `,
    [participantId],
  );
}

function mapArenaParticipant(item: ParticipantRow) {
  return {
    avatarUrl: "/avatars/karlos.svg",
    balance: Number(item.balance),
    clan: item.clan ?? "Sin clan",
    id: item.trader_id,
    name: item.trader_name,
    pnl: Number(item.pnl),
    position: item.rank,
    previousPosition: item.rank,
    scoreChange: Number(item.score_pct),
    trades: item.trades_count,
    winRate: Number(item.win_rate_pct),
  };
}

async function createUniqueTournamentSlug(name: string) {
  const baseSlug = slugify(name) || `tournament-${Date.now()}`;
  let slug = baseSlug;
  let suffix = 2;

  while (
    await queryOne<{ id: string }>(
      "select id from demo_tournaments where slug = $1 limit 1",
      [slug],
    )
  ) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  return slug;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function calculatePrizePool(input: CreateTournamentInput) {
  const fee = input.league === "elite" ? input.entryFeeUsd : input.entryFeeBmoney;
  const net = input.maxParticipants * fee * (1 - input.houseFeePct / 100);

  return Number(Math.max(0, net).toFixed(2));
}

function mapDemoStatusFromDates(startsAt: string, endsAt: string) {
  const now = Date.now();
  const start = new Date(startsAt).getTime();
  const end = new Date(endsAt).getTime();

  if (Number.isFinite(end) && end <= now) {
    return "finished";
  }

  if (Number.isFinite(start) && start <= now) {
    return "live";
  }

  return "scheduled";
}

function mapTournamentRow(row: TournamentRow): Tournament {
  const isElite = row.league === "elite";
  const entryFeeUsd = Number(row.entry_fee_usd);
  const entryFeeBmoney = Number(row.entry_fee_bmoney);

  return {
    description: row.description,
    endsAt: row.ends_at.toISOString(),
    entryCurrency: isElite ? "USD" : "BULLFY",
    entryFee: isElite ? entryFeeUsd : entryFeeBmoney,
    entryFeeBmoney,
    entryFeeUsd,
    id: row.id,
    name: row.name,
    participantsCount: Number(row.participants_count),
    prizeCurrency: isElite ? "USD" : "BULLFY",
    prizePool: Number(row.prize_pool),
    prizes: [
      { amount: Number(row.prize_pool) * 0.5, currency: isElite ? "USD" : "BULLFY", label: "1er lugar", position: 1 },
      { amount: Number(row.prize_pool) * 0.3, currency: isElite ? "USD" : "BULLFY", label: "2do lugar", position: 2 },
      { amount: Number(row.prize_pool) * 0.2, currency: isElite ? "USD" : "BULLFY", label: "3er lugar", position: 3 },
    ],
    rules: {
      accountMode: "demo",
      allowedAssets: row.allowed_symbols,
      market: "Forex + Metals",
      maxParticipants: row.max_participants,
      minBalance: Number(row.initial_balance),
    },
    slug: row.slug,
    sponsor: "Bullfy Demo Backend",
    startsAt: row.starts_at.toISOString(),
    status: mapTournamentStatus(row.status),
  };
}

function mapTournamentStatus(status: string): Tournament["status"] {
  if (status === "scheduled") {
    return "upcoming";
  }

  if (status === "finished" || status === "live" || status === "draft") {
    return status;
  }

  return "upcoming";
}

function mapAccountStatus(status: string): ArenaState["mt5Account"]["status"] {
  if (status === "connected" || status === "syncing") {
    return status;
  }

  return "disconnected";
}

function validateTradeInput(tournament: TournamentRow, input: DemoOpenTradeInput) {
  if (!tournament.allowed_symbols.includes(input.symbol)) {
    throw new Error("Symbol is not allowed in this tournament");
  }

  if (input.volume < 0.01 || input.volume > 1) {
    throw new Error("Volume is outside tournament limits");
  }
}

function simulatePnl(side: "buy" | "sell", volume: number) {
  const direction = side === "buy" ? 1 : -1;
  const base = 42.35 * volume * 10;

  return Number((base * direction).toFixed(2));
}

function sumPositionsVolume(positions: PositionRow[]) {
  return positions.reduce((total, position) => total + Number(position.volume), 0);
}
