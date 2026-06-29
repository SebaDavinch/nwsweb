import { useCallback, useEffect, useState } from "react";
import { BarChart2, Clock, Loader2, Plane, RefreshCw, TrendingUp, Users } from "lucide-react";
import { Button } from "../ui/button";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { useLanguage } from "../../context/language-context";

interface VamsysStatistics {
  total_pilots?: number | null;
  active_pilots?: number | null;
  total_pireps?: number | null;
  accepted_pireps?: number | null;
  total_hours?: number | null;
  total_flights?: number | null;
  total_distance?: number | null;
  average_flight_time?: number | null;
  [key: string]: unknown;
}

function StatCard({ label, value, icon: Icon, color = "#E31E24" }: { label: string; value: string; icon: React.ElementType; color?: string }) {
  return (
    <Card className="border-none shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-400">{label}</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
          </div>
          <div className="rounded-lg p-2" style={{ background: `${color}18` }}>
            <Icon className="h-5 w-5" style={{ color }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const fmt = (n: number | null | undefined, decimals = 0) =>
  n == null ? "—" : Number(n).toLocaleString("en-US", { maximumFractionDigits: decimals });

const fmtHours = (n: number | null | undefined) => {
  if (n == null) return "—";
  const h = Math.floor(Number(n));
  const m = Math.round((Number(n) - h) * 60);
  return `${h.toLocaleString("en-US")}h ${m}m`;
};

function parseStats(raw: unknown): VamsysStatistics {
  if (!raw || typeof raw !== "object") return {};
  const r = raw as Record<string, unknown>;
  const data = (r.data && typeof r.data === "object") ? r.data as Record<string, unknown> : r;
  return data as VamsysStatistics;
}

export function AdminStatistics() {
  const { language } = useLanguage();
  const tr = useCallback((ru: string, en: string) => (language === "ru" ? ru : en), [language]);

  const [stats, setStats] = useState<VamsysStatistics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [extra, setExtra] = useState<Record<string, unknown>>({});

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/statistics", { credentials: "include" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || res.statusText);
      const parsed = parseStats(json);
      setStats(parsed);
      const known = new Set(["total_pilots", "active_pilots", "total_pireps", "accepted_pireps", "total_hours", "total_flights", "total_distance", "average_flight_time"]);
      const extras: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (!known.has(k) && (typeof v === "number" || typeof v === "string")) extras[k] = v;
      }
      setExtra(extras);
    } catch (err) {
      toast.error(tr("Не удалось загрузить статистику", "Failed to load statistics"));
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [tr]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">{tr("Статистика ВАК", "VA Statistics")}</h2>
          <p className="text-sm text-gray-500">{tr("Общие показатели из vAMSYS", "Aggregate metrics from vAMSYS")}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          {tr("Обновить", "Refresh")}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : !stats ? (
        <Card className="border-none shadow-sm">
          <CardContent className="py-16 text-center text-gray-400">
            {tr("Данные недоступны", "Statistics unavailable")}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label={tr("Всего пилотов", "Total pilots")} value={fmt(stats.total_pilots)} icon={Users} />
            <StatCard label={tr("Активных пилотов", "Active pilots")} value={fmt(stats.active_pilots)} icon={TrendingUp} color="#2563eb" />
            <StatCard label={tr("Всего рейсов", "Total flights")} value={fmt(stats.total_flights ?? stats.total_pireps)} icon={Plane} color="#16a34a" />
            <StatCard label={tr("Принято PIREPs", "Accepted PIREPs")} value={fmt(stats.accepted_pireps)} icon={BarChart2} color="#7c3aed" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <StatCard label={tr("Общий налёт", "Total hours")} value={fmtHours(stats.total_hours)} icon={Clock} />
            <StatCard label={tr("Ср. время рейса", "Avg. flight time")} value={fmtHours(stats.average_flight_time)} icon={Clock} color="#2563eb" />
            <StatCard label={tr("Общий километраж", "Total distance")} value={stats.total_distance != null ? `${fmt(stats.total_distance)} nm` : "—"} icon={Plane} color="#16a34a" />
          </div>

          {Object.keys(extra).length > 0 && (
            <Card className="border-none shadow-sm">
              <CardHeader>
                <CardTitle className="text-base text-gray-700">{tr("Дополнительно", "Additional metrics")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 text-sm">
                  {Object.entries(extra).map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                      <span className="text-gray-500 capitalize">{k.replace(/_/g, " ")}</span>
                      <span className="font-medium text-gray-900">{typeof v === "number" ? fmt(v) : String(v)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
