import { bullfyEnv } from "@/shared/config";

export type RealtimeStatus =
  | "idle"
  | "connecting"
  | "open"
  | "closing"
  | "closed"
  | "error";

export type RealtimeEvent<TPayload = unknown> = {
  channel?: string;
  payload: TPayload;
  timestamp?: string;
  type: string;
};

export type RealtimeEventHandler<TPayload = unknown> = (
  event: RealtimeEvent<TPayload>,
) => void;

export type RealtimeStatusHandler = (status: RealtimeStatus) => void;

export type RealtimeClientOptions = {
  url?: string;
  protocols?: string | string[];
  reconnect?: {
    enabled?: boolean;
    initialDelayMs?: number;
    maxAttempts?: number;
    maxDelayMs?: number;
  };
  socketFactory?: (
    url: string,
    protocols?: string | string[],
  ) => Pick<WebSocket, "close" | "readyState" | "send"> & {
    onclose: WebSocket["onclose"];
    onerror: WebSocket["onerror"];
    onmessage: WebSocket["onmessage"];
    onopen: WebSocket["onopen"];
  };
};

type RealtimeSocket = ReturnType<
  NonNullable<RealtimeClientOptions["socketFactory"]>
>;

const SOCKET_CONNECTING = 0;
const SOCKET_OPEN = 1;

export class RealtimeClient {
  private readonly handlers = new Map<string, Set<RealtimeEventHandler>>();
  private readonly protocols?: string | string[];
  private readonly reconnect;
  private readonly socketFactory: NonNullable<
    RealtimeClientOptions["socketFactory"]
  >;
  private readonly statusHandlers = new Set<RealtimeStatusHandler>();
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private shouldReconnect = true;
  private socket: RealtimeSocket | undefined;
  private status: RealtimeStatus = "idle";
  private readonly url: string;

  constructor(options: RealtimeClientOptions = {}) {
    this.url = options.url ?? bullfyEnv.realtimeUrl;
    this.protocols = options.protocols;
    this.reconnect = {
      enabled: options.reconnect?.enabled ?? true,
      initialDelayMs:
        options.reconnect?.initialDelayMs ??
        bullfyEnv.realtimeReconnectInitialDelayMs,
      maxAttempts: options.reconnect?.maxAttempts ?? Infinity,
      maxDelayMs:
        options.reconnect?.maxDelayMs ?? bullfyEnv.realtimeReconnectMaxDelayMs,
    };
    this.socketFactory =
      options.socketFactory ??
      ((url, protocols) => {
        if (typeof WebSocket === "undefined") {
          throw new Error("WebSocket is not available in this runtime.");
        }

        return new WebSocket(url, protocols);
      });
  }

  connect() {
    if (!this.url) {
      throw new Error("Realtime URL is not configured.");
    }

    if (
      this.socket?.readyState === SOCKET_OPEN ||
      this.socket?.readyState === SOCKET_CONNECTING
    ) {
      return;
    }

    this.shouldReconnect = true;
    this.setStatus("connecting");

    const socket = this.socketFactory(this.url, this.protocols);
    this.socket = socket;

    socket.onopen = () => {
      this.reconnectAttempts = 0;
      this.setStatus("open");
    };

    socket.onmessage = (message) => {
      this.dispatchMessage(message.data);
    };

    socket.onerror = () => {
      this.setStatus("error");
    };

    socket.onclose = () => {
      this.setStatus("closed");
      this.scheduleReconnect();
    };
  }

  disconnect() {
    this.shouldReconnect = false;
    this.clearReconnectTimer();
    this.setStatus("closing");
    this.socket?.close();
    this.socket = undefined;
    this.setStatus("closed");
  }

  getStatus(): RealtimeStatus {
    return this.status;
  }

  onStatus(handler: RealtimeStatusHandler) {
    this.statusHandlers.add(handler);
    handler(this.status);

    return () => this.statusHandlers.delete(handler);
  }

  send<TPayload>(event: RealtimeEvent<TPayload>) {
    if (this.socket?.readyState !== SOCKET_OPEN) {
      throw new Error("Realtime socket is not open.");
    }

    this.socket.send(JSON.stringify(event));
  }

  subscribe<TPayload>(
    type: string,
    handler: RealtimeEventHandler<TPayload>,
  ) {
    const handlers = this.handlers.get(type) ?? new Set();
    handlers.add(handler as RealtimeEventHandler);
    this.handlers.set(type, handlers);

    return () => {
      handlers.delete(handler as RealtimeEventHandler);

      if (handlers.size === 0) {
        this.handlers.delete(type);
      }
    };
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }

  private dispatchMessage(data: unknown) {
    const event = parseRealtimeEvent(data);

    if (!event) {
      return;
    }

    this.handlers.get(event.type)?.forEach((handler) => handler(event));
    this.handlers.get("*")?.forEach((handler) => handler(event));
  }

  private scheduleReconnect() {
    if (!this.shouldReconnect || !this.reconnect.enabled) {
      return;
    }

    if (this.reconnectAttempts >= this.reconnect.maxAttempts) {
      return;
    }

    this.reconnectAttempts += 1;
    const delay = Math.min(
      this.reconnect.initialDelayMs * 2 ** (this.reconnectAttempts - 1),
      this.reconnect.maxDelayMs,
    );

    this.clearReconnectTimer();
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  private setStatus(status: RealtimeStatus) {
    this.status = status;
    this.statusHandlers.forEach((handler) => handler(status));
  }
}

export const realtimeClient = new RealtimeClient();

function parseRealtimeEvent(data: unknown): RealtimeEvent | null {
  if (typeof data !== "string") {
    return null;
  }

  try {
    const parsed = JSON.parse(data) as Partial<RealtimeEvent>;

    if (typeof parsed.type !== "string") {
      return null;
    }

    return {
      channel: parsed.channel,
      payload: parsed.payload,
      timestamp: parsed.timestamp,
      type: parsed.type,
    };
  } catch {
    return null;
  }
}
