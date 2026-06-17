// Сессия упакованного десктоп-приложения.
//
// В .exe куки webview ≠ куки системного браузера, где проходит OAuth. Поэтому после входа
// сервер возвращает сессию через deep-link nordwind://auth?kind=&session=<id>, приложение
// сохраняет её здесь и шлёт заголовком X-NWS-Session(-Kind) на каждый запрос (см. api-base.ts).
// В вебе ничего этого не нужно — там работают обычные куки.

const TOKEN_KEY = "nws.app.session.token";
const KIND_KEY = "nws.app.session.kind";

export type AppSessionKind = "vamsys" | "discord";

export interface AppSession {
  token: string;
  kind: AppSessionKind;
}

export function getAppSession(): AppSession | null {
  try {
    const token = window.localStorage.getItem(TOKEN_KEY) || "";
    const kind = window.localStorage.getItem(KIND_KEY) || "";
    if (token && (kind === "vamsys" || kind === "discord")) {
      return { token, kind };
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function setAppSession(kind: AppSessionKind, token: string): void {
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
    window.localStorage.setItem(KIND_KEY, kind);
  } catch {
    /* ignore */
  }
}

export function clearAppSession(): void {
  try {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(KIND_KEY);
  } catch {
    /* ignore */
  }
}

/** Заголовки сессии приложения для fetch (пусто, если сессии нет). */
export function appSessionHeaders(): Record<string, string> {
  const s = getAppSession();
  return s ? { "X-NWS-Session": s.token, "X-NWS-Session-Kind": s.kind } : {};
}

/** Параметры сессии приложения для WebSocket URL (WS не умеет слать заголовки). */
export function appSessionWsQuery(): string {
  const s = getAppSession();
  return s ? `session=${encodeURIComponent(s.token)}&kind=${encodeURIComponent(s.kind)}` : "";
}
