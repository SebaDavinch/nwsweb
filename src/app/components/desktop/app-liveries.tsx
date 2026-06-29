import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Download, FolderOpen, Loader2, Package, RefreshCw, Trash2, XCircle } from "lucide-react";
import { useLanguage } from "../../context/language-context";
import { getApiBaseUrl } from "../../api-base";
import { isTauri } from "./use-tauri";

// ── Community folder detection ────────────────────────────────────────────────

const COMMUNITY_PATHS = [
  "AppData/Local/Packages/Microsoft.FlightSimulator_8wekyb3d8bbwe/LocalCache/Packages/Community",
  "AppData/Roaming/Microsoft Flight Simulator/Packages/Community",
  "AppData/Local/Packages/Microsoft.Limitless_8wekyb3d8bbwe/LocalCache/Packages/Community",
  "AppData/Local/Packages/Microsoft.FlightDashboard_8wekyb3d8bbwe/LocalCache/Packages/Community",
];

async function detectCommunityFolder(): Promise<string | null> {
  if (!isTauri()) return null;
  try {
    const { homeDir } = await import("@tauri-apps/api/path");
    const { exists } = await import("@tauri-apps/plugin-fs");
    const home = await homeDir();
    for (const rel of COMMUNITY_PATHS) {
      const full = `${home}/${rel}`;
      if (await exists(full).catch(() => false)) return full;
    }
    return null;
  } catch {
    return null;
  }
}

async function checkPackageInstalled(communityPath: string, packageName: string): Promise<boolean> {
  if (!isTauri() || !communityPath || !packageName) return false;
  try {
    const { exists } = await import("@tauri-apps/plugin-fs");
    return await exists(`${communityPath}/${packageName}`).catch(() => false);
  } catch {
    return false;
  }
}

async function pickCommunityFolder(): Promise<string | null> {
  if (!isTauri()) return null;
  try {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const selected = await open({ directory: true, multiple: false, title: "Select MSFS Community folder" });
    return typeof selected === "string" ? selected : null;
  } catch {
    return null;
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface Livery {
  id: string;
  name: string;
  aircraft: string;
  icao: string;
  description: string;
  previewUrl: string | null;
  packageName: string;
  version: string;
  fileSizeBytes: number | null;
  uploadedAt: string | null;
  downloads: number;
}

type InstallStatus = "idle" | "installing" | "installed" | "removing" | "error";

const COMMUNITY_PATH_KEY = "nws.liveries.communityPath";

// ── Component ─────────────────────────────────────────────────────────────────

export function AppLiveries() {
  const { language } = useLanguage();
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);

  const [liveries, setLiveries] = useState<Livery[]>([]);
  const [loading, setLoading] = useState(true);
  const [communityPath, setCommunityPath] = useState<string>(
    () => (typeof localStorage !== "undefined" ? localStorage.getItem(COMMUNITY_PATH_KEY) || "" : ""),
  );
  const [autoDetected, setAutoDetected] = useState(false);
  const [status, setStatus] = useState<Record<string, InstallStatus>>({});
  const [installed, setInstalled] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const inTauri = isTauri();
  const checkRef = useRef(false);

  // Auto-detect Community folder
  useEffect(() => {
    if (communityPath) return;
    detectCommunityFolder().then((p) => {
      if (p) {
        setCommunityPath(p);
        setAutoDetected(true);
        try { localStorage.setItem(COMMUNITY_PATH_KEY, p); } catch { /* ignore */ }
      }
    });
  }, []);

  // Check which liveries are installed
  const refreshInstalled = useCallback(async (livs: Livery[], cPath: string) => {
    if (!inTauri || !cPath) return;
    const result = new Set<string>();
    await Promise.all(
      livs.map(async (l) => {
        if (await checkPackageInstalled(cPath, l.packageName)) result.add(l.id);
      }),
    );
    setInstalled(result);
  }, [inTauri]);

  // Load catalog
  useEffect(() => {
    fetch("/api/app/liveries")
      .then((r) => r.json())
      .then((data) => {
        const livs: Livery[] = data.liveries || [];
        setLiveries(livs);
        setLoading(false);
        if (!checkRef.current && communityPath) {
          checkRef.current = true;
          void refreshInstalled(livs, communityPath);
        }
      })
      .catch(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (communityPath) {
      try { localStorage.setItem(COMMUNITY_PATH_KEY, communityPath); } catch { /* ignore */ }
      if (liveries.length > 0) void refreshInstalled(liveries, communityPath);
    }
  }, [communityPath, liveries, refreshInstalled]);

  const setLiveryStatus = (id: string, s: InstallStatus) =>
    setStatus((prev) => ({ ...prev, [id]: s }));

  const handleInstall = async (livery: Livery) => {
    if (!inTauri || !communityPath) return;
    setLiveryStatus(livery.id, "installing");
    setErrors((e) => { const n = { ...e }; delete n[livery.id]; return n; });
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const downloadUrl = `${getApiBaseUrl()}/api/app/liveries/${livery.id}/download`;
      await invoke<number>("install_livery", {
        downloadUrl,
        communityPath,
        packageName: livery.packageName,
      });
      setLiveryStatus(livery.id, "installed");
      setInstalled((s) => new Set([...s, livery.id]));
    } catch (err) {
      setLiveryStatus(livery.id, "error");
      setErrors((e) => ({ ...e, [livery.id]: String(err) }));
    }
  };

  const handleRemove = async (livery: Livery) => {
    if (!inTauri || !communityPath) return;
    setLiveryStatus(livery.id, "removing");
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("remove_livery", { communityPath, packageName: livery.packageName });
      setLiveryStatus(livery.id, "idle");
      setInstalled((s) => { const n = new Set(s); n.delete(livery.id); return n; });
    } catch (err) {
      setLiveryStatus(livery.id, "error");
      setErrors((e) => ({ ...e, [livery.id]: String(err) }));
    }
  };

  const handlePickFolder = async () => {
    const p = await pickCommunityFolder();
    if (p) setCommunityPath(p);
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="nws-scroll-hover flex h-full flex-col overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl space-y-6 p-6">

        {/* Header */}
        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
            {tr("Ливреи vNWS", "vNWS Liveries")}
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {tr(
              "Официальные ливреи Nordwind Virtual для MSFS 2020 и MSFS 2024. Устанавливаются в папку Community.",
              "Official Nordwind Virtual liveries for MSFS 2020 and MSFS 2024. Installed into your Community folder.",
            )}
          </p>
        </div>

        {/* Community folder path */}
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-white/10 dark:bg-zinc-900">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {tr("Папка Community", "Community folder")}
            </span>
            {autoDetected && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                {tr("Обнаружена автоматически", "Auto-detected")}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-700 dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-300">
              {communityPath || tr("Не указана", "Not set")}
            </code>
            {inTauri && (
              <button
                type="button"
                onClick={handlePickFolder}
                className="flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-600 transition-colors hover:border-zinc-300 hover:text-zinc-900 dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:border-white/20"
              >
                <FolderOpen className="h-3.5 w-3.5" />
                {tr("Выбрать", "Browse")}
              </button>
            )}
            {communityPath && inTauri && (
              <button
                type="button"
                onClick={() => void refreshInstalled(liveries, communityPath)}
                className="flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-900 dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
                title={tr("Проверить снова", "Re-check")}
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {!inTauri && (
            <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
              {tr(
                "Установка доступна только в приложении NordwindHub.",
                "Installation requires the NordwindHub desktop app.",
              )}
            </p>
          )}
        </div>

        {/* Livery list */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
          </div>
        ) : liveries.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 py-16 dark:border-white/10 dark:bg-zinc-900/50">
            <Package className="h-10 w-10 text-zinc-300 dark:text-zinc-600" />
            <p className="text-sm text-zinc-400">
              {tr("Ливреи ещё не добавлены", "No liveries available yet")}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {liveries.map((livery) => {
              const rawSt = status[livery.id];
              const st = rawSt ?? (installed.has(livery.id) ? "installed" : "idle");
              const isInstalling = rawSt === "installing";
              const isRemoving = rawSt === "removing";
              const busy = isInstalling || isRemoving;
              const isInstalled = st === "installed" || (installed.has(livery.id) && st === "idle");

              return (
                <div
                  key={livery.id}
                  className="overflow-hidden rounded-2xl border border-zinc-200 bg-white transition-shadow hover:shadow-md dark:border-white/10 dark:bg-zinc-900"
                >
                  <div className="flex gap-0">
                    {/* Preview image */}
                    {livery.previewUrl ? (
                      <div className="h-32 w-52 shrink-0 overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                        <img
                          src={livery.previewUrl}
                          alt={livery.name}
                          className="h-full w-full object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      </div>
                    ) : (
                      <div className="flex h-32 w-52 shrink-0 items-center justify-center bg-gradient-to-br from-red-500/10 to-zinc-100 dark:from-red-500/20 dark:to-zinc-800">
                        <Package className="h-10 w-10 text-red-300 dark:text-red-500/50" />
                      </div>
                    )}

                    {/* Info */}
                    <div className="flex flex-1 flex-col justify-between p-4">
                      <div>
                        <div className="flex flex-wrap items-start gap-2">
                          <span className="font-semibold text-zinc-900 dark:text-zinc-100">{livery.name}</span>
                          {livery.icao && (
                            <span className="rounded bg-red-100 px-1.5 py-0.5 text-[11px] font-bold text-red-700 dark:bg-red-500/20 dark:text-red-300">
                              {livery.icao}
                            </span>
                          )}
                          {isInstalled && (
                            <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">
                              <CheckCircle2 className="h-3 w-3" />
                              {tr("Установлена", "Installed")}
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                          {[livery.aircraft, livery.version ? `v${livery.version}` : null, livery.fileSizeBytes ? `${(livery.fileSizeBytes / (1024 * 1024)).toFixed(0)} МБ` : null]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                        {livery.description && (
                          <p className="mt-1.5 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400 line-clamp-2">
                            {livery.description}
                          </p>
                        )}
                        {errors[livery.id] && (
                          <p className="mt-1 text-xs text-red-500 dark:text-red-400 line-clamp-1" title={errors[livery.id]}>
                            {tr("Ошибка: ", "Error: ")}{errors[livery.id]}
                          </p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="mt-3 flex items-center gap-2">
                        {inTauri && communityPath ? (
                          <>
                            {!isInstalled ? (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void handleInstall(livery)}
                                className="flex items-center gap-1.5 rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-red-600 disabled:opacity-60"
                              >
                                {isInstalling ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Download className="h-3.5 w-3.5" />
                                )}
                                {isInstalling ? tr("Установка...", "Installing...") : tr("Установить", "Install")}
                              </button>
                            ) : (
                              <>
                                <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  {tr("Установлена", "Installed")}
                                </span>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => void handleRemove(livery)}
                                  className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-500 transition-colors hover:border-red-200 hover:text-red-600 disabled:opacity-60 dark:border-white/10 dark:text-zinc-400 dark:hover:border-red-500/30 dark:hover:text-red-400"
                                >
                                  {isRemoving ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-3.5 w-3.5" />
                                  )}
                                  {isRemoving ? tr("Удаление...", "Removing...") : tr("Удалить", "Remove")}
                                </button>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => void handleInstall(livery)}
                                  className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-500 transition-colors hover:border-zinc-300 hover:text-zinc-900 disabled:opacity-60 dark:border-white/10 dark:text-zinc-400 dark:hover:border-white/20 dark:hover:text-zinc-100"
                                >
                                  <RefreshCw className="h-3.5 w-3.5" />
                                  {tr("Переустановить", "Reinstall")}
                                </button>
                              </>
                            )}
                          </>
                        ) : (
                          <a
                            href={`/api/app/liveries/${livery.id}/download`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:border-zinc-300 hover:text-zinc-900 dark:border-white/10 dark:text-zinc-400 dark:hover:text-zinc-100"
                          >
                            <Download className="h-3.5 w-3.5" />
                            {tr("Скачать ZIP", "Download ZIP")}
                          </a>
                        )}
                        {st === "error" && (
                          <span className="flex items-center gap-1 text-xs text-red-500">
                            <XCircle className="h-3.5 w-3.5" />
                            {tr("Ошибка установки", "Install failed")}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer note */}
        {!loading && liveries.length > 0 && (
          <p className="text-center text-xs text-zinc-400 dark:text-zinc-600">
            {tr(
              "ZIP-файлы ливрей устанавливаются в папку Community. Старая версия заменяется автоматически.",
              "Livery ZIPs are installed into the Community folder. Existing versions are replaced automatically.",
            )}
          </p>
        )}
      </div>
    </div>
  );
}
