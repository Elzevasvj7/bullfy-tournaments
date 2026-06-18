import type { ChatMessage, SendChatMessageInput } from "../types";
import type { ExternalChatMessageDto } from "./chat.contracts";
import {
  mapChatMessage,
  mapSendChatMessageRequest,
} from "./chat.mapper";

export async function sendChatMessage(
  input: SendChatMessageInput,
): Promise<ChatMessage> {
  const baseUrl = process.env.NEXT_PUBLIC_BULLFY_API_BASE_URL;

  if (baseUrl) {
    const response = await fetch(
      `${baseUrl.replace(/\/$/, "")}/chat/rooms/${input.roomId}/messages`,
      {
        body: JSON.stringify(mapSendChatMessageRequest(input)),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      },
    );

    if (!response.ok) {
      throw new Error(`Chat send failed with status ${response.status}`);
    }

    const dto = (await response.json()) as ExternalChatMessageDto;

    return mapChatMessage(dto);
  }

  return sendMockChatMessage(input);
}

async function sendMockChatMessage(
  input: SendChatMessageInput,
): Promise<ChatMessage> {
  await new Promise((resolve) => setTimeout(resolve, 450));

  return {
    id: `msg_${Date.now()}`,
    roomId: input.roomId,
    author: input.author,
    kind: "message",
    status: "visible",
    body: input.body,
    createdAt: new Date().toISOString(),
    tournamentSlug: input.tournamentSlug,
    deliveryStatus: "sent",
  };
}
