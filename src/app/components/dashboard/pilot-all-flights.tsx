import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  Filter,
  Loader2,
  Plane,
  RefreshCcw,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "../../context/language-context";
import { useNotifications } from "../../context/notifications-context";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { FlightMap, type Airport, type SelectableRoute, type HubData } from "./flight-map";
import { getFlagUri, getIcaoFlagUri, icaoToCountry } from "./flag-data";
import { fetchDashboardBootstrap, getCachedDashboardBootstrap } from "./dashboard-bootstrap-cache";

// ── Types ─────────────────────────────────────────────────────────────────────

interface RouteOption {
  id: number;
  type?: string;
  flightNumber?: string;
  callsign?: string;
  routeText?: string;
  airlineCode?: string;
  fromCode?: string;
  fromName?: string;
  fromLat?: number | null;
  fromLon?: number | null;
  toCode?: string;
  toName?: string;
  toLat?: number | null;
  toLon?: number | null;
  distance?: string;
  duration?: string;
  frequency?: string;
  fleetIds?: number[];
}

interface AircraftOption {
  id: number;
  fleetId: number;
  model: string;
  registration: string;
  fleetName: string;
}

interface FleetResponse {
  fleets?: Array<{ id: number; name: string; code: string; aircraft: Array<{ id: number; model: string; registration: string }> }>;
}

interface PilotAllFlightsProps { onOpenBookings: () => void; }

// ── Helpers ───────────────────────────────────────────────────────────────────

const getRouteLabel = (r: RouteOption) =>
  `${r.flightNumber || r.callsign || `Route ${r.id}`} · ${r.fromCode || "—"} → ${r.toCode || "—"}`;

const icaoFlag = (icao?: string | null) => icaoToCountry(icao);
const icaoCity = (name?: string | null, icao?: string | null) => {
  const raw = String(name || "").trim();
  if (!raw) return String(icao || "").trim().toUpperCase();
  return raw.replace(/\s*\([A-Z]{4}\)\s*/g, " ").replace(/\binternational\s+airport\b/gi, "").replace(/\bairport\b/gi, "").replace(/\s{2,}/g, " ").trim() || String(icao || "").trim().toUpperCase();
};
const fmtDuration = (v?: string | null) => {
  const raw = String(v || "").trim();
  const m = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (m) return `${String(Number(m[1])).padStart(2,"0")}:${m[2]}`;
  return raw || "—";
};
const fmtDistNm = (v?: string | number | null) => {
  if (typeof v === "number" && Number.isFinite(v)) return `${Math.round(v)} nm`;
  const raw = String(v || "").trim();
  if (!raw || raw === "-") return "";
  const n = raw.toLowerCase();
  const match = n.match(/(\d+(?:[.,]\d+)?)/);
  if (!match) return raw;
  let d = Number(match[1].replace(",", "."));
  if (n.includes("km")) d /= 1.852;
  else if (n.includes(" mi") || n.endsWith("mi")) d *= 0.869;
  return `${Math.round(d)} nm`;
};
const toAcType = (model: unknown) => {
  const v = String(model || "").toUpperCase().trim();
  if (!v) return "";
  if (/737\s*MAX\s*8|B38M/.test(v)) return "B38M";
  if (/737\s*-?\s*900\s*ER|B739/.test(v)) return "B739";
  if (/737\s*-?\s*800|B738/.test(v)) return "B738";
  if (/777\s*-?\s*300\s*ER|B77W/.test(v)) return "B77W";
  if (/A321\s*NEO|A21N/.test(v)) return "A21N";
  if (/A321/.test(v)) return "A321";
  if (/A330\s*-?\s*200|A332/.test(v)) return "A332";
  if (/A330\s*-?\s*300|A333/.test(v)) return "A333";
  if (/ERJ\s*-?\s*190|E190/.test(v)) return "E190";
  return v.replace(/[^A-Z0-9]/g, "").slice(0, 4);
};

// ── Days-of-week parser ────────────────────────────────────────────────────────

const DAY_SHORT_RU = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function parseDays(freq?: string | null): number[] {
  if (!freq) return [];
  const s = freq.trim();
  if (/daily|ежедневно|каждый день/i.test(s)) return [0, 1, 2, 3, 4, 5, 6];
  if (/^[1-7]+$/.test(s)) return [...new Set(s.split("").map((c) => Number(c) - 1))].sort((a, b) => a - b);
  const rangeM = s.match(/^(\d)-(\d)$/);
  if (rangeM) {
    const r: number[] = [];
    for (let i = Number(rangeM[1]); i <= Number(rangeM[2]); i++) r.push(i - 1);
    return r;
  }
  const enMap: Record<string, number> = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 };
  const ruMap: Record<string, number> = { пн: 0, вт: 1, ср: 2, чт: 3, пт: 4, сб: 5, вс: 6 };
  const tokens = s.toLowerCase().split(/[\s,;/]+/).filter(Boolean);
  const days: number[] = [];
  for (const t of tokens) {
    const en = enMap[t.slice(0, 3)];
    const ru = ruMap[t.slice(0, 2)];
    if (en !== undefined) days.push(en);
    else if (ru !== undefined) days.push(ru);
  }
  return [...new Set(days)].sort((a, b) => a - b);
}

function DaysPill({ freq, dark = false }: { freq?: string | null; dark?: boolean }) {
  const days = parseDays(freq);
  if (days.length === 7) return (
    <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-md ${
      dark ? "text-emerald-400 bg-emerald-900/35 border border-emerald-800/40" : "text-emerald-600 bg-emerald-50"
    }`}>Ежедн.</span>
  );
  if (days.length === 0) return <span className={`text-xs ${dark ? "text-slate-600" : "text-gray-300"}`}>—</span>;
  return (
    <div className="flex gap-0.5">
      {DAY_SHORT_RU.map((d, i) => (
        <span
          key={i}
          className={`text-[10px] font-semibold px-0.5 rounded ${
            days.includes(i)
              ? (dark ? "text-slate-200" : "text-gray-900")
              : (dark ? "text-slate-700" : "text-gray-200")
          }`}
        >
          {d}
        </span>
      ))}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PilotAllFlights({ onOpenBookings }: PilotAllFlightsProps) {
  const { t } = useLanguage();
  const { addNotification } = useNotifications();

  const [routeOptions, setRouteOptions] = useState<RouteOption[]>([]);
  const [aircraftOptions, setAircraftOptions] = useState<AircraftOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filter state
  const [search, setSearch] = useState("");
  const [filterHub, setFilterHub] = useState("all");
  const [filterDest, setFilterDest] = useState("all");
  const [filterAirline, setFilterAirline] = useState("all");
  const [filterAcTypes, setFilterAcTypes] = useState<string[]>([]);

  // Selection state
  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null);
  const [hoveredRouteId, setHoveredRouteId] = useState<number | null>(null);

  // UI state
  const [filterOpen, setFilterOpen] = useState(false);
  const [mapTheme, setMapTheme] = useState<"dark" | "light">("dark");
  const [reportingRouteId, setReportingRouteId] = useState<number | null>(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportRoute, setReportRoute] = useState<RouteOption | null>(null);
  const [reportReason, setReportReason] = useState("notOperated");
  const [reportComment, setReportComment] = useState("");

  const filterPanelRef = useRef<HTMLDivElement>(null);
  const selectedRowRef = useRef<HTMLDivElement>(null);

  // Close filter dropdown on outside click
  useEffect(() => {
    if (!filterOpen) return;
    const handler = (e: MouseEvent) => {
      if (filterPanelRef.current && !filterPanelRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [filterOpen]);

  // Scroll selected row into view
  useEffect(() => {
    if (selectedRowRef.current) {
      selectedRowRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [selectedRouteId]);

  // ── Data loading ──────────────────────────────────────────────────────────

  const loadData = async ({ silent = false } = {}) => {
    if (silent) setIsRefreshing(true); else setIsLoading(true);
    try {
      const bootstrap = await fetchDashboardBootstrap({ force: false });
      const routes = Array.isArray(bootstrap?.routes) ? (bootstrap.routes as RouteOption[]) : [];
      const fleetPayload = { fleets: Array.isArray(bootstrap?.fleets) ? bootstrap.fleets : [] } as FleetResponse;
      setRouteOptions(routes);
      setAircraftOptions(
        Array.isArray(fleetPayload.fleets)
          ? fleetPayload.fleets!.flatMap((fleet) =>
              (Array.isArray(fleet?.aircraft) ? fleet.aircraft : []).map((ac) => ({
                id: Number(ac?.id || 0),
                fleetId: Number(fleet?.id || 0),
                model: String(ac?.model || "Aircraft").trim(),
                registration: String(ac?.registration || "").trim(),
                fleetName: String(fleet?.name || fleet?.code || "Fleet").trim(),
              }))
            )
          : []
      );
    } catch {
      const cached = getCachedDashboardBootstrap();
      if (cached) {
        setRouteOptions(Array.isArray(cached?.routes) ? (cached.routes as RouteOption[]) : []);
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => { void loadData(); }, []);

  // ── Derived data ──────────────────────────────────────────────────────────

  const airlineOptions = useMemo(() =>
    Array.from(new Set(routeOptions.map((r) => String(r.airlineCode || "").trim()).filter(Boolean))).sort()
  , [routeOptions]);

  const hubOptions = useMemo(() =>
    Array.from(new Set(routeOptions.map((r) => String(r.fromCode || "").trim().toUpperCase()).filter(Boolean))).sort()
  , [routeOptions]);

  // Аэропорты прилёта, доступные при текущем хабе вылета
  const destOptions = useMemo(() => {
    const scope = filterHub === "all"
      ? routeOptions
      : routeOptions.filter((r) => String(r.fromCode || "").trim().toUpperCase() === filterHub);
    const map = new Map<string, string>();
    scope.forEach((r) => {
      const code = String(r.toCode || "").trim().toUpperCase();
      if (code && !map.has(code)) map.set(code, icaoCity(r.toName, r.toCode));
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [routeOptions, filterHub]);

  // Сбрасываем прилёт, если после смены хаба такого направления больше нет
  useEffect(() => {
    if (filterDest !== "all" && !destOptions.some(([code]) => code === filterDest)) {
      setFilterDest("all");
    }
  }, [destOptions, filterDest]);

  const acTypeOptions = useMemo(() => {
    const types = new Set<string>();
    routeOptions.forEach((r) => {
      const ids = Array.isArray(r.fleetIds) ? r.fleetIds : [];
      aircraftOptions
        .filter((ac) => ids.includes(ac.fleetId))
        .forEach((ac) => { const t = toAcType(ac.model); if (t) types.add(t); });
    });
    return Array.from(types).sort();
  }, [routeOptions, aircraftOptions]);

  const acTypeList = (r: RouteOption): string[] => {
    const ids = Array.isArray(r.fleetIds) ? r.fleetIds : [];
    if (!ids.length) return [];
    return Array.from(new Set(aircraftOptions.filter((ac) => ids.includes(ac.fleetId)).map((ac) => toAcType(ac.model)).filter(Boolean)));
  };

  const filteredRoutes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...routeOptions]
      .sort((a, b) => String(a.flightNumber || a.callsign || "").localeCompare(String(b.flightNumber || b.callsign || "")))
      .filter((r) => {
        if (filterAirline !== "all" && String(r.airlineCode || "").trim() !== filterAirline) return false;
        if (filterHub !== "all" && String(r.fromCode || "").trim().toUpperCase() !== filterHub) return false;
        if (filterDest !== "all" && String(r.toCode || "").trim().toUpperCase() !== filterDest) return false;
        if (filterAcTypes.length > 0) {
          const ids = Array.isArray(r.fleetIds) ? r.fleetIds : [];
          const types = aircraftOptions.filter((ac) => ids.includes(ac.fleetId)).map((ac) => toAcType(ac.model)).filter(Boolean);
          if (!types.some((t) => filterAcTypes.includes(t))) return false;
        }
        if (q) {
          const hay = [r.flightNumber, r.callsign, r.fromCode, r.fromName, r.toCode, r.toName, r.routeText].join(" ").toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });
  }, [routeOptions, search, filterAirline, filterHub, filterDest, filterAcTypes, aircraftOptions]);

  const selectedRoute = useMemo(() =>
    filteredRoutes.find((r) => r.id === selectedRouteId) || null
  , [filteredRoutes, selectedRouteId]);

  const hubsData = useMemo<HubData[]>(() => {
    const map = new Map<string, HubData>();
    filteredRoutes.forEach((r) => {
      const code = String(r.fromCode || "").trim().toUpperCase();
      const lat = Number(r.fromLat), lon = Number(r.fromLon);
      if (!code || !Number.isFinite(lat)) return;
      if (!map.has(code)) map.set(code, { code, name: r.fromName || code, lat, lon, routeCount: 0 });
      map.get(code)!.routeCount++;
    });
    return Array.from(map.values()).sort((a, b) => b.routeCount - a.routeCount);
  }, [filteredRoutes]);

  const mapRoutes = useMemo<SelectableRoute[]>(() =>
    filteredRoutes
      .filter((r) => Number.isFinite(Number(r.fromLat)) && Number.isFinite(Number(r.toLat)))
      .map((r) => ({
        id: String(r.id),
        from: { icao: r.fromCode?.toUpperCase(), name: r.fromName || r.fromCode || "", lat: Number(r.fromLat), lon: Number(r.fromLon) } as Airport,
        to: { icao: r.toCode?.toUpperCase(), name: r.toName || r.toCode || "", lat: Number(r.toLat), lon: Number(r.toLon) } as Airport,
        label: getRouteLabel(r),
        active: r.id === selectedRouteId || r.id === hoveredRouteId,
      }))
  , [filteredRoutes, selectedRouteId, hoveredRouteId]);

  // selectedMapRoute removed — map always shows all routes via availableRoutes

  const activeFilterCount = (filterHub !== "all" ? 1 : 0) + (filterDest !== "all" ? 1 : 0) + filterAcTypes.length + (filterAirline !== "all" ? 1 : 0);

  // ── Report handler ────────────────────────────────────────────────────────

  const handleReport = async (route: RouteOption) => {
    setReportingRouteId(route.id);
    try {
      const res = await fetch(`/api/pilot/routes/${route.id}/report-outdated`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: t(`bookings.reportReason.${reportReason}`),
          reasonKey: reportReason,
          comment: reportComment.trim() || undefined,
        }),
      });
      const payload = await res.json().catch(() => null) as { ok?: boolean; duplicate?: boolean; ticket?: { number?: number | string }; error?: string; code?: string; retryMinutes?: number } | null;
      if (!res.ok || !payload?.ok) {
        if (payload?.code === "report_blocked") throw new Error(t("bookings.toast.reportBlocked"));
        if (payload?.code === "report_cooldown") throw new Error(t("bookings.toast.reportCooldown").replace("{{minutes}}", String(payload?.retryMinutes || 1)));
        if (payload?.code === "report_daily_limit") throw new Error(t("bookings.toast.reportDailyLimit"));
        throw new Error(payload?.error || t("bookings.toast.reportInactiveError"));
      }
      if (payload.duplicate) {
        toast.success(t("bookings.toast.reportInactiveDuplicate").replace("{{ticket}}", String(payload?.ticket?.number || "#")));
      } else {
        toast.success(t("bookings.toast.reportInactiveSuccess").replace("{{ticket}}", String(payload?.ticket?.number || "#")));
        addNotification({ category: "system", title: t("bookings.notification.reportTitle"), description: `${getRouteLabel(route)} — #${payload?.ticket?.number || "?"}` });
      }
    } catch (err) {
      toast.error(String(err || t("bookings.toast.reportInactiveError")));
    } finally {
      setReportingRouteId(null);
      setReportModalOpen(false);
      setReportRoute(null);
      setReportReason("notOperated");
      setReportComment("");
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className="relative -mx-8 -mt-6 flex flex-col overflow-hidden rounded-2xl"
      style={{ height: "calc(100svh - 100px)", background: mapTheme === "dark" ? "#080e1a" : "#e8edf2" }}
    >

      {/* ══════════════ MAP AREA ══════════════ */}
      <div className="relative flex-1 overflow-hidden min-h-0">

        {isLoading ? (
          <div className={`flex h-full items-center justify-center ${mapTheme === "dark" ? "bg-[#080e1a]" : "bg-[#e8edf2]"}`}>
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-[#E31E24]" />
              <div className={`text-sm ${mapTheme === "dark" ? "text-slate-400" : "text-gray-500"}`}>{t("allFlights.loading")}</div>
            </div>
          </div>
        ) : (
          <FlightMap
            theme={mapTheme}
            route={null}
            availableRoutes={mapRoutes}
            hubs={hubsData}
            selectedHubCode={filterHub !== "all" ? filterHub : null}
            mode="hubs"
            focusRouteId={selectedRouteId ? String(selectedRouteId) : null}
            onHubSelect={(code) => {
              setFilterHub(filterHub === code ? "all" : code);
              if (filterHub === code) setFilterDest("all");
            }}
            onAirportSelect={(airportCode) => {
              // Клик по аэропорту прилёта при выбранном хабе = режим «два аэропорта»
              if (filterHub !== "all") setFilterDest(filterDest === airportCode ? "all" : airportCode);
              const r = filteredRoutes.find((x) =>
                (filterHub !== "all" ? (x.fromCode || "").toUpperCase() === filterHub : true) &&
                (x.toCode || "").toUpperCase() === airportCode
              );
              if (r) setSelectedRouteId(r.id);
            }}
          />
        )}

        {/* ── TOP LEFT: search ── */}
        <div className="absolute top-3 left-3 z-[1001]">
          <div className="relative">
            <Search className={`absolute left-3 top-2.5 h-3.5 w-3.5 ${mapTheme === "dark" ? "text-slate-400" : "text-gray-400"}`} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("allFlights.searchPlaceholder")}
              className={`w-56 rounded-xl py-2 pl-9 pr-7 text-sm outline-none backdrop-blur-sm border transition ${
                mapTheme === "dark"
                  ? "border-white/10 bg-[#0f172a]/90 text-slate-200 placeholder-slate-500 focus:border-[#E31E24]/50 focus:ring-1 focus:ring-[#E31E24]/20"
                  : "border-black/10 bg-white/90 text-gray-800 placeholder-gray-400 focus:border-[#E31E24]/40 focus:ring-1 focus:ring-[#E31E24]/15"
              }`}
            />
            {search && (
              <button type="button" onClick={() => setSearch("")} className={`absolute right-2.5 top-2.5 ${mapTheme === "dark" ? "text-slate-500 hover:text-slate-300" : "text-gray-400 hover:text-gray-600"}`}>
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* ── TOP RIGHT: stats + refresh + theme + filter ── */}
        <div className="absolute top-3 right-3 z-[1001] flex items-center gap-2" ref={filterPanelRef}>

          {/* Stats chip */}
          <div className={`flex items-center gap-1.5 rounded-full backdrop-blur-sm px-3.5 py-2 text-xs border ${
            mapTheme === "dark"
              ? "bg-[#0f172a]/90 border-white/10 text-slate-400"
              : "bg-white/90 border-black/10 text-gray-500"
          }`}>
            <span className={`font-bold ${mapTheme === "dark" ? "text-white" : "text-gray-900"}`}>{filteredRoutes.length}</span>
            {t("allFlights.kpi.routes").toLowerCase()} ·
            <span className={`font-bold ${mapTheme === "dark" ? "text-white" : "text-gray-900"}`}>{hubsData.length}</span>
            хабов
          </div>

          {/* Refresh */}
          <button
            type="button"
            onClick={() => void loadData({ silent: true })}
            disabled={isRefreshing}
            className={`flex h-9 w-9 items-center justify-center rounded-full backdrop-blur-sm border transition ${
              mapTheme === "dark"
                ? "bg-[#0f172a]/90 border-white/10 hover:bg-[#1e293b]"
                : "bg-white/90 border-black/10 hover:bg-white"
            }`}
          >
            <RefreshCcw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""} ${mapTheme === "dark" ? "text-slate-400" : "text-gray-500"}`} />
          </button>

          {/* Theme toggle */}
          <button
            type="button"
            onClick={() => setMapTheme((prev) => prev === "dark" ? "light" : "dark")}
            title={mapTheme === "dark" ? "Светлая тема" : "Тёмная тема"}
            className={`flex h-9 w-9 items-center justify-center rounded-full backdrop-blur-sm border transition ${
              mapTheme === "dark"
                ? "bg-[#0f172a]/90 border-white/10 hover:bg-[#1e293b]"
                : "bg-white/90 border-black/10 hover:bg-white"
            }`}
          >
            {mapTheme === "dark" ? (
              <svg className="h-4 w-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
            ) : (
              <svg className="h-4 w-4 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            )}
          </button>

          {/* Filter button */}
          <button
            type="button"
            onClick={() => setFilterOpen((v) => !v)}
            className={`flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium border transition backdrop-blur-sm ${
              filterOpen || activeFilterCount > 0
                ? "bg-[#E31E24] border-[#E31E24] text-white"
                : mapTheme === "dark"
                  ? "bg-[#0f172a]/90 border-white/10 text-slate-300 hover:bg-[#1e293b]"
                  : "bg-white/90 border-black/10 text-gray-600 hover:bg-white"
            }`}
          >
            <Filter className="h-3.5 w-3.5" />
            Фильтры
            {activeFilterCount > 0 && (
              <span className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-white/25 text-[10px] font-bold">
                {activeFilterCount}
              </span>
            )}
            <ChevronDown className={`h-3 w-3 transition-transform ${filterOpen ? "rotate-180" : ""}`} />
          </button>

          {/* Filter dropdown panel */}
          {filterOpen && (
            <div className="absolute top-12 right-0 w-80 rounded-2xl bg-[#0f172a] border border-white/10 shadow-2xl overflow-hidden">
              <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "#334155 transparent" }}>

                {/* Hubs */}
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Хаб вылета</div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setFilterHub("all")}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition ${filterHub === "all" ? "bg-[#E31E24] text-white" : "bg-white/8 text-slate-400 hover:bg-white/12"}`}
                    >
                      Все
                    </button>
                    {hubOptions.map((code) => (
                      <button
                        key={code}
                        type="button"
                        onClick={() => setFilterHub(filterHub === code ? "all" : code)}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition ${filterHub === code ? "bg-[#E31E24] text-white" : "bg-white/8 text-slate-400 hover:bg-white/12"}`}
                      >
                        {code}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Destination airport (направление: хаб → прилёт) */}
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Аэропорт прилёта</div>
                  <select
                    value={filterDest}
                    onChange={(e) => setFilterDest(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-[#1e293b] px-3 py-2 text-xs text-slate-200 outline-none focus:border-[#E31E24]/50"
                  >
                    <option value="all">Все направления</option>
                    {destOptions.map(([code, city]) => (
                      <option key={code} value={code}>{code}{city && city !== code ? ` — ${city}` : ""}</option>
                    ))}
                  </select>
                  {filterHub !== "all" && filterDest !== "all" && (
                    <div className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-[#E31E24]/10 border border-[#E31E24]/25 px-3 py-1.5">
                      <span className="text-xs font-bold text-white">{filterHub}</span>
                      <Plane className="h-3 w-3 text-[#E31E24]" />
                      <span className="text-xs font-bold text-white">{filterDest}</span>
                    </div>
                  )}
                </div>

                {/* Aircraft types */}
                {acTypeOptions.length > 0 && (
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Тип ВС</div>
                    <div className="flex flex-wrap gap-1.5">
                      {acTypeOptions.map((type) => {
                        const active = filterAcTypes.includes(type);
                        return (
                          <button
                            key={type}
                            type="button"
                            onClick={() => setFilterAcTypes(active ? filterAcTypes.filter((t) => t !== type) : [...filterAcTypes, type])}
                            className={`rounded-full px-3 py-1 text-xs font-mono font-medium transition ${active ? "bg-blue-600 text-white" : "bg-white/8 text-slate-400 hover:bg-white/12"}`}
                          >
                            {type}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Airline */}
                {airlineOptions.length > 1 && (
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Авиакомпания</div>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => setFilterAirline("all")}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition ${filterAirline === "all" ? "bg-[#E31E24] text-white" : "bg-white/8 text-slate-400 hover:bg-white/12"}`}
                      >
                        Все
                      </button>
                      {airlineOptions.map((code) => (
                        <button
                          key={code}
                          type="button"
                          onClick={() => setFilterAirline(filterAirline === code ? "all" : code)}
                          className={`rounded-full px-3 py-1 text-xs font-medium transition ${filterAirline === code ? "bg-[#E31E24] text-white" : "bg-white/8 text-slate-400 hover:bg-white/12"}`}
                        >
                          {code}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Clear + book */}
                <div className="flex items-center gap-2 pt-1 border-t border-white/8">
                  {activeFilterCount > 0 && (
                    <button
                      type="button"
                      onClick={() => { setFilterHub("all"); setFilterDest("all"); setFilterAirline("all"); setFilterAcTypes([]); }}
                      className="flex-1 rounded-xl py-2 text-xs font-medium text-slate-400 hover:text-white hover:bg-white/8 transition"
                    >
                      Сбросить фильтры
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => { setFilterOpen(false); onOpenBookings(); }}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-[#E31E24] py-2 text-xs font-semibold text-white hover:bg-[#c41a20] transition"
                  >
                    <Plane className="h-3 w-3" />
                    {t("allFlights.openBookings")}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── SELECTED ROUTE info strip ── */}
        {selectedRoute && (
          <div className={`absolute bottom-3 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-3 rounded-2xl backdrop-blur-md border px-4 py-2 shadow-2xl ${
            mapTheme === "dark"
              ? "bg-[#0d1829]/96 border-white/10"
              : "bg-white/95 border-black/10"
          }`}>
            <div className="flex items-center gap-1.5">
              {icaoFlag(selectedRoute.fromCode) && <img src={getFlagUri(icaoFlag(selectedRoute.fromCode))} alt="" className="h-3 w-4 rounded-[2px] object-cover" />}
              <span className={`font-black text-sm leading-none ${mapTheme === "dark" ? "text-white" : "text-gray-900"}`}>{selectedRoute.fromCode}</span>
            </div>
            <div className="flex items-center gap-1">
              <div className={`w-4 h-px ${mapTheme === "dark" ? "bg-slate-600" : "bg-gray-300"}`} />
              <Plane className="h-3 w-3 text-[#E31E24]" />
              <div className={`w-4 h-px ${mapTheme === "dark" ? "bg-slate-600" : "bg-gray-300"}`} />
            </div>
            <div className="flex items-center gap-1.5">
              {icaoFlag(selectedRoute.toCode) && <img src={getFlagUri(icaoFlag(selectedRoute.toCode))} alt="" className="h-3 w-4 rounded-[2px] object-cover" />}
              <span className={`font-black text-sm leading-none ${mapTheme === "dark" ? "text-white" : "text-gray-900"}`}>{selectedRoute.toCode}</span>
            </div>
            {(fmtDistNm(selectedRoute.distance) || fmtDuration(selectedRoute.duration) !== "—") && (
              <div className={`border-l pl-3 flex items-center gap-2 ${mapTheme === "dark" ? "border-white/10" : "border-black/08"}`}>
                {fmtDuration(selectedRoute.duration) !== "—" && (
                  <span className={`text-[11px] font-mono ${mapTheme === "dark" ? "text-slate-300" : "text-gray-700"}`}>ETE {fmtDuration(selectedRoute.duration)}</span>
                )}
                {fmtDistNm(selectedRoute.distance) && (
                  <span className={`text-[11px] font-mono ${mapTheme === "dark" ? "text-slate-500" : "text-gray-400"}`}>{fmtDistNm(selectedRoute.distance)}</span>
                )}
              </div>
            )}
            <button type="button" onClick={() => setSelectedRouteId(null)} className={`ml-1 transition ${mapTheme === "dark" ? "text-slate-600 hover:text-slate-300" : "text-gray-400 hover:text-gray-700"}`}>
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* ══════════════ BOTTOM TABLE ══════════════ */}
      {(() => {
        const isDark = mapTheme === "dark";
        return (
          <div
            className="shrink-0 flex flex-col"
            style={{
              height: "270px",
              background: isDark ? "#060c18" : "#f8fafc",
              borderTop: isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,0,0,0.08)",
            }}
          >
            {/* Table header */}
            <div
              className="flex items-center px-4 py-2 shrink-0"
              style={{
                background: isDark ? "#080e1a" : "#f1f5f9",
                borderBottom: isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,0,0,0.07)",
              }}
            >
              {(["Рейс", "Callsign", "Маршрут", "ETE", "Тип", "Расписание"] as const).map((label, i) => (
                <div
                  key={label}
                  className={`shrink-0 text-[10px] font-semibold uppercase tracking-wider ${isDark ? "text-slate-500" : "text-gray-400"}`}
                  style={{ width: [90, 84, 136, 64, 104, 158][i] }}
                >
                  {label}
                </div>
              ))}
              <div className={`flex-1 min-w-0 text-[10px] font-semibold uppercase tracking-wider ${isDark ? "text-slate-500" : "text-gray-400"}`}>
                Маршрут FPL
              </div>
              <div className="w-8 shrink-0" />
            </div>

            {/* Table body */}
            <div
              className="flex-1 overflow-y-auto"
              style={{ scrollbarWidth: "thin", scrollbarColor: isDark ? "#1e293b transparent" : "#cbd5e1 transparent" }}
            >
              {isLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-[#E31E24]" />
                </div>
              ) : filteredRoutes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2">
                  <div className={`text-sm ${isDark ? "text-slate-500" : "text-gray-400"}`}>{t("allFlights.empty")}</div>
                </div>
              ) : (
                filteredRoutes.map((route) => {
                  const isActive = route.id === selectedRouteId;
                  const fromFlag = getFlagUri(icaoFlag(route.fromCode));
                  const toFlag = getFlagUri(icaoFlag(route.toCode));
                  const acTypes = acTypeList(route);
                  const dist = fmtDistNm(route.distance);
                  const ete = fmtDuration(route.duration);

                  return (
                    <div
                      key={route.id}
                      ref={isActive ? selectedRowRef : undefined}
                      onClick={() => setSelectedRouteId(isActive ? null : route.id)}
                      onMouseEnter={() => setHoveredRouteId(route.id)}
                      onMouseLeave={() => setHoveredRouteId(null)}
                      className="flex items-center px-4 py-2.5 cursor-pointer transition-colors group border-l-2"
                      style={{
                        borderLeftColor: isActive ? "#E31E24" : "transparent",
                        borderBottomWidth: 1,
                        borderBottomStyle: "solid",
                        borderBottomColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.05)",
                        background: isActive
                          ? "rgba(227,30,36,0.08)"
                          : undefined,
                      }}
                      onMouseOver={(e) => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = isDark ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.025)"; }}
                      onMouseOut={(e) => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = ""; }}
                    >
                      {/* Flight number */}
                      <div className="w-[90px] shrink-0">
                        <span className={`font-bold text-sm ${isActive ? "text-[#E31E24]" : (isDark ? "text-white" : "text-gray-900")}`}>
                          {route.flightNumber || route.callsign || `#${route.id}`}
                        </span>
                      </div>

                      {/* Callsign */}
                      <div className="w-[84px] shrink-0">
                        <span className={`text-[11px] font-mono ${isDark ? "text-slate-500" : "text-gray-400"}`}>
                          {route.callsign && route.callsign !== route.flightNumber ? route.callsign : "—"}
                        </span>
                      </div>

                      {/* Route */}
                      <div className="w-[136px] shrink-0 flex items-center gap-1">
                        {fromFlag && <img src={fromFlag} alt="" className="h-2.5 w-3.5 rounded-[2px] object-cover shrink-0" />}
                        <span className={`font-bold text-xs ${isActive ? (isDark ? "text-white" : "text-gray-900") : (isDark ? "text-slate-200" : "text-gray-800")}`}>{route.fromCode}</span>
                        <span className={`text-[11px] mx-0.5 font-light ${isDark ? "text-slate-700" : "text-gray-300"}`}>—</span>
                        {toFlag && <img src={toFlag} alt="" className="h-2.5 w-3.5 rounded-[2px] object-cover shrink-0" />}
                        <span className={`font-bold text-xs ${isActive ? (isDark ? "text-white" : "text-gray-900") : (isDark ? "text-slate-200" : "text-gray-800")}`}>{route.toCode}</span>
                      </div>

                      {/* ETE */}
                      <div className="w-[64px] shrink-0">
                        <span className={`text-[11px] font-mono ${isDark ? "text-slate-300" : "text-gray-600"}`}>{ete !== "—" ? ete : (dist || "—")}</span>
                      </div>

                      {/* Aircraft ICAO types */}
                      <div className="w-[104px] shrink-0 flex items-center gap-1 flex-wrap pr-1">
                        {acTypes.length > 0
                          ? (
                            <>
                              {acTypes.slice(0, 2).map((type) => (
                                <span key={type} className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded border ${
                                  isDark
                                    ? "text-sky-400 bg-sky-900/35 border-sky-800/40"
                                    : "text-sky-700 bg-sky-50 border-sky-200"
                                }`}>
                                  {type}
                                </span>
                              ))}
                              {acTypes.length > 2 && (
                                <span
                                  title={acTypes.slice(2).join(", ")}
                                  className={`text-[10px] font-mono px-1 py-0.5 rounded ${isDark ? "text-slate-500 bg-white/5" : "text-gray-400 bg-gray-100"}`}
                                >
                                  +{acTypes.length - 2}
                                </span>
                              )}
                            </>
                          )
                          : <span className={`text-xs ${isDark ? "text-slate-700" : "text-gray-300"}`}>—</span>
                        }
                      </div>

                      {/* Schedule / days */}
                      <div className="w-[158px] shrink-0">
                        <DaysPill freq={route.frequency} dark={isDark} />
                      </div>

                      {/* Route FPL */}
                      <div className="flex-1 min-w-0 pr-2">
                        {route.routeText
                          ? <span className={`text-[10px] font-mono truncate block ${isDark ? "text-sky-500/70" : "text-sky-600"}`}>{route.routeText}</span>
                          : <span className={`text-xs ${isDark ? "text-slate-700" : "text-gray-300"}`}>—</span>
                        }
                      </div>

                      {/* Report */}
                      <div className="w-8 shrink-0 flex justify-center">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setReportRoute(route); setReportModalOpen(true); }}
                          disabled={reportingRouteId === route.id}
                          title={t("bookings.reportInactive")}
                          className={`flex items-center justify-center w-6 h-6 rounded-md transition opacity-0 group-hover:opacity-100 ${
                            isDark
                              ? "text-amber-500 hover:bg-amber-900/30 hover:text-amber-400"
                              : "text-amber-500 hover:bg-amber-50 hover:text-amber-600"
                          }`}
                        >
                          {reportingRouteId === route.id
                            ? <Loader2 className="h-3 w-3 animate-spin" />
                            : <AlertTriangle className="h-3 w-3" />
                          }
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })()}

      {/* ══════════════ REPORT MODAL ══════════════ */}
      <Dialog open={reportModalOpen} onOpenChange={(open) => { if (!open) { setReportModalOpen(false); setReportRoute(null); setReportReason("notOperated"); setReportComment(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              {t("bookings.reportInactive")}
            </DialogTitle>
          </DialogHeader>
          {reportRoute && (
            <div className="space-y-4">
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                <div className="font-bold text-gray-900">{reportRoute.flightNumber || reportRoute.callsign || `#${reportRoute.id}`}</div>
                <div className="flex items-center gap-1.5 mt-1 text-sm text-gray-500">
                  {icaoFlag(reportRoute.fromCode) && <img src={getFlagUri(icaoFlag(reportRoute.fromCode))} alt="" className="h-3 w-4.5 rounded-[2px] object-cover" />}
                  <span>{reportRoute.fromCode}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-gray-300" />
                  {icaoFlag(reportRoute.toCode) && <img src={getFlagUri(icaoFlag(reportRoute.toCode))} alt="" className="h-3 w-4.5 rounded-[2px] object-cover" />}
                  <span>{reportRoute.toCode}</span>
                  <span className="text-gray-400">— {icaoCity(reportRoute.toName, reportRoute.toCode)}</span>
                </div>
              </div>
              <p className="text-sm text-gray-600">
                {t("bookings.reportInactiveDescription")}
              </p>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">{t("bookings.reportReason")}</div>
                <div className="flex flex-wrap gap-1.5">
                  {(["notOperated", "schedule", "aircraft", "routing", "other"] as const).map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setReportReason(key)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                        reportReason === key
                          ? "bg-amber-500 text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {t(`bookings.reportReason.${key}`)}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">{t("bookings.reportComment")}</div>
                <textarea
                  value={reportComment}
                  onChange={(e) => setReportComment(e.target.value)}
                  placeholder={t("bookings.reportCommentPlaceholder")}
                  rows={3}
                  maxLength={500}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none placeholder-gray-400 focus:border-amber-400 focus:ring-1 focus:ring-amber-200 resize-none"
                />
              </div>
              <div className="flex gap-3 justify-end">
                <Button variant="outline" onClick={() => { setReportModalOpen(false); setReportRoute(null); }}>
                  Отмена
                </Button>
                <Button
                  className="bg-amber-500 hover:bg-amber-600 text-white"
                  disabled={reportingRouteId === reportRoute.id}
                  onClick={() => void handleReport(reportRoute)}
                >
                  {reportingRouteId === reportRoute.id ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Отправляем…</>
                  ) : (
                    <><AlertTriangle className="h-4 w-4 mr-2" /> Отправить репорт</>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
