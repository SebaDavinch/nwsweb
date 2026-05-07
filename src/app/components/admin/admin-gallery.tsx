import { useEffect, useState, useCallback } from "react";
import { Flag, Image, Loader2, Star, Trash2, CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react";
import { useLanguage } from "../../context/language-context";

interface GalleryMedia {
  id: string;
  ownerName?: string | null;
  ownerCallsign?: string | null;
  title?: string | null;
  assetUrl: string;
  likeCount?: number;
  isFeatured?: boolean;
  reportCount?: number;
  createdAt?: string;
}

interface GalleryReport {
  id: string;
  mediaId: string;
  reporterName?: string | null;
  reporterCallsign?: string | null;
  reason?: string | null;
  createdAt: string;
  resolved: boolean;
  media?: GalleryMedia | null;
}

type Tab = "media" | "reports";

export function AdminGallery() {
  const { language } = useLanguage();
  const isRu = language === "ru";
  const tr = (ru: string, en: string) => (isRu ? ru : en);

  const [tab, setTab] = useState<Tab>("media");
  const [media, setMedia] = useState<GalleryMedia[]>([]);
  const [reports, setReports] = useState<GalleryReport[]>([]);
  const [isLoadingMedia, setIsLoadingMedia] = useState(true);
  const [isLoadingReports, setIsLoadingReports] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [featuringId, setFeaturingId] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const loadMedia = useCallback(async () => {
    setIsLoadingMedia(true);
    try {
      const res = await fetch("/api/admin/gallery/media", { credentials: "include" });
      if (res.ok) {
        const payload = await res.json();
        setMedia(Array.isArray(payload?.items) ? payload.items : []);
      }
    } catch { /* ignore */ } finally {
      setIsLoadingMedia(false);
    }
  }, []);

  const loadReports = useCallback(async () => {
    setIsLoadingReports(true);
    try {
      const res = await fetch("/api/admin/gallery/reports/all", { credentials: "include" });
      if (res.ok) {
        const payload = await res.json();
        setReports(Array.isArray(payload?.reports) ? payload.reports : []);
      }
    } catch { /* ignore */ } finally {
      setIsLoadingReports(false);
    }
  }, []);

  useEffect(() => {
    void loadMedia();
    void loadReports();
  }, [loadMedia, loadReports]);

  const handleDelete = async (id: string) => {
    if (!window.confirm(tr("Удалить это фото? Это действие нельзя отменить.", "Delete this photo? This action cannot be undone."))) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/gallery/media/${id}`, { method: "DELETE", credentials: "include" });
      if (res.ok) setMedia((prev) => prev.filter((m) => m.id !== id));
    } catch { /* ignore */ } finally {
      setDeletingId(null);
    }
  };

  const handleToggleFeature = async (item: GalleryMedia) => {
    setFeaturingId(item.id);
    try {
      const res = await fetch(`/api/pilot/social-gallery/media/${item.id}/feature`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ featured: !item.isFeatured }),
      });
      if (res.ok) {
        setMedia((prev) => prev.map((m) => m.id === item.id ? { ...m, isFeatured: !item.isFeatured } : m));
      }
    } catch { /* ignore */ } finally {
      setFeaturingId(null);
    }
  };

  const handleResolveReport = async (reportId: string) => {
    setResolvingId(reportId);
    try {
      const res = await fetch(`/api/admin/gallery/reports/${reportId}/resolve`, {
        method: "PUT",
        credentials: "include",
      });
      if (res.ok) {
        setReports((prev) => prev.map((r) => r.id === reportId ? { ...r, resolved: true } : r));
      }
    } catch { /* ignore */ } finally {
      setResolvingId(null);
    }
  };

  const featuredCount = media.filter((m) => m.isFeatured).length;
  const pendingReports = reports.filter((r) => !r.resolved);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1d1d1f]">{tr("Управление галереей", "Gallery Management")}</h1>
        <p className="text-sm text-gray-500">{tr("Просмотр, удаление и продвижение фотографий пилотов", "View, delete and feature pilot photos")}</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">{tr("Всего фото", "Total photos")}</span>
            <Image className="h-4 w-4 text-[#E31E24]" />
          </div>
          <div className="mt-2 text-3xl font-bold text-gray-900">{media.length}</div>
        </div>
        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm text-amber-700">{tr("В рекомендованных", "Featured")}</span>
            <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
          </div>
          <div className="mt-2 text-3xl font-bold text-amber-900">{featuredCount}</div>
        </div>
        <div className={`rounded-2xl border p-5 shadow-sm ${pendingReports.length > 0 ? "border-red-100 bg-red-50" : "border-gray-100 bg-white"}`}>
          <div className="flex items-center justify-between">
            <span className={`text-sm ${pendingReports.length > 0 ? "text-red-700" : "text-gray-500"}`}>{tr("Жалоб на рассмотрении", "Pending reports")}</span>
            <Flag className={`h-4 w-4 ${pendingReports.length > 0 ? "text-red-500" : "text-gray-400"}`} />
          </div>
          <div className={`mt-2 text-3xl font-bold ${pendingReports.length > 0 ? "text-red-900" : "text-gray-900"}`}>{pendingReports.length}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-gray-100 p-1 w-fit">
        {(["media", "reports"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${tab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
          >
            {t === "media"
              ? tr("Все фото", "All photos")
              : `${tr("Жалобы", "Reports")}${pendingReports.length > 0 ? ` (${pendingReports.length})` : ""}`}
          </button>
        ))}
        <button
          type="button"
          onClick={() => { void loadMedia(); void loadReports(); }}
          className="ml-2 flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-gray-400 hover:text-gray-600 transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* All media tab */}
      {tab === "media" && (
        isLoadingMedia ? (
          <div className="flex items-center justify-center py-16 text-sm text-gray-400">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            {tr("Загружаем галерею...", "Loading gallery...")}
          </div>
        ) : media.length === 0 ? (
          <div className="rounded-2xl border border-gray-100 bg-gray-50 py-16 text-center text-sm text-gray-400">
            {tr("Нет фотографий", "No photos yet")}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {media.map((item) => (
              <div key={item.id} className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                <div className="relative">
                  <img src={item.assetUrl} alt={item.title || "Gallery photo"} className="h-48 w-full object-cover" />
                  {item.isFeatured && (
                    <div className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-semibold text-white shadow">
                      <Star className="h-3 w-3 fill-white" />
                      {tr("Топ", "Featured")}
                    </div>
                  )}
                  {(item.reportCount ?? 0) > 0 && (
                    <div className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-semibold text-white shadow">
                      <Flag className="h-3 w-3" />
                      {item.reportCount}
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <div className="text-sm font-medium text-gray-900 truncate">{item.ownerName || tr("Неизвестно", "Unknown")}</div>
                  {item.ownerCallsign && <div className="text-xs text-gray-400">{item.ownerCallsign.toUpperCase()}</div>}
                  {typeof item.likeCount === "number" && (
                    <div className="mt-1 text-xs text-gray-400">❤ {item.likeCount}</div>
                  )}
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleFeature(item)}
                      disabled={featuringId === item.id}
                      title={item.isFeatured ? tr("Убрать из рекомендованных", "Remove from featured") : tr("Добавить в рекомендованные", "Add to featured")}
                      className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${item.isFeatured ? "bg-amber-50 text-amber-600 hover:bg-amber-100" : "bg-gray-50 text-gray-500 hover:bg-gray-100"}`}
                    >
                      {featuringId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Star className={`h-3.5 w-3.5 ${item.isFeatured ? "fill-amber-500" : ""}`} />}
                      {item.isFeatured ? tr("Убрать", "Unfeature") : tr("Топ", "Feature")}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      disabled={deletingId === item.id}
                      title={tr("Удалить", "Delete")}
                      className="flex items-center justify-center rounded-lg bg-red-50 px-2 py-1.5 text-xs text-red-500 hover:bg-red-100 transition-colors"
                    >
                      {deletingId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Reports tab */}
      {tab === "reports" && (
        isLoadingReports ? (
          <div className="flex items-center justify-center py-16 text-sm text-gray-400">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            {tr("Загружаем жалобы...", "Loading reports...")}
          </div>
        ) : reports.length === 0 ? (
          <div className="rounded-2xl border border-gray-100 bg-gray-50 py-16 text-center text-sm text-gray-400">
            {tr("Жалоб нет", "No reports")}
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map((report) => (
              <div
                key={report.id}
                className={`rounded-2xl border p-5 shadow-sm transition-opacity ${report.resolved ? "border-gray-100 bg-gray-50 opacity-60" : "border-red-100 bg-white"}`}
              >
                <div className="flex items-start gap-4">
                  {report.media?.assetUrl && (
                    <img src={report.media.assetUrl} alt="" className="h-20 w-28 flex-shrink-0 rounded-xl object-cover" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {report.resolved ? (
                        <span className="flex items-center gap-1 text-xs font-medium text-green-600">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {tr("Рассмотрена", "Resolved")}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs font-medium text-red-600">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          {tr("Требует внимания", "Needs review")}
                        </span>
                      )}
                      <span className="text-xs text-gray-400">{new Date(report.createdAt).toLocaleString(isRu ? "ru-RU" : "en-GB")}</span>
                    </div>
                    <div className="text-sm text-gray-700">
                      <span className="font-medium">{report.reporterName || tr("Пилот", "Pilot")}</span>
                      {report.reporterCallsign && <span className="text-gray-400"> · {report.reporterCallsign.toUpperCase()}</span>}
                      <span className="text-gray-500"> {tr("пожаловался на фото", "reported a photo")}</span>
                      {report.media && (
                        <span className="text-gray-500">
                          {" "}{tr("от", "by")}{" "}
                          <span className="font-medium text-gray-700">{report.media.ownerName || "?"}</span>
                          {report.media.ownerCallsign && <span className="text-gray-400"> · {report.media.ownerCallsign.toUpperCase()}</span>}
                        </span>
                      )}
                    </div>
                    {report.reason && (
                      <div className="mt-1 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600 italic">"{report.reason}"</div>
                    )}
                    <div className="mt-3 flex gap-2 flex-wrap">
                      {!report.resolved && (
                        <button
                          type="button"
                          onClick={() => handleResolveReport(report.id)}
                          disabled={resolvingId === report.id}
                          className="flex items-center gap-1.5 rounded-lg bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 transition-colors"
                        >
                          {resolvingId === report.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                          {tr("Отклонить жалобу", "Dismiss report")}
                        </button>
                      )}
                      {report.media && (
                        <button
                          type="button"
                          onClick={() => { if (report.media) handleDelete(report.media.id); }}
                          disabled={deletingId === report.media.id}
                          className="flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors"
                        >
                          {deletingId === report.media.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                          {tr("Удалить фото", "Delete photo")}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
