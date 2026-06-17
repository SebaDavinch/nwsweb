import { isTauri } from "./use-tauri";

/**
 * Показать системное уведомление. В Tauri — нативное (Windows toast) через плагин,
 * в браузере (dev) — Web Notifications API. Разрешение запрашивается при первом вызове.
 */
export async function notify(title: string, body: string): Promise<void> {
  try {
    if (isTauri()) {
      const mod = await import("@tauri-apps/plugin-notification");
      let granted = await mod.isPermissionGranted();
      if (!granted) granted = (await mod.requestPermission()) === "granted";
      if (granted) mod.sendNotification({ title, body });
      return;
    }
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "granted") {
        new Notification(title, { body });
      } else if (Notification.permission !== "denied") {
        const perm = await Notification.requestPermission();
        if (perm === "granted") new Notification(title, { body });
      }
    }
  } catch {
    /* ignore */
  }
}
