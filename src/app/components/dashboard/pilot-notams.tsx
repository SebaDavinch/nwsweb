import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ExternalLink,
  Loader2,
  RefreshCcw,
  Search,
  ShieldAlert,
} from "lucide-react";
import { useLanguage } from "../../context/language-context";
import { toast } from "sonner";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

interface NotamItem {
  id: number;
  title: string;
  content: string;
  type: "info" | "warning" | "critical";
  priority: "low" | "medium" | "high";
  mustRead: boolean;
  isRead?: boolean;
  tag?: string | null;
  url?: string | null;
  createdAt?: string | null;
  readCount?: number;
}

interface NotamsResponse {
  notams?: NotamItem[];
  summary?: {
    total?: number;
    mustRead?: number;
    highPriority?: number;
    unread?: number;
  };
  error?: string;
}

type NotamTypeFilter = "all" | "info" | "warning" | "critical";
type NotamPriorityFilter = "all" | "low" | "medium" | "high";

const formatDateTime = (value?: string | null) => {
  if (!value) {
    return "—";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const TYPE_BADGE_CLASSNAMES: Record<NotamItem["type"], string> = {
  info: "border-slate-200 bg-slate-50 text-slate-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  critical: "border-red-200 bg-red-50 text-red-700",
};

const PRIORITY_BADGE_CLASSNAMES: Record<NotamItem["priority"], string> = {
  low: "border-gray-200 bg-gray-50 text-gray-700",
  medium: "border-sky-200 bg-sky-50 text-sky-700",
  high: "border-orange-200 bg-orange-50 text-orange-700",
};

export function PilotNotams() {
  const { t } = useLanguage();
  const [notams, setNotams] = useState<NotamItem[]>([]);
  const [summary, setSummary] = useState({ total: 0, mustRead: 0, highPriority: 0 });
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<NotamTypeFilter>("all");
  const [priorityFilter, setPriorityFilter] = useState<NotamPriorityFilter>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const [readingIds, setReadingIds] = useState<number[]>([]);

  const loadNotams = async ({ silent = false } = {}) => {
    if (silent) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const response = await fetch("/api/vamsys/notams", {
        credentials: "include",
      });
      const payload = (await response.json().catch(() => null)) as NotamsResponse | null;

      if (!response.ok) {
        setNotams([]);
        setSummary({ total: 0, mustRead: 0, highPriority: 0 });
        setMessage(payload?.error || t("notams.connection.failed"));
        return;
      }

      setNotams(Array.isArray(payload?.notams) ? payload.notams : []);
      setSummary({
        total: Number(payload?.summary?.total || 0) || 0,
        mustRead: Number(payload?.summary?.mustRead || 0) || 0,
        highPriority: Number(payload?.summary?.highPriority || 0) || 0,
      });
      setMessage("");
    } catch {
      setNotams([]);
      setSummary({ total: 0, mustRead: 0, highPriority: 0 });
      setMessage(t("notams.connection.failed"));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    void loadNotams();
  }, []);

  const handleMarkAsRead = async (notamId: number) => {
    setReadingIds((current) => [...current, notamId]);
    try {
      const response = await fetch(`/api/pilot/notams/${notamId}/read`, {
        method: "POST",
        credentials: "include",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(String(payload?.error || t("notams.toastReadError")));
      }

      setNotams((current) => current.map((item) => (item.id === notamId ? { ...item, isRead: true } : item)));
      toast.success(t("notams.toastRead"));
      void loadNotams({ silent: true });
    } catch (error) {
      toast.error(String(error || t("notams.toastReadError")));
    } finally {
      setReadingIds((current) => current.filter((item) => item !== notamId));
    }
  };

  const filteredNotams = useMemo(() => {
    return notams.filter((item) => {
      const matchesSearch =
        !search ||
        item.title.toLowerCase().includes(search.toLowerCase()) ||
        item.content.toLowerCase().includes(search.toLowerCase()) ||
        String(item.tag || "").toLowerCase().includes(search.toLowerCase());
      const matchesType = typeFilter === "all" || item.type === typeFilter;
      const matchesPriority = priorityFilter === "all" || item.priority === priorityFilter;
      return matchesSearch && matchesType && matchesPriority;
    });
  }, [notams, priorityFilter, search, typeFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1d1d1f]">{t("notams.title")}</h1>
          <p className="mt-1 text-sm text-gray-500">{t("notams.subtitle")}</p>
        </div>
        <Button variant="outline" onClick={() => loadNotams({ silent: true })} disabled={isLoading || isRefreshing}>
          {isRefreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
          {t("notams.refresh")}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="border-none shadow-sm bg-white/70">
          <CardContent className="p-6">
            <div className="text-sm text-gray-500">{t("notams.summary.total")}</div>
            <div className="mt-1 text-3xl font-bold text-[#1d1d1f]">{summary.total}</div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-amber-50/80">
          <CardContent className="p-6">
            <div className="text-sm text-amber-700">{t("notams.summary.mustRead")}</div>
            <div className="mt-1 text-3xl font-bold text-amber-900">{summary.mustRead}</div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-orange-50/80">
          <CardContent className="p-6">
            <div className="text-sm text-orange-700">{t("notams.summary.highPriority")}</div>
            <div className="mt-1 text-3xl font-bold text-orange-900">{summary.highPriority}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-md">
        <CardHeader>
          <CardTitle>{t("notams.filters.title")}</CardTitle>
          <CardDescription>{t("notams.filters.description")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-[minmax(0,1.2fr)_minmax(180px,0.6fr)_minmax(180px,0.6fr)]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-gray-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("notams.filters.searchPlaceholder")}
              className="pl-9"
            />
          </div>
          <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as NotamTypeFilter)}>
            <SelectTrigger>
              <SelectValue placeholder={t("notams.filters.type")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("notams.filters.allTypes")}</SelectItem>
              <SelectItem value="info">{t("notams.type.info")}</SelectItem>
              <SelectItem value="warning">{t("notams.type.warning")}</SelectItem>
              <SelectItem value="critical">{t("notams.type.critical")}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={(value) => setPriorityFilter(value as NotamPriorityFilter)}>
            <SelectTrigger>
              <SelectValue placeholder={t("notams.filters.priority")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("notams.filters.allPriorities")}</SelectItem>
              <SelectItem value="low">{t("notams.priority.low")}</SelectItem>
              <SelectItem value="medium">{t("notams.priority.medium")}</SelectItem>
              <SelectItem value="high">{t("notams.priority.high")}</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {message ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {message}
        </div>
      ) : null}

      {isLoading ? (
        <div className="flex min-h-[240px] items-center justify-center gap-2 rounded-2xl border border-dashed border-gray-200 bg-white text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("notams.loading")}
        </div>
      ) : filteredNotams.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-5 py-10 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-gray-500">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <div className="font-semibold text-[#1d1d1f]">{t("notams.empty")}</div>
          <div className="mt-1 text-sm text-gray-500">{t("notams.emptyDesc")}</div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredNotams.map((item) => (
            <Card key={item.id} className="border-none shadow-md overflow-hidden">
              <CardContent className="p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={TYPE_BADGE_CLASSNAMES[item.type]}>
                        {t(`notams.type.${item.type}`)}
                      </Badge>
                      <Badge variant="outline" className={PRIORITY_BADGE_CLASSNAMES[item.priority]}>
                        {t(`notams.priority.${item.priority}`)}
                      </Badge>
                      {item.mustRead ? <Badge className="bg-[#E31E24] text-white">{t("notams.mustRead")}</Badge> : null}
                      {item.isRead ? (
                        <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                          {t("notams.readDone")}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-orange-200 bg-orange-50 text-orange-700">
                          {t("notams.unread")}
                        </Badge>
                      )}
                      {item.tag ? (
                        <Badge variant="outline" className="border-gray-200 bg-gray-50 text-gray-700">
                          {item.tag}
                        </Badge>
                      ) : null}
                    </div>

                    <div className="text-xl font-bold text-[#1d1d1f]">{item.title}</div>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-gray-600">{item.content || "—"}</p>
                  </div>

                  <div className="w-full shrink-0 lg:w-56">
                    <div className="rounded-2xl bg-gray-50 p-4 text-sm text-gray-600">
                      <div className="flex items-start gap-2 text-[#1d1d1f]">
                        <AlertTriangle className="mt-0.5 h-4 w-4 text-[#E31E24]" />
                        <div className="font-medium">{t("notams.posted")}</div>
                      </div>
                      <div className="mt-2">{formatDateTime(item.createdAt)}</div>
                      {item.url ? (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-[#E31E24] transition-colors hover:text-[#c41a20]"
                        >
                          <ExternalLink className="h-4 w-4" />
                          {t("notams.readMore")}
                        </a>
                      ) : null}
                      {!item.isRead ? (
                        <Button
                          variant="outline"
                          className="mt-3 w-full"
                          onClick={() => handleMarkAsRead(item.id)}
                          disabled={readingIds.includes(item.id)}
                        >
                          {readingIds.includes(item.id) ? t("notams.reading") : t("notams.read")}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
