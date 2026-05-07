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

interface UtcClockValue {
  time: string;
  date: string;
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

function formatUtcClock(date: Date): UtcClockValue {
  return {
    time: `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}`,
    date: date.toLocaleDateString("en-GB", {
      timeZone: "UTC",
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
  };
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

// AIRAC cycle calculation — pure math, no API needed
const AIRAC_EPOCH_MS = Date.UTC(2024, 0, 18); // AIRAC 2401 started Jan 18, 2024
const AIRAC_CYCLE_MS = 28 * 24 * 60 * 60 * 1000;

function getAiracInfo(now = new Date()) {
  const todayMs = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const n = Math.floor((todayMs - AIRAC_EPOCH_MS) / AIRAC_CYCLE_MS);
  const startMs = AIRAC_EPOCH_MS + n * AIRAC_CYCLE_MS;
  const start = new Date(startMs);
  const end = new Date(startMs + AIRAC_CYCLE_MS - 86400000);
  const yr = start.getUTCFullYear();
  const n0 = Math.ceil((Date.UTC(yr, 0, 1) - AIRAC_EPOCH_MS) / AIRAC_CYCLE_MS);
  const ident = `${String(yr).slice(-2)}${String(n - n0 + 1).padStart(2, "0")}`;
  return { ident, start, end };
}

function formatAiracDate(d: Date) {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });
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
  const [utcNow, setUtcNow] = useState<UtcClockValue>(() => formatUtcClock(new Date()));
  const airac = useMemo(() => getAiracInfo(new Date()), [utcNow]);

  useEffect(() => {
    const update = () => setUtcNow(formatUtcClock(new Date()));
    update();
    const timer = window.setInterval(update, 30000);
    return () => window.clearInterval(timer);
  }, []);

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
  const chartMax = activityData.reduce((max, item) => Math.max(max, Number(item.flights || 0)), 0);
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
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">{tr("Обзор панели", "Dashboard Overview")}</h2>
        <span className="text-sm text-gray-500">{tr("Обновлено только что", "Updated just now")}</span>
      </div>

      <AdminQuickAccessPanel />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-5">
        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">{tr("Всего пилотов", "Total pilots")}</p>
                <h3 className="text-2xl font-bold text-gray-900">{Number(kpi.totalPilots || 0).toLocaleString()}</h3>
              </div>
              <div className="p-3 bg-blue-50 text-blue-600 rounded-full">
                <Users size={24} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">{tr("Активные рейсы", "Active flights")}</p>
                <h3 className="text-2xl font-bold text-gray-900">{Number(kpi.activeFlights || 0).toLocaleString()}</h3>
              </div>
              <div className="p-3 bg-green-50 text-green-600 rounded-full">
                <Plane size={24} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">{tr("Всего часов", "Total hours")}</p>
                <h3 className="text-2xl font-bold text-gray-900">{Number(kpi.totalHours || 0).toLocaleString()}</h3>
              </div>
              <div className="p-3 bg-purple-50 text-purple-600 rounded-full">
                <Clock size={24} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">NOTAM</p>
                <h3 className="text-2xl font-bold text-gray-900">{Number(kpi.totalNotams || 0).toLocaleString()}</h3>
              </div>
              <div className="p-3 bg-orange-50 text-orange-600 rounded-full">
                <AlertCircle size={24} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-500 mb-1">UTC</p>
                <h3 className="text-2xl font-bold text-gray-900 tabular-nums">{utcNow.time}</h3>
                <p className="mt-1 text-xs uppercase tracking-[0.18em] text-gray-400">{utcNow.date}</p>
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                    AIRAC {airac.ident}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-400">
                    {formatAiracDate(airac.start)} – {formatAiracDate(airac.end)}
                  </p>
                </div>
              </div>
              <div className="p-3 bg-slate-100 text-slate-700 rounded-full shrink-0">
                <Clock size={24} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
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
                <div className="mt-1 text-2xl font-bold text-gray-900">{averageFlightsInRange.toFixed(1)}</div>
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
                <AreaChart data={activityData} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
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
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-800">{tr("Последняя активность", "Recent Activity")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {logs.length > 0 ? (
                logs.map((log) => {
                  const StatusIcon = getRecentStatusIcon(log.status);
                  return (
                    <button
                      key={log.id}
                      type="button"
                      onClick={() => navigateTo("pirep-detail", log.id)}
                      className="flex w-full flex-col gap-3 rounded-2xl border border-transparent pb-4 text-left transition hover:border-red-100 hover:bg-red-50/40 last:pb-0"
                    >
                      <div className="flex items-start gap-3 border-b pb-4 last:border-0 last:pb-0">
                        <div className={`mt-0.5 rounded-full border p-1.5 ${getRecentStatusClasses(log.status)}`}>
                          <StatusIcon size={12} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-gray-900 truncate">{log.flightNumber || log.detail}</p>
                              <p className="text-xs text-gray-500 truncate">{log.user}{log.departure && log.arrival ? ` · ${log.departure} → ${log.arrival}` : ""}</p>
                            </div>
                            <div className="text-right">
                              <div className="text-xs text-gray-400 whitespace-nowrap">{formatRelativeTime(log.time, language)}</div>
                              <div className={`mt-1 inline-flex rounded-full border px-2 py-1 text-[11px] font-medium uppercase tracking-wide whitespace-nowrap ${getRecentStatusClasses(log.status)}`}>{getRecentStatusLabel(log.status, language)}</div>
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
                          <div className="mt-3 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-gray-400">
                            <ArrowDownToLine className="h-3.5 w-3.5" />
                            {tr("Открыть PIREP", "Open PIREP")}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="text-sm text-gray-500">{tr("Пока нет недавней активности.", "No recent activity yet.")}</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
