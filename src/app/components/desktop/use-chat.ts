import { useCallback, useEffect, useRef, useState } from "react";
import { log } from "./app-logger";

export interface ChatMessage {
  id: string;
  room: string;
  pilotId: number | null;
  username: string | null;
  name: string;
  rank: string | null;
  avatar: string | null;
  text: string;
  mentions?: string[];
  reactions?: Record<string, string[]>;
  ts: string;
}

export type ChatStatus = "connecting" | "open" | "closed";

interface UseChatOptions {
  // Вызывается для каждого нового входящего сообщения (не из истории).
  onIncoming?: (msg: ChatMessage) => void;
}

function chatWsUrl(room: string): string {
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${window.location.host}/api/chat/ws?room=${encodeURIComponent(room)}`;
}

/**
 * Подключение к комнате чата по WebSocket. Авто-переподключение с backoff.
 * История приходит при подключении (type:"history"), новые сообщения — type:"message".
 */
export function useChat(room: string | null, options?: UseChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<ChatStatus>("closed");
  const [isModerator, setIsModerator] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef(0);
  const closedByUser = useRef(false);
  const onIncomingRef = useRef(options?.onIncoming);
  onIncomingRef.current = options?.onIncoming;

  useEffect(() => {
    if (!room) {
      setMessages([]);
      setStatus("closed");
      return;
    }

    closedByUser.current = false;
    let reconnectTimer: number | undefined;

    const connect = () => {
      setStatus("connecting");
      let ws: WebSocket;
      try {
        ws = new WebSocket(chatWsUrl(room));
      } catch {
        scheduleReconnect();
        return;
      }
      wsRef.current = ws;

      ws.onopen = () => {
        retryRef.current = 0;
        setStatus("open");
        log.info("chat", `connected: ${room}`);
      };
      ws.onmessage = (event) => {
        let payload:
          | {
              type?: string;
              messages?: ChatMessage[];
              message?: ChatMessage;
              id?: string;
              isModerator?: boolean;
              error?: string;
              reactions?: Record<string, string[]>;
            }
          | null = null;
        try {
          payload = JSON.parse(String(event.data));
        } catch {
          return;
        }
        if (!payload) return;
        if (payload.type === "history" && Array.isArray(payload.messages)) {
          setMessages(payload.messages);
          setIsModerator(Boolean(payload.isModerator));
        } else if (payload.type === "message" && payload.message) {
          const msg = payload.message;
          setMessages((prev) => [...prev, msg]);
          onIncomingRef.current?.(msg);
        } else if (payload.type === "delete" && payload.id) {
          setMessages((prev) => prev.filter((m) => m.id !== payload!.id));
        } else if (payload.type === "reaction" && payload.id) {
          const { id, reactions } = payload;
          setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, reactions: reactions || {} } : m)));
        } else if (payload.type === "error" && payload.error) {
          setError(payload.error);
        }
      };
      ws.onclose = () => {
        setStatus("closed");
        if (!closedByUser.current) {
          log.warn("chat", `disconnected: ${room}, reconnecting…`);
          scheduleReconnect();
        }
      };
      ws.onerror = () => {
        try {
          ws.close();
        } catch {
          /* ignore */
        }
      };
    };

    const scheduleReconnect = () => {
      retryRef.current = Math.min(retryRef.current + 1, 6);
      const delay = Math.min(1000 * 2 ** retryRef.current, 15000);
      reconnectTimer = window.setTimeout(connect, delay);
    };

    // новая комната — чистим историю прошлой
    setMessages([]);
    setError(null);
    connect();

    return () => {
      closedByUser.current = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      try {
        wsRef.current?.close();
      } catch {
        /* ignore */
      }
      wsRef.current = null;
    };
  }, [room]);

  const sendMessage = useCallback((text: string) => {
    const trimmed = text.trim();
    const ws = wsRef.current;
    if (!trimmed || !ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify({ type: "message", text: trimmed }));
    return true;
  }, []);

  const deleteMessage = useCallback((id: string) => {
    const ws = wsRef.current;
    if (!id || !ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "delete", id }));
  }, []);

  const reportMessage = useCallback((id: string, reason: string) => {
    const ws = wsRef.current;
    if (!id || !ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "report", id, reason }));
  }, []);

  const reactMessage = useCallback((id: string, emoji: string) => {
    const ws = wsRef.current;
    if (!id || !emoji || !ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "react", id, emoji }));
  }, []);

  return { messages, status, isModerator, error, sendMessage, deleteMessage, reportMessage, reactMessage };
}
