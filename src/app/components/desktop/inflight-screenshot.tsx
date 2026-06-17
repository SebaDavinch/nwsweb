import { useCallback, useRef, useState } from "react";
import { Camera, UploadCloud, Loader2, Check, Info, FolderOpen } from "lucide-react";
import { useLanguage } from "../../context/language-context";
import { useAuth } from "../../context/auth-context";
import { getWatchFolder, isWatchSupported } from "./screenshot-watcher";

const MAX_BYTES = 10 * 1024 * 1024;

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

interface InflightScreenshotProps {
  bookingId?: number | null;
  callsign?: string | null;
  route?: string | null;
  aircraft?: string | null;
  registration?: string | null;
}

/**
 * In-flight приглашение поделиться скриншотом: подсказка + drag-n-drop/выбор файла.
 * Снимок привязывается к текущему рейсу (bookingId) и попадает в галерею.
 */
/** Текущая позиция пилота из flight-map (для гео-метки скриншота). */
async function fetchMyPosition(pilotId?: string): Promise<{ lat: number; lon: number; altitude: number | null } | null> {
  if (!pilotId) return null;
  try {
    const res = await fetch("/api/vamsys/flight-map", { credentials: "include" });
    if (!res.ok) return null;
    const payload = (await res.json().catch(() => null)) as { flights?: Record<string, unknown>[] } | null;
    const mine = (payload?.flights || []).find((f) => String(f.pilotId ?? "") === String(pilotId));
    if (!mine) return null;
    const lat = Number(mine.currentLat ?? mine.latitude ?? mine.lat);
    const lon = Number(mine.currentLon ?? mine.longitude ?? mine.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    const altitude = Number(mine.altitude);
    return { lat, lon, altitude: Number.isFinite(altitude) ? altitude : null };
  } catch {
    return null;
  }
}

export function InflightScreenshot({ bookingId, callsign, route, aircraft, registration }: InflightScreenshotProps) {
  const { language } = useLanguage();
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);
  const { pilot } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [shots, setShots] = useState<{ id: string; assetUrl: string }[]>([]);
  const [showHelp, setShowHelp] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const watchFolder = getWatchFolder();
  const autoOn = isWatchSupported() && Boolean(watchFolder);

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
      if (!list.length) return;
      setUploading(true);
      try {
        let ok = 0;
        for (const file of list) {
          if (file.size > MAX_BYTES) continue;
          const dataUrl = await readAsDataUrl(file);
          const res = await fetch("/api/pilot/social-gallery/media", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              imageDataUrl: dataUrl,
              mimeType: file.type,
              fileName: file.name,
              title: file.name.replace(/\.[^.]+$/, ""),
              flight: { bookingId: bookingId || null, callsign: callsign || "", route: route || "" },
              gear: { aircraft: aircraft || "", registration: registration || "", addons: "" },
            }),
          });
          if (res.ok) {
            ok += 1;
            // гео-метка на карте по текущей позиции (живёт 30 мин)
            const payload = (await res.json().catch(() => null)) as
              | { media?: { id?: string; assetUrl?: string; title?: string } }
              | null;
            if (payload?.media?.id && payload.media.assetUrl) {
              const m = payload.media;
              setShots((prev) => [{ id: m.id as string, assetUrl: m.assetUrl as string }, ...prev].slice(0, 12));
            }
            const pos = await fetchMyPosition(pilot?.id);
            if (pos && payload?.media) {
              await fetch("/api/pilot/screenshot-pins", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  lat: pos.lat,
                  lon: pos.lon,
                  altitude: pos.altitude,
                  mediaId: payload.media.id,
                  assetUrl: payload.media.assetUrl,
                  title: payload.media.title,
                  callsign: callsign || "",
                }),
              }).catch(() => null);
            }
          }
        }
        void ok;
      } finally {
        setUploading(false);
      }
    },
    [bookingId, callsign, route, aircraft, registration, pilot?.id]
  );

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-white/5 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-500 dark:bg-red-500/15 dark:text-red-300">
            <Camera className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
              {tr("Хотите поделиться скриншотом?", "Want to share a screenshot?")}
            </div>
            <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              {autoOn
                ? tr("Автодетект включён — снимки добавятся сами. Или закиньте вручную.", "Auto-detect is on — shots upload automatically. Or drop them manually.")
                : tr("Перетащите снимок этого рейса — он попадёт в вашу галерею.", "Drop a shot from this flight — it'll go to your gallery.")}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowHelp((v) => !v)}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-white/5"
        >
          <Info className="h-3.5 w-3.5" />
          {tr("Как сделать", "How to")}
        </button>
      </div>

      {showHelp ? (
        <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs leading-relaxed text-zinc-600 dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-300">
          <div className="mb-1 font-semibold text-zinc-700 dark:text-zinc-200">
            {tr("Как сделать скриншот", "How to take a screenshot")}
          </div>
          <ul className="list-inside list-disc space-y-0.5">
            <li>{tr("MSFS: клавиша V (или Windows+PrtScn — папка «Изображения/Снимки экрана»).", "MSFS: press V (or Win+PrtScn — Pictures/Screenshots folder).")}</li>
            <li>{tr("X-Plane: меню или назначенная клавиша скриншота.", "X-Plane: menu or assigned screenshot key.")}</li>
            <li>
              {tr(
                "Включите автодетект папки в Настройках, чтобы снимки заливались сами.",
                "Enable folder auto-detect in Settings to upload shots automatically."
              )}
            </li>
          </ul>
          {autoOn ? (
            <div className="mt-2 inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <FolderOpen className="h-3.5 w-3.5" />
              {tr("Папка:", "Folder:")} <span className="font-mono">{watchFolder}</span>
            </div>
          ) : null}
        </div>
      ) : null}

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
          "mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-4 text-center text-sm transition-colors",
          dragOver
            ? "border-red-500 bg-red-50 dark:bg-red-500/10"
            : "border-zinc-200 text-zinc-500 hover:border-zinc-300 hover:bg-zinc-50 dark:border-white/10 dark:text-zinc-400 dark:hover:bg-white/5",
        ].join(" ")}
      >
        {uploading ? <Loader2 className="h-5 w-5 animate-spin text-red-500" /> : <UploadCloud className="h-5 w-5" />}
        <span className="font-medium">
          {uploading ? tr("Загрузка…", "Uploading…") : tr("Перетащите или выберите скриншот", "Drag or choose a screenshot")}
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

      {/* Виджет: снимки этого рейса */}
      {shots.length > 0 ? (
        <div className="mt-3">
          <div className="mb-1.5 inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
            <Check className="h-3.5 w-3.5" />
            {tr(`В галерее за этот рейс: ${shots.length}`, `Shared this flight: ${shots.length}`)}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {shots.map((s) => (
              <a
                key={s.id}
                href={s.assetUrl}
                target="_blank"
                rel="noreferrer"
                className="block h-16 w-24 shrink-0 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 dark:border-white/10 dark:bg-zinc-800"
              >
                <img src={s.assetUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
              </a>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
