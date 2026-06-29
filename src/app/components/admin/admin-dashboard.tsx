import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useAdminNav } from "./admin-nav-context";
import { useLanguage } from "../../context/language-context";
import {
  Activity,
  Users,
  Plane,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Ban,
  ArrowDownToLine,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { AdminQuickAccessPanel } from "./admin-quick-access";

type ActivityRange = "day" | "week" | "month" | "year";

interface ActivityPoint {
  label: string;
  fullLabel?: string;
  flights: number;
}

interface OverviewPayload {
  kpi?: {
    totalPilots?: number;
    activeFlights?: number;
    totalHours?: number;
    totalNotams?: number;
  };
  weeklyActivity?: Array<{ day: string; flights: number }>;
  activitySeries?: Partial<Record<ActivityRange, ActivityPoint[]>>;
  recentActivity?: Array<{
    id: number;
    bookingId?: number | null;
    user: string;
    detail: string;
    time: string;
    status: "approved" | "pending" | "rejected" | "invalidated" | "cancelled";
    flightNumber?: string | null;
    departure?: string | null;
    arrival?: string | null;
    landedAt?: string | null;
    flightLengthSeconds?: number;
    blockLengthSeconds?: number;
    landingRate?: number | null;
    gForce?: number | null;
  }>;
}

type RecentActivityStatus = NonNullable<OverviewPayload["recentActivity"]>[number]["status"];

function formatRelativeTime(value: string, language: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
      return language === "ru" ? "только что" : "just now";
  }
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.max(1, Math.floor(diffMs / 60000));
  if (minutes < 60) {
      return language === "ru" ? `${minutes} мин назад` : `${minutes} min ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
      return language === "ru" ? `${hours} ч назад` : `${hours} hr ago`;
  }
  const days = Math.floor(hours / 24);
  return language === "ru" ? `${days} дн назад` : `${days} days ago`;
}

function formatUtcTime(value?: string | null) {
  if (!value) {
    return "--:--";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "--:--";
  }
  return `${String(parsed.getUTCHours()).padStart(2, "0")}:${String(parsed.getUTCMinutes()).padStart(2, "0")}`;
}

function formatDurationHHMM(value?: number) {
  const totalSeconds = Number(value || 0);
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return "--:--";
  }

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function formatGForce(value?: number | null) {
  if (!Number.isFinite(Number(value))) {
    return "--";
  }
  return `${Number(value).toFixed(2)}G`;
}

function getRecentStatusLabel(status: RecentActivityStatus, language: string) {
  const ru = language === "ru";
  switch (status) {
    case "approved":
      return ru ? "Принят" : "Approved";
    case "pending":
      return ru ? "На проверке" : "Pending";
    case "rejected":
      return ru ? "Отклонён" : "Rejected";
    case "invalidated":
      return ru ? "Аннулирован" : "Invalidated";
    case "cancelled":
      return ru ? "Отменён" : "Cancelled";
    default:
      return ru ? "Рейс" : "Flight";
  }
}

function getRecentStatusClasses(status: RecentActivityStatus) {
  switch (status) {
    case "approved":
      return "bg-green-100 text-green-700 border-green-200";
    case "pending":
      return "bg-amber-100 text-amber-700 border-amber-200";
    case "rejected":
      return "bg-red-100 text-red-700 border-red-200";
    case "invalidated":
      return "bg-slate-200 text-slate-700 border-slate-300";
    case "cancelled":
      return "bg-gray-200 text-gray-700 border-gray-300";
    default:
      return "bg-gray-100 text-gray-700 border-gray-200";
  }
}

function getRecentStatusIcon(status: RecentActivityStatus) {
  switch (status) {
    case "approved":
      return CheckCircle2;
    case "pending":
      return AlertCircle;
    case "rejected":
      return XCircle;
    case "invalidated":
      return Ban;
    case "cancelled":
      return Ban;
    default:
      return Activity;
  }
}

function formatApproxFlightsPerDay(totalFlights: number, range: ActivityRange, language: string) {
  const rangeDays: Record<ActivityRange, number> = {
    day: 1,
    week: 7,
    month: 30,
    year: 365,
  };

  const normalizedTotal = Number(totalFlights || 0);
  const perDay = normalizedTotal > 0 ? normalizedTotal / rangeDays[range] : 0;
  const rounded = Math.max(0, Math.round(perDay));

  if (language === "ru") {
    if (rounded <= 0) {
      return "примерно 0 полетов в день";
    }
    if (rounded % 10 === 1 && rounded % 100 !== 11) {
      return `примерно ${rounded} полет в день`;
    }
    if ([2, 3, 4].includes(rounded % 10) && ![12, 13, 14].includes(rounded % 100)) {
      return `примерно ${rounded} полета в день`;
    }
    return `примерно ${rounded} полетов в день`;
  }

  return `about ${rounded} flight${rounded === 1 ? '' : 's'} per day`;
}

// ACTIVITY_RANGES is defined inside AdminDashboard so it can use tr()

export function AdminDashboard() {
  const { navigateTo } = useAdminNav();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);

  const ACTIVITY_RANGES: Array<{ value: ActivityRange; label: string; title: string }> = [
    { value: "day", label: tr("24ч", "24h"), title: tr("За последние 24 часа", "Last 24 hours") },
    { value: "week", label: tr("7д", "7d"), title: tr("За последние 7 дней", "Last 7 days") },
    { value: "month", label: tr("30д", "30d"), title: tr("За последние 30 дней", "Last 30 days") },
    { value: "year", label: tr("12м", "12m"), title: tr("За последние 12 месяцев", "Last 12 months") },
  ];

  const [overview, setOverview] = useState<OverviewPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRange, setSelectedRange] = useState<ActivityRange>("week");
  const [isRecentFlightsModalOpen, setIsRecentFlightsModalOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const response = await fetch("/api/admin/dashboard/overview", {
          credentials: "include",
        });
        if (!response.ok) {
          throw new Error("failed");
        }
        const payload = await response.json();
        setOverview(payload || null);
      } catch {
        setOverview(null);
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, []);

  const activitySeries = useMemo(() => {
    return overview?.activitySeries || {};
  }, [overview]);

  const activityData = useMemo(() => {
    const selected = activitySeries?.[selectedRange];
    if (Array.isArray(selected) && selected.length > 0) {
      return selected;
    }

    if (selectedRange === "week" && Array.isArray(overview?.weeklyActivity)) {
      return overview.weeklyActivity.map((item) => ({
        label: item.day,
        fullLabel: item.day,
        flights: item.flights,
      }));
    }

    return [];
  }, [activitySeries, overview, selectedRange]);

  const logs = useMemo(() => {
    return Array.isArray(overview?.recentActivity) ? overview.recentActivity : [];
  }, [overview]);

  const kpi = overview?.kpi || {};
  const selectedRangeMeta = ACTIVITY_RANGES.find((item) => item.value === selectedRange) || ACTIVITY_RANGES[1];
  const totalFlightsInRange = activityData.reduce((sum, item) => sum + Number(item.flights || 0), 0);
  const averageFlightsInRange = activityData.length > 0 ? totalFlightsInRange / activityData.length : 0;
  const averageFlightsLabel = formatApproxFlightsPerDay(totalFlightsInRange, selectedRange, language);
  const chartMax = activityData.reduce((max, item) => Math.max(max, Number(item.flights || 0)), 0);
  const recentFlightsPreview = logs.slice(0, 8);
  const peakBucket = activityData.reduce<ActivityPoint | null>((best, item) => {
    if (!best || Number(item.flights || 0) > Number(best.flights || 0)) {
      return item;
    }
    return best;
  }, null);

  if (isLoading) {
    return <div className="text-gray-500">{tr("Загрузка панели...", "Loading dashboard...")}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <h2 className="text-2xl font-bold text-gray-800">{tr("Обзор панели", "Dashboard Overview")}</h2>
      </div>

      <AdminQuickAccessPanel />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">{tr("Всего пилотов", "Total pilots")}</p>
                <h3 className="text-xl font-bold text-gray-900">{Number(kpi.totalPilots || 0).toLocaleString()}</h3>
              </div>
              <div className="p-2 bg-blue-50 text-blue-600 rounded-full">
                <Users size={18} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">{tr("Активные рейсы", "Active flights")}</p>
                <h3 className="text-xl font-bold text-gray-900">{Number(kpi.activeFlights || 0).toLocaleString()}</h3>
              </div>
              <div className="p-2 bg-green-50 text-green-600 rounded-full">
                <Plane size={18} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">{tr("Всего часов", "Total hours")}</p>
                <h3 className="text-xl font-bold text-gray-900">{Number(kpi.totalHours || 0).toLocaleString()}</h3>
              </div>
              <div className="p-2 bg-purple-50 text-purple-600 rounded-full">
                <Clock size={18} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">NOTAM</p>
                <h3 className="text-xl font-bold text-gray-900">{Number(kpi.totalNotams || 0).toLocaleString()}</h3>
              </div>
              <div className="p-2 bg-orange-50 text-orange-600 rounded-full">
                <AlertCircle size={18} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="min-w-0 shadow-sm">
          <CardHeader className="gap-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle className="text-lg font-semibold text-gray-800">{tr("Распределение рейсов", "Flight Distribution")}</CardTitle>
                <p className="mt-1 text-sm text-gray-500">{selectedRangeMeta.title}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {ACTIVITY_RANGES.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    variant={selectedRange === option.value ? "default" : "outline"}
                    className={selectedRange === option.value ? "bg-[#E31E24] hover:bg-[#c41a20] text-white" : "border-gray-200 text-gray-600"}
                    onClick={() => setSelectedRange(option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-gray-500">{tr("Рейсы", "Flights")}</div>
                <div className="mt-1 text-2xl font-bold text-gray-900">{totalFlightsInRange.toLocaleString()}</div>
              </div>
              <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-gray-500">{tr("Средний онлайн", "Avg online")}</div>
                <div className="mt-1 text-xl font-bold leading-tight text-gray-900">{averageFlightsLabel}</div>
              </div>
              <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-gray-500">{tr("Пик онлайна", "Peak online")}</div>
                <div className="mt-1 text-lg font-bold text-gray-900">{peakBucket?.fullLabel || peakBucket?.label || "—"}</div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[260px] w-full rounded-2xl border border-gray-100 bg-gradient-to-b from-gray-50 to-white p-4 sm:h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={activityData} margin={{ top: 8, right: 0, left: -40, bottom: 0 }}>
                  <defs>
                    <linearGradient id="adminActivityFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#E31E24" stopOpacity={0.38} />
                      <stop offset="100%" stopColor="#E31E24" stopOpacity={0.04} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 6" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#9CA3AF", fontSize: 12 }} />
                  <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "#9CA3AF", fontSize: 12 }} domain={[0, Math.max(4, chartMax + 1)]} />
                  <Tooltip
                    formatter={(value) => [`${value} ${tr("рейсов", "flights")}`, tr("Рейсы", "Flights")]}
                    labelFormatter={(_label, payload) => {
                      const point = payload?.[0]?.payload as ActivityPoint | undefined;
                      return point?.fullLabel || point?.label || tr("Активность", "Activity");
                    }}
                    contentStyle={{
                      borderRadius: "8px",
                      border: "none",
                      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                      backgroundColor: "rgba(255,255,255,0.96)",
                    }}
                  />
                  <Area type="monotone" dataKey="flights" stroke="#E31E24" strokeWidth={3} fill="url(#adminActivityFill)" activeDot={{ r: 5, fill: "#E31E24" }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold text-gray-800">{tr("Крайние полеты", "Latest flights")}</CardTitle>
            <p className="text-sm text-gray-500">{tr("Последние 5-10 рейсов с быстрым доступом к PIREP", "Latest 5-10 flights with quick access to PIREP")}</p>
          </CardHeader>
          <CardContent className="pt-0">
            {recentFlightsPreview.length > 0 ? (
              <div className="space-y-2">
                {recentFlightsPreview.map((log) => {
                  const StatusIcon = getRecentStatusIcon(log.status);
                  return (
                    <button
                      key={log.id}
                      type="button"
                      onClick={() => navigateTo("pirep-detail", log.id)}
                      className="w-full rounded-xl border border-gray-100 px-3 py-2.5 text-left transition hover:border-red-100 hover:bg-red-50/30"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-gray-900">{log.flightNumber || log.detail}</div>
                          <div className="mt-0.5 truncate text-xs text-gray-500">{log.departure && log.arrival ? `${log.departure} → ${log.arrival}` : log.user}</div>
                        </div>
                        <div className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${getRecentStatusClasses(log.status)}`}>
                          <StatusIcon className="h-3 w-3" />
                          {getRecentStatusLabel(log.status, language)}
                        </div>
                      </div>
                      <div className="mt-2 text-[11px] text-gray-400">{formatRelativeTime(log.time, language)}</div>
                    </button>
                  );
                })}

                <Button
                  type="button"
                  variant="outline"
                  className="mt-2 w-full"
                  onClick={() => setIsRecentFlightsModalOpen(true)}
                >
                  <ArrowDownToLine className="mr-2 h-4 w-4" />
                  {tr("Посмотреть все", "View all")}
                </Button>
              </div>
            ) : (
              <div className="text-sm text-gray-500">{tr("Пока нет недавних полетов.", "No recent flights yet.")}</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isRecentFlightsModalOpen} onOpenChange={setIsRecentFlightsModalOpen}>
        <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{tr("Крайние полеты", "Latest flights")}</DialogTitle>
            <DialogDescription>
              {tr("Полный список недавних рейсов", "Complete list of recent flights")}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[64vh] space-y-3 overflow-y-auto pr-1">
            {logs.length > 0 ? (
              logs.map((log) => {
                const StatusIcon = getRecentStatusIcon(log.status);
                return (
                  <button
                    key={`modal-${log.id}`}
                    type="button"
                    onClick={() => {
                      setIsRecentFlightsModalOpen(false);
                      navigateTo("pirep-detail", log.id);
                    }}
                    className="w-full rounded-2xl border border-gray-100 p-3 text-left transition hover:border-red-100 hover:bg-red-50/30"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-gray-900">{log.flightNumber || log.detail}</div>
                        <div className="mt-0.5 truncate text-xs text-gray-500">{log.user}{log.departure && log.arrival ? ` · ${log.departure} → ${log.arrival}` : ""}</div>
                      </div>
                      <div className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${getRecentStatusClasses(log.status)}`}>
                        <StatusIcon className="h-3 w-3" />
                        {getRecentStatusLabel(log.status, language)}
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-500 sm:grid-cols-4">
                      <div className="rounded-xl bg-gray-50 px-2 py-2">
                        <div className="uppercase tracking-wide text-[10px] text-gray-400">{tr("Полёт", "Flight")}</div>
                        <div className="mt-1 font-semibold text-gray-800 tabular-nums">{formatDurationHHMM(log.flightLengthSeconds)}</div>
                      </div>
                      <div className="rounded-xl bg-gray-50 px-2 py-2">
                        <div className="uppercase tracking-wide text-[10px] text-gray-400">{tr("Блок", "Block")}</div>
                        <div className="mt-1 font-semibold text-gray-800 tabular-nums">{formatDurationHHMM(log.blockLengthSeconds)}</div>
                      </div>
                      <div className="rounded-xl bg-gray-50 px-2 py-2">
                        <div className="uppercase tracking-wide text-[10px] text-gray-400">{tr("Посадка UTC", "Landing UTC")}</div>
                        <div className="mt-1 font-semibold text-gray-800 tabular-nums">{formatUtcTime(log.landedAt)} UTC</div>
                      </div>
                      <div className="rounded-xl bg-gray-50 px-2 py-2">
                        <div className="uppercase tracking-wide text-[10px] text-gray-400">VS / G</div>
                        <div className="mt-1 font-semibold text-gray-800 tabular-nums">{Number.isFinite(Number(log.landingRate)) ? `${Number(log.landingRate)} fpm` : "--"} · {formatGForce(log.gForce)}</div>
                      </div>
                    </div>

                    <div className="mt-2 text-[11px] text-gray-400">{formatRelativeTime(log.time, language)}</div>
                  </button>
                );
              })
            ) : (
              <div className="text-sm text-gray-500">{tr("Пока нет недавней активности.", "No recent activity yet.")}</div>
            )}
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
