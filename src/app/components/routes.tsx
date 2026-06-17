import { useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "../context/language-context";
import {
  ChevronRight,
  ChevronDown,
  Globe,
  Layers,
  Loader2,
  MapPin,
  Plane,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { FlightMap, type Airport, type Route, type HubData } from "./dashboard/flight-map";

// ── Types ─────────────────────────────────────────────────────────────────────

type ApiRoute = {
  id: string | number;
  airlineCode?: string;
  fleetIds?: Array<string | number>;
  fromCode?: string;
  fromName?: string;
  fromLat?: number | null;
  fromLon?: number | null;
  toCode?: string;
  toName?: string;
  toLat?: number | null;
  toLon?: number | null;
  distance?: string;
  duration?: string | number;
  serviceDays?: number[];
  frequency?: string;
};

type ApiHub = {
  id: string | number;
  name?: string;
  airportCodes?: string[];
  airportLabels?: string[];
};

type SortKey = "default" | "alpha" | "duration" | "distance";

const AIRLINES = [
  { code: "ALL", label: "Все", labelEn: "All", color: "#94a3b8" },
  { code: "NWS", label: "Nordwind", labelEn: "Nordwind", color: "#E31E24" },
  { code: "KAR", label: "IKAR", labelEn: "IKAR", color: "#10b981" },
  { code: "STW", label: "Southwind", labelEn: "Southwind", color: "#f59e0b" },
] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

const parseDistanceNm = (v: unknown) => {
  const n = Number(String(v || "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const parseDurationMins = (v: unknown) => {
  const s = String(v || "").trim();
  if (!s) return 0;
  if (/^\d+$/.test(s)) return Math.round(Number(s) / 60);
  const m = s.match(/^(\d{1,3}):(\d{2})(?::(\d{2}))?$/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  return 0;
};

const fmtDuration = (mins: number, ru: boolean) => {
  const h = Math.floor(mins / 60), m = mins % 60;
  return ru ? `${h}ч ${m}м` : `${h}h ${m}m`;
};

const ICAO_FLAG: Record<string, string> = {
  UU: "ru", UR: "ru", UW: "ru", UK: "ru", US: "ru", UA: "ua",
  LT: "tr", LG: "gr", LF: "fr", ED: "de", EG: "gb", LE: "es",
  LI: "it", EH: "nl", LO: "at", LP: "pt", LK: "cz", EP: "pl",
  EY: "lt", EV: "lv", EE: "ee", UB: "az", UT: "uz",
};
const icaoFlag = (icao?: string) => {
  const c = String(icao || "").trim().toUpperCase();
  return ICAO_FLAG[c] || ICAO_FLAG[c.slice(0, 2)] || "";
};

// ── Component ─────────────────────────────────────────────────────────────────

export function Routes() {
  const { language } = useLanguage();
  const ru = language === "ru";
  const tr = (r: string, e: string) => (ru ? r : e);

  const [apiRoutes, setApiRoutes] = useState<ApiRoute[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const [selectedAirline, setSelectedAirline] = useState("ALL");
  const [search, setSearch] = useState("");
  const [selectedHubCode, setSelectedHubCode] = useState<string | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [expandedHubs, setExpandedHubs] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>("default");
  const [mapMode, setMapMode] = useState<"hubs" | "default">("hubs");

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersRef = useRef<HTMLDivElement>(null);

  const [hoveredHubCode, setHoveredHubCode] = useState<string | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);

  // Close filters panel on outside click
  useEffect(() => {
    if (!filtersOpen) return;
    const handler = (e: MouseEvent) => {
      if (filtersRef.current && !filtersRef.current.contains(e.target as Node))
        setFiltersOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [filtersOpen]);

  // Track mouse for hover tooltip
  useEffect(() => {
    if (!hoveredHubCode) return;
    const handler = (e: MouseEvent) => setHoverPos({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", handler);
    return () => window.removeEventListener("mousemove", handler);
  }, [hoveredHubCode]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setIsLoading(true); setHasError(false);
      try {
        const res = await fetch("/api/vamsys/routes", { credentials: "include" });
        if (!res.ok) throw new Error();
        const payload = await res.json();
        if (!mounted) return;
        setApiRoutes(Array.isArray(payload?.routes) ? payload.routes : []);
      } catch {
        if (!mounted) return;
        setHasError(true);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };
    void load();
    return () => { mounted = false; };
  }, []);

  const routes = useMemo<Route[]>(() =>
    apiRoutes
      .filter((r) => Number.isFinite(Number(r.fromLat)) && Number.isFinite(Number(r.toLat)))
      .map((r) => ({
        id: String(r.id),
        airline: String(r.airlineCode || "NWS").toUpperCase(),
        aircraft: "",
        totalDistance: parseDistanceNm(r.distance),
        totalDuration: parseDurationMins(r.duration),
        legs: [{
          from: { icao: r.fromCode?.toUpperCase(), name: r.fromName || r.fromCode || "—", lat: Number(r.fromLat), lon: Number(r.fromLon) } as Airport,
          to:   { icao: r.toCode?.toUpperCase(),   name: r.toName   || r.toCode   || "—", lat: Number(r.toLat),   lon: Number(r.toLon)   } as Airport,
          distance: parseDistanceNm(r.distance),
          duration: parseDurationMins(r.duration),
        }],
      }))
  , [apiRoutes]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return routes.filter((r) => {
      if (selectedAirline !== "ALL" && r.airline !== selectedAirline) return false;
      if (selectedHubCode && (r.legs[0].from.icao || "").toUpperCase() !== selectedHubCode) return false;
      if (q) {
        const hay = [r.legs[0].from.icao, r.legs[0].from.name, r.legs[0].to.icao, r.legs[0].to.name].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [routes, selectedAirline, selectedHubCode, search]);

  const hubsData = useMemo<HubData[]>(() => {
    const map = new Map<string, HubData>();
    const scope = selectedAirline === "ALL" ? routes : routes.filter((r) => r.airline === selectedAirline);
    scope.forEach((r) => {
      const code = (r.legs[0].from.icao || "").toUpperCase();
      const lat = r.legs[0].from.lat, lon = r.legs[0].from.lon;
      if (!code || !Number.isFinite(lat)) return;
      if (!map.has(code)) map.set(code, { code, name: r.legs[0].from.name, lat, lon, routeCount: 0 });
      map.get(code)!.routeCount++;
    });
    return Array.from(map.values()).sort((a, b) => b.routeCount - a.routeCount);
  }, [routes, selectedAirline]);

  const routesByHub = useMemo(() => {
    const groups = new Map<string, Route[]>();
    const scope = selectedAirline === "ALL" ? routes : routes.filter((r) => r.airline === selectedAirline);
    scope.forEach((r) => {
      const hub = (r.legs[0].from.icao || "?").toUpperCase();
      if (!groups.has(hub)) groups.set(hub, []);
      groups.get(hub)!.push(r);
    });
    const entries = Array.from(groups.entries());
    switch (sortKey) {
      case "alpha":    return entries.sort((a, b) => a[0].localeCompare(b[0]));
      case "duration": return entries.sort((a, b) => Math.min(...a[1].map((r) => r.totalDuration || 9999)) - Math.min(...b[1].map((r) => r.totalDuration || 9999)));
      case "distance": return entries.sort((a, b) => Math.min(...a[1].map((r) => r.totalDistance || 9999)) - Math.min(...b[1].map((r) => r.totalDistance || 9999)));
      default:         return entries.sort((a, b) => b[1].length - a[1].length);
    }
  }, [routes, selectedAirline, sortKey]);

  const hubModeRoutes = useMemo(() => {
    if (!selectedHubCode) return [];
    return filtered.map((r) => ({
      id: r.id, from: r.legs[0].from, to: r.legs[0].to,
      label: `${r.airline} · ${r.legs[0].from.icao} → ${r.legs[0].to.icao}`,
      active: r.id === selectedRouteId,
    }));
  }, [filtered, selectedHubCode, selectedRouteId]);

  const mapRoutes = useMemo(() => filtered.map((r) => ({
    id: r.id, from: r.legs[0].from, to: r.legs[0].to,
    label: `${r.airline} · ${r.legs[0].from.icao} → ${r.legs[0].to.icao}`,
    active: r.id === selectedRouteId,
  })), [filtered, selectedRouteId]);

  const selectedRoute = useMemo(() =>
    selectedRouteId ? routes.find((r) => r.id === selectedRouteId) || null : null
  , [routes, selectedRouteId]);

  const stats = useMemo(() => ({
    routes: filtered.length,
    hubs: hubsData.length,
    destinations: new Set(filtered.map((r) => r.legs[0].to.icao)).size,
  }), [filtered, hubsData]);

  // Hover tooltip data
  const hoveredHubInfo = useMemo(() =>
    hoveredHubCode ? hubsData.find((h) => h.code === hoveredHubCode) || null : null
  , [hubsData, hoveredHubCode]);

  const hoveredHubRoutes = useMemo(() => {
    if (!hoveredHubCode) return [];
    return routes
      .filter((r) => (r.legs[0].from.icao || "").toUpperCase() === hoveredHubCode)
      .slice(0, 8);
  }, [routes, hoveredHubCode]);

  const hasActiveFilters = selectedAirline !== "ALL" || selectedHubCode || sortKey !== "default" || !!search;

  return (
    <div className="relative bg-[#0d1117] overflow-hidden" style={{ height: "calc(100svh - 68px)" }}>

      {/* ── Full-screen map ───────────────────────────────────────────────── */}
      <div className="absolute inset-0">
        {isLoading ? (
          <div className="flex h-full items-center justify-center bg-[#0d1117]">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-[#E31E24]" />
              <div className="text-white/30 text-sm">{tr("Загружаем маршрутную сеть…", "Loading route network…")}</div>
            </div>
          </div>
        ) : (
          <FlightMap
            route={mapMode === "default" ? selectedRoute : null}
            availableRoutes={mapMode === "hubs" ? hubModeRoutes : mapRoutes}
            hubs={mapMode === "hubs" ? hubsData : []}
            selectedHubCode={mapMode === "hubs" ? selectedHubCode : null}
            mode={mapMode}
            onHubSelect={(code) => {
              setSelectedHubCode(code);
              setExpandedHubs((prev) => { const s = new Set(prev); s.add(code); return s; });
              setSelectedRouteId(null);
            }}
            onAirportSelect={(airportCode) => {
              setSelectedHubCode(airportCode);
              setExpandedHubs((prev) => { const s = new Set(prev); s.add(airportCode); return s; });
              setSelectedRouteId(null);
            }}
            onHubHover={(code) => {
              setHoveredHubCode(code);
              if (!code) setHoverPos(null);
            }}
          />
        )}
      </div>

      {/* ── Sidebar overlay ───────────────────────────────────────────────── */}
      <aside
        className={`absolute left-0 top-0 h-full w-[300px] z-[500] bg-[#111318]/97 backdrop-blur-sm border-r border-white/8 flex flex-col transition-transform duration-300 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-white/6 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <span className="text-white font-bold">{tr("Маршруты", "Routes")}</span>
            <span className="text-xs font-bold text-[#E31E24]">{filtered.length}</span>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-white/30" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tr("UUEE, Москва, Анталья…", "UUEE, Moscow, Antalya…")}
              className="w-full bg-white/6 border border-white/8 rounded-xl pl-9 pr-8 py-2 text-sm text-white placeholder-white/25 outline-none focus:border-white/20"
            />
            {search && (
              <button type="button" onClick={() => setSearch("")} className="absolute right-3 top-2.5 text-white/30 hover:text-white/60">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Hub list */}
        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
          {hasError ? (
            <div className="px-4 py-8 text-center text-white/25 text-sm">{tr("Ошибка загрузки", "Load error")}</div>
          ) : (
            <div className="divide-y divide-white/4">
              {routesByHub.map(([hub, hubRoutes]) => {
                const isActive = hub === selectedHubCode;
                const isExpanded = expandedHubs.has(hub) || isActive;
                const hubInfo = hubsData.find((h) => h.code === hub);
                const flag = icaoFlag(hub);
                const visibleRoutes = isActive
                  ? filtered.filter((r) => (r.legs[0].from.icao || "").toUpperCase() === hub)
                  : hubRoutes;

                return (
                  <div key={hub}>
                    <button
                      type="button"
                      onClick={() => {
                        const next = isActive ? null : hub;
                        setSelectedHubCode(next);
                        setSelectedRouteId(null);
                        setExpandedHubs((prev) => {
                          const s = new Set(prev);
                          isExpanded ? s.delete(hub) : s.add(hub);
                          return s;
                        });
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition hover:bg-white/5 ${isActive ? "bg-white/8" : ""}`}
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isActive ? "bg-[#E31E24]/20" : "bg-white/6"}`}>
                        {flag
                          ? <img src={`https://flagcdn.com/${flag}.svg`} alt="" className="w-6 h-4 rounded object-cover" loading="lazy" />
                          : <span className="text-[10px] font-black text-white/50">{hub.slice(0, 2)}</span>
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`font-bold text-sm ${isActive ? "text-white" : "text-white/70"}`}>{hub}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${isActive ? "bg-[#E31E24]/25 text-[#E31E24]" : "bg-white/8 text-white/35"}`}>
                            {hubRoutes.length}
                          </span>
                        </div>
                        <div className="text-[11px] text-white/30 truncate">{hubInfo?.name || hub}</div>
                      </div>
                      {isExpanded
                        ? <ChevronDown className="h-3.5 w-3.5 text-white/25 shrink-0" />
                        : <ChevronRight className="h-3.5 w-3.5 text-white/25 shrink-0" />
                      }
                    </button>

                    {isExpanded && (
                      <div className="bg-black/20 border-t border-white/4">
                        {visibleRoutes.map((r) => {
                          const isRouteActive = r.id === selectedRouteId;
                          const destFlag = icaoFlag(r.legs[0].to.icao);
                          const airline = AIRLINES.find((a) => a.code === r.airline);
                          return (
                            <button
                              key={r.id}
                              type="button"
                              onClick={() => { setSelectedRouteId(r.id); setSelectedHubCode(hub); }}
                              className={`w-full flex items-center gap-3 pl-6 pr-4 py-2.5 text-left transition border-b border-white/4 last:border-0 ${isRouteActive ? "bg-white/8" : "hover:bg-white/4"}`}
                            >
                              <div className="w-1 h-8 rounded-full shrink-0" style={{ backgroundColor: isRouteActive ? (airline?.color || "#E31E24") : "rgba(255,255,255,0.1)" }} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  {destFlag && <img src={`https://flagcdn.com/${destFlag}.svg`} alt="" className="h-2.5 w-3.5 rounded-[2px] object-cover shrink-0 opacity-60" loading="lazy" />}
                                  <span className={`text-xs font-bold ${isRouteActive ? "text-white" : "text-white/60"}`}>{r.legs[0].to.icao}</span>
                                  <span className="text-[10px] text-white/25 truncate">{r.legs[0].to.name}</span>
                                </div>
                                <div className="text-[10px] text-white/25 font-mono mt-0.5">
                                  {r.totalDistance ? `${r.totalDistance} nm` : ""}{r.totalDuration ? ` · ${fmtDuration(r.totalDuration, ru)}` : ""}
                                </div>
                              </div>
                              {r.airline !== "ALL" && (
                                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: airline?.color || "#94a3b8" }} />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer stats */}
        <div className="px-4 py-3 border-t border-white/6 shrink-0 flex items-center gap-4 text-[11px] text-white/30">
          <span><span className="text-white font-bold">{stats.hubs}</span> {tr("хабов", "hubs")}</span>
          <span><span className="text-white font-bold">{stats.destinations}</span> {tr("направлений", "dest.")}</span>
        </div>
      </aside>

      {/* ── Sidebar toggle tab ────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setSidebarOpen((v) => !v)}
        className="absolute top-1/2 -translate-y-1/2 z-[600] flex items-center justify-center w-5 h-14 bg-[#111318]/90 backdrop-blur-sm border border-white/10 rounded-r-lg text-white/40 hover:text-white/70 transition-colors"
        style={{ left: sidebarOpen ? 300 : 0, transition: "left 0.3s" }}
      >
        <ChevronRight className={`h-3 w-3 transition-transform duration-300 ${sidebarOpen ? "rotate-180" : ""}`} />
      </button>

      {/* ── Filters pill button ───────────────────────────────────────────── */}
      <div ref={filtersRef} className="absolute top-4 right-4 z-[1000]">
        <button
          type="button"
          onClick={() => setFiltersOpen((v) => !v)}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border transition-all backdrop-blur-sm shadow-xl ${filtersOpen ? "bg-white/15 border-white/20 text-white" : "bg-black/55 border-white/10 text-white/70 hover:text-white hover:bg-black/70"}`}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          {tr("Фильтры", "Filters")}
          {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-[#E31E24] shrink-0" />}
        </button>

        {filtersOpen && (
          <div className="absolute top-11 right-0 w-72 bg-[#0f172a]/97 backdrop-blur-sm border border-white/10 rounded-2xl shadow-2xl p-4 space-y-4">

            {/* Airline */}
            <div>
              <div className="text-[10px] text-white/35 uppercase tracking-widest mb-2">{tr("Авиакомпания", "Airline")}</div>
              <div className="flex flex-wrap gap-1.5">
                {AIRLINES.map((a) => {
                  const active = selectedAirline === a.code;
                  return (
                    <button
                      key={a.code}
                      type="button"
                      onClick={() => { setSelectedAirline(a.code); setSelectedHubCode(null); setSelectedRouteId(null); }}
                      className={`px-3 py-1 rounded-full text-xs font-semibold transition border ${active ? "bg-white/12 border-white/15 text-white" : "bg-transparent border-white/8 text-white/40 hover:text-white/65 hover:border-white/15"}`}
                      style={active && a.code !== "ALL" ? { color: a.color, borderColor: `${a.color}40` } : undefined}
                    >
                      {ru ? a.label : a.labelEn}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Map mode */}
            <div>
              <div className="text-[10px] text-white/35 uppercase tracking-widest mb-2">{tr("Режим карты", "Map mode")}</div>
              <div className="flex rounded-xl bg-white/5 border border-white/8 overflow-hidden">
                <button type="button" onClick={() => setMapMode("hubs")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold transition ${mapMode === "hubs" ? "bg-white/12 text-white" : "text-white/35 hover:text-white/60"}`}>
                  <Layers className="h-3.5 w-3.5" />{tr("Хабы", "Hubs")}
                </button>
                <button type="button" onClick={() => setMapMode("default")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold transition ${mapMode === "default" ? "bg-white/12 text-white" : "text-white/35 hover:text-white/60"}`}>
                  <Plane className="h-3.5 w-3.5" />{tr("Маршруты", "Routes")}
                </button>
              </div>
            </div>

            {/* Sort */}
            <div>
              <div className="text-[10px] text-white/35 uppercase tracking-widest mb-2">{tr("Сортировка", "Sort by")}</div>
              <div className="grid grid-cols-2 gap-1.5">
                {([
                  ["default",  tr("По умолчанию", "Default")],
                  ["alpha",    tr("А → Я", "A → Z")],
                  ["duration", tr("По времени", "By duration")],
                  ["distance", tr("По расстоянию", "By distance")],
                ] as [SortKey, string][]).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSortKey(key)}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold transition text-left border ${sortKey === key ? "bg-white/10 border-white/15 text-white" : "bg-white/4 border-transparent text-white/35 hover:text-white/60 hover:border-white/10"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Reset */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => { setSelectedAirline("ALL"); setSelectedHubCode(null); setSelectedRouteId(null); setSortKey("default"); setSearch(""); }}
                className="w-full py-2 rounded-lg text-xs text-white/40 hover:text-white/65 border border-white/8 hover:border-white/15 transition"
              >
                {tr("Сбросить всё", "Reset all")}
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Stats chip (visible when sidebar closed) ──────────────────────── */}
      {!sidebarOpen && (
        <div className="absolute top-4 left-4 z-[400] flex items-center gap-2.5 rounded-full bg-black/55 backdrop-blur-sm border border-white/10 px-3 py-2 shadow-lg pointer-events-none">
          <Globe className="h-3.5 w-3.5 text-white/35" />
          <span className="text-[11px] text-white/50">
            <span className="text-white font-bold">{isLoading ? "—" : stats.routes}</span> {tr("маршрутов", "routes")}
          </span>
          <span className="text-white/15">·</span>
          <span className="text-[11px] text-white/50">
            <span className="text-white font-bold">{isLoading ? "—" : stats.hubs}</span> {tr("хабов", "hubs")}
          </span>
        </div>
      )}

      {/* ── Hub hover tooltip ─────────────────────────────────────────────── */}
      {hoveredHubCode && hoverPos && hoveredHubInfo && (
        <div
          className="fixed z-[9999] pointer-events-none"
          style={{ left: hoverPos.x + 18, top: hoverPos.y, transform: "translateY(-50%)" }}
        >
          <div className="bg-[#0f172a]/98 backdrop-blur-sm border border-white/12 rounded-xl shadow-2xl p-3 w-52">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="font-black text-white text-sm">{hoveredHubCode}</span>
              <span className="text-[10px] bg-[#E31E24]/20 text-[#E31E24] font-semibold px-2 py-0.5 rounded-full">
                {hoveredHubInfo.routeCount} {tr("рейсов", "routes")}
              </span>
            </div>
            <div className="text-[11px] text-white/40 mb-2.5 truncate">{hoveredHubInfo.name}</div>
            <div className="space-y-1">
              {hoveredHubRoutes.map((r) => (
                <div key={r.id} className="flex items-center gap-2 text-[10px]">
                  <span className="font-bold text-white/65 w-10 shrink-0 font-mono">{r.legs[0].to.icao}</span>
                  <span className="text-white/30 truncate">{r.legs[0].to.name}</span>
                </div>
              ))}
              {hoveredHubInfo.routeCount > 8 && (
                <div className="text-[10px] text-white/25 pt-0.5">
                  +{hoveredHubInfo.routeCount - 8} {tr("ещё", "more")}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Selected route info overlay ───────────────────────────────────── */}
      {selectedRoute && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-4 rounded-2xl bg-[#111318]/95 backdrop-blur-sm border border-white/10 px-5 py-3.5 shadow-2xl">
          <div className="flex items-center gap-3">
            {icaoFlag(selectedRoute.legs[0].from.icao) && (
              <img src={`https://flagcdn.com/${icaoFlag(selectedRoute.legs[0].from.icao)}.svg`} alt="" className="h-3.5 w-5 rounded object-cover" />
            )}
            <div>
              <div className="text-white font-black text-base leading-tight">{selectedRoute.legs[0].from.icao}</div>
              <div className="text-white/35 text-[11px] leading-tight">{selectedRoute.legs[0].from.name}</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-white/30">
            <div className="w-8 h-px bg-white/20" />
            <Plane className="h-3.5 w-3.5 text-[#E31E24]" />
            <div className="w-8 h-px bg-white/20" />
          </div>
          <div className="flex items-center gap-3">
            {icaoFlag(selectedRoute.legs[0].to.icao) && (
              <img src={`https://flagcdn.com/${icaoFlag(selectedRoute.legs[0].to.icao)}.svg`} alt="" className="h-3.5 w-5 rounded object-cover" />
            )}
            <div>
              <div className="text-white font-black text-base leading-tight">{selectedRoute.legs[0].to.icao}</div>
              <div className="text-white/35 text-[11px] leading-tight">{selectedRoute.legs[0].to.name}</div>
            </div>
          </div>
          {(selectedRoute.totalDistance > 0 || selectedRoute.totalDuration > 0) && (
            <div className="border-l border-white/10 pl-4 flex items-center gap-3 text-[11px] text-white/40 font-mono">
              {selectedRoute.totalDistance > 0 && <span>{selectedRoute.totalDistance} nm</span>}
              {selectedRoute.totalDuration > 0 && <span>{fmtDuration(selectedRoute.totalDuration, ru)}</span>}
            </div>
          )}
          <button type="button" onClick={() => setSelectedRouteId(null)} className="ml-2 text-white/25 hover:text-white/60 transition">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── Hub breadcrumb ────────────────────────────────────────────────── */}
      {mapMode === "hubs" && selectedHubCode && !selectedRoute && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-2 rounded-full bg-[#111318]/90 backdrop-blur-sm border border-white/10 px-4 py-2.5 shadow-xl">
          <MapPin className="h-3.5 w-3.5 text-[#E31E24]" />
          <span className="text-white font-bold text-sm">{selectedHubCode}</span>
          <span className="text-white/30 text-xs">· {hubModeRoutes.length} {tr("направлений", "destinations")}</span>
          <button type="button" onClick={() => { setSelectedHubCode(null); setSelectedRouteId(null); }} className="ml-1 text-white/30 hover:text-white/60 transition">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* ── Error chip ────────────────────────────────────────────────────── */}
      {hasError && (
        <div className="absolute top-16 right-4 z-[1000] rounded-lg bg-red-900/80 px-3 py-1.5 text-[11px] text-red-200 border border-red-500/20">
          {tr("Ошибка загрузки данных", "Failed to load data")}
        </div>
      )}
    </div>
  );
}
