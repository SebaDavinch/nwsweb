import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Award,
  Edit2,
  ExternalLink,
  Globe,
  Loader2,
  MessageSquare,
  Plus,
  RefreshCcw,
  Search,
  Send,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Switch } from "../ui/switch";
import { useLanguage } from "../../context/language-context";

type NotamType = "info" | "warning" | "critical";
type NotamPriority = "low" | "medium" | "high";

interface VamsysNotam {
  id: number;
  title: string;
  content: string;
  type: NotamType;
  priority: NotamPriority;
  must_read?: boolean;
  mustRead?: boolean;
  tag?: string | null;
  url?: string | null;
  created_at?: string | null;
  read_count?: number;
}

interface NotamForm {
  title: string;
  content: string;
  type: NotamType;
  priority: NotamPriority;
  must_read: boolean;
  tag: string;
  url: string;
  sendToDiscord: boolean;
  sendToTelegram: boolean;
  sendToVK: boolean;
  // Badge
  createBadge: boolean;
  badgeName: string;
  badgeDescription: string;
  badgeColor: string;
  badgeImagePreview: string | null;
  badgeImageFile: File | null;
}

const BADGE_COLORS = [
  "#E31E24", "#2563EB", "#16A34A", "#D97706", "#7C3AED",
  "#0891B2", "#DB2777", "#65A30D", "#EA580C", "#1d1d1f",
];

const EMPTY_FORM: NotamForm = {
  title: "",
  content: "",
  type: "info",
  priority: "low",
  must_read: false,
  tag: "",
  url: "",
  sendToDiscord: false,
  sendToTelegram: false,
  sendToVK: false,
  createBadge: false,
  badgeName: "",
  badgeDescription: "",
  badgeColor: "#E31E24",
  badgeImagePreview: null,
  badgeImageFile: null,
};

const TYPE_CLASSES: Record<NotamType, string> = {
  info: "border-slate-200 bg-slate-50 text-slate-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  critical: "border-red-200 bg-red-50 text-red-700",
};

const PRIORITY_CLASSES: Record<NotamPriority, string> = {
  low: "border-gray-200 bg-gray-50 text-gray-700",
  medium: "border-sky-200 bg-sky-50 text-sky-700",
  high: "border-orange-200 bg-orange-50 text-orange-700",
};

function normalizeNotam(raw: Record<string, unknown>): VamsysNotam {
  const validTypes: NotamType[] = ["info", "warning", "critical"];
  const validPriorities: NotamPriority[] = ["low", "medium", "high"];
  const type = validTypes.includes(raw.type as NotamType) ? (raw.type as NotamType) : "info";
  const priority = validPriorities.includes(raw.priority as NotamPriority) ? (raw.priority as NotamPriority) : "low";
  return {
    id: Number(raw.id || 0) || 0,
    title: String(raw.title || "").trim() || "Untitled NOTAM",
    content: String(raw.content || "").trim(),
    type,
    priority,
    must_read: Boolean(raw.must_read),
    mustRead: Boolean(raw.must_read),
    tag: typeof raw.tag === "string" ? raw.tag : null,
    url: typeof raw.url === "string" ? raw.url : null,
    created_at: typeof raw.created_at === "string" ? raw.created_at : null,
    read_count: Number(raw.read_count || 0) || 0,
  };
}

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
};

// ── Drag-n-drop image zone ────────────────────────────────────────────────────

function BadgeImageZone({
  preview,
  onFileChange,
  onClear,
}: {
  preview: string | null;
  onFileChange: (file: File, dataUrl: string) => void;
  onClear: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Только изображения"); return; }
    if (file.size > 4 * 1024 * 1024) { toast.error("Файл не должен превышать 4 МБ"); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result;
      if (typeof dataUrl === "string") onFileChange(file, dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, []);

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);

  if (preview) {
    return (
      <div className="relative inline-block">
        <img src={preview} alt="Badge preview" className="h-24 w-24 rounded-xl object-cover border border-gray-200 shadow-sm" />
        <button
          type="button"
          onClick={onClear}
          className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-gray-800 text-white flex items-center justify-center hover:bg-red-600 transition-colors"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    );
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 transition-all ${
        dragging ? "border-[#E31E24] bg-red-50" : "border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-gray-100"
      }`}
    >
      <ImagePlus className="h-7 w-7 text-gray-400" />
      <div className="text-center">
        <div className="text-sm font-medium text-gray-700">Перетащите изображение</div>
        <div className="text-xs text-gray-400">или нажмите для выбора · PNG, JPG, WebP до 4 МБ</div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); }}
      />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function AdminNotams() {
  const { language } = useLanguage();
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);

  const [notams, setNotams] = useState<VamsysNotam[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<NotamType | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<NotamPriority | "all">("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingNotam, setEditingNotam] = useState<VamsysNotam | null>(null);
  const [form, setForm] = useState<NotamForm>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [vkBannerUrl, setVkBannerUrl] = useState<string | null>(null);

  const loadNotams = async ({ silent = false } = {}) => {
    if (silent) setIsRefreshing(true);
    else setIsLoading(true);
    try {
      const res = await fetch("/api/admin/notams", { credentials: "include" });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.error || "Failed to load NOTAMs");
      const raw = Array.isArray(payload?.notams) ? payload.notams : Array.isArray(payload) ? payload : [];
      setNotams(raw.map((item: Record<string, unknown>) => normalizeNotam(item)));
    } catch (e) {
      toast.error(String(e instanceof Error ? e.message : e));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => { void loadNotams(); }, []);

  const openCreate = () => {
    setEditingNotam(null);
    setForm(EMPTY_FORM);
    setVkBannerUrl(null);
    setDialogOpen(true);
  };

  const openEdit = (notam: VamsysNotam) => {
    setVkBannerUrl(null);
    setEditingNotam(notam);
    setForm({
      title: notam.title,
      content: notam.content,
      type: notam.type,
      priority: notam.priority,
      must_read: Boolean(notam.must_read),
      tag: notam.tag || "",
      url: notam.url || "",
      sendToDiscord: false,
      sendToTelegram: false,
      sendToVK: false,
      createBadge: false,
      badgeName: notam.title,
      badgeDescription: "",
      badgeColor: "#E31E24",
      badgeImagePreview: null,
      badgeImageFile: null,
    });
    setDialogOpen(true);
  };

  const uploadBadgeImage = async (dataUrl: string): Promise<string | null> => {
    try {
      const res = await fetch("/api/admin/badge-image-upload", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.error || "Upload failed");
      return typeof payload?.url === "string" ? payload.url : null;
    } catch (e) {
      toast.error(tr("Ошибка загрузки изображения: ", "Image upload failed: ") + String(e instanceof Error ? e.message : e));
      return null;
    }
  };

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error(tr("Заголовок обязателен", "Title is required")); return; }
    if (form.createBadge && !form.badgeName.trim()) {
      toast.error(tr("Название бейджа обязательно", "Badge name is required")); return;
    }
    setIsSaving(true);
    try {
      // 1. Save NOTAM
      const body = {
        title: form.title.trim(),
        content: form.content.trim(),
        type: form.type,
        priority: form.priority,
        must_read: form.must_read,
        tag: form.tag.trim() || null,
        url: form.url.trim() || null,
        sendToDiscord: form.sendToDiscord,
        sendToTelegram: form.sendToTelegram,
        sendToVK: form.sendToVK,
        bannerUrl: vkBannerUrl || null,
      };
      const url = editingNotam ? `/api/admin/notams/${editingNotam.id}` : "/api/admin/notams";
      const res = await fetch(url, {
        method: editingNotam ? "PUT" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.error || "Failed to save NOTAM");

      // 2. Create badge if requested
      if (form.createBadge) {
        let imageUrl: string | null = null;
        if (form.badgeImagePreview) {
          imageUrl = await uploadBadgeImage(form.badgeImagePreview);
        }
        const badgeBody: Record<string, unknown> = {
          name: form.badgeName.trim(),
          description: form.badgeDescription.trim() || undefined,
          color: form.badgeColor,
          manually_awardable: true,
        };
        if (imageUrl) badgeBody.image = imageUrl;

        const badgeRes = await fetch("/api/admin/operations/badges", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(badgeBody),
        });
        const badgePayload = await badgeRes.json().catch(() => null);
        if (!badgeRes.ok) {
          toast.warning(tr("NOTAM создан, но бейдж не удалось создать: ", "NOTAM saved, but badge failed: ") + String(badgePayload?.error || "Unknown error"));
        } else {
          toast.success(tr("NOTAM и бейдж успешно созданы", "NOTAM and badge created"));
        }
      } else {
        toast.success(editingNotam ? tr("NOTAM обновлён", "NOTAM updated") : tr("NOTAM создан", "NOTAM created"));
      }

      setDialogOpen(false);
      void loadNotams({ silent: true });
    } catch (e) {
      toast.error(String(e instanceof Error ? e.message : e));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (notam: VamsysNotam) => {
    if (!confirm(tr(`Удалить NOTAM «${notam.title}»?`, `Delete NOTAM "${notam.title}"?`))) return;
    setDeletingId(notam.id);
    try {
      const res = await fetch(`/api/admin/notams/${notam.id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed to delete NOTAM");
      toast.success(tr("NOTAM удалён", "NOTAM deleted"));
      void loadNotams({ silent: true });
    } catch (e) {
      toast.error(String(e instanceof Error ? e.message : e));
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = useMemo(() => notams.filter((item) => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || item.title.toLowerCase().includes(q) || item.content.toLowerCase().includes(q) || String(item.tag || "").toLowerCase().includes(q);
    const matchesType = typeFilter === "all" || item.type === typeFilter;
    const matchesPriority = priorityFilter === "all" || item.priority === priorityFilter;
    return matchesSearch && matchesType && matchesPriority;
  }), [notams, search, typeFilter, priorityFilter]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1d1d1f]">{tr("NOTAMы", "NOTAMs")}</h1>
          <p className="mt-1 text-sm text-gray-500">{tr("Управление NOTAMами через vAMSYS", "Manage NOTAMs via vAMSYS")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => loadNotams({ silent: true })} disabled={isLoading || isRefreshing}>
            {isRefreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
            {tr("Обновить", "Refresh")}
          </Button>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            {tr("Создать NOTAM", "Create NOTAM")}
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: tr("Всего", "Total"), value: notams.length, cls: "" },
          { label: tr("Обязательные", "Must Read"), value: notams.filter((n) => n.must_read).length, cls: "bg-amber-50" },
          { label: tr("Высокий приоритет", "High Priority"), value: notams.filter((n) => n.priority === "high").length, cls: "bg-orange-50" },
          { label: tr("Критические", "Critical"), value: notams.filter((n) => n.type === "critical").length, cls: "bg-red-50" },
        ].map(({ label, value, cls }) => (
          <Card key={label} className={`border-none shadow-sm ${cls}`}>
            <CardContent className="p-4">
              <div className="text-xs text-gray-500">{label}</div>
              <div className="mt-0.5 text-2xl font-bold text-gray-900">{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tr("Поиск NOTAMов...", "Search NOTAMs...")} className="pl-9 w-56" />
        </div>
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as NotamType | "all")}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tr("Все типы", "All types")}</SelectItem>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={(v) => setPriorityFilter(v as NotamPriority | "all")}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tr("Все приоритеты", "All priorities")}</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex min-h-[200px] items-center justify-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          {tr("Загрузка NOTAMов...", "Loading NOTAMs...")}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-5 py-10 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-gray-500">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <div className="font-semibold text-[#1d1d1f]">{tr("NOTAMы не найдены", "No NOTAMs found")}</div>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((notam) => (
            <Card key={notam.id} className="border-none shadow-sm overflow-hidden">
              <CardContent className="p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={TYPE_CLASSES[notam.type]}>{notam.type}</Badge>
                      <Badge variant="outline" className={PRIORITY_CLASSES[notam.priority]}>{notam.priority}</Badge>
                      {notam.must_read && <Badge className="bg-[#E31E24] text-white text-xs">Must Read</Badge>}
                      {notam.tag && <Badge variant="outline" className="border-gray-200 bg-gray-50 text-gray-700">{notam.tag}</Badge>}
                    </div>
                    <div className="text-base font-semibold text-gray-900">{notam.title}</div>
                    {notam.content && (
                      <p className="mt-1 line-clamp-2 text-sm text-gray-500">{notam.content}</p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        {formatDate(notam.created_at)}
                      </span>
                      {notam.read_count != null && notam.read_count > 0 && (
                        <span>{notam.read_count} {tr("прочтений", "reads")}</span>
                      )}
                      {notam.url && (
                        <a href={notam.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[#E31E24] hover:underline">
                          <ExternalLink className="h-3 w-3" />
                          {tr("Ссылка", "Link")}
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(notam)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => handleDelete(notam)} disabled={deletingId === notam.id}>
                      {deletingId === notam.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) setDialogOpen(false); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingNotam ? tr("Редактировать NOTAM", "Edit NOTAM") : tr("Создать NOTAM", "Create NOTAM")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>{tr("Заголовок", "Title")} *</Label>
              <Input
                className="mt-1"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value, badgeName: f.createBadge && !f.badgeName ? e.target.value : f.badgeName }))}
                placeholder="NOTAM title"
              />
            </div>
            <div>
              <Label>{tr("Содержимое", "Content")}</Label>
              <textarea
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[120px]"
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                placeholder={tr("Подробное описание NOTAMа...", "Detailed NOTAM description...")}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{tr("Тип", "Type")}</Label>
                <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v as NotamType }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{tr("Приоритет", "Priority")}</Label>
                <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v as NotamPriority }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{tr("Тег", "Tag")}</Label>
                <Input className="mt-1" value={form.tag} onChange={(e) => setForm((f) => ({ ...f, tag: e.target.value }))} placeholder="ops, maintenance..." />
              </div>
              <div>
                <Label>URL</Label>
                <Input className="mt-1" value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} placeholder="https://..." />
              </div>
            </div>

            {/* Must read */}
            <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300"
                checked={form.must_read}
                onChange={(e) => setForm((f) => ({ ...f, must_read: e.target.checked }))}
              />
              <div>
                <div className="text-sm font-medium text-gray-900">{tr("Обязательно к прочтению", "Must Read")}</div>
                <div className="text-xs text-gray-500">{tr("Пилоты должны прочитать перед бронированием", "Pilots must read before booking")}</div>
              </div>
            </label>

            {/* Banner */}
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{tr("Баннер публикации", "Publication banner")}</div>
              <Input
                placeholder="https://cdn.example.com/banner.webp"
                value={vkBannerUrl ?? ""}
                onChange={(e) => setVkBannerUrl(e.target.value || null)}
              />
              {vkBannerUrl && (
                <img src={vkBannerUrl} alt="banner" className="w-full max-h-48 rounded-xl object-cover border border-gray-200" />
              )}
            </div>

            {/* Publication channels */}
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{tr("Публикация", "Publication")}</div>
              <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 bg-indigo-50/60">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-100">
                    <MessageSquare className="h-4 w-4 text-indigo-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-indigo-900">Discord</div>
                    <div className="text-xs text-indigo-600 truncate">{tr("Отправить уведомление в Discord-канал", "Send notification to Discord channel")}</div>
                  </div>
                  <Switch checked={form.sendToDiscord} onCheckedChange={(v) => setForm((f) => ({ ...f, sendToDiscord: v }))} className="data-[state=checked]:bg-indigo-600" />
                </div>
                <div className="flex items-center gap-3 px-4 py-3 bg-sky-50/60">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-100">
                    <Send className="h-4 w-4 text-sky-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-sky-900">Telegram</div>
                    <div className="text-xs text-sky-600 truncate">{tr("Отправить в Telegram-канал", "Send to Telegram channel")}</div>
                  </div>
                  <Switch checked={form.sendToTelegram} onCheckedChange={(v) => setForm((f) => ({ ...f, sendToTelegram: v }))} className="data-[state=checked]:bg-sky-500" />
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-3 px-4 py-3 bg-blue-50/60">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100">
                      <Globe className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-blue-900">ВКонтакте</div>
                      <div className="text-xs text-blue-600 truncate">
                        {tr("Опубликовать пост в сообщество", "Post to VK community")}{vkBannerUrl ? tr(" · с баннером", " · with banner") : ""}
                      </div>
                    </div>
                    <Switch checked={form.sendToVK} onCheckedChange={(v) => setForm((f) => ({ ...f, sendToVK: v }))} className="data-[state=checked]:bg-blue-600" />
                  </div>
                  {form.sendToVK && (
                    <div className="border-t border-blue-100 bg-blue-50/30 px-4 py-4 space-y-3">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-blue-500">{tr("Так будет выглядеть пост", "Post preview")}</div>
                      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden font-sans">
                        {vkBannerUrl && (
                          <img src={vkBannerUrl} alt="banner" className="w-full max-h-52 object-cover" />
                        )}
                        <div className="p-4 space-y-3">
                          <div className="flex items-center gap-2">
                            <div className="h-9 w-9 rounded-full bg-red-600 flex items-center justify-center text-white font-bold text-base leading-none select-none shrink-0">N</div>
                            <div>
                              <div className="font-semibold text-[#000000de] text-[13px]">Nordwind Virtual</div>
                              <div className="text-[11px] text-gray-400">{tr("только что", "just now")}</div>
                            </div>
                          </div>
                          <div className="whitespace-pre-wrap text-[13px] leading-[1.5] text-[#000000de] break-words">
                            {`[NOTAM] ${form.title || tr("Заголовок", "Title")}\n\n${form.content ? (form.content.length > 300 ? form.content.slice(0, 300) + "…" : form.content) : tr("Текст NOTAM...", "NOTAM text...")}`}
                            {form.url ? `\n\n${tr("Подробнее", "Read more")}: ${form.url}` : ""}
                            {`\n\n${tr("Автор", "Author")}: Ops`}
                          </div>
                          <div className="flex items-center gap-4 pt-2 border-t border-gray-100 text-gray-400 text-[12px]">
                            <span>♥ {tr("Нравится", "Like")}</span>
                            <span>💬 {tr("Комментировать", "Comment")}</span>
                            <span>↗ {tr("Поделиться", "Share")}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Badge section */}
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              {/* Toggle header */}
              <label className="flex cursor-pointer items-center justify-between bg-gray-50 px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <Award className="h-4 w-4 text-[#E31E24]" />
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{tr("Создать бейдж", "Create Badge")}</div>
                    <div className="text-xs text-gray-500">{tr("Создать бейдж в vAMSYS вместе с этим NOTAMом", "Create a badge in vAMSYS alongside this NOTAM")}</div>
                  </div>
                </div>
                {/* Slider toggle */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.createBadge}
                  onClick={() => setForm((f) => ({
                    ...f,
                    createBadge: !f.createBadge,
                    badgeName: !f.createBadge && !f.badgeName ? f.title : f.badgeName,
                  }))}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none ${
                    form.createBadge ? "bg-[#E31E24]" : "bg-gray-200"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                      form.createBadge ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </label>

              {/* Collapsible badge fields */}
              <div
                className="overflow-hidden transition-all duration-300 ease-in-out"
                style={{ maxHeight: form.createBadge ? "700px" : "0px" }}
              >
                <div className="space-y-4 border-t border-gray-200 bg-white p-4">
                  {/* Name */}
                  <div>
                    <Label>{tr("Название бейджа", "Badge Name")} *</Label>
                    <Input
                      className="mt-1"
                      value={form.badgeName}
                      onChange={(e) => setForm((f) => ({ ...f, badgeName: e.target.value }))}
                      placeholder={tr("Название бейджа...", "Badge name...")}
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <Label>{tr("Описание", "Description")}</Label>
                    <textarea
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[72px]"
                      value={form.badgeDescription}
                      onChange={(e) => setForm((f) => ({ ...f, badgeDescription: e.target.value }))}
                      placeholder={tr("Краткое описание бейджа...", "Short badge description...")}
                    />
                  </div>

                  {/* Color */}
                  <div>
                    <Label>{tr("Цвет бейджа", "Badge Color")}</Label>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {BADGE_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, badgeColor: c }))}
                          className={`h-7 w-7 rounded-full transition-all ${form.badgeColor === c ? "ring-2 ring-offset-2 ring-gray-400 scale-110" : "hover:scale-105"}`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                      <div className="flex items-center gap-2 ml-1">
                        <input
                          type="color"
                          value={form.badgeColor}
                          onChange={(e) => setForm((f) => ({ ...f, badgeColor: e.target.value }))}
                          className="h-7 w-7 cursor-pointer rounded-full border-0 p-0.5 bg-transparent"
                          title={tr("Свой цвет", "Custom color")}
                        />
                        <span className="text-xs text-gray-400 font-mono">{form.badgeColor}</span>
                      </div>
                    </div>
                  </div>

                  {/* Image */}
                  <div>
                    <Label>{tr("Изображение бейджа", "Badge Image")}</Label>
                    <div className="mt-2">
                      <BadgeImageZone
                        preview={form.badgeImagePreview}
                        onFileChange={(_file, dataUrl) => setForm((f) => ({ ...f, badgeImagePreview: dataUrl, badgeImageFile: _file }))}
                        onClear={() => setForm((f) => ({ ...f, badgeImagePreview: null, badgeImageFile: null }))}
                      />
                    </div>
                  </div>

                  {/* Preview */}
                  <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-3">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white text-sm font-bold shadow-sm"
                      style={{ backgroundColor: form.badgeColor }}
                    >
                      {form.badgeImagePreview ? (
                        <img src={form.badgeImagePreview} className="h-10 w-10 rounded-full object-cover" alt="" />
                      ) : (
                        <Award className="h-5 w-5" />
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-gray-900">{form.badgeName || tr("Название бейджа", "Badge name")}</div>
                      <div className="text-xs text-gray-500">{form.badgeDescription || tr("Описание бейджа", "Badge description")}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>{tr("Отмена", "Cancel")}</Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingNotam ? tr("Сохранить", "Save") : tr("Создать", "Create")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
