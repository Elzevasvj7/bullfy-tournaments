export type ChatRoomScope = "global" | "tournament" | "clan" | "duel";

export type ChatAuthor = {
  id: string;
  name: string;
  handle: string;
  clan?: string;
  avatarUrl?: string;
  role: "trader" | "organizer" | "system" | "moderator";
};

export type ChatMessageKind = "message" | "system" | "trade" | "reward";

export type ChatMessageStatus = "visible" | "flagged" | "removed";

export type ChatMessageDeliveryStatus = "sent" | "sending" | "failed";

export type ChatMessage = {
  id: string;
  roomId: string;
  author: ChatAuthor;
  kind: ChatMessageKind;
  status: ChatMessageStatus;
  body: string;
  createdAt: string;
  tournamentSlug?: string;
  asset?: string;
  pnlPercent?: number;
  deliveryStatus?: ChatMessageDeliveryStatus;
};

export type ChatRoom = {
  id: string;
  scope: ChatRoomScope;
  title: string;
  tournamentSlug?: string;
  onlineCount: number;
  slowModeSeconds: number;
  messages: ChatMessage[];
};

export type SendChatMessageInput = {
  roomId: string;
  author: ChatAuthor;
  body: string;
  tournamentSlug?: string;
};
