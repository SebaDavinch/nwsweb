import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Edit2,
  ExternalLink,
  Loader2,
  Plus,
  RefreshCcw,
  Search,
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
}

const EMPTY_FORM: NotamForm = {
  title: "",
  content: "",
  type: "info",
  priority: "low",
  must_read: false,
  tag: "",
  url: "",
  sendToDiscord: false,
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
    setDialogOpen(true);
  };

  const openEdit = (notam: VamsysNotam) => {
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
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error(tr("Заголовок обязателен", "Title is required")); return; }
    setIsSaving(true);
    try {
      const body = {
        title: form.title.trim(),
        content: form.content.trim(),
        type: form.type,
        priority: form.priority,
        must_read: form.must_read,
        tag: form.tag.trim() || null,
        url: form.url.trim() || null,
        sendToDiscord: form.sendToDiscord,
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
      toast.success(editingNotam ? tr("NOTAM обновлён", "NOTAM updated") : tr("NOTAM создан", "NOTAM created"));
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
              <Input className="mt-1" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="NOTAM title" />
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
            <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <label className="flex cursor-pointer items-center gap-3">
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
              <label className="flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300"
                  checked={form.sendToDiscord}
                  onChange={(e) => setForm((f) => ({ ...f, sendToDiscord: e.target.checked }))}
                />
                <div>
                  <div className="text-sm font-medium text-gray-900">{tr("Опубликовать в Discord", "Publish to Discord")}</div>
                  <div className="text-xs text-gray-500">{tr("Отправить уведомление в настроенный канал Discord", "Send notification to configured Discord channel")}</div>
                </div>
              </label>
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
