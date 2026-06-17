import { useEffect } from "react";
import { getWatchFolder, startScreenshotWatch, isWatchSupported } from "./screenshot-watcher";
import { notify } from "./notify";
import { getNotificationsEnabled } from "./app-settings";
import { log } from "./app-logger";

/**
 * Глобально (на уровне оболочки) наблюдает за выбранной папкой скриншотов,
 * чтобы автодетект работал во всех режимах, а не только на экране настроек.
 * При появлении нового снимка — уведомление «добавлено в галерею».
 */
export function useScreenshotAutoWatch(enabled: boolean) {
  useEffect(() => {
    if (!enabled || !isWatchSupported()) return;
    const folder = getWatchFolder();
    if (!folder) return;

    let stop: (() => void) | null = null;
    let cancelled = false;
    void (async () => {
      log.info("screenshots", `watching folder: ${folder}`);
      const unwatch = await startScreenshotWatch(folder, (name) => {
        log.info("screenshots", `auto-imported: ${name}`);
        if (getNotificationsEnabled()) {
          void notify("NordwindHub", `Скриншот добавлен в галерею: ${name}`);
        }
      });
      if (cancelled) unwatch();
      else stop = unwatch;
    })();

    return () => {
      cancelled = true;
      stop?.();
    };
  }, [enabled]);
}
