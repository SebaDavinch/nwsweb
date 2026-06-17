import { useCallback, useRef, useState } from "react";
import { FolderOpen, FolderSync, UploadCloud, Loader2, X, Check } from "lucide-react";
import { useLanguage } from "../../context/language-context";
import { getWatchFolder, setWatchFolder, pickFolder, isWatchSupported } from "./screenshot-watcher";

const MAX_BYTES = 10 * 1024 * 1024;

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function ScreenshotSettings() {
  const { language } = useLanguage();
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);
  const [folder, setFolder] = useState(getWatchFolder());
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const supported = isWatchSupported();
  // наблюдение запускается глобально в AppShell (useScreenshotAutoWatch);
  // здесь только выбор/сброс папки. «watching» = папка задана и поддерживается.
  const watching = supported && Boolean(folder);

  const choose = async () => {
    const path = await pickFolder();
    if (path) {
      setFolder(path);
      setWatchFolder(path);
    }
  };

  const clearFolder = () => {
    setFolder("");
    setWatchFolder("");
  };

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
      if (!list.length) return;
      setUploading(true);
      try {
        for (const file of list) {
          if (file.size > MAX_BYTES) continue;
          const dataUrl = await readAsDataUrl(file);
          await fetch("/api/pilot/social-gallery/media", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              imageDataUrl: dataUrl,
              mimeType: file.type,
              fileName: file.name,
              title: file.name.replace(/\.[^.]+$/, ""),
            }),
          }).catch(() => null);
          setLastAdded(file.name);
        }
      } finally {
        setUploading(false);
      }
    },
    []
  );

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white px-5 py-4 shadow-sm dark:border-white/10 dark:bg-zinc-900">
      <div className="mb-3">
        <div className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
          {tr("Скриншоты полётов", "Flight screenshots")}
        </div>
        <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          {tr(
            "Автодетект папки скриншотов симулятора — новые снимки попадут в вашу галерею. Или загрузите вручную.",
            "Auto-detect your sim's screenshot folder — new shots go to your gallery. Or upload manually."
          )}
        </div>
      </div>

      {/* Детект папки (только в десктоп-приложении) */}
      {supported ? (
        <div className="mb-3 flex items-center gap-2">
          {folder ? (
            <>
              <span className="inline-flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs dark:border-white/10 dark:bg-zinc-800">
                {watching ? (
                  <FolderSync className="h-4 w-4 shrink-0 text-emerald-500" />
                ) : (
                  <FolderOpen className="h-4 w-4 shrink-0 text-zinc-400" />
                )}
                <span className="truncate text-zinc-600 dark:text-zinc-300" title={folder}>
                  {folder}
                </span>
                {watching ? (
                  <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-semibold uppercase text-emerald-500">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                    {tr("следим", "watching")}
                  </span>
                ) : null}
              </span>
              <button
                type="button"
                onClick={clearFolder}
                className="rounded-lg border border-zinc-200 p-2 text-zinc-400 hover:bg-zinc-100 dark:border-white/10 dark:hover:bg-white/5"
                title={tr("Отключить детект", "Disable detection")}
              >
                <X className="h-4 w-4" />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={choose}
              className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              <FolderOpen className="h-4 w-4" />
              {tr("Выбрать папку скриншотов", "Choose screenshot folder")}
            </button>
          )}
        </div>
      ) : (
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">
          {tr(
            "Автодетект папки доступен в десктоп-приложении. В браузере — загрузка вручную ниже.",
            "Folder auto-detect is available in the desktop app. In the browser — manual upload below."
          )}
        </div>
      )}

      {/* Прямая загрузка drag-n-drop */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files?.length) void uploadFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={[
          "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-5 text-center transition-colors",
          dragOver
            ? "border-red-500 bg-red-50 dark:bg-red-500/10"
            : "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 dark:border-white/10 dark:hover:bg-white/5",
        ].join(" ")}
      >
        {uploading ? (
          <Loader2 className="h-5 w-5 animate-spin text-red-500" />
        ) : (
          <UploadCloud className="h-5 w-5 text-zinc-400" />
        )}
        <span className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
          {uploading
            ? tr("Загрузка…", "Uploading…")
            : tr("Перетащите скриншоты или нажмите", "Drag screenshots or click")}
        </span>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) void uploadFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {lastAdded ? (
        <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
          <Check className="h-3.5 w-3.5" />
          {tr("Добавлено в галерею:", "Added to gallery:")} {lastAdded}
        </div>
      ) : null}
    </div>
  );
}
