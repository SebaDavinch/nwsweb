import { useCallback, useEffect, useMemo, useState } from "react";
import { useLanguage } from "../../context/language-context";
import { 
  Plus, 
  Trash2, 
  Edit, 
  Search, 
  Calendar,
  MoreVertical,
  Send,
  Loader2,
} from "lucide-react";
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "../ui/select";
import { Badge } from "../ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { NewsForm, type NewsFormData } from "./news-form";

type OpsCategory = "News" | "NOTAM" | "Alert";

interface ManagedNewsItem {
  id: string | number;
  title?: string;
  content?: string;
  summary?: string;
  author?: string;
  date?: string;
  status?: string;
  category?: string;
  type?: string;
  published?: boolean;
  views?: number;
  tag?: string | null;
  linkUrl?: string | null;
  vkPublishStatus?: string | null;
  vkPublishReason?: string | null;
  vkPublishedAt?: string | null;
}

interface NotamApiItem {
  id: number;
  type?: string;
  priority?: string;
  must_read?: boolean;
  tag?: string | null;
  url?: string | null;
  title?: string;
  content?: string;
  created_at?: string;
  read_count?: number;
}

interface AlertApiItem {
  id: number;
  title?: string;
  content?: string;
  type?: string;
  pages?: string[];
  orderColumn?: number;
  startShowing?: string | null;
  stopShowing?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

interface OpsItem {
  id: string;
  externalId: string | number;
  category: OpsCategory;
  source: "vamsys" | "local";
  title: string;
  content: string;
  author: string;
  date: string;
  status: "Published" | "Draft" | "Archived";
  views: number;
  sendToDiscord: boolean;
  notamType?: "info" | "warning" | "critical";
  notamPriority?: "low" | "medium" | "high";
  mustRead?: boolean;
  tag?: string | null;
  linkUrl?: string | null;
  vkPublishStatus?: string | null;
  vkPublishReason?: string | null;
  vkPublishedAt?: string | null;
  alertPages?: string[];
  alertOrder?: number;
  alertStartShowing?: string | null;
  alertStopShowing?: string | null;
}

const toNotamType = (value: string | undefined): OpsItem["notamType"] => {
  const normalized = String(value || "info").toLowerCase();
  if (normalized === "warning" || normalized === "critical") {
    return normalized;
  }
  return "info";
};

const toNotamPriority = (value: string | undefined): OpsItem["notamPriority"] => {
  const normalized = String(value || "low").toLowerCase();
  if (normalized === "medium" || normalized === "high") {
    return normalized;
  }
  return "low";
};

export function AdminNews() {
  const { t, language } = useLanguage();
  const [filter, setFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<OpsItem | null>(null);
  const [items, setItems] = useState<OpsItem[]>([]);
  const [vkPublishingId, setVkPublishingId] = useState<string | null>(null);
  const tr = useCallback((ru: string, en: string) => (language === "ru" ? ru : en), [language]);

  const label = (key: string, fallback: string) => {
    const translated = t(key);
    return translated === key ? fallback : translated;
  };

  const mapManagedNews = useCallback((item: ManagedNewsItem): OpsItem | null => {
    const normalizedCategory = String(item.category || item.type || "").trim().toLowerCase();
    if (normalizedCategory !== "news") {
      return null;
    }

    const normalizedStatus = String(item.status || "").trim().toLowerCase();
    const status: OpsItem["status"] = normalizedStatus === "archived"
      ? "Archived"
      : normalizedStatus === "draft"
        ? "Draft"
        : "Published";

    return {
      id: `news-${String(item.id || "")}`,
      externalId: String(item.id || ""),
      source: "local",
      title: String(item.title || tr("Новость без заголовка", "Untitled news")),
      category: "News",
      content: String(item.content || item.summary || ""),
      author: String(item.author || tr("Админ", "Admin")),
      date: String(item.date || "").slice(0, 10) || new Date().toISOString().slice(0, 10),
      status,
      views: Number(item.views || 0),
      sendToDiscord: false,
      tag: item.tag || null,
      linkUrl: item.linkUrl || null,
      vkPublishStatus: item.vkPublishStatus || null,
      vkPublishReason: item.vkPublishReason || null,
      vkPublishedAt: item.vkPublishedAt || null,
    };
  }, [tr]);

  const mapNotam = useCallback((notam: NotamApiItem): OpsItem => ({
    id: `notam-${Number(notam.id || 0)}`,
    externalId: Number(notam.id || 0),
    source: "vamsys",
    notamType: toNotamType(notam.type),
    notamPriority: toNotamPriority(notam.priority),
    mustRead: Boolean(notam.must_read),
    tag: notam.tag || null,
    linkUrl: notam.url || null,
    title: String(notam.title || "Untitled NOTAM"),
    category: "NOTAM",
    content: String(notam.content || ""),
    author: "Ops",
    date: String(notam.created_at || "").slice(0, 10) || new Date().toISOString().slice(0, 10),
    status: "Published",
    views: Number(notam.read_count || 0),
    sendToDiscord: false,
  }), []);

  const mapAlert = useCallback((alert: AlertApiItem): OpsItem => {
    const now = Date.now();
    const start = Date.parse(String(alert.startShowing || ""));
    const stop = Date.parse(String(alert.stopShowing || ""));
    const status: OpsItem["status"] = Number.isFinite(stop) && stop < now
      ? "Archived"
      : Number.isFinite(start) && start > now
        ? "Draft"
        : "Published";

    return {
      id: `alert-${Number(alert.id || 0)}`,
      externalId: Number(alert.id || 0),
      source: "vamsys",
      title: String(alert.title || "Untitled Alert"),
      category: "Alert",
      content: String(alert.content || ""),
      author: "Ops",
      date: String(alert.startShowing || alert.createdAt || "").slice(0, 10) || new Date().toISOString().slice(0, 10),
      status,
      views: 0,
      sendToDiscord: false,
      notamType: toNotamType(alert.type),
      alertPages: Array.isArray(alert.pages) ? alert.pages : ["dashboard"],
      alertOrder: Number(alert.orderColumn || 0) || 0,
      alertStartShowing: alert.startShowing || null,
      alertStopShowing: alert.stopShowing || null,
    };
  }, []);

  const loadOps = useCallback(async (isActiveCheck?: () => boolean) => {
    try {
      const [newsResponse, notamsResponse, alertsResponse] = await Promise.all([
        fetch("/api/admin/content/activities", { credentials: "include" }).catch(() => null),
        fetch("/api/admin/notams", { credentials: "include" }).catch(() => null),
        fetch("/api/admin/alerts", { credentials: "include" }).catch(() => null),
      ]);

      const newsPayload = newsResponse && newsResponse.ok ? await newsResponse.json() : null;
      const notamsPayload = notamsResponse && notamsResponse.ok ? await notamsResponse.json() : null;
      const alertsPayload = alertsResponse && alertsResponse.ok ? await alertsResponse.json() : null;
      const newsItems: ManagedNewsItem[] = Array.isArray(newsPayload?.items) ? newsPayload.items : [];
      const notams: NotamApiItem[] = Array.isArray(notamsPayload?.notams) ? notamsPayload.notams : [];
      const alerts: AlertApiItem[] = Array.isArray(alertsPayload?.alerts) ? alertsPayload.alerts : [];
      const mapped = [
        ...newsItems.map((item) => mapManagedNews(item)).filter((item): item is OpsItem => Boolean(item)),
        ...alerts.map((alert) => mapAlert(alert)),
        ...notams.map((notam) => mapNotam(notam)),
      ].sort((left, right) => {
        const statusWeight = { Published: 0, Draft: 1, Archived: 2 };
        const leftWeight = statusWeight[left.status] ?? 3;
        const rightWeight = statusWeight[right.status] ?? 3;
        if (leftWeight !== rightWeight) {
          return leftWeight - rightWeight;
        }
        return String(right.date || "").localeCompare(String(left.date || ""));
      });

      if (!isActiveCheck || isActiveCheck()) {
        setItems(mapped);
      }
    } catch (error) {
      console.error("Не удалось загрузить alerts и NOTAM", error);
    }
  }, [mapAlert, mapManagedNews, mapNotam]);

  useEffect(() => {
    let active = true;
    loadOps(() => active);
    return () => {
      active = false;
    };
  }, [loadOps]);

  const handleCreate = async (data: NewsFormData) => {
    try {
      if (data.category === "News") {
        const requestBody = {
          title: data.title,
          category: "News",
          type: "news",
          status: data.status,
          published: data.status === "Published",
          author: data.author || tr("Админ", "Admin"),
          date: data.date || new Date().toISOString().slice(0, 10),
          content: data.content,
          summary: data.content.slice(0, 180),
          tag: data.tag || null,
          linkUrl: data.linkUrl || null,
          sendToDiscord: Boolean(data.sendToDiscord),
          sendToTelegram: Boolean(data.sendToTelegram),
          sendToVK: Boolean(data.sendToVK),
          bannerUrl: data.bannerUrl || null,
        };
        const response = await fetch(
          editingItem?.category === "News"
            ? `/api/admin/content/activities/${encodeURIComponent(String(editingItem.externalId))}`
            : "/api/admin/content/activities",
          {
            method: editingItem?.category === "News" ? "PUT" : "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody),
          }
        );
        if (!response.ok) {
          alert(label("admin.news.operationFailed", "Операция не выполнена"));
          return;
        }
        const payload = await response.json().catch(() => null) as {
          integrations?: {
            vk?: {
              sent?: boolean;
              attempted?: boolean;
              reason?: string;
            };
          };
        } | null;
        const vkResult = payload?.integrations?.vk;
        if (Boolean(data.sendToVK) && vkResult?.attempted && vkResult.sent === false) {
          alert(
            tr(
              `Новость сохранена, но публикация в VK не выполнена: ${vkResult.reason || "unknown_error"}`,
              `News was saved, but VK publication failed: ${vkResult.reason || "unknown_error"}`
            )
          );
        }
      } else if (data.category === "NOTAM") {
        const requestBody = {
          title: data.title,
          content: data.content,
          type: data.notamType || "info",
          priority: data.notamPriority || "low",
          must_read: Boolean(data.mustRead),
          tag: data.tag || null,
          url: data.linkUrl || null,
          sendToDiscord: Boolean(data.sendToDiscord),
          sendToTelegram: Boolean(data.sendToTelegram),
          sendToVK: Boolean(data.sendToVK),
          bannerUrl: data.bannerUrl || null,
        };
        const response = await fetch(editingItem?.externalId ? `/api/admin/notams/${editingItem.externalId}` : "/api/admin/notams", {
          method: editingItem?.externalId ? "PUT" : "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });
        if (!response.ok) {
          alert(label("admin.news.notamSaveFailed", "Не удалось сохранить NOTAM в vAMSYS"));
          return;
        }
      } else if (data.category === "Alert") {
        const requestBody = {
          title: data.title,
          content: data.content,
          type: data.notamType || "info",
          pages: data.alertPages,
          order_column: data.alertOrder || 0,
          start_showing: data.alertStartShowing || null,
          stop_showing: data.alertStopShowing || null,
          sendToDiscord: Boolean(data.sendToDiscord),
          sendToTelegram: Boolean(data.sendToTelegram),
          sendToVK: Boolean(data.sendToVK),
          bannerUrl: data.bannerUrl || null,
        };
        const response = await fetch(editingItem?.externalId ? `/api/admin/alerts/${editingItem.externalId}` : "/api/admin/alerts", {
          method: editingItem?.externalId ? "PUT" : "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });
        if (!response.ok) {
          alert(label("admin.news.alertSaveFailed", "Не удалось сохранить alert в vAMSYS"));
          return;
        }
      }

      await loadOps();
      setIsFormOpen(false);
      setEditingItem(null);
    } catch (error) {
      console.error("Не удалось сохранить операционное объявление", error);
      alert(label("admin.news.operationFailed", "Операция не выполнена"));
    }
  };

  const handleDelete = async (id: string) => {
    const current = items.find((item) => item.id === id);
    if (!current) {
      return;
    }

    if (confirm(t("admin.news.confirmDelete"))) {
      try {
        const endpoint = current.category === "News"
          ? `/api/admin/content/activities/${encodeURIComponent(String(current.externalId))}`
          : current.category === "Alert"
            ? `/api/admin/alerts/${current.externalId}`
            : `/api/admin/notams/${current.externalId}`;
        const response = await fetch(endpoint, { method: "DELETE", credentials: "include" }).catch(() => null);
        if (!response || !response.ok) {
          alert(
            current.category === "News"
              ? label("admin.news.operationFailed", "Операция не выполнена")
              : current.category === "Alert"
                ? label("admin.news.deleteAlertFailed", "Не удалось удалить alert из vAMSYS")
                : t("admin.news.deleteNotamFailed") || "Не удалось удалить NOTAM из vAMSYS"
          );
          return;
        }
        await loadOps();
      } catch (error) {
        console.error("Операция удаления завершилась ошибкой", error);
      }
    }
  };

  const handleRepublishVk = async (item: OpsItem) => {
    if (item.category !== "News" || item.source !== "local") {
      return;
    }
    setVkPublishingId(item.id);
    try {
      const response = await fetch(`/api/admin/content/activities/${encodeURIComponent(String(item.externalId))}/publish-vk`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const payload = await response.json().catch(() => null) as {
        ok?: boolean;
        error?: string;
        item?: {
          vkPublishStatus?: string | null;
          vkPublishReason?: string | null;
          vkPublishedAt?: string | null;
        };
      } | null;

      if (!response.ok || payload?.ok === false) {
        const reason = String(payload?.error || tr("Не удалось опубликовать в VK", "Failed to publish to VK"));
        setItems((prev) => prev.map((entry) =>
          entry.id === item.id
            ? {
                ...entry,
                vkPublishStatus: "failed",
                vkPublishReason: reason,
                vkPublishedAt: null,
              }
            : entry
        ));
        alert(reason);
        return;
      }

      const updated = payload?.item;
      setItems((prev) => prev.map((entry) =>
        entry.id === item.id
          ? {
              ...entry,
              vkPublishStatus: updated?.vkPublishStatus || "published",
              vkPublishReason: updated?.vkPublishReason || "",
              vkPublishedAt: updated?.vkPublishedAt || new Date().toISOString(),
            }
          : entry
      ));
    } catch (error) {
      const reason = String(error instanceof Error ? error.message : tr("Не удалось опубликовать в VK", "Failed to publish to VK"));
      setItems((prev) => prev.map((entry) =>
        entry.id === item.id
          ? {
              ...entry,
              vkPublishStatus: "failed",
              vkPublishReason: reason,
              vkPublishedAt: null,
            }
          : entry
      ));
      alert(reason);
    } finally {
      setVkPublishingId(null);
    }
  };

  const filteredNews = useMemo(() => items.filter((item) => {
    const matchesFilter = filter === "all" || item.category.toLowerCase() === filter.toLowerCase();
    const matchesStatus = statusFilter === "all" || String(item.status || "Published").toLowerCase() === statusFilter;
    const query = search.toLowerCase();
    const matchesSearch =
      item.title.toLowerCase().includes(query) ||
      item.content.toLowerCase().includes(query) ||
      item.author.toLowerCase().includes(query) ||
      String(item.tag || "").toLowerCase().includes(query);
    return matchesFilter && matchesStatus && matchesSearch;
  }), [filter, items, search, statusFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">{label("admin.news.title", "Оповещения и NOTAM")}</h2>
          <p className="text-sm text-gray-500">{label("admin.news.subtitle", "Управление оповещениями панели vAMSYS и операционными бюллетенями NOTAM.")}</p>
        </div>
        <Button 
          onClick={() => {
            setEditingItem(null);
            setIsFormOpen(true);
          }} 
          className="bg-[#E31E24] hover:bg-[#c41a20] text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          {label("admin.news.create", "Создать запись")}
        </Button>
      </div>

      <Card className="border-none shadow-sm">
        <CardContent className="p-4">
          {/* Toolbar */}
          <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <Input 
                placeholder={label("admin.news.search", "Поиск записей...")}
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder={t("news.category")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("news.allCategories")}</SelectItem>
                  <SelectItem value="news">{t("news.cat.news")}</SelectItem>
                  <SelectItem value="alert">{label("admin.news.filter.alert", "Alerts")}</SelectItem>
                  <SelectItem value="notam">{t("news.cat.notam")}</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder={t("admin.news.table.status")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все статусы</SelectItem>
                  <SelectItem value="published">Опубликовано</SelectItem>
                  <SelectItem value="draft">Черновик</SelectItem>
                  <SelectItem value="archived">Архив</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-md border">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-500 font-medium">
                <tr>
                  <th className="px-4 py-3">{label("admin.news.table.title", "Заголовок")}</th>
                  <th className="px-4 py-3">{t("news.category")}</th>
                  <th className="px-4 py-3">{label("admin.news.table.source", "Источник")}</th>
                  <th className="px-4 py-3">{label("admin.news.table.status", "Статус")}</th>
                  <th className="px-4 py-3">{label("admin.news.table.author", "Автор")}</th>
                  <th className="px-4 py-3">{label("admin.news.table.date", "Дата")}</th>
                  <th className="px-4 py-3 text-right">{label("admin.news.table.actions", "Действия")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredNews.length > 0 ? (
                  filteredNews.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50 group transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900">{item.title}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={`
                          ${item.category === 'NOTAM' ? 'border-orange-200 bg-orange-50 text-orange-700' : item.category === 'Alert' ? 'border-sky-200 bg-sky-50 text-sky-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}
                        `}>
                          {item.category}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className={
                            item.source === "vamsys"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-gray-200 bg-gray-50 text-gray-700"
                          }
                        >
                          {item.source === "vamsys" ? "vAMSYS" : tr("Сайт", "Site")}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${item.status === 'Published' ? 'bg-green-500' : 'bg-gray-300'}`} />
                          {item.status}
                        </div>
                        {item.category === "News" && item.source === "local" && (
                          <div className="mt-1">
                            <Badge
                              variant="outline"
                              title={item.vkPublishReason || ""}
                              className={
                                item.vkPublishStatus === "published"
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                  : item.vkPublishStatus === "failed"
                                    ? "border-red-200 bg-red-50 text-red-700"
                                    : item.vkPublishStatus === "skipped"
                                      ? "border-amber-200 bg-amber-50 text-amber-700"
                                      : "border-gray-200 bg-gray-50 text-gray-600"
                              }
                            >
                              {item.vkPublishStatus === "published"
                                ? tr("VK: опубликовано", "VK: published")
                                : item.vkPublishStatus === "failed"
                                  ? tr("VK: ошибка", "VK: failed")
                                  : item.vkPublishStatus === "skipped"
                                    ? tr("VK: пропущено", "VK: skipped")
                                    : tr("VK: нет данных", "VK: no status")}
                            </Badge>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{item.author}</td>
                      <td className="px-4 py-3 text-gray-500">
                        <div className="flex items-center gap-2">
                          <Calendar size={14} />
                          {item.date}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical size={16} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {item.category === "News" && item.source === "local" && (
                              <DropdownMenuItem
                                onClick={() => { void handleRepublishVk(item); }}
                                disabled={vkPublishingId === item.id}
                              >
                                {vkPublishingId === item.id ? (
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                  <Send className="w-4 h-4 mr-2" />
                                )}
                                {tr("Переопубликовать в VK", "Republish to VK")}
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => {
                              setEditingItem(item);
                              setIsFormOpen(true);
                            }}>
                              <Edit className="w-4 h-4 mr-2" />
                              {label("admin.news.edit", "Изменить")}
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="text-red-600 focus:text-red-600 focus:bg-red-50"
                              onClick={() => handleDelete(item.id)}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              {label("admin.news.delete", "Удалить")}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      {label("admin.news.noPosts", "Для текущих фильтров записи не найдены.")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <NewsForm 
        open={isFormOpen} 
        onOpenChange={(open) => {
          setIsFormOpen(open);
          if (!open) setEditingItem(null);
        }}
        onSubmit={handleCreate}
        initialData={editingItem}
      />
    </div>
  );
}
