import type {
  ChatAuthor,
  ChatMessage,
  ChatMessageKind,
  ChatMessageStatus,
  ChatRoom,
  ChatRoomScope,
  SendChatMessageInput,
} from "../types";
import type {
  ExternalChatAuthorDto,
  ExternalChatMessageDto,
  ExternalChatRoomDto,
  ExternalSendChatMessageRequestDto,
} from "./chat.contracts";

const scopeMap: Record<ExternalChatRoomDto["scope"], ChatRoomScope> = {
  CLAN: "clan",
  DUEL: "duel",
  GLOBAL: "global",
  TOURNAMENT: "tournament",
};

const roleMap: Record<ExternalChatAuthorDto["role"], ChatAuthor["role"]> = {
  MODERATOR: "moderator",
  ORGANIZER: "organizer",
  SYSTEM: "system",
  TRADER: "trader",
};

const messageKindMap: Record<
  ExternalChatMessageDto["message_type"],
  ChatMessageKind
> = {
  MESSAGE: "message",
  REWARD: "reward",
  SYSTEM: "system",
  TRADE: "trade",
};

const messageStatusMap: Record<
  ExternalChatMessageDto["moderation_status"],
  ChatMessageStatus
> = {
  FLAGGED: "flagged",
  REMOVED: "removed",
  VISIBLE: "visible",
};

export function mapChatRoom(dto: ExternalChatRoomDto): ChatRoom {
  return {
    id: dto.room_id,
    scope: scopeMap[dto.scope],
    title: dto.title,
    tournamentSlug: dto.tournament_slug,
    onlineCount: dto.online_count,
    slowModeSeconds: dto.slow_mode_seconds,
    messages: dto.messages.map(mapChatMessage),
  };
}

export function mapChatMessage(message: ExternalChatMessageDto): ChatMessage {
  return {
    id: message.message_id,
    roomId: message.room_id,
    author: {
      id: message.author.trader_id,
      name: message.author.display_name,
      handle: message.author.handle,
      clan: message.author.clan_name,
      avatarUrl: message.author.avatar_url,
      role: roleMap[message.author.role],
    },
    kind: messageKindMap[message.message_type],
    status: messageStatusMap[message.moderation_status],
    body: message.body,
    createdAt: message.created_at,
    tournamentSlug: message.tournament_slug,
    asset: message.asset_symbol,
    pnlPercent: message.pnl_pct,
    deliveryStatus: "sent" as const,
  };
}

export function mapSendChatMessageRequest(
  input: SendChatMessageInput,
): ExternalSendChatMessageRequestDto {
  return {
    room_id: input.roomId,
    author_id: input.author.id,
    body: input.body,
    tournament_slug: input.tournamentSlug,
  };
}
