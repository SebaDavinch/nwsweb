import { isTauri } from "./use-tauri";

/**
 * Открыть внешнюю ссылку в системном браузере.
 * В упакованном Tauri webview обычный `<a target="_blank">` не открывает внешний браузер —
 * используем плагин opener. В вебе/dev — обычный window.open.
 */
export async function openExternal(url: string): Promise<void> {
  const href = String(url || "").trim();
  if (!href) return;
  if (isTauri()) {
    try {
      const mod = await import("@tauri-apps/plugin-opener");
      await mod.openUrl(href);
      return;
    } catch {
      /* плагин недоступен — падаем в window.open ниже */
    }
  }
  try {
    window.open(href, "_blank", "noopener,noreferrer");
  } catch {
    /* ignore */
  }
}

/** Обработчик клика для якоря: в Tauri перехватываем и открываем системным браузером. */
export function externalLinkProps(url: string) {
  return {
    href: url,
    target: "_blank",
    rel: "noreferrer",
    onClick: (e: React.MouseEvent) => {
      if (isTauri()) {
        e.preventDefault();
        void openExternal(url);
      }
    },
  } as const;
}
