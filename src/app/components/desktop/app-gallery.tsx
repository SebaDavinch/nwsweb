import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Heart, Upload, X, Loader2, Images, Sparkles, User as UserIcon, Plane, Calendar, FolderSync, FolderOpen, Tag } from "lucide-react";
import { useLanguage } from "../../context/language-context";
import { getWatchFolder, setWatchFolder, pickFolder, isWatchSupported } from "./screenshot-watcher";

interface GalleryMedia {
  id: string;
  title: string;
  description?: string;
  assetUrl: string;
  ownerName: string;
  ownerCallsign?: string | null;
  likeCount: number;
  likedByViewer: boolean;
  isOwner: boolean;
  createdAt: string | null;
  categoryIds: string[];
  tags: string[];
  flight?: { callsign?: string | null; route?: string | null } | null;
  gear?: { aircraft?: string | null; registration?: string | null; addons?: string[] } | null;
}
interface GalleryCategory {
  id: string;
  title: string;
}
interface GalleryPayload {
  categories: GalleryCategory[];
  myMedia: GalleryMedia[];
  communityMedia: GalleryMedia[];
  topShots: GalleryMedia[];
}

type Tab = "feed" | "mine" | "top";
const MAX_BYTES = 10 * 1024 * 1024;

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

export function AppGallery() {
  const { language } = useLanguage();
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);
  const locale = language === "ru" ? "ru-RU" : "en-US";
  const [data, setData] = useState<GalleryPayload | null>(null);
  const [tab, setTab] = useState<Tab>("feed");
  const [category, setCategory] = useState<string>("all");
  const [lightbox, setLightbox] = useState<GalleryMedia | null>(null);
  const [liking, setLiking] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [folder, setFolder] = useState(getWatchFolder());
  const [showDetails, setShowDetails] = useState(false);
  const [meta, setMeta] = useState({ description: "", aircraft: "", registration: "", addons: "" });
  const inputRef = useRef<HTMLInputElement | null>(null);
  const watchSupported = isWatchSupported();

  const chooseFolder = async () => {
    const path = await pickFolder();
    if (path) {
      setFolder(path);
      setWatchFolder(path);
    }
  };

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/pilot/social-gallery", { credentials: "include" });
      if (res.ok) setData(await res.json());
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const source = tab === "mine" ? data?.myMedia : tab === "top" ? data?.topShots : data?.communityMedia;
  const items = useMemo(() => {
    const list = Array.isArray(source) ? source : [];
    if (category === "all") return list;
    return list.filter((m) => m.categoryIds?.includes(category));
  }, [source, category]);

  const toggleLike = async (m: GalleryMedia) => {
    if (liking) return;
    setLiking(m.id);
    // оптимистично
    const delta = m.likedByViewer ? -1 : 1;
    const patch = (x: GalleryMedia) =>
      x.id === m.id ? { ...x, likedByViewer: !x.likedByViewer, likeCount: Math.max(0, x.likeCount + delta) } : x;
    setData((d) =>
      d
        ? { ...d, myMedia: d.myMedia.map(patch), communityMedia: d.communityMedia.map(patch), topShots: d.topShots.map(patch) }
        : d
    );
    if (lightbox?.id === m.id) setLightbox(patch(lightbox));
    try {
      await fetch(`/api/pilot/social-gallery/media/${encodeURIComponent(m.id)}/like`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      /* ignore */
    } finally {
      setLiking(null);
    }
  };

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files).filter((f) => f.type.startsWith("image/") && f.size <= MAX_BYTES);
      if (!list.length) return;
      setUploading(true);
      try {
        for (const file of list) {
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
              description: meta.description || "",
              gear: { aircraft: meta.aircraft, registration: meta.registration, addons: meta.addons },
            }),
          });
        }
        await load();
        setTab("mine");
      } finally {
        setUploading(false);
      }
    },
    [load, meta]
  );

  const fmtDate = (v: string | null) => {
    const t = new Date(String(v || "")).getTime();
    return Number.isFinite(t) && t > 0 ? new Date(t).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" }) : "";
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "feed", label: tr("Лента", "Feed"), icon: <Images className="h-4 w-4" /> },
    { id: "top", label: tr("Топ", "Top"), icon: <Sparkles className="h-4 w-4" /> },
    { id: "mine", label: tr("Мои", "Mine"), icon: <UserIcon className="h-4 w-4" /> },
  ];

  return (
    <div>
      {/* Панель: вкладки + загрузка */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-zinc-200 bg-white p-1 dark:border-white/10 dark:bg-zinc-900">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={[
                "inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors",
                tab === t.id ? "bg-red-500 text-white" : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100",
              ].join(" ")}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {watchSupported ? (
            <button
              type="button"
              onClick={chooseFolder}
              title={folder || tr("Папка скриншотов симулятора", "Sim screenshot folder")}
              className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium ${
                folder
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400"
                  : "border-zinc-200 text-zinc-600 hover:bg-zinc-100 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/5"
              }`}
            >
              {folder ? <FolderSync className="h-4 w-4" /> : <FolderOpen className="h-4 w-4" />}
              <span className="hidden sm:inline">
                {folder ? tr("Авто-импорт вкл", "Auto-import on") : tr("Авто-импорт папки", "Auto-import folder")}
              </span>
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setShowDetails((v) => !v)}
            className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium ${
              showDetails ? "border-red-300 bg-red-50 text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400" : "border-zinc-200 text-zinc-600 hover:bg-zinc-100 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/5"
            }`}
          >
            <Tag className="h-4 w-4" />
            <span className="hidden sm:inline">{tr("Детали", "Details")}</span>
          </button>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {tr("Загрузить", "Upload")}
          </button>
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

      {/* Фильтр категорий */}
      {data?.categories?.length ? (
        <div className="mb-4 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setCategory("all")}
            className={`rounded-full px-3 py-1 text-xs font-medium ${category === "all" ? "bg-red-500 text-white" : "bg-zinc-100 text-zinc-600 dark:bg-white/5 dark:text-zinc-300"}`}
          >
            {tr("Все", "All")}
          </button>
          {data.categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.id)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${category === c.id ? "bg-red-500 text-white" : "bg-zinc-100 text-zinc-600 dark:bg-white/5 dark:text-zinc-300"}`}
            >
              {c.title}
            </button>
          ))}
        </div>
      ) : null}

      {/* Опциональные детали для загрузки */}
      {showDetails ? (
        <div className="mb-4 grid grid-cols-1 gap-2 rounded-2xl border border-zinc-200 bg-white p-3 dark:border-white/10 dark:bg-zinc-900 sm:grid-cols-2">
          <input
            value={meta.aircraft}
            onChange={(e) => setMeta((m) => ({ ...m, aircraft: e.target.value }))}
            placeholder={tr("Тип ВС (ICAO), напр. B738", "Aircraft (ICAO), e.g. B738")}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-950 dark:text-zinc-100"
          />
          <input
            value={meta.registration}
            onChange={(e) => setMeta((m) => ({ ...m, registration: e.target.value }))}
            placeholder={tr("Регистрация, напр. VQ-BCD", "Registration, e.g. VQ-BCD")}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-950 dark:text-zinc-100"
          />
          <input
            value={meta.addons}
            onChange={(e) => setMeta((m) => ({ ...m, addons: e.target.value }))}
            placeholder={tr("Аддоны через запятую (Fenix, FSLTL…)", "Addons, comma-separated (Fenix, FSLTL…)")}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-950 dark:text-zinc-100 sm:col-span-2"
          />
          <input
            value={meta.description}
            onChange={(e) => setMeta((m) => ({ ...m, description: e.target.value }))}
            placeholder={tr("Описание (необязательно)", "Description (optional)")}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-950 dark:text-zinc-100 sm:col-span-2"
          />
          <div className="text-xs text-zinc-400 sm:col-span-2">
            {tr("Применится к следующим загрузкам.", "Applies to your next uploads.")}
          </div>
        </div>
      ) : null}

      {/* Masonry-сетка с drag-n-drop */}
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
        className={`rounded-2xl transition-colors ${dragOver ? "bg-red-50 ring-2 ring-dashed ring-red-400 dark:bg-red-500/10" : ""}`}
      >
        {items.length === 0 ? (
          <div className="mx-auto max-w-lg py-10 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-500 dark:bg-red-500/10">
              <Images className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              {tr("Поделитесь первым скриншотом", "Share your first screenshot")}
            </h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-zinc-500 dark:text-zinc-400">
              {tr(
                "Скриншоты появятся здесь и в вашей галерее сообщества. Всего три шага:",
                "Screenshots appear here and in the community gallery. Just three steps:"
              )}
            </p>

            <div className="mt-5 space-y-2 text-left">
              {[
                {
                  n: 1,
                  title: tr("Сделайте снимок в симуляторе", "Take a shot in the sim"),
                  desc: tr(
                    "MSFS: клавиша V (или Windows+PrtScn → папка «Изображения/Снимки экрана»). X-Plane: назначенная клавиша скриншота.",
                    "MSFS: press V (or Win+PrtScn → Pictures/Screenshots). X-Plane: your assigned screenshot key."
                  ),
                },
                {
                  n: 2,
                  title: tr("Подключите авто-импорт или перетащите файл", "Enable auto-import or drag a file"),
                  desc: tr(
                    "Нажмите «Авто-импорт папки» вверху и выберите папку скриншотов — новые снимки зальются сами. Или перетащите файлы прямо сюда.",
                    "Click “Auto-import folder” above and pick your screenshots folder — new shots upload automatically. Or drag files right here."
                  ),
                },
                {
                  n: 3,
                  title: tr("Готово — снимок в галерее", "Done — it's in the gallery"),
                  desc: tr(
                    "Во время полёта снимки привязываются к рейсу и появляются меткой на карте.",
                    "During a flight, shots are linked to the flight and pinned on the map."
                  ),
                },
              ].map((step) => (
                <div
                  key={step.n}
                  className="flex gap-3 rounded-xl border border-zinc-200 bg-white p-3 dark:border-white/10 dark:bg-zinc-900"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-500 text-sm font-bold text-white">
                    {step.n}
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{step.title}</div>
                    <div className="mt-0.5 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{step.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 flex items-center justify-center gap-2">
              {watchSupported ? (
                <button
                  type="button"
                  onClick={chooseFolder}
                  className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-white/10 dark:text-zinc-200 dark:hover:bg-white/5"
                >
                  <FolderOpen className="h-4 w-4" />
                  {tr("Авто-импорт папки", "Auto-import folder")}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-400"
              >
                <Upload className="h-4 w-4" />
                {tr("Загрузить скриншот", "Upload a screenshot")}
              </button>
            </div>
          </div>
        ) : (
          <div className="columns-2 gap-3 sm:columns-3 lg:columns-4 [&>*]:mb-3">
            {items.map((m) => (
              <div
                key={m.id}
                className="group relative cursor-pointer overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 break-inside-avoid dark:border-white/10 dark:bg-zinc-800"
                onClick={() => setLightbox(m)}
              >
                <img src={m.assetUrl} alt={m.title} loading="lazy" className="w-full transition-transform duration-300 group-hover:scale-[1.03]" />
                {/* Оверлей */}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-2.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <div className="min-w-0">
                    <div className="truncate text-xs font-semibold text-white">{m.ownerName}</div>
                    {m.flight?.route ? <div className="truncate text-[10px] text-white/70">{m.flight.route}</div> : null}
                  </div>
                </div>
                {/* Лайк */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void toggleLike(m);
                  }}
                  className={`absolute right-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold backdrop-blur transition-colors ${
                    m.likedByViewer ? "bg-red-500 text-white" : "bg-black/40 text-white hover:bg-black/60"
                  }`}
                >
                  <Heart className={`h-3.5 w-3.5 ${m.likedByViewer ? "fill-current" : ""}`} />
                  {m.likeCount}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Лайтбокс */}
      {lightbox ? (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-6" onClick={() => setLightbox(null)}>
          <div className="relative max-h-full w-full max-w-3xl overflow-hidden rounded-2xl bg-zinc-900 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setLightbox(null)} className="absolute right-2 top-2 z-10 rounded-full bg-black/50 p-1.5 text-white hover:bg-black/70">
              <X className="h-4 w-4" />
            </button>
            <img src={lightbox.assetUrl} alt={lightbox.title} className="max-h-[72vh] w-full object-contain" />
            <div className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-zinc-100">{lightbox.title || lightbox.ownerName}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-zinc-400">
                  <span className="inline-flex items-center gap-1"><UserIcon className="h-3 w-3" />{lightbox.ownerName}</span>
                  {lightbox.flight?.route ? <span className="inline-flex items-center gap-1"><Plane className="h-3 w-3" />{lightbox.flight.route}</span> : null}
                  {lightbox.createdAt ? <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{fmtDate(lightbox.createdAt)}</span> : null}
                </div>
                {/* Теги: тип ВС / регистрация / аддоны */}
                {lightbox.gear && (lightbox.gear.aircraft || lightbox.gear.registration || (lightbox.gear.addons?.length ?? 0) > 0) ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {lightbox.gear.aircraft ? (
                      <span className="rounded-md bg-sky-500/15 px-2 py-0.5 text-[11px] font-semibold text-sky-300">{lightbox.gear.aircraft}</span>
                    ) : null}
                    {lightbox.gear.registration ? (
                      <span className="rounded-md bg-violet-500/15 px-2 py-0.5 text-[11px] font-semibold text-violet-300">{lightbox.gear.registration}</span>
                    ) : null}
                    {(lightbox.gear.addons || []).map((a) => (
                      <span key={a} className="rounded-md bg-white/10 px-2 py-0.5 text-[11px] text-zinc-300">{a}</span>
                    ))}
                  </div>
                ) : null}
                {lightbox.description ? <p className="mt-2 text-xs leading-relaxed text-zinc-400">{lightbox.description}</p> : null}
              </div>
              <button
                type="button"
                onClick={() => void toggleLike(lightbox)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                  lightbox.likedByViewer ? "bg-red-500 text-white" : "bg-white/10 text-zinc-200 hover:bg-white/20"
                }`}
              >
                <Heart className={`h-4 w-4 ${lightbox.likedByViewer ? "fill-current" : ""}`} />
                {lightbox.likeCount}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
