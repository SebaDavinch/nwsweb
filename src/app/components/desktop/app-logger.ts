// Лёгкий внутренний логгер приложения для диагностики (для саппорта).
// Кольцевой буфер в памяти + персист в localStorage. Авто-перехват ошибок.

export type LogLevel = "info" | "warn" | "error";
export interface LogEntry {
  ts: string;
  level: LogLevel;
  scope: string;
  message: string;
}

const STORAGE_KEY = "nws.app.logs";
const MAX = 400;

let buffer: LogEntry[] = load();
const listeners = new Set<() => void>();

function load(): LogEntry[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.slice(-MAX) : [];
  } catch {
    return [];
  }
}

let persistTimer: number | undefined;
function persist() {
  if (persistTimer) return;
  persistTimer = window.setTimeout(() => {
    persistTimer = undefined;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(buffer.slice(-MAX)));
    } catch {
      /* ignore */
    }
  }, 800);
}

export function appLog(level: LogLevel, scope: string, message: string) {
  const entry: LogEntry = { ts: new Date().toISOString(), level, scope, message: String(message).slice(0, 1000) };
  buffer.push(entry);
  if (buffer.length > MAX) buffer = buffer.slice(-MAX);
  persist();
  listeners.forEach((l) => l());
}

export const log = {
  info: (scope: string, msg: string) => appLog("info", scope, msg),
  warn: (scope: string, msg: string) => appLog("warn", scope, msg),
  error: (scope: string, msg: string) => appLog("error", scope, msg),
};

export function getLogs(): LogEntry[] {
  return buffer.slice();
}

export function clearLogs() {
  buffer = [];
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

export function subscribeLogs(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function exportLogsText(): string {
  return getLogs()
    .map((e) => `[${e.ts}] ${e.level.toUpperCase()} ${e.scope}: ${e.message}`)
    .join("\n");
}

let installed = false;
/** Один раз: перехват глобальных ошибок и отклонённых промисов. */
export function installGlobalLogHandlers() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("error", (e) => {
    appLog("error", "window", `${e.message} @ ${e.filename}:${e.lineno}`);
  });
  window.addEventListener("unhandledrejection", (e) => {
    const reason = (e as PromiseRejectionEvent).reason;
    appLog("error", "promise", String(reason?.message || reason || "unhandled rejection"));
  });

  // Зеркалируем console.warn/error в технические логи (не ломая вывод в консоль).
  const fmt = (args: unknown[]) =>
    args
      .map((a) => {
        if (a instanceof Error) return a.message;
        if (typeof a === "object") {
          try {
            return JSON.stringify(a);
          } catch {
            return String(a);
          }
        }
        return String(a);
      })
      .join(" ");
  const origWarn = console.warn.bind(console);
  const origError = console.error.bind(console);
  console.warn = (...args: unknown[]) => {
    appLog("warn", "console", fmt(args));
    origWarn(...args);
  };
  console.error = (...args: unknown[]) => {
    appLog("error", "console", fmt(args));
    origError(...args);
  };

  appLog("info", "app", `NordwindHub session started · ${navigator.userAgent}`);
}
