import { useCallback, useEffect, useMemo, useState } from "react";
import { useLanguage } from "../../context/language-context";
import { 
  Plus, 
  Trash2, 
  Edit, 
  Search, 
  Calendar,
  MoreVertical 
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

type OpsCategory = "NOTAM" | "Alert";

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
  externalId: number;
  category: OpsCategory;
  source: "vamsys";
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
  const { t } = useLanguage();
  const [filter, setFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<OpsItem | null>(null);
  const [items, setItems] = useState<OpsItem[]>([]);

  const label = (key: string, fallback: string) => {
    const translated = t(key);
    return translated === key ? fallback : translated;
  };

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
      const [notamsResponse, alertsResponse] = await Promise.all([
        fetch("/api/admin/notams"),
        fetch("/api/admin/alerts"),
      ]);

      if (!notamsResponse.ok || !alertsResponse.ok) {
        return;
      }

      const notamsPayload = await notamsResponse.json();
      const alertsPayload = await alertsResponse.json();
      const notams: NotamApiItem[] = Array.isArray(notamsPayload?.notams) ? notamsPayload.notams : [];
      const alerts: AlertApiItem[] = Array.isArray(alertsPayload?.alerts) ? alertsPayload.alerts : [];
      const mapped = [
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
      console.error("Failed to load alerts and NOTAMs", error);
    }
  }, [mapAlert, mapNotam]);

  useEffect(() => {
    let active = true;
    loadOps(() => active);
    return () => {
      active = false;
    };
  }, [loadOps]);

  const handleCreate = async (data: NewsFormData) => {
    try {
      if (data.category === "NOTAM") {
        const requestBody = {
          title: data.title,
          content: data.content,
          type: data.notamType || "info",
          priority: data.notamPriority || "low",
          must_read: Boolean(data.mustRead),
          tag: data.tag || null,
          url: data.linkUrl || null,
          sendToDiscord: Boolean(data.sendToDiscord),
        };
        const response = await fetch(editingItem?.externalId ? `/api/admin/notams/${editingItem.externalId}` : "/api/admin/notams", {
          method: editingItem?.externalId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });
        if (!response.ok) {
          alert(label("admin.news.notamSaveFailed", "Failed to save NOTAM in vAMSYS"));
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
        };
        const response = await fetch(editingItem?.externalId ? `/api/admin/alerts/${editingItem.externalId}` : "/api/admin/alerts", {
          method: editingItem?.externalId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });
        if (!response.ok) {
          alert(label("admin.news.alertSaveFailed", "Failed to save alert in vAMSYS"));
          return;
        }
      }

      await loadOps();
      setIsFormOpen(false);
      setEditingItem(null);
    } catch (error) {
      console.error("Ops announcement save failed", error);
      alert(label("admin.news.operationFailed", "Operation failed"));
    }
  };

  const handleDelete = async (id: string) => {
    const current = items.find((item) => item.id === id);
    if (!current) {
      return;
    }

    if (confirm(t("admin.news.confirmDelete"))) {
      try {
        const endpoint = current.category === "Alert" ? `/api/admin/alerts/${current.externalId}` : `/api/admin/notams/${current.externalId}`;
        const response = await fetch(endpoint, { method: "DELETE" }).catch(() => null);
        if (!response || !response.ok) {
          alert(current.category === "Alert" ? label("admin.news.deleteAlertFailed", "Failed to delete alert from vAMSYS") : t("admin.news.deleteNotamFailed") || "Failed to delete NOTAM from vAMSYS");
          return;
        }
        await loadOps();
      } catch (error) {
        console.error("Delete operation failed", error);
      }
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
          <h2 className="text-2xl font-bold text-gray-800">{label("admin.news.title", "Alerts & NOTAMs")}</h2>
          <p className="text-sm text-gray-500">{label("admin.news.subtitle", "Manage vAMSYS dashboard alerts and operational NOTAM bulletins.")}</p>
        </div>
        <Button 
          onClick={() => {
            setEditingItem(null);
            setIsFormOpen(true);
          }} 
          className="bg-[#E31E24] hover:bg-[#c41a20] text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          {label("admin.news.create", "Create Entry")}
        </Button>
      </div>

      <Card className="border-none shadow-sm">
        <CardContent className="p-4">
          {/* Toolbar */}
          <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <Input 
                placeholder={label("admin.news.search", "Search posts...")}
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
                  <SelectItem value="alert">{label("admin.news.filter.alert", "Alerts")}</SelectItem>
                  <SelectItem value="notam">{t("news.cat.notam")}</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder={t("admin.news.table.status")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-md border">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-500 font-medium">
                <tr>
                  <th className="px-4 py-3">{label("admin.news.table.title", "Title")}</th>
                  <th className="px-4 py-3">{t("news.category")}</th>
                  <th className="px-4 py-3">{label("admin.news.table.source", "Source")}</th>
                  <th className="px-4 py-3">{label("admin.news.table.status", "Status")}</th>
                  <th className="px-4 py-3">{label("admin.news.table.author", "Author")}</th>
                  <th className="px-4 py-3">{label("admin.news.table.date", "Date")}</th>
                  <th className="px-4 py-3 text-right">{label("admin.news.table.actions", "Actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredNews.length > 0 ? (
                  filteredNews.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50 group transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900">{item.title}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={`
                          ${item.category === 'NOTAM' ? 'border-orange-200 bg-orange-50 text-orange-700' : 'border-sky-200 bg-sky-50 text-sky-700'}
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
                          {item.source === "vamsys" ? "vAMSYS" : "Local"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${item.status === 'Published' ? 'bg-green-500' : 'bg-gray-300'}`} />
                          {item.status}
                        </div>
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
                            <DropdownMenuItem onClick={() => {
                              setEditingItem(item);
                              setIsFormOpen(true);
                            }}>
                              <Edit className="w-4 h-4 mr-2" />
                              {label("admin.news.edit", "Edit")}
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="text-red-600 focus:text-red-600 focus:bg-red-50"
                              onClick={() => handleDelete(item.id)}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              {label("admin.news.delete", "Delete")}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      {label("admin.news.noPosts", "No posts found for the current filters.")}
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
