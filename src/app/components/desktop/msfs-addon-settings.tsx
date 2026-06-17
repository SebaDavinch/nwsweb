import { useEffect, useState } from "react";
import { Plug, CheckCircle2, XCircle, HelpCircle, RefreshCw } from "lucide-react";
import { useLanguage } from "../../context/language-context";
import { isTauri } from "./use-tauri";

type AddonStatus = "checking" | "installed" | "not-installed" | "unknown";

// Кандидаты путей Community-папки MSFS (Store + Steam). Имя пакета мода — заглушка.
const ADDON_PACKAGE = "nordwind-hub-link";

async function detectAddon(): Promise<AddonStatus> {
  if (!isTauri()) return "unknown";
  try {
    const fs = await import("@tauri-apps/plugin-fs");
    const env = await import("@tauri-apps/api/path");
    const home = await env.homeDir().catch(() => "");
    if (!home) return "unknown";
    const candidates = [
      `${home}/AppData/Local/Packages/Microsoft.FlightSimulator_8wekyb3d8bbwe/LocalCache/Packages/Community/${ADDON_PACKAGE}`,
      `${home}/AppData/Roaming/Microsoft Flight Simulator/Packages/Community/${ADDON_PACKAGE}`,
      `${home}/AppData/Local/Packages/Microsoft.Limitless_8wekyb3d8bbwe/LocalCache/Packages/Community/${ADDON_PACKAGE}`,
    ];
    for (const p of candidates) {
      try {
        if (await fs.exists(p)) return "installed";
      } catch {
        /* keep checking */
      }
    }
    return "not-installed";
  } catch {
    return "unknown";
  }
}

export function MsfsAddonSettings() {
  const { language } = useLanguage();
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);
  const [status, setStatus] = useState<AddonStatus>("checking");

  const check = () => {
    setStatus("checking");
    void detectAddon().then(setStatus);
  };

  useEffect(() => {
    check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const meta: Record<AddonStatus, { dot: string; icon: React.ReactNode; label: string }> = {
    checking: { dot: "bg-zinc-400", icon: <RefreshCw className="h-4 w-4 animate-spin" />, label: tr("Проверка…", "Checking…") },
    installed: { dot: "bg-emerald-500", icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />, label: tr("Установлен", "Installed") },
    "not-installed": { dot: "bg-amber-500", icon: <XCircle className="h-4 w-4 text-amber-500" />, label: tr("Не установлен", "Not installed") },
    unknown: { dot: "bg-zinc-400", icon: <HelpCircle className="h-4 w-4 text-zinc-400" />, label: tr("Только в приложении", "Desktop app only") },
  };
  const m = meta[status];

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white px-5 py-4 shadow-sm dark:border-white/10 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-500 dark:bg-red-500/15 dark:text-red-300">
            <Plug className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-100">
              {tr("Аддон для MSFS", "MSFS add-on")}
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
                {tr("скоро", "soon")}
              </span>
            </div>
            <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              {tr(
                "Панель NordwindHub в навбаре симулятора (MSFS 2020/2024). Статус установки определяется автоматически.",
                "NordwindHub panel in the sim toolbar (MSFS 2020/2024). Install status is detected automatically."
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
            <span className={`h-2 w-2 rounded-full ${m.dot}`} />
            {m.label}
          </span>
          <button
            type="button"
            onClick={check}
            className="rounded-lg border border-zinc-200 p-1.5 text-zinc-400 hover:bg-zinc-100 dark:border-white/10 dark:hover:bg-white/5"
            title={tr("Проверить снова", "Re-check")}
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
