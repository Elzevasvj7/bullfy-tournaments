"use client";

import { FormEvent, useMemo, useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { sendChatMessage } from "../services/chat.sender";
import type { ChatAuthor, ChatMessage, ChatRoom } from "../types";

type ChatPanelProps = {
  room: ChatRoom;
  className?: string;
  compact?: boolean;
  currentUser?: ChatAuthor;
  messagesClassName?: string;
};

const defaultCurrentUser: ChatAuthor = {
  id: "trader_karlos",
  name: "Karlos Guzman",
  handle: "karlosfx",
  clan: "Bullfy Clan",
  role: "trader",
};

export function ChatPanel({
  className,
  compact = false,
  currentUser = defaultCurrentUser,
  messagesClassName,
  room,
}: ChatPanelProps) {
  const [messages, setMessages] = useState(room.messages);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const visibleMessages = useMemo(
    () => messages.filter((message) => message.status !== "removed"),
    [messages],
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const body = draft.trim();

    if (!body) {
      return;
    }

    const optimisticMessage: ChatMessage = {
      id: `optimistic_${crypto.randomUUID()}`,
      roomId: room.id,
      author: currentUser,
      kind: "message",
      status: "visible",
      body,
      createdAt: new Date().toISOString(),
      tournamentSlug: room.tournamentSlug,
      deliveryStatus: "sending",
    };

    setDraft("");
    setError(null);
    setMessages((current) => [...current, optimisticMessage]);

    startTransition(async () => {
      try {
        const savedMessage = await sendChatMessage({
          roomId: room.id,
          author: currentUser,
          body,
          tournamentSlug: room.tournamentSlug,
        });

        setMessages((current) =>
          current.map((message) =>
            message.id === optimisticMessage.id ? savedMessage : message,
          ),
        );
      } catch {
        setError("No se pudo enviar el mensaje.");
        setMessages((current) =>
          current.map((message) =>
            message.id === optimisticMessage.id
              ? { ...message, deliveryStatus: "failed" }
              : message,
          ),
        );
      }
    });
  }

  return (
    <section
      className={cn(
        "rounded-md border border-cyan-300/10 bg-[#07131d]/95 p-4 shadow-xl shadow-black/20",
        compact && "p-3",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100">
              Chat
            </h2>
            <span className="size-2 rounded-full bg-emerald-300" />
          </div>
          <p className="mt-1 text-xs text-slate-500">{room.title}</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold text-white">{room.onlineCount}</p>
          <p className="text-[10px] uppercase tracking-wide text-slate-500">
            online
          </p>
        </div>
      </div>

      <div
        className={cn(
          compact ? "mt-3 flex flex-col gap-3" : "mt-4 flex flex-col gap-3",
          messagesClassName,
        )}
      >
        {visibleMessages.map((message) => (
          <ChatMessageItem
            key={message.id}
            compact={compact}
            message={message}
          />
        ))}
      </div>
      <form className="mt-4 flex gap-2" onSubmit={handleSubmit}>
        <label className="sr-only" htmlFor={`chat-${room.id}`}>
          Escribe un mensaje
        </label>
        <input
          className="min-w-0 flex-1 rounded-md border border-white/10 bg-black/25 px-3 py-2 text-xs text-slate-200 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/40"
          id={`chat-${room.id}`}
          maxLength={240}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={
            room.slowModeSeconds > 0
              ? `Slow mode ${room.slowModeSeconds}s`
              : "Escribe un mensaje..."
          }
          type="text"
          value={draft}
        />
        <button
          className="rounded-md bg-blue-500 px-3 text-xs font-bold uppercase text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
          disabled={!draft.trim() || isPending}
          type="submit"
        >
          Enviar
        </button>
      </form>
      {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}
    </section>
  );
}

function ChatMessageItem({
  compact,
  message,
}: {
  compact: boolean;
  message: ChatMessage;
}) {
  const isSystem = message.author.role === "system";
  const isModerator = message.author.role === "moderator";

  return (
    <article
      className={`flex gap-3 ${
        isSystem
          ? "rounded-md border border-amber-300/15 bg-amber-300/8 p-3"
          : ""
      }`}
    >
      <div
        className={`flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] ${
          isSystem
            ? "bg-amber-300/15 text-amber-100"
            : isModerator
              ? "bg-blue-300/15 text-blue-100"
              : "bg-cyan-300/15 text-cyan-100"
        }`}
      >
        {message.author.name.slice(0, 2).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="text-xs font-semibold text-white">
            {message.author.name}
          </p>
          {message.author.clan ? (
            <span className="text-[10px] uppercase tracking-[0.14em] text-cyan-200">
              {message.author.clan}
            </span>
          ) : null}
          <span className="text-[10px] text-slate-600">
            {formatChatTime(message.createdAt)}
          </span>
        </div>
        <p className="mt-1 text-xs leading-5 text-slate-400">{message.body}</p>
        {message.asset ? (
          <p
            className={`mt-1 text-[10px] ${
              (message.pnlPercent ?? 0) >= 0
                ? "text-emerald-300"
                : "text-red-300"
            }`}
          >
            {message.asset} {formatPercent(message.pnlPercent)}
          </p>
        ) : null}
        {!compact && message.status !== "visible" ? (
          <p className="mt-1 text-[10px] uppercase tracking-wide text-amber-200">
            {message.status === "flagged" ? "En revision" : "Removido"}
          </p>
        ) : null}
        {message.deliveryStatus && message.deliveryStatus !== "sent" ? (
          <p
            className={`mt-1 text-[10px] uppercase tracking-wide ${
              message.deliveryStatus === "failed"
                ? "text-red-300"
                : "text-slate-500"
            }`}
          >
            {message.deliveryStatus === "failed" ? "No enviado" : "Enviando"}
          </p>
        ) : null}
      </div>
    </article>
  );
}

function formatPercent(value: number | undefined) {
  if (value === undefined) {
    return "";
  }

  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatChatTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "--:--";
  }

  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");

  return `${hours}:${minutes}`;
}
