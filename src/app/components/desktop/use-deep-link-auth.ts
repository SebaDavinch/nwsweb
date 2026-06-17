import { useEffect } from "react";
import { isTauri } from "./use-tauri";
import { setAppSession, type AppSessionKind } from "../../app-session";
import { log } from "./app-logger";

// Разбирает deep-link вида nordwind://auth?kind=&session=<id> и сохраняет сессию приложения.
function parseAuthUrl(url: string): { kind: AppSessionKind; token: string } | null {
  try {
    const u = new URL(url);
    // схема nordwind://auth → host="auth"; на всякий случай принимаем и path "/auth".
    const isAuth = u.host === "auth" || u.pathname.replace(/\//g, "") === "auth";
    if (!isAuth) return null;
    const token = String(u.searchParams.get("session") || "").trim();
    const kind = String(u.searchParams.get("kind") || "").trim().toLowerCase();
    if (token && (kind === "vamsys" || kind === "discord")) {
      return { kind: kind as AppSessionKind, token };
    }
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Слушает deep-link nordwind://auth (вход из системного браузера в упакованном .exe),
 * сохраняет токен сессии и вызывает onAuthenticated (обычно refreshAuth + переход в хаб).
 * В вебе/dev — no-op.
 */
export function useDeepLinkAuth(onAuthenticated: () => void) {
  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | undefined;
    let cancelled = false;

    const handleUrls = (urls: string[] | null | undefined) => {
      for (const url of urls || []) {
        const parsed = parseAuthUrl(url);
        if (parsed) {
          setAppSession(parsed.kind, parsed.token);
          log.info("auth", `deep-link session received (${parsed.kind})`);
          onAuthenticated();
          break;
        }
      }
    };

    void (async () => {
      try {
        const mod = await import("@tauri-apps/plugin-deep-link");
        // URL, которым приложение было запущено (cold start через протокол).
        try {
          const current = await mod.getCurrent();
          if (!cancelled) handleUrls(current);
        } catch {
          /* ignore */
        }
        // Подписка на последующие deep-link (app уже запущен, single-instance форвардит URL).
        unlisten = await mod.onOpenUrl((urls) => {
          if (!cancelled) handleUrls(urls);
        });
      } catch (e) {
        log.warn("auth", `deep-link plugin unavailable: ${String(e)}`);
      }
    })();

    return () => {
      cancelled = true;
      try {
        unlisten?.();
      } catch {
        /* ignore */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
