import { useEffect, useMemo, useState } from "react";
import {
  Users,
  Plane,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import {
  BarChart,
  Bar,
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
    user: string;
    detail: string;
    time: string;
    status: "approved" | "pending" | "rejected";
  }>;
}

function formatRelativeTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "just now";
  }
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.max(1, Math.floor(diffMs / 60000));
  if (minutes < 60) {
    return `${minutes} min ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  }
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? "s" : ""} ago`;
}

const ACTIVITY_RANGES: Array<{ value: ActivityRange; label: string; title: string }> = [
  { value: "day", label: "24h", title: "Last 24 hours" },
  { value: "week", label: "7d", title: "Last 7 days" },
  { value: "month", label: "30d", title: "Last 30 days" },
  { value: "year", label: "12m", title: "Last 12 months" },
];

export function AdminDashboard() {
  const [overview, setOverview] = useState<OverviewPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRange, setSelectedRange] = useState<ActivityRange>("week");

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
  const peakBucket = activityData.reduce<ActivityPoint | null>((best, item) => {
    if (!best || Number(item.flights || 0) > Number(best.flights || 0)) {
      return item;
    }
    return best;
  }, null);

  if (isLoading) {
    return <div className="text-gray-500">Loading dashboard...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">Dashboard Overview</h2>
        <span className="text-sm text-gray-500">Last updated: just now</span>
      </div>

      <AdminQuickAccessPanel />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Total Pilots</p>
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
                <p className="text-sm font-medium text-gray-500 mb-1">Active Flights</p>
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
                <p className="text-sm font-medium text-gray-500 mb-1">Total Hours</p>
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
                <p className="text-sm font-medium text-gray-500 mb-1">NOTAMs</p>
                <h3 className="text-2xl font-bold text-gray-900">{Number(kpi.totalNotams || 0).toLocaleString()}</h3>
              </div>
              <div className="p-3 bg-orange-50 text-orange-600 rounded-full">
                <AlertCircle size={24} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 shadow-sm">
          <CardHeader className="gap-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle className="text-lg font-semibold text-gray-800">Flight Activity Distribution</CardTitle>
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
                <div className="text-xs uppercase tracking-wide text-gray-500">Flights</div>
                <div className="mt-1 text-2xl font-bold text-gray-900">{totalFlightsInRange.toLocaleString()}</div>
              </div>
              <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-gray-500">Average bucket</div>
                <div className="mt-1 text-2xl font-bold text-gray-900">{averageFlightsInRange.toFixed(1)}</div>
              </div>
              <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-gray-500">Peak bucket</div>
                <div className="mt-1 text-lg font-bold text-gray-900">{peakBucket?.fullLabel || peakBucket?.label || "—"}</div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={activityData} barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#9CA3AF", fontSize: 12 }} />
                  <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "#9CA3AF", fontSize: 12 }} />
                  <Tooltip
                    formatter={(value) => [`${value} flights`, "Flights"]}
                    labelFormatter={(_label, payload) => {
                      const point = payload?.[0]?.payload as ActivityPoint | undefined;
                      return point?.fullLabel || point?.label || "Activity";
                    }}
                    contentStyle={{
                      borderRadius: "8px",
                      border: "none",
                      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                    }}
                  />
                  <Bar dataKey="flights" fill="#E31E24" radius={[8, 8, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-800">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {logs.length > 0 ? (
                logs.map((log) => (
                  <div key={log.id} className="flex items-start gap-3 pb-4 border-b last:border-0 last:pb-0">
                    <div
                      className={`mt-0.5 rounded-full p-1.5 ${
                        log.status === "approved"
                          ? "bg-green-100 text-green-600"
                          : log.status === "pending"
                          ? "bg-orange-100 text-orange-600"
                          : "bg-red-100 text-red-600"
                      }`}
                    >
                      {log.status === "approved" && <CheckCircle2 size={12} />}
                      {log.status === "pending" && <AlertCircle size={12} />}
                      {log.status === "rejected" && <XCircle size={12} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{log.user}</p>
                      <p className="text-xs text-gray-500 truncate">{log.detail}</p>
                    </div>
                    <div className="text-xs text-gray-400 whitespace-nowrap">{formatRelativeTime(log.time)}</div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-gray-500">No recent activity.</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
