import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, UploadCloud, Loader2, FolderOpen, Check, RefreshCw, ImageOff } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "../../context/language-context";
import { isTauri } from "./use-tauri";
import {
  getWatchFolder,
  setWatchFolder,
  pickFolder,
  listFolderImages,
  readImageAsDataUrl,
  type FolderImage,
} from "./screenshot-watcher";

const MAX_BYTES = 10 * 1024 * 1024;

interface Shot {
  id: string;
  assetUrl: string;
  title?: string;
}

interface Props {
  bookingId: number;
  callsign?: string | null;
  route?: string | null;
  aircraft?: string | null;
  registration?: string | null;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** Вкладка «Скриншоты» на странице «Полёт»: залитые снимки рейса + добавление (папка/файл) с выбором что публиковать. */
export function FlightScreenshots({ bookingId, callsign, route, aircraft, registration }: Props) {
  const { language } = useLanguage();
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);
  const [shots, setShots] = useState<Shot[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [folder, setFolder] = useState<string>(getWatchFolder());
  const [folderImages, setFolderImages] = useState<FolderImage[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [scanning, setScanning] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const flightMeta = {
    flight: { bookingId, callsign: callsign || "", route: route || "" },
    gear: { aircraft: aircraft || "", registration: registration || "", addons: "" },
  };

  const loadShots = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/pilot/bookings/${bookingId}/screenshots`, { credentials: "include" });
      const p = await r.json().catch(() => null);
      setShots(Array.isArray(p?.screenshots) ? p.screenshots : []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    void loadShots();
  }, [loadShots]);

  const uploadOne = async (dataUrl: string, mime: string, name: string) => {
    const r = await fetch("/api/pilot/social-gallery/media", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageDataUrl: dataUrl,
        mimeType: mime,
        fileName: name,
        title: name.replace(/\.[^.]+$/, ""),
        ...flightMeta,
      }),
    });
    return r.ok;
  };

  const uploadFiles = async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/") && f.size <= MAX_BYTES);
    if (!list.length) return;
    setUploading(true);
    try {
      let ok = 0;
      for (const f of list) {
        const dataUrl = await readAsDataUrl(f);
        if (await uploadOne(dataUrl, f.type, f.name)) ok += 1;
      }
      if (ok) {
        toast.success(tr(`Опубликовано: ${ok}`, `Published: ${ok}`));
        await loadShots();
      }
    } finally {
      setUploading(false);
    }
  };

  const chooseFolder = async () => {
    const p = await pickFolder();
    if (p) {
      setWatchFolder(p);
      setFolder(p);
      void scanFolder(p);
    }
  };

  const scanFolder = async (f = folder) => {
    if (!f) return;
    setScanning(true);
    try {
      const imgs = await listFolderImages(f, 40);
      setFolderImages(imgs);
      setSelected(new Set());
    } finally {
      setScanning(false);
    }
  };

  const toggleSel = (path: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  const publishSelected = async () => {
    if (selected.size === 0) return;
    setUploading(true);
    try {
      let ok = 0;
      for (const path of selected) {
        const img = await readImageAsDataUrl(path);
        if (img && (await uploadOne(img.dataUrl, img.mime, img.name))) ok += 1;
      }
      if (ok) {
        toast.success(tr(`Опубликовано из папки: ${ok}`, `Published from folder: ${ok}`));
        setSelected(new Set());
        await loadShots();
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Залитые скриншоты рейса */}
      {loading ? (
        <div className="flex items-center gap-2 py-6 text-sm text-white/50">
          <Loader2 className="h-4 w-4 animate-spin" />
          {tr("Загрузка…", "Loading…")}
        </div>
      ) : shots.length > 0 ? (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-white/80">
              <Camera className="h-4 w-4 text-red-400" />
              {tr(`Скриншоты рейса: ${shots.length}`, `Flight screenshots: ${shots.length}`)}
            </span>
            <button type="button" onClick={() => void loadShots()} className="rounded-lg p-1.5 text-white/50 hover:bg-white/5 hover:text-white/80" title={tr("Обновить", "Refresh")}>
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {shots.map((s) => (
              <a key={s.id} href={s.assetUrl} target="_blank" rel="noreferrer" className="block aspect-video overflow-hidden rounded-lg border border-white/10 bg-zinc-800">
                <img src={s.assetUrl} alt={s.title || ""} className="h-full w-full object-cover" loading="lazy" />
              </a>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center">
          <ImageOff className="h-8 w-8 text-white/30" />
          <div className="mt-2 text-sm font-medium text-white/70">{tr("Скриншотов этого рейса пока нет", "No screenshots for this flight yet")}</div>
          <div className="mt-1 text-xs text-white/40">{tr("Настройте папку сима или добавьте снимок вручную ниже.", "Set your sim folder or add a screenshot manually below.")}</div>
        </div>
      )}

      {/* Добавление вручную (drag-n-drop / файл) */}
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
          "flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-4 text-center text-sm transition-colors",
          dragOver ? "border-red-500 bg-red-500/10 text-red-300" : "border-white/15 text-white/50 hover:border-white/25 hover:bg-white/5",
        ].join(" ")}
      >
        {uploading ? <Loader2 className="h-5 w-5 animate-spin text-red-400" /> : <UploadCloud className="h-5 w-5" />}
        <span className="font-medium">{uploading ? tr("Загрузка…", "Uploading…") : tr("Перетащите или выберите скриншот", "Drag or choose a screenshot")}</span>
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

      {/* Папка сима — выбор что опубликовать (только в приложении) */}
      {isTauri() ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-white/80">
              <FolderOpen className="h-4 w-4 text-amber-400" />
              {tr("Из папки скриншотов", "From screenshot folder")}
            </span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={chooseFolder} className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-white/70 hover:bg-white/5">
                {folder ? tr("Сменить папку", "Change folder") : tr("Выбрать папку", "Choose folder")}
              </button>
              {folder ? (
                <button type="button" onClick={() => void scanFolder()} disabled={scanning} className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white/80 hover:bg-white/15 disabled:opacity-50">
                  {scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  {tr("Сканировать", "Scan")}
                </button>
              ) : null}
            </div>
          </div>
          {folder ? <div className="mt-1 truncate font-mono text-[11px] text-white/40">{folder}</div> : null}

          {folderImages.length > 0 ? (
            <>
              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
                {folderImages.map((img) => {
                  const sel = selected.has(img.path);
                  return (
                    <button
                      key={img.path}
                      type="button"
                      onClick={() => toggleSel(img.path)}
                      className={[
                        "relative aspect-video overflow-hidden rounded-lg border-2 bg-zinc-800 transition-colors",
                        sel ? "border-red-500" : "border-transparent hover:border-white/20",
                      ].join(" ")}
                    >
                      <FolderThumb path={img.path} />
                      {sel ? (
                        <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white">
                          <Check className="h-3 w-3" />
                        </span>
                      ) : null}
                      <span className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-1 py-0.5 text-[9px] text-white/70">{img.name}</span>
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => void publishSelected()}
                disabled={selected.size === 0 || uploading}
                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-400 disabled:opacity-40"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                {tr(`Опубликовать выбранные (${selected.size})`, `Publish selected (${selected.size})`)}
              </button>
            </>
          ) : folder ? (
            <div className="mt-3 text-xs text-white/40">{tr("Нажмите «Сканировать», чтобы увидеть снимки из папки.", "Press Scan to list shots from the folder.")}</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Лениво читает превью файла из папки. */
function FolderThumb({ path }: { path: string }) {
  const [src, setSrc] = useState<string>("");
  useEffect(() => {
    let active = true;
    void readImageAsDataUrl(path).then((r) => {
      if (active && r) setSrc(r.dataUrl);
    });
    return () => {
      active = false;
    };
  }, [path]);
  return src ? <img src={src} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center"><Loader2 className="h-4 w-4 animate-spin text-white/30" /></div>;
}
