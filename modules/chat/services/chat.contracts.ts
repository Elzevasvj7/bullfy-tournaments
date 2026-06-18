export type ExternalChatAuthorDto = {
  trader_id: string;
  display_name: string;
  handle: string;
  clan_name?: string;
  avatar_url?: string;
  role: "TRADER" | "ORGANIZER" | "SYSTEM" | "MODERATOR";
};

export type ExternalChatMessageDto = {
  message_id: string;
  room_id: string;
  author: ExternalChatAuthorDto;
  message_type: "MESSAGE" | "SYSTEM" | "TRADE" | "REWARD";
  moderation_status: "VISIBLE" | "FLAGGED" | "REMOVED";
  body: string;
  created_at: string;
  tournament_slug?: string;
  asset_symbol?: string;
  pnl_pct?: number;
};

export type ExternalChatRoomDto = {
  room_id: string;
  scope: "GLOBAL" | "TOURNAMENT" | "CLAN" | "DUEL";
  title: string;
  tournament_slug?: string;
  online_count: number;
  slow_mode_seconds: number;
  messages: ExternalChatMessageDto[];
};

export type ExternalSendChatMessageRequestDto = {
  room_id: string;
  author_id: string;
  body: string;
  tournament_slug?: string;
};
