import { useEffect, useState } from "react";
import { Loader2, Plane, Clock, Route, TrendingUp, ChevronDown } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

interface MonthlyPoint {
  month: string;
  flights: number;
  hours: number;
}

interface BreakdownRow {
  key: string;
  count: number;
  hours: number;
}

interface TopAirport {
  icao: string;
  name: string | null;
  countryIso2: string | null;
  count: number;
}

interface VsCategory {
  label: string;
  count: number;
}

interface AnalyticsData {
  summary: {
    totalFlights: number;
    totalHours: number;
    totalDistance: number;
    totalPoints: number;
    avgVs: number | null;
  };
  monthly: MonthlyPoint[];
  byAircraft: BreakdownRow[];
  byNetwork: BreakdownRow[];
  byRouteType: BreakdownRow[];
  byTimeOfDay: BreakdownRow[];
  byCallsignPrefix: BreakdownRow[];
  topDepartures: TopAirport[];
  topArrivals: TopAirport[];
  vsDistribution: VsCategory[];
  eventFlights: { event: number; nonEvent: number };
  landingsByDayNight: { day: number; night: number };
}

const RED = "#E31E24";
const COLORS = ["#E31E24", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];

function formatMonth(key: string) {
  const [y, m] = key.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("ru-RU", {
    month: "short",
    year: "2-digit",
  });
}

function Section({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 mb-4 group"
      >
        <h2 className="text-lg font-bold text-[#1d1d1f] group-hover:text-[#E31E24] transition-colors">{title}</h2>
        <ChevronDown
          size={18}
          className={`text-gray-400 transition-transform duration-200 ${open ? "" : "-rotate-90"}`}
        />
      </button>
      {open && children}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: React.ComponentType<any>;
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <Card className="border-none shadow-sm bg-white/70 backdrop-blur-sm">
      <CardContent className="p-5 flex items-center gap-4">
        <div className="w-11 h-11 rounded-xl bg-[#E31E24]/10 flex items-center justify-center shrink-0">
          <Icon size={20} className="text-[#E31E24]" />
        </div>
        <div className="min-w-0">
          <div className="text-xs text-gray-500 font-medium truncate">{label}</div>
          <div className="text-2xl font-bold text-[#1d1d1f] leading-tight">{value}</div>
          {sub ? <div className="text-xs text-gray-400 mt-0.5">{sub}</div> : null}
        </div>
      </CardContent>
    </Card>
  );
}

function BreakdownTable({ rows, label }: { rows: BreakdownRow[]; label: string }) {
  const total = rows.reduce((s, r) => s + r.count, 0) || 1;
  return (
    <Card className="border-none shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-gray-700">{label}</CardTitle>
      </CardHeader>
      <CardContent className="p-0 pb-3">
        <div className="divide-y divide-gray-50">
          {rows.slice(0, 8).map((row) => {
            const pct = Math.round((row.count / total) * 100);
            return (
              <div key={row.key} className="px-5 py-2.5 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-[#1d1d1f] truncate">{row.key}</div>
                  <div className="mt-1 h-1.5 w-full rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: RED }}
                    />
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-semibold text-[#1d1d1f]">{row.count}</div>
                  <div className="text-xs text-gray-400">{pct}%</div>
                </div>
              </div>
            );
          })}
          {rows.length === 0 && (
            <div className="px-5 py-6 text-sm text-gray-400 text-center">Нет данных</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function TopAirportsTable({
  airports,
  label,
}: {
  airports: TopAirport[];
  label: string;
}) {
  const max = airports[0]?.count || 1;
  return (
    <Card className="border-none shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-gray-700">{label}</CardTitle>
      </CardHeader>
      <CardContent className="p-0 pb-3">
        <div className="divide-y divide-gray-50">
          {airports.slice(0, 8).map((a, i) => (
            <div key={a.icao} className="px-5 py-2.5 flex items-center gap-3">
              <span className="text-xs font-bold text-gray-400 w-5 text-right shrink-0">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  {a.countryIso2 && (
                    <img
                      src={`https://flagcdn.com/16x12/${a.countryIso2}.png`}
                      srcSet={`https://flagcdn.com/32x24/${a.countryIso2}.png 2x`}
                      width={16}
                      height={12}
                      alt={a.countryIso2}
                      className="shrink-0 rounded-[2px]"
                    />
                  )}
                  <span className="text-sm font-mono font-bold text-[#1d1d1f]">{a.icao}</span>
                  {a.name && (
                    <span className="text-xs text-gray-400 truncate">{a.name}</span>
                  )}
                </div>
                <div className="h-1 rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.round((a.count / max) * 100)}%`, backgroundColor: RED }}
                  />
                </div>
              </div>
              <div className="text-sm font-semibold text-[#1d1d1f] shrink-0">{a.count}</div>
            </div>
          ))}
          {airports.length === 0 && (
            <div className="px-5 py-6 text-sm text-gray-400 text-center">Нет данных</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function DonutCard({
  label,
  sub,
  data,
  colors,
}: {
  label: string;
  sub?: string;
  data: { name: string; value: number }[];
  colors: string[];
}) {
  const hasData = data.some((d) => d.value > 0);
  return (
    <Card className="border-none shadow-sm">
      <CardHeader className="pb-1">
        <CardTitle className="text-sm font-semibold text-gray-700">{label}</CardTitle>
        {sub && <p className="text-xs text-gray-400">{sub}</p>}
      </CardHeader>
      <CardContent className="pb-4">
        {hasData ? (
          <>
            <div className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={data.filter((d) => d.value > 0)}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={64}
                    innerRadius={36}
                  >
                    {data
                      .filter((d) => d.value > 0)
                      .map((_, i) => (
                        <Cell key={i} fill={colors[i % colors.length]} />
                      ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number, name: string) => [v, name]}
                    contentStyle={{ fontSize: 11, borderRadius: 8, border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 space-y-2">
              {data
                .filter((d) => d.value > 0)
                .map((item, index) => (
                  <div key={item.name} className="flex items-center justify-between gap-3 text-xs">
                    <div className="flex min-w-0 items-center gap-2 text-gray-600">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} />
                      <span className="truncate">{item.name}</span>
                    </div>
                    <span className="shrink-0 font-semibold text-gray-900">{item.value}</span>
                  </div>
                ))}
            </div>
          </>
        ) : (
          <div className="h-[200px] flex items-center justify-center text-sm text-gray-400">Нет данных</div>
        )}
      </CardContent>
    </Card>
  );
}

export function PilotStats() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [monthlyMode, setMonthlyMode] = useState<"flights" | "hours">("flights");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    fetch("/api/pilot/analytics", { credentials: "include" })
      .then((r) => r.json())
      .then((payload) => {
        if (!active) return;
        if (payload?.ok) {
          setData(payload as AnalyticsData);
        } else {
          setError(payload?.error || payload?.message || "Не удалось загрузить статистику");
        }
      })
      .catch(() => {
        if (active) setError("Ошибка загрузки данных");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-[#E31E24]" size={32} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        {error || "Нет данных"}
      </div>
    );
  }

  const {
    summary, monthly, byAircraft, byNetwork, byRouteType, byTimeOfDay,
    byCallsignPrefix, topDepartures, topArrivals, vsDistribution,
    eventFlights, landingsByDayNight,
  } = data;

  const vsLabel =
    summary.avgVs == null
      ? "—"
      : `${summary.avgVs > 0 ? "+" : ""}${summary.avgVs} fpm`;

  const vsColor =
    summary.avgVs == null
      ? "text-gray-400"
      : summary.avgVs >= -150
      ? "text-emerald-600"
      : summary.avgVs >= -300
      ? "text-amber-600"
      : "text-red-600";

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <h1 className="text-2xl font-bold text-[#1d1d1f]">Статистика пилота</h1>

      {/* Summary cards */}
      <Section title="Сводка">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={Plane} label="Рейсов выполнено" value={summary.totalFlights} />
          <StatCard
            icon={Route}
            label="Налёт (морские мили)"
            value={summary.totalDistance > 0 ? summary.totalDistance.toLocaleString("ru-RU") : "—"}
          />
          <StatCard
            icon={Clock}
            label="Налёт в часах"
            value={summary.totalHours > 0 ? `${summary.totalHours} ч` : "—"}
          />
          <Card className="border-none shadow-sm bg-white/70 backdrop-blur-sm">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-[#E31E24]/10 flex items-center justify-center shrink-0">
                <TrendingUp size={20} className="text-[#E31E24]" />
              </div>
              <div className="min-w-0">
                <div className="text-xs text-gray-500 font-medium">Средний VS</div>
                <div className={`text-2xl font-bold leading-tight ${vsColor}`}>{vsLabel}</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </Section>

      {/* Monthly trend */}
      {monthly.length > 0 && (
        <Section title="Динамика по месяцам">
          <Card className="border-none shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-semibold text-gray-700">По месяцам</CardTitle>
              <div className="flex gap-1">
                {(["flights", "hours"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setMonthlyMode(mode)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      monthlyMode === mode
                        ? "bg-[#E31E24] text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {mode === "flights" ? "Рейсы" : "Часы"}
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={monthly} margin={{ top: 4, right: 8, bottom: 4, left: -20 }}>
                  <XAxis
                    dataKey="month"
                    tickFormatter={formatMonth}
                    tick={{ fontSize: 10, fill: "#9ca3af" }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(v: number) =>
                      monthlyMode === "flights" ? [`${v} рейсов`] : [`${v} ч`]
                    }
                    labelFormatter={formatMonth}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }}
                  />
                  <Bar dataKey={monthlyMode} radius={[4, 4, 0, 0]} maxBarSize={28}>
                    {monthly.map((_, i) => (
                      <Cell key={i} fill={i === monthly.length - 1 ? RED : "#e5e7eb"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Section>
      )}

      {/* Breakdowns */}
      <Section title="Разбивка">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <BreakdownTable rows={byAircraft} label="По воздушному судну" />
          <BreakdownTable rows={byNetwork} label="По сети" />
          <BreakdownTable rows={byRouteType} label="По типу рейса" />
          <BreakdownTable rows={byTimeOfDay} label="По времени суток" />
        </div>
      </Section>

      {/* Top airports */}
      <Section title="Топ аэропортов">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <TopAirportsTable airports={topDepartures} label="Топ аэропортов отправления" />
          <TopAirportsTable airports={topArrivals} label="Топ аэропортов прибытия" />
        </div>
      </Section>

      {/* Donut charts row */}
      <Section title="Графики">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <DonutCard
            label="Типы ВС"
            sub="Распределение по самолётам"
            data={(byAircraft ?? []).slice(0, 6).map((r) => ({ name: r.key, value: r.count }))}
            colors={COLORS}
          />
          <DonutCard
            label="Event Flights"
            sub="Рейсы с бонус-очками"
            data={[
              { name: "Обычный", value: eventFlights?.nonEvent ?? 0 },
              { name: "Event", value: eventFlights?.event ?? 0 },
            ]}
            colors={["#3b82f6", "#E31E24"]}
          />
          <DonutCard
            label="Посадки"
            sub="День / ночь"
            data={[
              { name: "День", value: landingsByDayNight?.day ?? 0 },
              { name: "Ночь", value: landingsByDayNight?.night ?? 0 },
            ]}
            colors={["#f59e0b", "#3b82f6"]}
          />
          <DonutCard
            label="Callsign"
            sub="Префиксы позывных"
            data={(byCallsignPrefix ?? []).slice(0, 6).map((r) => ({ name: r.key, value: r.count }))}
            colors={COLORS}
          />
          {vsDistribution.some((c) => c.count > 0) && (
            <DonutCard
              label="Вертикальная скорость"
              sub="Распределение VS"
              data={vsDistribution.filter((c) => c.count > 0).map((c) => ({ name: c.label, value: c.count }))}
              colors={COLORS}
            />
          )}
        </div>
      </Section>
    </div>
  );
}
