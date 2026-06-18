import {
  getCurrentChatAuthor,
  getCurrentSessionUser,
} from "@/modules/auth/services/session-user";
import { ChatRoomView, getGlobalChatRoom } from "@/modules/chat";

export default async function ChatPage() {
  const [room, sessionUser, currentUser] = await Promise.all([
    getGlobalChatRoom(),
    getCurrentSessionUser(),
    getCurrentChatAuthor(),
  ]);

  return (
    <ChatRoomView
      currentUser={currentUser}
      room={room}
      sessionUser={sessionUser}
    />
  );
}
