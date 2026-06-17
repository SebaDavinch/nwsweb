import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, ImagePlus, Loader2, UploadCloud } from "lucide-react";
import { useLanguage } from "../../context/language-context";

interface Screenshot {
  id: string;
  title: string;
  assetUrl: string;
  createdAt: string | null;
}

interface PirepScreenshotsProps {
  pirepId: number;
  callsign?: string | null;
  route?: string | null;
}

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function PirepScreenshots({ pirepId, callsign, route }: PirepScreenshotsProps) {
  const { language } = useLanguage();
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);
  const [open, setOpen] = useState(true);
  const [items, setItems] = useState<Screenshot[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/pilot/pireps/${pirepId}/screenshots`, { credentials: "include" });
      const payload = (await res.json().catch(() => null)) as { screenshots?: Screenshot[] } | null;
      if (res.ok && Array.isArray(payload?.screenshots)) setItems(payload!.screenshots!);
    } catch {
      /* ignore */
    }
  }, [pirepId]);

  useEffect(() => {
    void load();
  }, [load]);

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
      if (list.length === 0) return;
      setUploading(true);
      setError(null);
      try {
        for (const file of list) {
          if (file.size > MAX_BYTES) {
            setError(tr("Файл больше 10 МБ пропущен", "File over 10 MB skipped"));
            continue;
          }
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
              flight: { pirepId, callsign: callsign || "", route: route || "" },
            }),
          });
          if (!res.ok) {
            const p = await res.json().catch(() => null);
            setError(String(p?.error || tr("Не удалось загрузить", "Upload failed")));
          }
        }
        await load();
      } finally {
        setUploading(false);
      }
    },
    [pirepId, callsign, route, load, tr]
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-3.5 text-left transition-colors hover:bg-gray-50"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold uppercase tracking-wider text-gray-600">
            {tr("Скриншоты", "Screenshots")}
          </span>
          {items.length > 0 && (
            <span className="rounded-full bg-[#E31E24] px-2 py-0.5 text-[10px] font-bold text-white">{items.length}</span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
      </button>

      {open && (
        <div className="border-t border-gray-100 p-5">
          {/* Сетка превью */}
          {items.length > 0 && (
            <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {items.map((s) => (
                <a
                  key={s.id}
                  href={s.assetUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="group relative aspect-video overflow-hidden rounded-lg border border-gray-200 bg-gray-100"
                  title={s.title}
                >
                  <img
                    src={s.assetUrl}
                    alt={s.title}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  />
                </a>
              ))}
            </div>
          )}

          {/* Drag-n-drop зона */}
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
              "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors",
              dragOver ? "border-[#E31E24] bg-red-50" : "border-gray-200 hover:border-gray-300 hover:bg-gray-50",
            ].join(" ")}
          >
            {uploading ? (
              <Loader2 className="h-6 w-6 animate-spin text-[#E31E24]" />
            ) : (
              <UploadCloud className="h-6 w-6 text-gray-400" />
            )}
            <div className="text-sm font-medium text-gray-600">
              {uploading
                ? tr("Загрузка…", "Uploading…")
                : tr("Перетащите скриншоты сюда или нажмите", "Drag screenshots here or click")}
            </div>
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <ImagePlus className="h-3.5 w-3.5" />
              {tr("JPG/PNG до 10 МБ · добавятся в вашу галерею", "JPG/PNG up to 10 MB · added to your gallery")}
            </div>
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

          {error && <div className="mt-2 text-xs text-red-600">{error}</div>}
        </div>
      )}
    </div>
  );
}
