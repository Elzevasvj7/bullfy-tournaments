import { bullfyEnv } from "@/shared/config";
import { httpClient } from "@/shared/services";
import type { ChatRoom } from "../types";
import type { ExternalChatRoomDto } from "./chat.contracts";
import { mapChatRoom } from "./chat.mapper";
import { chatRoomMockDtos, createTournamentChatRoomMockDto } from "./chat.mock";

export async function getChatRoom(
  tournamentSlug: string,
): Promise<ChatRoom | null> {
  if (bullfyEnv.apiBaseUrl) {
    const dto = await httpClient.get<ExternalChatRoomDto>(
      `/chat/rooms/tournaments/${tournamentSlug}`,
      { next: { tags: [`chat:${tournamentSlug}`], revalidate: 15 } },
    );

    return mapChatRoom(dto);
  }

  const room = chatRoomMockDtos.find(
    (item) => item.tournament_slug === tournamentSlug,
  );

  return mapChatRoom(room ?? createTournamentChatRoomMockDto(tournamentSlug));
}

export async function getGlobalChatRoom(): Promise<ChatRoom> {
  if (bullfyEnv.apiBaseUrl) {
    const dto = await httpClient.get<ExternalChatRoomDto>("/chat/rooms/global", {
      next: { tags: ["chat:global"], revalidate: 15 },
    });

    return mapChatRoom(dto);
  }

  return mapChatRoom(chatRoomMockDtos[1]);
}
