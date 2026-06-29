import { useEffect, useState } from "react";
import {
  Loader2, Plane, Clock, Route, TrendingUp, MapPin, Star,
  Moon, Sun, Zap, Radio, ArrowRight,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie,
} from "recharts";
import { useLanguage } from "../../context/language-context";
import { icaoToCountry, getFlagUri } from "./flag-data";

/* ── types ──────────────────────────────────────────────────────────── */
interface MonthlyPoint  { month: string; flights: number; hours: number }
interface BreakdownRow  { key: string; count: number; hours: number; registrations?: string[] }
interface TopAirport    { icao: string; name: string | null; countryIso2: string | null; count: number }
interface VsCategory    { label: string; count: number }
interface AnalyticsData {
  summary: { totalFlights: number; totalHours: number; totalDistance: number; totalPoints: number; avgVs: number | null };
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
  favorites?: {
    aircraft: { type: string; registration: string | null; count: number } | null;
    route: { route: string; count: number } | null;
    type: { type: string; count: number } | null;
  };
}

/* ── helpers ─────────────────────────────────────────────────────────── */
const PIE_COLORS = ["#e31e24","#3b82f6","#10b981","#f59e0b","#8b5cf6","#ec4899","#06b6d4","#84cc16"];

function fmtMonth(key: string) {
  const [y, m] = key.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("ru-RU", { month: "short", year: "2-digit" });
}

function IcaoFlag({ icao }: { icao?: string | null }) {
  const code = icaoToCountry(String(icao || "").trim()) || String(icao || "").slice(0, 2).toLowerCase();
  const uri = getFlagUri(code);
  if (!uri) return null;
  return <img src={uri} alt={code} className="h-3.5 w-5 shrink-0 rounded-[2px] border border-black/10 object-cover" />;
}

/* ── hero metric card ────────────────────────────────────────────────── */
function HeroCard({
  icon: Icon, label, value, sub, gradient, iconBg,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  sub?: string;
  gradient: string;
  iconBg: string;
}) {
  return (
    <div className={`relative overflow-hidden rounded-3xl p-5 text-white shadow-lg ${gradient}`}>
      <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-white/10 blur-xl" />
      <div className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-2xl ${iconBg}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="text-[11px] font-semibold uppercase tracking-widest text-white/70">{label}</div>
      <div className="mt-1 text-3xl font-black leading-none">{value}</div>
      {sub ? <div className="mt-1.5 text-xs text-white/60">{sub}</div> : null}
    </div>
  );
}

/* ── horizontal bar row ──────────────────────────────────────────────── */
function HBar({ label, count, max, color = "#e31e24", rank, tooltip }: {
  label: string; count: number; max: number; color?: string; rank?: number; tooltip?: string;
}) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className="relative flex items-center gap-3 py-2"
      onMouseEnter={() => tooltip ? setHovered(true) : undefined}
      onMouseLeave={() => setHovered(false)}
    >
      {rank != null && (
        <span className="w-5 shrink-0 text-right text-[11px] font-bold text-zinc-400">{rank}</span>
      )}
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">{label}</span>
          <span className="shrink-0 text-xs font-semibold text-zinc-500">{count}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-white/10">
          <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
        </div>
      </div>
      {hovered && tooltip && (
        <div className="pointer-events-none absolute left-0 -top-8 z-50 rounded-lg bg-zinc-800 px-2.5 py-1.5 text-[11px] font-mono text-white shadow-lg whitespace-nowrap">
          {tooltip}
        </div>
      )}
    </div>
  );
}

/* ── section card ────────────────────────────────────────────────────── */
function Panel({ title, children, className = "" }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-3xl border border-zinc-100 bg-white p-5 shadow-sm dark:border-white/5 dark:bg-zinc-900 ${className}`}>
      {title && <div className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-400">{title}</div>}
      {children}
    </div>
  );
}

/* ── donut ───────────────────────────────────────────────────────────── */
function Donut({ data, colors, size = 140 }: {
  data: { name: string; value: number }[];
  colors: string[];
  size?: number;
}) {
  const filtered = data.filter((d) => d.value > 0);
  if (!filtered.length) return <div className="flex h-32 items-center justify-center text-xs text-zinc-400">Нет данных</div>;
  return (
    <div className="flex items-center gap-4">
      <ResponsiveContainer width={size} height={size}>
        <PieChart>
          <Pie data={filtered} dataKey="value" cx="50%" cy="50%" outerRadius={size / 2 - 4} innerRadius={size / 2 - 22} strokeWidth={0}>
            {filtered.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
          </Pie>
          <Tooltip
            formatter={(v: number, name: string) => [v, name]}
            contentStyle={{ fontSize: 11, borderRadius: 10, border: "none", boxShadow: "0 4px 20px rgba(0,0,0,.12)" }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="min-w-0 flex-1 space-y-1.5">
        {filtered.map((item, i) => (
          <div key={item.name} className="flex items-center justify-between gap-2 text-xs">
            <div className="flex min-w-0 items-center gap-1.5 text-zinc-600 dark:text-zinc-300">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: colors[i % colors.length] }} />
              <span className="truncate">{item.name}</span>
            </div>
            <span className="shrink-0 font-semibold text-zinc-800 dark:text-zinc-100">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── main component ──────────────────────────────────────────────────── */
export function PilotStats() {
  const { language } = useLanguage();
  const ru = language === "ru";
  const tr = (r: string, e: string) => (ru ? r : e);

  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartMode, setChartMode] = useState<"flights" | "hours">("flights");

  useEffect(() => {
    let active = true;
    fetch("/api/pilot/analytics", { credentials: "include" })
      .then((r) => r.json())
      .then((p) => { if (active) { if (p?.ok) setData(p); else setError(p?.error || "Ошибка"); } })
      .catch(() => { if (active) setError("Ошибка загрузки"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-[#E31E24]" />
    </div>
  );
  if (error || !data) return (
    <div className="flex h-64 items-center justify-center text-sm text-zinc-400">{error || tr("Нет данных", "No data")}</div>
  );

  const { summary, monthly, byAircraft, byNetwork, byRouteType, byTimeOfDay,
    byCallsignPrefix, topDepartures, topArrivals, vsDistribution,
    eventFlights, landingsByDayNight, favorites } = data;

  const vsLabel = summary.avgVs == null ? "—" : `${summary.avgVs > 0 ? "+" : ""}${summary.avgVs} fpm`;
  const vsGradient = summary.avgVs == null
    ? "bg-gradient-to-br from-zinc-500 to-zinc-600"
    : summary.avgVs >= -150
    ? "bg-gradient-to-br from-emerald-500 to-teal-600"
    : summary.avgVs >= -300
    ? "bg-gradient-to-br from-amber-500 to-orange-500"
    : "bg-gradient-to-br from-red-500 to-rose-600";

  // merged top airports
  const cityMap = new Map<string, TopAirport & { total: number }>();
  [...topDepartures, ...topArrivals].forEach((a) => {
    const ex = cityMap.get(a.icao);
    if (ex) ex.total += a.count;
    else cityMap.set(a.icao, { ...a, total: a.count });
  });
  const topCities = Array.from(cityMap.values()).sort((a, b) => b.total - a.total).slice(0, 8);
  const maxCity = topCities[0]?.total || 1;

  const maxAircraft = byAircraft[0]?.count || 1;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{tr("Статистика пилота", "Pilot Statistics")}</h1>
        <p className="mt-0.5 text-sm text-zinc-400">{tr("Сводка по выполненным рейсам", "Summary of completed flights")}</p>
      </div>

      {/* ── Hero metrics ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <HeroCard
          icon={Plane}
          label={tr("Рейсов", "Flights")}
          value={summary.totalFlights.toLocaleString(ru ? "ru-RU" : "en-US")}
          gradient="bg-gradient-to-br from-[#E31E24] to-rose-700"
          iconBg="bg-white/20"
        />
        <HeroCard
          icon={Clock}
          label={tr("Налёт", "Flight hours")}
          value={summary.totalHours > 0 ? `${summary.totalHours} ч` : "—"}
          sub={summary.totalHours > 0 ? tr(`≈ ${Math.round(summary.totalHours / 24)} дней`, `≈ ${Math.round(summary.totalHours / 24)} days`) : undefined}
          gradient="bg-gradient-to-br from-violet-600 to-purple-700"
          iconBg="bg-white/20"
        />
        <HeroCard
          icon={Route}
          label={tr("Пройдено (nm)", "Distance (nm)")}
          value={summary.totalDistance > 0 ? summary.totalDistance.toLocaleString(ru ? "ru-RU" : "en-US") : "—"}
          gradient="bg-gradient-to-br from-sky-500 to-blue-700"
          iconBg="bg-white/20"
        />
        <HeroCard
          icon={TrendingUp}
          label={tr("Средний VS", "Avg VS")}
          value={vsLabel}
          gradient={vsGradient}
          iconBg="bg-white/20"
        />
      </div>

      {/* ── Favourites strip ── */}
      {(() => {
        const favAc = favorites?.aircraft ?? null;
        const favRt = favorites?.route ?? null;
        // route format from server: "UWKD - URKK"
        const routeParts = favRt?.route ? favRt.route.split(/\s*-\s*/) : [];
        const depIcao = routeParts[0] ?? null;
        const arrIcao = routeParts[1] ?? null;
        return (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Любимый самолёт */}
            <div className="relative overflow-hidden rounded-3xl border border-zinc-100 bg-white p-5 shadow-sm dark:border-white/5 dark:bg-zinc-900">
              <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-zinc-400">
                <Star className="h-3.5 w-3.5 text-amber-400" />
                {tr("Любимый самолёт", "Favourite aircraft")}
              </div>
              {favAc ? (
                <div className="mt-2 flex items-end justify-between gap-3">
                  <div>
                    <div className="text-2xl font-black text-zinc-900 dark:text-zinc-100">{favAc.type}</div>
                    {favAc.registration && (
                      <div className="mt-0.5 font-mono text-sm text-zinc-400">{favAc.registration}</div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-black text-[#E31E24]">{favAc.count}</div>
                    <div className="text-xs text-zinc-400">{tr("рейсов", "flights")}</div>
                  </div>
                </div>
              ) : (
                <div className="mt-3 text-sm text-zinc-400">{tr("Нет данных", "No data yet")}</div>
              )}
              <div className="pointer-events-none absolute -right-6 -bottom-6 opacity-[0.06]">
                <Plane className="h-28 w-28 text-zinc-900 dark:text-zinc-100" />
              </div>
            </div>

            {/* Любимый маршрут */}
            <div className="relative overflow-hidden rounded-3xl border border-zinc-100 bg-white p-5 shadow-sm dark:border-white/5 dark:bg-zinc-900">
              <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-zinc-400">
                <Star className="h-3.5 w-3.5 text-amber-400" />
                {tr("Любимый маршрут", "Favourite route")}
              </div>
              {favRt && depIcao && arrIcao ? (
                <div className="mt-2 flex items-end justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <IcaoFlag icao={depIcao} />
                      <span className="font-mono text-xl font-black text-zinc-900 dark:text-zinc-100">{depIcao}</span>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-zinc-300" />
                    <div className="flex items-center gap-1.5">
                      <IcaoFlag icao={arrIcao} />
                      <span className="font-mono text-xl font-black text-zinc-900 dark:text-zinc-100">{arrIcao}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-black text-[#E31E24]">{favRt.count}</div>
                    <div className="text-xs text-zinc-400">{tr("рейсов", "flights")}</div>
                  </div>
                </div>
              ) : (
                <div className="mt-3 text-sm text-zinc-400">{tr("Нет данных", "No data yet")}</div>
              )}
              <div className="pointer-events-none absolute -right-6 -bottom-6 opacity-[0.06]">
                <Route className="h-28 w-28 text-zinc-900 dark:text-zinc-100" />
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Monthly trend ── */}
      {monthly.length > 0 && (
        <Panel>
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{tr("Динамика по месяцам", "Monthly trend")}</div>
            <div className="flex gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-white/5">
              {(["flights", "hours"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setChartMode(m)}
                  className={`rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
                    chartMode === m
                      ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100"
                      : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                  }`}
                >
                  {m === "flights" ? tr("Рейсы", "Flights") : tr("Часы", "Hours")}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={monthly} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
              <defs>
                <linearGradient id="statsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#E31E24" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#E31E24" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="month" tickFormatter={fmtMonth} tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(v: number) => [chartMode === "flights" ? `${v} ${tr("рейсов", "flights")}` : `${v} ч`, ""]}
                labelFormatter={fmtMonth}
                contentStyle={{ fontSize: 11, borderRadius: 10, border: "none", boxShadow: "0 4px 20px rgba(0,0,0,.12)" }}
              />
              <Area dataKey={chartMode} stroke="#E31E24" strokeWidth={2} fill="url(#statsGrad)" dot={false} activeDot={{ r: 4, fill: "#E31E24" }} />
            </AreaChart>
          </ResponsiveContainer>
        </Panel>
      )}

      {/* ── Airports + Favorites ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Top airports */}
        <Panel title={tr("Топ аэропортов", "Top airports")}>
          <div className="space-y-0.5">
            {topCities.map((a, i) => (
              <div key={a.icao} className="flex items-center gap-3 py-2">
                <span className="w-5 shrink-0 text-right text-[11px] font-bold text-zinc-300">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <IcaoFlag icao={a.icao} />
                    <span className="font-mono text-sm font-bold text-zinc-800 dark:text-zinc-100">{a.icao}</span>
                    {a.name && <span className="truncate text-xs text-zinc-400">{a.name}</span>}
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-white/10">
                    <div className="h-full rounded-full bg-[#E31E24] transition-[width] duration-500" style={{ width: `${Math.round((a.total / maxCity) * 100)}%` }} />
                  </div>
                </div>
                <span className="shrink-0 text-sm font-semibold text-zinc-600 dark:text-zinc-300">{a.total}</span>
              </div>
            ))}
            {topCities.length === 0 && <div className="py-6 text-center text-sm text-zinc-400">{tr("Нет данных", "No data")}</div>}
          </div>
        </Panel>

        {/* Favorites + quick stats */}
        <div className="space-y-4">
          {favorites && (
            <Panel title={tr("Предпочтения", "Favorites")}>
              <div className="space-y-3">
                {[
                  favorites.aircraft && {
                    icon: Plane, label: tr("Любимый борт", "Favourite aircraft"),
                    value: `${favorites.aircraft.type}${favorites.aircraft.registration ? ` · ${favorites.aircraft.registration}` : ""}`,
                    count: favorites.aircraft.count,
                  },
                  favorites.route && {
                    icon: Route, label: tr("Любимый маршрут", "Favourite route"),
                    value: favorites.route.route,
                    count: favorites.route.count,
                  },
                  favorites.type && {
                    icon: Star, label: tr("Тип ВС", "Aircraft type"),
                    value: favorites.type.type,
                    count: favorites.type.count,
                  },
                ].filter(Boolean).map((item) => {
                  if (!item) return null;
                  const { icon: Icon, label, value, count } = item;
                  return (
                    <div key={label} className="flex items-center gap-3 rounded-2xl bg-zinc-50 p-3 dark:bg-white/5">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#E31E24]/10 text-[#E31E24]">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] text-zinc-400">{label}</div>
                        <div className="truncate text-sm font-semibold text-zinc-800 dark:text-zinc-100">{value}</div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-lg font-black text-zinc-800 dark:text-zinc-100">{count}</div>
                        <div className="text-[10px] text-zinc-400">{tr("рейсов", "flights")}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>
          )}

          {/* Day/Night + Events */}
          <div className="grid grid-cols-2 gap-4">
            <Panel>
              <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">{tr("Посадки", "Landings")}</div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Sun className="h-4 w-4 shrink-0 text-amber-400" />
                  <div className="min-w-0 flex-1">
                    <div className="mb-0.5 flex justify-between text-xs">
                      <span className="text-zinc-500">{tr("День", "Day")}</span>
                      <span className="font-bold text-zinc-800 dark:text-zinc-100">{landingsByDayNight.day}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-white/10">
                      <div className="h-full rounded-full bg-amber-400" style={{ width: `${Math.round((landingsByDayNight.day / Math.max(landingsByDayNight.day + landingsByDayNight.night, 1)) * 100)}%` }} />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Moon className="h-4 w-4 shrink-0 text-blue-400" />
                  <div className="min-w-0 flex-1">
                    <div className="mb-0.5 flex justify-between text-xs">
                      <span className="text-zinc-500">{tr("Ночь", "Night")}</span>
                      <span className="font-bold text-zinc-800 dark:text-zinc-100">{landingsByDayNight.night}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-white/10">
                      <div className="h-full rounded-full bg-blue-400" style={{ width: `${Math.round((landingsByDayNight.night / Math.max(landingsByDayNight.day + landingsByDayNight.night, 1)) * 100)}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            </Panel>
            <Panel>
              <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">Event</div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 shrink-0 text-[#E31E24]" />
                  <div className="min-w-0 flex-1">
                    <div className="mb-0.5 flex justify-between text-xs">
                      <span className="text-zinc-500">Event</span>
                      <span className="font-bold text-zinc-800 dark:text-zinc-100">{eventFlights.event}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-white/10">
                      <div className="h-full rounded-full bg-[#E31E24]" style={{ width: `${Math.round((eventFlights.event / Math.max(eventFlights.event + eventFlights.nonEvent, 1)) * 100)}%` }} />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Plane className="h-4 w-4 shrink-0 text-zinc-300" />
                  <div className="min-w-0 flex-1">
                    <div className="mb-0.5 flex justify-between text-xs">
                      <span className="text-zinc-500">{tr("Обычный", "Regular")}</span>
                      <span className="font-bold text-zinc-800 dark:text-zinc-100">{eventFlights.nonEvent}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-white/10">
                      <div className="h-full rounded-full bg-zinc-300" style={{ width: `${Math.round((eventFlights.nonEvent / Math.max(eventFlights.event + eventFlights.nonEvent, 1)) * 100)}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            </Panel>
          </div>
        </div>
      </div>

      {/* ── Breakdowns grid ── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { title: tr("Воздушные суда", "Aircraft"), rows: byAircraft, color: "#E31E24", showRegs: true },
          { title: tr("Сеть", "Network"), rows: byNetwork, color: "#3b82f6", showRegs: false },
          { title: tr("Тип рейса", "Route type"), rows: byRouteType, color: "#10b981", showRegs: false },
          { title: tr("Время суток", "Time of day"), rows: byTimeOfDay, color: "#f59e0b", showRegs: false },
        ].map(({ title, rows, color, showRegs }) => {
          const max = rows[0]?.count || 1;
          return (
            <Panel key={title} title={title}>
              <div className="divide-y divide-zinc-50 dark:divide-white/5">
                {rows.slice(0, 7).map((r) => (
                  <HBar
                    key={r.key} label={r.key} count={r.count} max={max} color={color}
                    tooltip={showRegs && r.registrations?.length ? r.registrations.slice(0, 6).join(" · ") : undefined}
                  />
                ))}
                {rows.length === 0 && <div className="py-4 text-center text-xs text-zinc-400">{tr("Нет данных", "No data")}</div>}
              </div>
            </Panel>
          );
        })}
      </div>

      {/* ── Donuts row ── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Panel title={tr("Типы ВС", "Aircraft types")}>
          <Donut
            data={byAircraft.slice(0, 6).map((r) => ({ name: r.key, value: r.count }))}
            colors={PIE_COLORS}
          />
        </Panel>

        <Panel title={tr("Позывные", "Callsigns")}>
          <Donut
            data={byCallsignPrefix.slice(0, 6).map((r) => ({ name: r.key, value: r.count }))}
            colors={PIE_COLORS}
          />
        </Panel>

        {vsDistribution.some((c) => c.count > 0) && (
          <Panel title={tr("Вертикальная скорость", "Vertical speed")}>
            <Donut
              data={vsDistribution.filter((c) => c.count > 0).map((c) => ({ name: c.label, value: c.count }))}
              colors={["#10b981","#f59e0b","#E31E24","#8b5cf6","#06b6d4"]}
            />
          </Panel>
        )}
      </div>
    </div>
  );
}
