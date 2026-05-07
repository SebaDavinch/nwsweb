import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Camera,
  Copy,
  Flag,
  FolderOpen,
  Heart,
  ImagePlus,
  Loader2,
  Medal,
  PlusCircle,
  Sparkles,
  Star,
  Tags,
  Trophy,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "../../context/language-context";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Progress } from "../ui/progress";
import { Textarea } from "../ui/textarea";

interface GalleryProfile {
  pilotId?: number | null;
  username?: string | null;
  name: string;
  rank?: string | null;
  avatar?: string | null;
  metrics: {
    uploads: number;
    likesReceived: number;
    likesGiven: number;
    albums: number;
    categories: number;
    featured: number;
  };
  reputation: {
    tier: number;
    label: string;
    reputation: number;
    currentStatusFloor: number;
    nextStatusReputation: number;
    progressPercent: number;
  };
}

interface GalleryCategory {
  id: string;
  title: string;
  description?: string;
  color?: string;
  isSystem?: boolean;
}

interface GalleryAlbum {
  id: string;
  title: string;
  description?: string;
  visibility: "public" | "private";
  mediaCount: number;
  coverUrl?: string | null;
}

interface GalleryMedia {
  id: string;
  title: string;
  description?: string;
  assetUrl: string;
  createdAt?: string | null;
  visibility: "public" | "private";
  ownerName: string;
  ownerRank?: string | null;
  albumTitle?: string | null;
  tags: string[];
  likeCount: number;
  likedByViewer: boolean;
  categories: GalleryCategory[];
  isOwner?: boolean;
  isFeatured?: boolean;
  ownerCallsign?: string | null;
  reportCount?: number;
}

interface GalleryFeedItem {
  id: string;
  type: string;
  createdAt?: string | null;
  title: string;
  summary: string;
  actor: {
    name: string;
    username?: string | null;
  };
  media?: GalleryMedia | null;
  album?: GalleryAlbum | null;
  category?: GalleryCategory | null;
}

interface GalleryPilotRanking {
  key: string;
  name: string;
  rank?: string | null;
  uploads: number;
  likesReceived: number;
  likesGiven: number;
  albums: number;
  categories: number;
  featured: number;
  reputation: {
    tier: number;
    label: string;
    reputation: number;
  };
}

interface FeaturedPick {
  id: string;
  title: string;
  assetUrl: string;
  ownerName?: string | null;
  likeCount?: number;
}

interface SocialGalleryPayload {
  profile: GalleryProfile;
  categories: GalleryCategory[];
  myAlbums: GalleryAlbum[];
  myMedia: GalleryMedia[];
  communityMedia: GalleryMedia[];
  communityAlbums: GalleryAlbum[];
  feed: GalleryFeedItem[];
  topShots: GalleryMedia[];
  topPilots: GalleryPilotRanking[];
  featuredPicks: FeaturedPick[];
}

const formatRelativeTime = (value?: string | null, ru = false) => {
  const parsed = value ? new Date(value) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) {
    return ru ? "только что" : "just now";
  }
  const diffMs = Date.now() - parsed.getTime();
  const minutes = Math.max(1, Math.floor(diffMs / 60000));
  if (minutes < 60) {
    return ru ? `${minutes} мин назад` : `${minutes} min ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return ru ? `${hours} ч назад` : `${hours} hour${hours > 1 ? "s" : ""} ago`;
  }
  const days = Math.floor(hours / 24);
  return ru ? `${days} дн назад` : `${days} day${days > 1 ? "s" : ""} ago`;
};

const toDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });

export function PilotSocialGallery() {
  const { language } = useLanguage();
  const [data, setData] = useState<SocialGalleryPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [isCreatingAlbum, setIsCreatingAlbum] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [likingMediaId, setLikingMediaId] = useState<string | null>(null);
  const [categoryTitle, setCategoryTitle] = useState("");
  const [categoryDescription, setCategoryDescription] = useState("");
  const [categoryColor, setCategoryColor] = useState("#E31E24");
  const [albumTitle, setAlbumTitle] = useState("");
  const [albumDescription, setAlbumDescription] = useState("");
  const [albumVisibility, setAlbumVisibility] = useState<"public" | "private">("public");
  const [selectedAlbumCategories, setSelectedAlbumCategories] = useState<string[]>([]);
  const [mediaTitle, setMediaTitle] = useState("");
  const [mediaDescription, setMediaDescription] = useState("");
  const [mediaTags, setMediaTags] = useState("");
  const [mediaAlbumId, setMediaAlbumId] = useState("");
  const [mediaVisibility, setMediaVisibility] = useState<"public" | "private">("public");
  const [selectedMediaCategories, setSelectedMediaCategories] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const isRu = language === "ru";
  const tr = useCallback((ru: string, en: string) => (isRu ? ru : en), [isRu]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/pilot/social-gallery", { credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(String(payload?.error || "Failed to load social gallery"));
      }
      setData(payload);
    } catch (error) {
      toast.error(String(error instanceof Error ? error.message : tr("Не удалось загрузить галерею", "Failed to load gallery")));
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [tr]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const allCategories = data?.categories || [];
  const myAlbums = data?.myAlbums || [];
  const topShots = data?.topShots || [];
  const feed = data?.feed || [];
  const topPilots = data?.topPilots || [];
  const featuredPicks = data?.featuredPicks || [];

  const toggleSelection = (current: string[], value: string, setter: (next: string[]) => void) => {
    setter(current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  };

  const updateMediaInState = useCallback((nextMedia: GalleryMedia) => {
    setData((current) => {
      if (!current) {
        return current;
      }
      const replaceInList = (list: GalleryMedia[]) => list.map((item) => (item.id === nextMedia.id ? nextMedia : item));
      return {
        ...current,
        myMedia: replaceInList(current.myMedia),
        communityMedia: replaceInList(current.communityMedia),
        topShots: replaceInList(current.topShots),
        feed: current.feed.map((item) => (item.media?.id === nextMedia.id ? { ...item, media: nextMedia } : item)),
      };
    });
  }, []);

  const handleCategoryCreate = async () => {
    if (!categoryTitle.trim()) {
      toast.error(tr("Нужно название категории", "Category title is required"));
      return;
    }
    setIsCreatingCategory(true);
    try {
      const response = await fetch("/api/pilot/social-gallery/categories", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: categoryTitle,
          description: categoryDescription,
          color: categoryColor,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(String(payload?.error || "Failed to create category"));
      }
      toast.success(tr("Категория создана", "Category created"));
      setCategoryTitle("");
      setCategoryDescription("");
      await loadData();
    } catch (error) {
      toast.error(String(error instanceof Error ? error.message : tr("Не удалось создать категорию", "Failed to create category")));
    } finally {
      setIsCreatingCategory(false);
    }
  };

  const handleAlbumCreate = async () => {
    if (!albumTitle.trim()) {
      toast.error(tr("Нужно название альбома", "Album title is required"));
      return;
    }
    setIsCreatingAlbum(true);
    try {
      const response = await fetch("/api/pilot/social-gallery/albums", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: albumTitle,
          description: albumDescription,
          visibility: albumVisibility,
          categoryIds: selectedAlbumCategories,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(String(payload?.error || "Failed to create album"));
      }
      toast.success(tr("Альбом создан", "Album created"));
      setAlbumTitle("");
      setAlbumDescription("");
      setSelectedAlbumCategories([]);
      setAlbumVisibility("public");
      await loadData();
    } catch (error) {
      toast.error(String(error instanceof Error ? error.message : tr("Не удалось создать альбом", "Failed to create album")));
    } finally {
      setIsCreatingAlbum(false);
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setSelectedFile(file);
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    try {
      const dataUrl = await toDataUrl(file);
      setPreviewUrl(dataUrl);
      if (!mediaTitle.trim()) {
        setMediaTitle(file.name.replace(/\.[^.]+$/, ""));
      }
    } catch {
      toast.error(tr("Не удалось прочитать файл", "Failed to read selected file"));
      setPreviewUrl(null);
      setSelectedFile(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !previewUrl) {
      toast.error(tr("Сначала выберите скриншот", "Select a screenshot first"));
      return;
    }
    setIsUploading(true);
    try {
      const response = await fetch("/api/pilot/social-gallery/media", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: mediaTitle,
          description: mediaDescription,
          tags: mediaTags,
          albumId: mediaAlbumId || null,
          visibility: mediaVisibility,
          categoryIds: selectedMediaCategories,
          imageDataUrl: previewUrl,
          mimeType: selectedFile.type,
          fileName: selectedFile.name,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(String(payload?.error || "Failed to upload screenshot"));
      }
      toast.success(tr("Скриншот опубликован", "Screenshot published"));
      setMediaTitle("");
      setMediaDescription("");
      setMediaTags("");
      setMediaAlbumId("");
      setMediaVisibility("public");
      setSelectedMediaCategories([]);
      setSelectedFile(null);
      setPreviewUrl(null);
      await loadData();
    } catch (error) {
      toast.error(String(error instanceof Error ? error.message : tr("Не удалось загрузить скриншот", "Failed to upload screenshot")));
    } finally {
      setIsUploading(false);
    }
  };

  const toggleLike = async (mediaId: string) => {
    setLikingMediaId(mediaId);
    try {
      const response = await fetch(`/api/pilot/social-gallery/media/${mediaId}/like`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(String(payload?.error || "Failed to update like"));
      }
      if (payload?.media) {
        updateMediaInState(payload.media);
      }
    } catch (error) {
      toast.error(String(error instanceof Error ? error.message : tr("Не удалось обновить лайк", "Failed to update like")));
    } finally {
      setLikingMediaId(null);
    }
  };

  const [featuringMediaId, setFeaturingMediaId] = useState<string | null>(null);
  const [reportingMediaId, setReportingMediaId] = useState<string | null>(null);

  const toggleFeature = async (mediaId: string) => {
    setFeaturingMediaId(mediaId);
    try {
      const response = await fetch(`/api/pilot/social-gallery/media/${mediaId}/feature`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(String(payload?.error || tr("Нет доступа", "Access denied")));
      }
      if (payload?.media) updateMediaInState(payload.media);
      toast.success(payload?.isFeatured ? tr("Скрин теперь рекомендован", "Screenshot featured") : tr("Убрано из рекомендованных", "Removed from featured"));
    } catch (error) {
      toast.error(String(error instanceof Error ? error.message : tr("Ошибка", "Error")));
    } finally {
      setFeaturingMediaId(null);
    }
  };

  const submitReport = async (mediaId: string, reason: string) => {
    setReportingMediaId(mediaId);
    try {
      const response = await fetch(`/api/pilot/social-gallery/media/${mediaId}/report`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(String(payload?.error || "Failed to report"));
      toast.success(tr("Жалоба отправлена. Мы рассмотрим её в ближайшее время.", "Report submitted. We will review it shortly."));
    } catch (error) {
      toast.error(String(error instanceof Error ? error.message : tr("Ошибка", "Error")));
    } finally {
      setReportingMediaId(null);
    }
  };

  const isCaptain = useMemo(() => {
    const rank = String(data?.profile?.rank || "").toLowerCase();
    return rank.includes("captain") || rank.includes("капитан") || rank.includes("commander") || rank.includes("командир");
  }, [data?.profile?.rank]);

  const copyUrl = async (value: string, successMessage: string) => {
    try {
      if (!navigator.clipboard) {
        throw new Error("Clipboard unavailable");
      }
      await navigator.clipboard.writeText(value);
      toast.success(successMessage);
    } catch {
      toast.error(tr("Не удалось скопировать ссылку", "Failed to copy URL"));
    }
  };

  const progressLabel = useMemo(() => {
    if (!data?.profile) {
      return "";
    }
    const current = data.profile.reputation.reputation - data.profile.reputation.currentStatusFloor;
    const target = data.profile.reputation.nextStatusReputation - data.profile.reputation.currentStatusFloor;
    return `${current}/${target} REP`;
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex min-h-[45vh] items-center justify-center text-sm text-gray-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        {tr("Загружаем social gallery...", "Loading social gallery...")}
      </div>
    );
  }

  if (!data) {
    return <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-sm text-gray-500">{tr("Модуль галереи сейчас недоступен.", "The gallery module is currently unavailable.")}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
        <Card className="overflow-hidden border-none bg-[radial-gradient(circle_at_top_left,_rgba(227,30,36,0.18),_transparent_38%),linear-gradient(135deg,_#1d1d1f_0%,_#2f2f34_100%)] text-white shadow-sm">
          <CardContent className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/70">
                  <Sparkles className="h-3.5 w-3.5" />
                  {tr("Галерея", "Gallery")}
                </div>
                <h1 className="mt-4 text-3xl font-bold tracking-tight">{tr("Скриншоты, альбомы и лента сообщества", "Screenshots, albums and a community feed")}</h1>
                <p className="mt-3 max-w-xl text-sm leading-6 text-white/70">
                  {tr(
                    "Пилоты собирают свои альбомы, создают категории, получают репутацию от сообщества, а лучшие кадры можно использовать в подборках сайта и баннерных сценариях.",
                    "Pilots build their own albums, create categories, grow reputation across the community, and surface the best shots for site collections and banner workflows."
                  )}
                </p>
              </div>
              <div className="min-w-[250px] rounded-2xl border border-white/10 bg-white/6 p-4 backdrop-blur-sm">
                <div className="text-xs uppercase tracking-[0.2em] text-white/55">{tr("Ваш статус", "Your status")}</div>
                <div className="mt-2 flex items-end gap-3">
                  <div>
                    <div className="text-3xl font-bold">{data.profile.reputation.label}</div>
                    <div className="mt-1 text-xs uppercase tracking-[0.18em] text-white/55">Tier {data.profile.reputation.tier}</div>
                  </div>
                  <div className="pb-1 text-sm text-white/60">{progressLabel}</div>
                </div>
                <Progress value={data.profile.reputation.progressPercent} className="mt-4 h-2.5 bg-white/10 [&_[data-slot=progress-indicator]]:bg-[#E31E24]" />
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-white/80">
                  <div className="rounded-xl border border-white/8 bg-black/10 p-3">
                    <div className="text-xs uppercase tracking-[0.18em] text-white/45">REP</div>
                    <div className="mt-1 font-semibold">{data.profile.reputation.reputation}</div>
                  </div>
                  <div className="rounded-xl border border-white/8 bg-black/10 p-3">
                    <div className="text-xs uppercase tracking-[0.18em] text-white/45">{tr("Лайки", "Likes")}</div>
                    <div className="mt-1 font-semibold">{data.profile.metrics.likesReceived}</div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
          {[
            { label: tr("Публикации", "Uploads"), value: data.profile.metrics.uploads, icon: Camera },
            { label: tr("Альбомы", "Albums"), value: data.profile.metrics.albums, icon: FolderOpen },
            { label: tr("Категории", "Categories"), value: data.profile.metrics.categories, icon: Tags },
            { label: tr("Лайки выданы", "Likes given"), value: data.profile.metrics.likesGiven, icon: Heart },
          ].map((item) => (
            <Card key={item.label} className="border-none shadow-sm">
              <CardContent className="flex items-center justify-between p-5">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-gray-400">{item.label}</div>
                  <div className="mt-2 text-2xl font-bold text-[#1d1d1f]">{item.value}</div>
                </div>
                <div className="rounded-2xl bg-red-50 p-3 text-[#E31E24]">
                  <item.icon className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_1.1fr_0.9fr]">
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><PlusCircle className="h-4 w-4 text-[#E31E24]" />{tr("Создать категорию", "Create category")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input value={categoryTitle} onChange={(event) => setCategoryTitle(event.target.value)} placeholder={tr("Например: Ночные посадки", "Example: Night arrivals")} />
            <Textarea value={categoryDescription} onChange={(event) => setCategoryDescription(event.target.value)} placeholder={tr("Коротко опишите тему категории", "Briefly describe the category theme")} className="min-h-[92px]" />
            <div className="flex items-center gap-3">
              <input type="color" value={categoryColor} onChange={(event) => setCategoryColor(event.target.value)} className="h-10 w-14 rounded-md border border-gray-200 bg-transparent" />
              <div className="text-xs text-gray-500">{tr("Цвет поможет визуально отделять подборки и теги в ленте.", "Color helps separate collections and tags across the feed.")}</div>
            </div>
            <Button onClick={handleCategoryCreate} disabled={isCreatingCategory} className="bg-[#E31E24] hover:bg-[#c41a20]">
              {isCreatingCategory ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Tags className="mr-2 h-4 w-4" />}
              {tr("Создать категорию", "Create category")}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><FolderOpen className="h-4 w-4 text-[#E31E24]" />{tr("Создать альбом", "Create album")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input value={albumTitle} onChange={(event) => setAlbumTitle(event.target.value)} placeholder={tr("Например: Summer Ops 2026", "Example: Summer Ops 2026")} />
            <Textarea value={albumDescription} onChange={(event) => setAlbumDescription(event.target.value)} placeholder={tr("Что собираете в этом альбоме", "What this album is collecting")} className="min-h-[92px]" />
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant={albumVisibility === "public" ? "default" : "outline"} className={albumVisibility === "public" ? "bg-[#E31E24] hover:bg-[#c41a20]" : ""} onClick={() => setAlbumVisibility("public")}>{tr("Публичный", "Public")}</Button>
              <Button type="button" variant={albumVisibility === "private" ? "default" : "outline"} className={albumVisibility === "private" ? "bg-[#2A2A2A] hover:bg-[#1d1d1f]" : ""} onClick={() => setAlbumVisibility("private")}>{tr("Приватный", "Private")}</Button>
            </div>
            <div className="rounded-2xl border border-gray-200 p-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">{tr("Категории альбома", "Album categories")}</div>
              <div className="flex flex-wrap gap-2">
                {allCategories.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => toggleSelection(selectedAlbumCategories, category.id, setSelectedAlbumCategories)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition ${selectedAlbumCategories.includes(category.id) ? "border-transparent text-white" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}
                    style={selectedAlbumCategories.includes(category.id) ? { backgroundColor: category.color || "#E31E24" } : undefined}
                  >
                    {category.title}
                  </button>
                ))}
              </div>
            </div>
            <Button onClick={handleAlbumCreate} disabled={isCreatingAlbum} className="bg-[#E31E24] hover:bg-[#c41a20]">
              {isCreatingAlbum ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FolderOpen className="mr-2 h-4 w-4" />}
              {tr("Создать альбом", "Create album")}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><Medal className="h-4 w-4 text-[#E31E24]" />{tr("Топ пилотов", "Top pilots")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {topPilots.slice(0, 5).map((pilot, index) => (
              <div key={pilot.key} className="flex items-center justify-between rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-[#1d1d1f]">#{index + 1} {pilot.name}</div>
                  <div className="mt-1 text-xs text-gray-500">{pilot.rank || tr("Пилот", "Pilot")} · {pilot.likesReceived} {tr("лайков", "likes")}</div>
                </div>
                <Badge className="bg-[#1d1d1f] text-white">{pilot.reputation.label}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><Upload className="h-4 w-4 text-[#E31E24]" />{tr("Опубликовать скриншот", "Publish a screenshot")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
          <div className="space-y-3">
            <Input value={mediaTitle} onChange={(event) => setMediaTitle(event.target.value)} placeholder={tr("Название кадра", "Shot title")} />
            <Textarea value={mediaDescription} onChange={(event) => setMediaDescription(event.target.value)} placeholder={tr("Подпись, маршрут, погода, момент полета", "Caption, route, weather, flight moment")} className="min-h-[104px]" />
            <Input value={mediaTags} onChange={(event) => setMediaTags(event.target.value)} placeholder={tr("Теги через запятую: sunset, touchdown, vnukovo", "Comma-separated tags: sunset, touchdown, vnukovo")} />
            <div className="grid gap-3 sm:grid-cols-2">
              <select value={mediaAlbumId} onChange={(event) => setMediaAlbumId(event.target.value)} className="h-10 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-700">
                <option value="">{tr("Без альбома", "No album")}</option>
                {myAlbums.map((album) => (
                  <option key={album.id} value={album.id}>{album.title}</option>
                ))}
              </select>
              <select value={mediaVisibility} onChange={(event) => setMediaVisibility(event.target.value as "public" | "private")} className="h-10 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-700">
                <option value="public">{tr("Публичный", "Public")}</option>
                <option value="private">{tr("Приватный", "Private")}</option>
              </select>
            </div>
            <div className="rounded-2xl border border-gray-200 p-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">{tr("Категории кадра", "Shot categories")}</div>
              <div className="flex flex-wrap gap-2">
                {allCategories.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => toggleSelection(selectedMediaCategories, category.id, setSelectedMediaCategories)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition ${selectedMediaCategories.includes(category.id) ? "border-transparent text-white" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}
                    style={selectedMediaCategories.includes(category.id) ? { backgroundColor: category.color || "#E31E24" } : undefined}
                  >
                    {category.title}
                  </button>
                ))}
              </div>
            </div>
            <Input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={handleFileChange} />
            <Button onClick={handleUpload} disabled={isUploading} className="bg-[#E31E24] hover:bg-[#c41a20]">
              {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}
              {tr("Опубликовать", "Publish screenshot")}
            </Button>
          </div>
          <div className="rounded-3xl border border-dashed border-gray-300 bg-gray-50 p-4">
            {previewUrl ? (
              <div className="space-y-3">
                <img src={previewUrl} alt={mediaTitle || "preview"} className="h-[320px] w-full rounded-2xl object-cover" />
                <div className="text-sm text-gray-500">{tr("Превью перед публикацией", "Preview before publishing")}</div>
              </div>
            ) : (
              <div className="flex h-[320px] items-center justify-center rounded-2xl bg-white text-sm text-gray-400">
                {tr("Выберите кадр, чтобы увидеть превью", "Select a screenshot to preview it here")}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_1.1fr_0.9fr]">
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><Trophy className="h-4 w-4 text-[#E31E24]" />{tr("Топ по лайкам", "Top by likes")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {topShots.slice(0, 6).map((shot) => (
              <div key={shot.id} className="group overflow-hidden rounded-2xl border border-gray-100 bg-white">
                <div className="relative">
                  <img src={shot.assetUrl} alt={shot.title} className="h-40 w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                  <div className="absolute bottom-0 left-0 right-0 translate-y-full group-hover:translate-y-0 transition-transform duration-300 bg-gradient-to-t from-black/75 to-transparent px-3 py-2">
                    <div className="text-white text-xs font-medium">{shot.ownerName}{shot.ownerCallsign ? <span className="ml-1 text-gray-300">· {shot.ownerCallsign.toUpperCase()}</span> : null}</div>
                  </div>
                  {shot.isFeatured && <div className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-white shadow"><Star className="h-3 w-3 fill-white" />Featured</div>}
                </div>
                <div className="space-y-2 p-3">
                  <div className="text-sm font-semibold text-[#1d1d1f]">{shot.title}</div>
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline" className="border-red-200 text-[#E31E24]">{shot.likeCount} {tr("лайков", "likes")}</Badge>
                    <div className="flex items-center gap-1">
                      {isCaptain && (
                        <button type="button" onClick={() => toggleFeature(shot.id)} disabled={featuringMediaId === shot.id} className={`rounded-full p-1 transition ${shot.isFeatured ? "text-amber-500" : "text-gray-300 hover:text-amber-500"}`}>
                          {featuringMediaId === shot.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Star className={`h-3.5 w-3.5 ${shot.isFeatured ? "fill-amber-500" : ""}`} />}
                        </button>
                      )}
                      {!shot.isOwner ? (
                        <Button variant="outline" size="sm" onClick={() => toggleLike(shot.id)} disabled={likingMediaId === shot.id} className="h-7 px-2 text-xs">
                          {likingMediaId === shot.id ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Heart className={`mr-1 h-3 w-3 ${shot.likedByViewer ? "fill-[#E31E24] text-[#E31E24]" : ""}`} />}
                          {shot.likedByViewer ? tr("Лайкнут", "Liked") : tr("Лайк", "Like")}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><Sparkles className="h-4 w-4 text-[#E31E24]" />{tr("Activity Feed", "Activity Feed")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {feed.length === 0 ? <div className="text-sm text-gray-500">{tr("Лента пока пуста.", "The feed is empty for now.")}</div> : null}
            {feed.map((item) => (
              <div key={item.id} className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-[#1d1d1f]">{item.actor.name}</div>
                    <div className="mt-1 text-xs uppercase tracking-[0.18em] text-gray-400">{item.title}</div>
                  </div>
                  <div className="text-xs text-gray-400">{formatRelativeTime(item.createdAt, isRu)}</div>
                </div>
                <div className="mt-2 text-sm text-gray-600">{item.summary}</div>
                {item.media ? (
                  <div className="mt-3 flex items-center gap-3 rounded-2xl bg-white p-3">
                    <img src={item.media.assetUrl} alt={item.media.title} className="h-16 w-24 rounded-xl object-cover" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-[#1d1d1f]">{item.media.title}</div>
                      <div className="mt-1 text-xs text-gray-500">{item.media.likeCount} {tr("лайков", "likes")} · {item.media.albumTitle || tr("вне альбома", "standalone shot")}</div>
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><FolderOpen className="h-4 w-4 text-[#E31E24]" />{tr("Мои альбомы", "My albums")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {myAlbums.length === 0 ? <div className="text-sm text-gray-500">{tr("Пока нет альбомов.", "No albums yet.")}</div> : null}
            {myAlbums.map((album) => (
              <div key={album.id} className="rounded-2xl border border-gray-100 bg-gray-50 p-3">
                {album.coverUrl ? <img src={album.coverUrl} alt={album.title} className="mb-3 h-28 w-full rounded-xl object-cover" /> : null}
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-[#1d1d1f]">{album.title}</div>
                    <div className="mt-1 text-xs text-gray-500">{album.mediaCount} {tr("кадров", "shots")} · {album.visibility === "public" ? tr("публичный", "public") : tr("приватный", "private")}</div>
                  </div>
                  <Badge variant="outline">{album.mediaCount}</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><Camera className="h-4 w-4 text-[#E31E24]" />{tr("Последние кадры сообщества", "Latest community shots")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {data.communityMedia.map((shot) => (
              <div key={shot.id} className="group overflow-hidden rounded-2xl border border-gray-100 bg-white">
                <div className="relative">
                  <img src={shot.assetUrl} alt={shot.title} className="h-44 w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                  {/* Authorship hover overlay */}
                  <div className="absolute bottom-0 left-0 right-0 translate-y-full group-hover:translate-y-0 transition-transform duration-300 bg-gradient-to-t from-black/75 to-transparent px-3 py-2">
                    <div className="text-white text-xs font-medium">{shot.ownerName}{shot.ownerCallsign ? <span className="ml-1 text-gray-300">· {shot.ownerCallsign.toUpperCase()}</span> : null}</div>
                  </div>
                  {shot.isFeatured && (
                    <div className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-white shadow">
                      <Star className="h-3 w-3 fill-white" />
                      Featured
                    </div>
                  )}
                </div>
                <div className="space-y-2 p-3">
                  <div className="line-clamp-1 text-sm font-semibold text-[#1d1d1f]">{shot.title}</div>
                  <div className="text-xs text-gray-500">{formatRelativeTime(shot.createdAt, isRu)}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {shot.categories.slice(0, 2).map((category) => (
                      <span key={category.id} className="rounded-full px-2 py-0.5 text-[11px] font-medium text-white" style={{ backgroundColor: category.color || "#E31E24" }}>{category.title}</span>
                    ))}
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <div className="text-xs text-gray-500">{shot.likeCount} {tr("лайков", "likes")}</div>
                    <div className="flex items-center gap-1">
                      {isCaptain && (
                        <button type="button" title={shot.isFeatured ? tr("Убрать", "Unfeature") : tr("Рекомендовать", "Feature")}
                          onClick={() => toggleFeature(shot.id)} disabled={featuringMediaId === shot.id}
                          className={`rounded-full p-1.5 transition ${shot.isFeatured ? "text-amber-500 hover:text-amber-600" : "text-gray-400 hover:text-amber-500"}`}>
                          {featuringMediaId === shot.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Star className={`h-3.5 w-3.5 ${shot.isFeatured ? "fill-amber-500" : ""}`} />}
                        </button>
                      )}
                      {!shot.isOwner && (
                        <button type="button" title={tr("Пожаловаться", "Report")}
                          onClick={() => { const reason = window.prompt(tr("Причина жалобы (необязательно):", "Reason (optional):") || ""); if (reason !== null) void submitReport(shot.id, reason); }}
                          disabled={reportingMediaId === shot.id}
                          className="rounded-full p-1.5 text-gray-300 hover:text-red-400 transition">
                          {reportingMediaId === shot.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Flag className="h-3.5 w-3.5" />}
                        </button>
                      )}
                      {!shot.isOwner ? (
                        <Button variant="outline" size="sm" onClick={() => toggleLike(shot.id)} disabled={likingMediaId === shot.id} className="h-7 px-2 text-xs">
                          {likingMediaId === shot.id ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Heart className={`mr-1 h-3 w-3 ${shot.likedByViewer ? "fill-[#E31E24] text-[#E31E24]" : ""}`} />}
                          {tr("Лайк", "Like")}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><Copy className="h-4 w-4 text-[#E31E24]" />{tr("Подборки сайта", "Site picks")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
              {tr(
                "Эти кадры попадают сюда после запуска скрипта отбора. Их URL можно сразу отдавать в баннерный генератор или другие витрины сайта.",
                "These shots land here after running the picks script. Their URLs can be fed directly into the banner generator or other site showcases."
              )}
            </div>
            {featuredPicks.length === 0 ? <div className="text-sm text-gray-500">{tr("Пока нет собранных подборок.", "No curated picks generated yet.")}</div> : null}
            {featuredPicks.map((pick) => (
              <div key={pick.id} className="rounded-2xl border border-gray-100 bg-gray-50 p-3">
                <img src={pick.assetUrl} alt={pick.title} className="mb-3 h-36 w-full rounded-xl object-cover" />
                <div className="text-sm font-semibold text-[#1d1d1f]">{pick.title}</div>
                <div className="mt-1 text-xs text-gray-500">{pick.ownerName || tr("Сообщество", "Community")} · {pick.likeCount || 0} {tr("лайков", "likes")}</div>
                <Button variant="outline" size="sm" className="mt-3 w-full" onClick={() => copyUrl(pick.assetUrl, tr("URL кадра скопирован", "Shot URL copied"))}>
                  <Copy className="mr-2 h-3.5 w-3.5" />
                  {tr("Скопировать URL", "Copy URL")}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}