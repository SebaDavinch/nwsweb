import { useCallback, useEffect, useState } from "react";

/**
 * Запущены ли мы внутри Tauri-окна (десктоп-приложение), а не в обычном браузере.
 * В вебе все оконные контролы — no-op, поэтому UI остаётся работоспособным и в браузере
 * (это удобно для разработки без сборки нативного приложения).
 */
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

type WindowControls = {
  isTauri: boolean;
  isMaximized: boolean;
  alwaysOnTop: boolean;
  minimize: () => void;
  toggleMaximize: () => void;
  close: () => void;
  toggleAlwaysOnTop: () => void;
};

/**
 * Управление нативным окном (свернуть/развернуть/закрыть/«поверх всех окон»).
 * Используется кастомным заголовком frameless-окна. Динамический импорт `@tauri-apps/api`,
 * чтобы веб-сборка не тянула нативный код и не падала вне Tauri.
 */
export function useWindowControls(): WindowControls {
  const tauri = isTauri();
  const [isMaximized, setIsMaximized] = useState(false);
  const [alwaysOnTop, setAlwaysOnTop] = useState(false);

  useEffect(() => {
    if (!tauri) return;
    let unlisten: (() => void) | undefined;
    void (async () => {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const win = getCurrentWindow();
      setIsMaximized(await win.isMaximized());
      unlisten = await win.onResized(async () => {
        setIsMaximized(await win.isMaximized());
      });
    })();
    return () => {
      unlisten?.();
    };
  }, [tauri]);

  const minimize = useCallback(() => {
    if (!tauri) return;
    void import("@tauri-apps/api/window").then(({ getCurrentWindow }) =>
      getCurrentWindow().minimize()
    );
  }, [tauri]);

  const toggleMaximize = useCallback(() => {
    if (!tauri) return;
    void import("@tauri-apps/api/window").then(({ getCurrentWindow }) =>
      getCurrentWindow().toggleMaximize()
    );
  }, [tauri]);

  const close = useCallback(() => {
    if (!tauri) return;
    void import("@tauri-apps/api/window").then(({ getCurrentWindow }) =>
      getCurrentWindow().close()
    );
  }, [tauri]);

  const toggleAlwaysOnTop = useCallback(() => {
    if (!tauri) return;
    setAlwaysOnTop((prev) => {
      const next = !prev;
      void import("@tauri-apps/api/window").then(({ getCurrentWindow }) =>
        getCurrentWindow().setAlwaysOnTop(next)
      );
      return next;
    });
  }, [tauri]);

  return { isTauri: tauri, isMaximized, alwaysOnTop, minimize, toggleMaximize, close, toggleAlwaysOnTop };
}
