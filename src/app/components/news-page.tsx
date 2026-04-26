import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  ExternalLink,
  Filter,
  LayoutGrid,
  List,
  Loader2,
  Megaphone,
  Newspaper,
  Search,
  Trophy,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../context/auth-context";
import { useLanguage } from "../context/language-context";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { ToggleGroup, ToggleGroupItem } from "./ui/toggle-group";

interface NewsItem {
  id: string;
  source?: "manual" | "vamsys";
  originalId?: number | null;
  title: string;
  category: "News" | "Event";
  content: string;
  summary?: string;
  author: string;
  date: string;
  status: "Published" | "Draft" | "Archived";
  views: number;
  tag?: string | null;
  linkUrl?: string | null;
  imageUrl?: string | null;
  featured?: boolean;
  activityType?: string;
  activitySubtype?: string | null;
  target?: string | null;
  registrations?: number;
  completions?: number;
  points?: number;
  registrationOpen?: boolean;
}

interface ActivityRegistration {
  id: number;
  activityId: number;
  createdAt?: string | null;
}

type NewsViewMode = "gallery" | "list";
type NewsSortMode = "latest" | "popular" | "oldest";
type NewsCategoryFilter = "All" | NewsItem["category"];
type PublicFeedMode = "activities" | "news";

interface PublicFeedPayload {
  activities?: NewsItem[];
  news?: NewsItem[];
}

const getViewModeStorageKey = (mode: PublicFeedMode) =>
  mode === "news" ? "nws.public.news.viewMode" : "nws.public.activities.viewMode";

const formatNewsDate = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const toTimestamp = (value: string) => {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getCategoryBadgeClassName = (item: NewsItem) => {
  if (item.category === "Event") {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }

  return "border-gray-200 bg-gray-50 text-gray-700";
};

const getCategoryIcon = (item: NewsItem) => {
  if (item.category === "Event") {
    return Trophy;
  }

  return Newspaper;
};

const formatActivityType = (value?: string | null) => {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "Program";
  }

  return normalized.replace(/([a-z])([A-Z])/g, "$1 $2");
};

const getActivityExcerpt = (item: NewsItem) => {
  const summary = String(item.summary || "").trim();
  if (summary) {
    return summary;
  }

  return item.content;
};

const renderActivityImage = (item: NewsItem, className: string) => {
  if (!item.imageUrl) {
    return null;
  }

  return (
    <div className={className}>
      <img src={item.imageUrl} alt={item.title} className="h-full w-full object-cover" loading="lazy" />
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/10 to-transparent" />
    </div>
  );
};

interface PublicFeedPageProps {
  mode: PublicFeedMode;
}

function PublicFeedPage({ mode }: PublicFeedPageProps) {
  const { t } = useLanguage();
  const { isAuthenticated, connectPilotApi } = useAuth();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<NewsCategoryFilter>("All");
  const [activityTypeFilter, setActivityTypeFilter] = useState("all");
  const [sortMode, setSortMode] = useState<NewsSortMode>("latest");
  const [viewMode, setViewMode] = useState<NewsViewMode>("gallery");
  const [activityRegistrations, setActivityRegistrations] = useState<Record<number, ActivityRegistration>>({});
  const [isLoadingRegistrations, setIsLoadingRegistrations] = useState(false);
  const [isPilotApiConnected, setIsPilotApiConnected] = useState(true);
  const [busyRegistrationItemId, setBusyRegistrationItemId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const savedViewMode = window.localStorage.getItem(getViewModeStorageKey(mode));
    if (savedViewMode === "gallery" || savedViewMode === "list") {
      setViewMode(savedViewMode);
    }
  }, [mode]);

  const loadActivityRegistrations = useCallback(async () => {
    if (mode !== "activities" || !isAuthenticated) {
      setActivityRegistrations({});
      setIsPilotApiConnected(true);
      return;
    }

    setIsLoadingRegistrations(true);
    try {
      const response = await fetch("/api/pilot/activities/registrations", {
        credentials: "include",
      });
      const payload = (await response.json().catch(() => null)) as {
        code?: string;
        registrations?: ActivityRegistration[];
      } | null;

      if (!response.ok) {
        if (payload?.code === "pilot_api_not_connected") {
          setActivityRegistrations({});
          setIsPilotApiConnected(false);
          return;
        }
        throw new Error("Failed to load activity registrations");
      }

      const rows = Array.isArray(payload?.registrations) ? payload.registrations : [];
      const nextMap = rows.reduce<Record<number, ActivityRegistration>>((accumulator, row) => {
        const activityId = Number(row?.activityId || 0) || 0;
        const registrationId = Number(row?.id || 0) || 0;
        if (activityId > 0 && registrationId > 0) {
          accumulator[activityId] = {
            id: registrationId,
            activityId,
            createdAt: String(row?.createdAt || "").trim() || null,
          };
        }
        return accumulator;
      }, {});

      setActivityRegistrations(nextMap);
      setIsPilotApiConnected(true);
    } catch {
      setActivityRegistrations({});
    } finally {
      setIsLoadingRegistrations(false);
    }
  }, [isAuthenticated, mode]);

  useEffect(() => {
    void loadActivityRegistrations();
  }, [loadActivityRegistrations]);

  const getLiveActivityId = (item: NewsItem) => {
    return Number(item?.originalId || 0) || 0;
  };

  const handleRegisterActivity = async (item: NewsItem) => {
    const activityId = getLiveActivityId(item);
    if (activityId <= 0) {
      return;
    }

    if (!isAuthenticated) {
      toast.error(t("news.registration.authRequired"));
      return;
    }

    if (!isPilotApiConnected) {
      await connectPilotApi("/activities");
      return;
    }

    if (item.registrationOpen === false) {
      toast.error(t("news.registration.closed"));
      return;
    }

    setBusyRegistrationItemId(item.id);
    try {
      const response = await fetch(`/api/pilot/activities/${activityId}/register`, {
        method: "POST",
        credentials: "include",
      });
      const payload = (await response.json().catch(() => null)) as {
        code?: string;
        error?: string;
        registration?: ActivityRegistration;
      } | null;

      if (!response.ok) {
        if (payload?.code === "pilot_api_not_connected") {
          setIsPilotApiConnected(false);
        }
        throw new Error(String(payload?.error || t("news.registration.error")));
      }

      const registration = payload?.registration;
      if (registration && Number(registration?.id || 0) > 0) {
        setActivityRegistrations((current) => ({
          ...current,
          [activityId]: {
            id: Number(registration.id || 0) || 0,
            activityId,
            createdAt: String(registration.createdAt || "").trim() || null,
          },
        }));
      } else {
        await loadActivityRegistrations();
      }

      toast.success(t("news.registration.registered"));
    } catch (error) {
      toast.error(String(error || t("news.registration.error")));
    } finally {
      setBusyRegistrationItemId(null);
    }
  };

  const handleUnregisterActivity = async (item: NewsItem) => {
    const activityId = getLiveActivityId(item);
    const registrationId = Number(activityRegistrations[activityId]?.id || 0) || 0;
    if (activityId <= 0 || registrationId <= 0) {
      return;
    }

    setBusyRegistrationItemId(item.id);
    try {
      const response = await fetch(`/api/pilot/activities/registrations/${registrationId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(String(payload?.error || t("news.registration.error")));
      }

      setActivityRegistrations((current) => {
        const next = { ...current };
        delete next[activityId];
        return next;
      });
      toast.success(t("news.registration.unregistered"));
    } catch (error) {
      toast.error(String(error || t("news.registration.error")));
    } finally {
      setBusyRegistrationItemId(null);
    }
  };

  const renderActivityRegistrationAction = (item: NewsItem) => {
    if (mode !== "activities" || item.category !== "Event" || item.source !== "vamsys") {
      return null;
    }

    const activityId = getLiveActivityId(item);
    if (activityId <= 0) {
      return null;
    }

    const registration = activityRegistrations[activityId] || null;
    const isBusy = busyRegistrationItemId === item.id;

    if (!isAuthenticated) {
      return <div className="text-xs text-gray-500">{t("news.registration.loginHint")}</div>;
    }

    if (!isPilotApiConnected) {
      return (
        <Button size="sm" variant="outline" onClick={() => void connectPilotApi("/activities")}>
          {t("news.registration.connectPilotApi")}
        </Button>
      );
    }

    if (registration) {
      return (
        <Button size="sm" variant="outline" onClick={() => void handleUnregisterActivity(item)} disabled={isBusy}>
          {isBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {t("news.registration.unregister")}
        </Button>
      );
    }

    return (
      <Button
        size="sm"
        className="bg-[#E31E24] text-white hover:bg-[#c21920]"
        onClick={() => void handleRegisterActivity(item)}
        disabled={isBusy || item.registrationOpen === false || isLoadingRegistrations}
      >
        {isBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {item.registrationOpen === false ? t("news.registration.closed") : t("news.registration.register")}
      </Button>
    );
  };

  useEffect(() => {
    let isActive = true;

    const loadFeed = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(mode === "news" ? "/api/public/news" : "/api/public/activities", {
          credentials: "include",
        });
        if (!response.ok) {
          if (isActive) {
            setNews([]);
          }
          return;
        }

        const payload = (await response.json().catch(() => null)) as PublicFeedPayload | null;
        if (isActive) {
          const items = mode === "news" ? payload?.news : payload?.activities;
          setNews(Array.isArray(items) ? items : []);
        }
      } catch {
        if (isActive) {
          setNews([]);
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    void loadFeed();

    return () => {
      isActive = false;
    };
  }, [mode]);

  const handleViewModeChange = (nextViewMode: string) => {
    if (nextViewMode !== "gallery" && nextViewMode !== "list") {
      return;
    }

    setViewMode(nextViewMode);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(getViewModeStorageKey(mode), nextViewMode);
    }
  };

  const publishedItems = useMemo(
    () =>
      news
        .filter((item) => item.status === "Published")
        .filter((item) => (mode === "news" ? item.category === "News" : item.category === "Event")),
    [mode, news]
  );

  const featuredItem = useMemo(() => {
    const featured = [...publishedItems]
      .filter((item) => item.featured)
      .sort((left, right) => toTimestamp(right.date) - toTimestamp(left.date))[0];
    if (featured) {
      return featured;
    }

    return [...publishedItems].sort((left, right) => toTimestamp(right.date) - toTimestamp(left.date))[0] || null;
  }, [publishedItems]);

  const filteredNews = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    const items = publishedItems.filter((item) => {
      const matchesSearch =
        !normalizedSearch ||
        item.title.toLowerCase().includes(normalizedSearch) ||
        item.content.toLowerCase().includes(normalizedSearch) ||
        String(item.tag || "").toLowerCase().includes(normalizedSearch) ||
        formatActivityType(item.activityType).toLowerCase().includes(normalizedSearch) ||
        String(item.activitySubtype || "").toLowerCase().includes(normalizedSearch);
      const matchesCategory = categoryFilter === "All" || item.category === categoryFilter;
      const matchesActivityType =
        mode !== "activities" ||
        activityTypeFilter === "all" ||
        String(item.activityType || "").toLowerCase() === activityTypeFilter;

      return matchesSearch && matchesCategory && matchesActivityType;
    });

    return items.sort((left, right) => {
      if (sortMode === "popular") {
        return Number(right.views || 0) - Number(left.views || 0);
      }

      if (sortMode === "oldest") {
        return toTimestamp(left.date) - toTimestamp(right.date);
      }

      return toTimestamp(right.date) - toTimestamp(left.date);
    });
  }, [activityTypeFilter, categoryFilter, mode, publishedItems, search, sortMode]);

  const summary = useMemo(
    () => ({
      total: publishedItems.length,
      events: publishedItems.filter((item) => item.category === "Event").length,
      news: publishedItems.filter((item) => item.category === "News").length,
      programs: new Set(
        publishedItems
          .filter((item) => item.category === "Event")
          .map((item) => formatActivityType(item.activityType))
      ).size,
    }),
    [publishedItems]
  );

  const categoryOptions: NewsCategoryFilter[] = mode === "news" ? ["All", "News"] : ["All", "Event"];
  const activityTypeOptions = useMemo(
    () =>
      Array.from(
        new Set(
          publishedItems
            .filter((item) => item.category === "Event")
            .map((item) => String(item.activityType || "").trim())
            .filter(Boolean)
        )
      ).sort(),
    [publishedItems]
  );

  const copy =
    mode === "news"
      ? {
          heroBadge: t("publicNews.hero.badge"),
          title: t("publicNews.title"),
          subtitle: t("publicNews.subtitle"),
          searchPlaceholder: t("publicNews.searchPlaceholder"),
          featuredTitle: t("publicNews.featured.title"),
          totalLabel: t("publicNews.kpi.total"),
          firstLabel: t("publicNews.kpi.news"),
          secondLabel: t("publicNews.kpi.featured"),
          firstValue: summary.news,
          secondValue: publishedItems.filter((item) => item.featured).length,
          loadingLabel: "Loading news...",
        }
      : {
          heroBadge: t("news.hero.badge"),
          title: t("news.title"),
          subtitle: t("news.subtitle"),
          searchPlaceholder: t("news.searchPlaceholder"),
          featuredTitle: t("news.featured.title"),
          totalLabel: t("news.kpi.total"),
          firstLabel: t("news.kpi.events"),
          secondLabel: t("news.kpi.programs"),
          firstValue: summary.events,
          secondValue: summary.programs,
          loadingLabel: "Loading activities...",
        };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f6f7fb_0%,#eef2f7_100%)] flex flex-col">
      <section className="relative overflow-hidden bg-[#1f2430] py-14 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(227,30,36,0.18),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(14,165,233,0.16),transparent_30%)]" />
        <div className="relative max-w-7xl mx-auto px-4">
          <Badge className="mb-4 bg-white/10 text-white border border-white/15">{copy.heroBadge}</Badge>
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)] lg:items-end">
            <div>
              <h1 className="text-4xl font-bold tracking-tight md:text-5xl">{copy.title}</h1>
              <p className="mt-4 max-w-3xl text-lg text-slate-300">{copy.subtitle}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Card className="border-white/10 bg-white/5 text-white shadow-none backdrop-blur-sm">
                <CardContent className="p-5">
                  <div className="text-sm text-slate-300">{copy.firstLabel}</div>
                  <div className="mt-1 text-3xl font-bold">{copy.firstValue}</div>
                </CardContent>
              </Card>
              <Card className="border-white/10 bg-white/5 text-white shadow-none backdrop-blur-sm">
                <CardContent className="p-5">
                  <div className="text-sm text-slate-300">{copy.secondLabel}</div>
                  <div className="mt-1 text-3xl font-bold">{copy.secondValue}</div>
                </CardContent>
              </Card>
              <Card className="border-white/10 bg-white/5 text-white shadow-none backdrop-blur-sm col-span-2">
                <CardContent className="p-5">
                  <div className="text-sm text-slate-300">{copy.totalLabel}</div>
                  <div className="mt-1 text-3xl font-bold">{summary.total}</div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      <div className="flex-1 max-w-7xl mx-auto w-full px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-3 space-y-6">
          <Card className="border-none shadow-md sticky top-24">
            <CardContent className="p-6 space-y-6">
              <div>
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Filter size={18} className="text-[#E31E24]" />
                  {t("news.filters")}
                </h3>

                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder={copy.searchPlaceholder}
                      className="pl-9"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-500">{t("news.category")}</label>
                    <Select value={categoryFilter} onValueChange={(value) => setCategoryFilter(value as NewsCategoryFilter)}>
                      <SelectTrigger>
                        <SelectValue placeholder={t("news.allCategories")} />
                      </SelectTrigger>
                      <SelectContent>
                        {categoryOptions.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option === "All"
                              ? t("news.allCategories")
                              : option === "Event"
                                ? t("news.cat.event")
                                : t("news.cat.news")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {mode === "activities" ? (
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-gray-500">{t("news.eventType")}</label>
                      <Select value={activityTypeFilter} onValueChange={setActivityTypeFilter}>
                        <SelectTrigger>
                          <SelectValue placeholder={t("news.allEventTypes")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{t("news.allEventTypes")}</SelectItem>
                          {activityTypeOptions.map((option) => (
                            <SelectItem key={option} value={option.toLowerCase()}>
                              {formatActivityType(option)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-500">{t("news.sort.label")}</label>
                    <Select value={sortMode} onValueChange={(value) => setSortMode(value as NewsSortMode)}>
                      <SelectTrigger>
                        <SelectValue placeholder={t("news.sort.label")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="latest">{t("news.sort.latest")}</SelectItem>
                        <SelectItem value="popular">{t("news.sort.popular")}</SelectItem>
                        <SelectItem value="oldest">{t("news.sort.oldest")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-500">{t("news.view.label")}</label>
                    <ToggleGroup
                      type="single"
                      value={viewMode}
                      onValueChange={handleViewModeChange}
                      variant="outline"
                      className="w-full"
                    >
                      <ToggleGroupItem value="gallery" className="flex-1">
                        <LayoutGrid className="mr-2 h-4 w-4" />
                        {t("news.view.gallery")}
                      </ToggleGroupItem>
                      <ToggleGroupItem value="list" className="flex-1">
                        <List className="mr-2 h-4 w-4" />
                        {t("news.view.list")}
                      </ToggleGroupItem>
                    </ToggleGroup>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t">
                <h4 className="text-sm font-semibold text-gray-500 mb-3">{t("news.categories")}</h4>
                <div className="space-y-2">
                  {categoryOptions.filter((option) => option !== "All").map((cat) => (
                    <div
                      key={cat}
                      className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors ${categoryFilter === cat ? "bg-red-50 text-[#E31E24]" : "hover:bg-gray-100"}`}
                      onClick={() => setCategoryFilter(cat)}
                    >
                      <span className="text-sm">{cat === "News" ? t("news.cat.news") : t("news.cat.event")}</span>
                      <Badge variant="secondary" className="bg-gray-200 text-gray-700">
                        {publishedItems.filter((item) => item.category === cat).length}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Megaphone className="h-4 w-4 text-[#E31E24]" />
                  {t("news.kpi.news")}
                </div>
                <div className="text-2xl font-bold text-[#1d1d1f]">{summary.news}</div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-9 space-y-6">
          {isLoading ? (
            <div className="rounded-2xl bg-white p-8 text-sm text-gray-500 shadow-sm">{copy.loadingLabel}</div>
          ) : null}

          {!isLoading && featuredItem && !search && (categoryFilter === "All" || categoryFilter === featuredItem.category) ? (
            <Card className="border-none overflow-hidden shadow-lg bg-[linear-gradient(135deg,#0f172a_0%,#1e293b_55%,#2563eb_100%)] text-white">
              {renderActivityImage(featuredItem, "relative h-48 overflow-hidden border-b border-white/10")}
              <CardHeader>
                <CardDescription className="text-slate-300">{copy.featuredTitle}</CardDescription>
                <CardTitle className="text-3xl font-bold leading-tight">{featuredItem.title}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_220px]">
                <div>
                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    <Badge className="bg-white/10 text-white border border-white/10">
                      {featuredItem.category === "Event" ? t("news.cat.event") : t("news.cat.news")}
                    </Badge>
                    {featuredItem.activityType ? (
                      <Badge variant="outline" className="border-white/20 bg-transparent text-white">
                        {formatActivityType(featuredItem.activityType)}
                      </Badge>
                    ) : null}
                    {featuredItem.activitySubtype ? (
                      <Badge variant="outline" className="border-white/20 bg-transparent text-white">
                        {featuredItem.activitySubtype}
                      </Badge>
                    ) : null}
                    <Badge variant="outline" className="border-white/20 bg-transparent text-white">
                      {formatNewsDate(featuredItem.date)}
                    </Badge>
                  </div>
                  {featuredItem.summary && featuredItem.summary !== featuredItem.content ? (
                    <p className="mb-3 max-w-3xl text-base font-medium leading-7 text-white/90">{featuredItem.summary}</p>
                  ) : null}
                  <p className="max-w-3xl whitespace-pre-wrap text-sm leading-7 text-slate-200">{featuredItem.content}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
                  <div className="flex items-center gap-2 text-sm text-slate-300">
                    <CalendarDays className="h-4 w-4" />
                    {formatNewsDate(featuredItem.date)}
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-sm text-slate-300">
                    <Clock className="h-4 w-4" />
                    {t("news.postedBy")} {featuredItem.author}
                  </div>
                  {featuredItem.target ? <div className="mt-3 text-sm text-slate-300">{featuredItem.target}</div> : null}
                  {mode === "activities" ? <div className="mt-4">{renderActivityRegistrationAction(featuredItem)}</div> : null}
                  {featuredItem.linkUrl ? (
                    <a
                      href={featuredItem.linkUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-100"
                    >
                      <ExternalLink className="h-4 w-4" />
                      {t("news.readMore")}
                    </a>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {!isLoading && filteredNews.length > 0 ? (
            viewMode === "gallery" ? (
              <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                {filteredNews.map((item) => {
                  const CategoryIcon = getCategoryIcon(item);

                  return (
                    <Card key={item.id} className="border-none shadow-md overflow-hidden transition-transform hover:-translate-y-1 hover:shadow-lg">
                      {renderActivityImage(item, "relative h-40 overflow-hidden")}
                      <CardContent className="p-6">
                        <div className="mb-5 flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                              <CategoryIcon className="h-5 w-5" />
                            </div>
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline" className={getCategoryBadgeClassName(item)}>
                                  {item.category === "Event" ? t("news.cat.event") : t("news.cat.news")}
                                </Badge>
                                {item.activityType ? (
                                  <Badge variant="outline" className="border-gray-200 bg-gray-50 text-gray-700">
                                    {formatActivityType(item.activityType)}
                                  </Badge>
                                ) : null}
                                {item.activitySubtype ? (
                                  <Badge variant="outline" className="border-gray-200 bg-gray-50 text-gray-700">
                                    {item.activitySubtype}
                                  </Badge>
                                ) : null}
                                {mode === "activities" && activityRegistrations[getLiveActivityId(item)] ? (
                                  <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                                    <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                                    {t("news.registration.registered")}
                                  </Badge>
                                ) : null}
                              </div>
                              <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
                                <Clock className="h-3.5 w-3.5" />
                                {formatNewsDate(item.date)}
                              </div>
                            </div>
                          </div>
                          <div className="text-xs text-gray-400">{t("news.postedBy")} {item.author}</div>
                        </div>

                        <h2 className="text-2xl font-bold text-gray-900">{item.title}</h2>
                        <p className="mt-3 line-clamp-5 whitespace-pre-wrap text-sm leading-6 text-gray-600">{getActivityExcerpt(item)}</p>

                        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                          <div className="flex flex-wrap gap-2">
                            {item.tag ? (
                              <Badge variant="outline" className="border-gray-200 bg-gray-50 text-gray-700">
                                {item.tag}
                              </Badge>
                            ) : null}
                            {item.target ? (
                              <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-700">
                                {item.target}
                              </Badge>
                            ) : null}
                          </div>
                          {item.linkUrl ? (
                            <a
                              href={item.linkUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-2 text-sm font-semibold text-[#E31E24] transition-colors hover:text-[#c41a20]"
                            >
                              <ExternalLink className="h-4 w-4" />
                              {t("news.readMore")}
                            </a>
                          ) : null}
                          {mode === "activities" ? renderActivityRegistrationAction(item) : null}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredNews.map((item) => {
                  const CategoryIcon = getCategoryIcon(item);

                  return (
                    <Card key={item.id} className="border-none shadow-md overflow-hidden">
                      <CardContent className="p-5">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="flex min-w-0 flex-1 gap-4">
                            {item.imageUrl ? (
                              <div className="relative h-24 w-28 shrink-0 overflow-hidden rounded-2xl">
                                <img src={item.imageUrl} alt={item.title} className="h-full w-full object-cover" loading="lazy" />
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/40 via-transparent to-transparent" />
                              </div>
                            ) : null}
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                              <CategoryIcon className="h-5 w-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="mb-2 flex flex-wrap items-center gap-2">
                                <Badge variant="outline" className={getCategoryBadgeClassName(item)}>
                                  {item.category === "Event" ? t("news.cat.event") : t("news.cat.news")}
                                </Badge>
                                {item.activityType ? (
                                  <Badge variant="outline" className="border-gray-200 bg-gray-50 text-gray-700">
                                    {formatActivityType(item.activityType)}
                                  </Badge>
                                ) : null}
                                {item.activitySubtype ? (
                                  <Badge variant="outline" className="border-gray-200 bg-gray-50 text-gray-700">
                                    {item.activitySubtype}
                                  </Badge>
                                ) : null}
                                {item.tag ? (
                                  <Badge variant="outline" className="border-gray-200 bg-gray-50 text-gray-700">
                                    {item.tag}
                                  </Badge>
                                ) : null}
                                {mode === "activities" && activityRegistrations[getLiveActivityId(item)] ? (
                                  <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                                    <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                                    {t("news.registration.registered")}
                                  </Badge>
                                ) : null}
                              </div>
                              <h2 className="text-xl font-bold text-gray-900">{item.title}</h2>
                              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-gray-600">{getActivityExcerpt(item)}</p>
                            </div>
                          </div>

                          <div className="w-full shrink-0 rounded-2xl bg-slate-50 p-4 text-sm text-gray-600 lg:w-56">
                            <div className="flex items-center gap-2 text-[#1d1d1f]">
                              <CalendarDays className="h-4 w-4 text-[#E31E24]" />
                              {formatNewsDate(item.date)}
                            </div>
                            <div className="mt-2 text-xs text-gray-400">{t("news.postedBy")} {item.author}</div>
                            {item.target ? <div className="mt-2 text-xs text-gray-500">{item.target}</div> : null}
                            {item.linkUrl ? (
                              <a
                                href={item.linkUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#E31E24] transition-colors hover:text-[#c41a20]"
                              >
                                <ExternalLink className="h-4 w-4" />
                                {t("news.readMore")}
                              </a>
                            ) : null}
                            {mode === "activities" ? <div className="mt-4">{renderActivityRegistrationAction(item)}</div> : null}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )
          ) : !isLoading ? (
            <div className="text-center py-12 bg-white rounded-lg shadow-sm">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
                <Search className="text-gray-400" size={24} />
              </div>
              <h3 className="text-lg font-medium text-gray-900">{t("news.noPosts")}</h3>
              <p className="text-gray-500 mt-1">{t("news.tryAdjusting")}</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => {
                  setSearch("");
                  setCategoryFilter("All");
                  setActivityTypeFilter("all");
                }}
              >
                {t("news.clearFilters")}
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function ActivitiesPage() {
  return <PublicFeedPage mode="activities" />;
}

export function NewsPage() {
  return <PublicFeedPage mode="news" />;
}
