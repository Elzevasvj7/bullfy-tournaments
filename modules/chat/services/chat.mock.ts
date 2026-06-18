import type { ExternalChatRoomDto } from "./chat.contracts";

const systemAuthor = {
  trader_id: "system",
  display_name: "Bullfy System",
  handle: "system",
  role: "SYSTEM" as const,
};

export const chatRoomMockDtos: ExternalChatRoomDto[] = [
  {
    room_id: "chat_devtest3",
    scope: "TOURNAMENT",
    title: "devtest3 Live Chat",
    tournament_slug: "devtest3",
    online_count: 143,
    slow_mode_seconds: 5,
    messages: [
      {
        message_id: "msg_001",
        room_id: "chat_devtest3",
        author: systemAuthor,
        message_type: "SYSTEM",
        moderation_status: "VISIBLE",
        body: "La arena esta en vivo. Mantengan el chat enfocado en trading.",
        created_at: "2026-06-04T17:00:00.000Z",
        tournament_slug: "devtest3",
      },
      {
        message_id: "msg_002",
        room_id: "chat_devtest3",
        author: {
          trader_id: "trader_max",
          display_name: "TraderMax",
          handle: "tradermax",
          clan_name: "Alpha Desk",
          role: "TRADER",
        },
        message_type: "MESSAGE",
        moderation_status: "VISIBLE",
        body: "Vamos Karlos, esa gestion de riesgo esta limpia.",
        created_at: "2026-06-04T17:18:00.000Z",
        tournament_slug: "devtest3",
      },
      {
        message_id: "msg_003",
        room_id: "chat_devtest3",
        author: {
          trader_id: "luna_fx",
          display_name: "Luna Trader",
          handle: "lunafx",
          clan_name: "Bullfy Clan",
          role: "TRADER",
        },
        message_type: "TRADE",
        moderation_status: "VISIBLE",
        body: "Cerro parcial en EURUSD.",
        created_at: "2026-06-04T17:26:00.000Z",
        tournament_slug: "devtest3",
        asset_symbol: "EURUSD",
        pnl_pct: 1.12,
      },
      {
        message_id: "msg_004",
        room_id: "chat_devtest3",
        author: {
          trader_id: "fx_immortal",
          display_name: "FX Immortal",
          handle: "fximmortal",
          clan_name: "Volatility Lab",
          role: "TRADER",
        },
        message_type: "MESSAGE",
        moderation_status: "VISIBLE",
        body: "Mercado volatil hoy, cuidado con London close.",
        created_at: "2026-06-04T17:41:00.000Z",
        tournament_slug: "devtest3",
      },
      {
        message_id: "msg_005",
        room_id: "chat_devtest3",
        author: {
          trader_id: "mod_iris",
          display_name: "Iris",
          handle: "modiris",
          role: "MODERATOR",
        },
        message_type: "MESSAGE",
        moderation_status: "VISIBLE",
        body: "Recuerden que no se permite compartir enlaces externos.",
        created_at: "2026-06-04T17:50:00.000Z",
        tournament_slug: "devtest3",
      },
      {
        message_id: "msg_006",
        room_id: "chat_devtest3",
        author: systemAuthor,
        message_type: "REWARD",
        moderation_status: "VISIBLE",
        body: "Bonus de actividad desbloqueado para el top 3.",
        created_at: "2026-06-04T18:03:00.000Z",
        tournament_slug: "devtest3",
      },
    ],
  },
  {
    room_id: "chat_global",
    scope: "GLOBAL",
    title: "Bullfy Global Chat",
    online_count: 418,
    slow_mode_seconds: 10,
    messages: [
      {
        message_id: "msg_global_001",
        room_id: "chat_global",
        author: systemAuthor,
        message_type: "SYSTEM",
        moderation_status: "VISIBLE",
        body: "Bienvenido al chat global de Bullfy Tournaments.",
        created_at: "2026-06-04T15:00:00.000Z",
      },
      {
        message_id: "msg_global_002",
        room_id: "chat_global",
        author: {
          trader_id: "pipmaster",
          display_name: "PipMaster",
          handle: "pipmaster",
          clan_name: "Asia Session",
          role: "TRADER",
        },
        message_type: "MESSAGE",
        moderation_status: "VISIBLE",
        body: "Alguien entra al proximo Scalp Night?",
        created_at: "2026-06-04T16:14:00.000Z",
      },
      {
        message_id: "msg_global_003",
        room_id: "chat_global",
        author: {
          trader_id: "nora_gold",
          display_name: "Nora Gold",
          handle: "noragold",
          clan_name: "Metal Desk",
          role: "TRADER",
        },
        message_type: "MESSAGE",
        moderation_status: "VISIBLE",
        body: "Estoy mirando XAUUSD, el spread esta interesante.",
        created_at: "2026-06-04T16:20:00.000Z",
      },
    ],
  },
];

export function createTournamentChatRoomMockDto(
  tournamentSlug: string,
): ExternalChatRoomDto {
  const roomId = `chat_${tournamentSlug}`;

  return {
    room_id: roomId,
    scope: "TOURNAMENT",
    title: `${tournamentSlug} Live Chat`,
    tournament_slug: tournamentSlug,
    online_count: 0,
    slow_mode_seconds: 5,
    messages: [
      {
        message_id: `${roomId}_system`,
        room_id: roomId,
        author: systemAuthor,
        message_type: "SYSTEM",
        moderation_status: "VISIBLE",
        body: "Chat del torneo listo para la apertura.",
        created_at: new Date().toISOString(),
        tournament_slug: tournamentSlug,
      },
    ],
  };
}
