// Базовый адрес API для упакованного приложения.
//
// В вебе (dev/прод-сайт) фронтенд и API на одном origin — относительные пути
// "/api/..." работают как есть. В упакованном Tauri фронтенд грузится с
// tauri://localhost, поэтому относительные запросы нужно перенаправить на
// прод-домен. Делаем это одним глобальным патчем fetch + WebSocket, чтобы не
// переписывать сотни вызовов по коду.

import { appSessionHeaders, appSessionWsQuery } from "./app-session";

const API_BASE = (import.meta.env.VITE_API_BASE as string) || "https://vnws.org";

/** Абсолютный базовый URL API (для случаев, где относительный путь не годится — OAuth в системном браузере). */
export function getApiBaseUrl(): string {
  return API_BASE.replace(/\/$/, "");
}

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

// Добавляет заголовки сессии приложения к init, не затирая уже заданные.
function withAppSession(init?: RequestInit): RequestInit {
  const extra = appSessionHeaders();
  if (Object.keys(extra).length === 0) return { credentials: "include", ...init };
  return {
    credentials: "include",
    ...init,
    headers: { ...extra, ...(init?.headers as Record<string, string> | undefined) },
  };
}

// Добавляет параметры сессии приложения в WS URL.
function appendWsSession(url: string): string {
  const q = appSessionWsQuery();
  if (!q) return url;
  return url.includes("?") ? `${url}&${q}` : `${url}?${q}`;
}

export function installApiBase(): void {
  if (!isTauriRuntime()) return; // в браузере ничего не меняем

  const httpBase = API_BASE.replace(/\/$/, "");
  const wsBase = httpBase.replace(/^http/, "ws");

  // fetch: относительные /api/* → прод-домен, с куками + заголовком сессии приложения
  const origFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      if (typeof input === "string" && input.startsWith("/")) {
        return origFetch(`${httpBase}${input}`, withAppSession(init));
      }
      if (input instanceof URL && input.pathname.startsWith("/") && input.origin === window.location.origin) {
        return origFetch(`${httpBase}${input.pathname}${input.search}`, withAppSession(init));
      }
    } catch {
      /* fall through */
    }
    return origFetch(input, init);
  };

  // WebSocket: относительный/локальный /api/chat/ws → wss://домен + сессия в query
  const OrigWS = window.WebSocket;
  class PatchedWS extends OrigWS {
    constructor(url: string | URL, protocols?: string | string[]) {
      let u = String(url);
      if (u.startsWith("/")) {
        u = `${wsBase}${u}`;
      } else if (u.startsWith("ws://") || u.startsWith("wss://")) {
        try {
          const parsed = new URL(u);
          if (parsed.host === window.location.host) {
            u = `${wsBase}${parsed.pathname}${parsed.search}`;
          }
        } catch {
          /* ignore */
        }
      }
      super(appendWsSession(u), protocols);
    }
  }
  window.WebSocket = PatchedWS as unknown as typeof WebSocket;
}
