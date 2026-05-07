import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Loader2,
  MapPin,
  Plane,
  RefreshCcw,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "../../context/language-context";
import { useNotifications } from "../../context/notifications-context";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { FlightMap, type Airport, type Route as FlightMapRoute, type SelectableRoute } from "./flight-map";
import { fetchDashboardBootstrap, getCachedDashboardBootstrap } from "./dashboard-bootstrap-cache";

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

interface RoutesResponse {
  routes?: RouteOption[];
}

interface FleetResponse {
  fleets?: Array<{
    id: number;
    name: string;
    code: string;
    aircraft: Array<{
      id: number;
      model: string;
      registration: string;
    }>;
  }>;
}

interface PilotAllFlightsProps {
  onOpenBookings: () => void;
}

const getRouteLabel = (route: RouteOption) =>
  `${route.flightNumber || route.callsign || `Route ${route.id}`} · ${route.fromCode || "—"} → ${route.toCode || "—"}`;

const formatRouteDuration = (value?: string | null) => {
  const raw = String(value || "").trim();
  if (!raw) {
    return "-";
  }

  const match = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) {
    return raw;
  }

  return `${String(Number(match[1] || 0)).padStart(2, "0")}:${String(Number(match[2] || 0)).padStart(2, "0")}`;
};

const formatRouteDistanceNm = (value?: string | number | null) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return `${Math.round(value)} nm`;
  }

  const raw = String(value || "").trim();
  if (!raw || raw === "-") {
    return "-";
  }

  const normalized = raw.toLowerCase();
  const numberMatch = normalized.match(/(\d+(?:[.,]\d+)?)/);
  if (!numberMatch) {
    return raw;
  }

  const parsed = Number(numberMatch[1].replace(",", "."));
  if (!Number.isFinite(parsed)) {
    return raw;
  }

  let distanceNm = parsed;
  if (normalized.includes("km")) {
    distanceNm = parsed / 1.852;
  } else if (normalized.includes(" mi") || normalized.endsWith("mi") || normalized.includes("sm")) {
    distanceNm = parsed * 0.868976;
  }

  return `${Math.round(distanceNm)} nm`;
};

const getRouteFrequencyLabel = (route: RouteOption, t: (key: string) => string) => {
  const value = String(route.frequency || "").trim().toLowerCase();
  if (!value) {
    return t("bookings.frequency.scheduled");
  }
  if (value === "daily") {
    return t("bookings.frequency.daily");
  }
  if (value === "weekly3") {
    return t("bookings.frequency.weekly3");
  }
  if (value === "weekly5") {
    return t("bookings.frequency.weekly5");
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
};

const getRouteAircraftTypeLabel = (
  route: RouteOption,
  aircraftOptions: AircraftOption[],
  t: (key: string) => string
) => {
  const fleetIds = Array.isArray(route.fleetIds) ? route.fleetIds : [];
  if (!fleetIds.length) {
    return t("bookings.aircraftTypeUnknown");
  }

  const models = Array.from(
    new Set(
      aircraftOptions
        .filter((aircraft) => fleetIds.includes(aircraft.fleetId))
        .map((aircraft) => String(aircraft.model || "").trim())
        .filter(Boolean)
    )
  );

  if (!models.length) {
    return t("bookings.aircraftTypeUnknown");
  }

  if (models.length <= 2) {
    return models.join(" / ");
  }

  return `${models.slice(0, 2).join(" / ")} +${models.length - 2}`;
};

export function PilotAllFlights({ onOpenBookings }: PilotAllFlightsProps) {
  const { t } = useLanguage();
  const { addNotification } = useNotifications();
  const [routeOptions, setRouteOptions] = useState<RouteOption[]>([]);
  const [aircraftOptions, setAircraftOptions] = useState<AircraftOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null);
  const [reportingRouteId, setReportingRouteId] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterAirline, setFilterAirline] = useState<string>("all");
  const [filterCity, setFilterCity] = useState("");
  const [filterHub, setFilterHub] = useState<string>("all");

  const tr = (key: string, vars?: Record<string, string | number>) => {
    const template = t(key);
    if (!vars) {
      return template;
    }

    return Object.entries(vars).reduce(
      (current, [varKey, varValue]) => current.split(`{{${varKey}}}`).join(String(varValue)),
      template
    );
  };

  const loadData = async ({ silent = false } = {}) => {
    if (silent) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const bootstrap = await fetchDashboardBootstrap({ force: false });
      const routesPayload = { routes: Array.isArray(bootstrap?.routes) ? bootstrap.routes : [] } as RoutesResponse;
      const fleetPayload = { fleets: Array.isArray(bootstrap?.fleets) ? bootstrap.fleets : [] } as FleetResponse;

      setRouteOptions(Array.isArray(routesPayload?.routes) ? routesPayload.routes : []);
      setAircraftOptions(
        Array.isArray(fleetPayload?.fleets)
          ? fleetPayload.fleets.flatMap((fleet) =>
              (Array.isArray(fleet?.aircraft) ? fleet.aircraft : []).map((aircraft) => ({
                id: Number(aircraft?.id || 0) || 0,
                fleetId: Number(fleet?.id || 0) || 0,
                model: String(aircraft?.model || "Aircraft").trim() || "Aircraft",
                registration: String(aircraft?.registration || "").trim(),
                fleetName: String(fleet?.name || fleet?.code || "Fleet").trim() || "Fleet",
              }))
            )
          : []
      );
    } catch {
      const cached = getCachedDashboardBootstrap();
      if (cached) {
        const routesPayload = { routes: Array.isArray(cached?.routes) ? cached.routes : [] } as RoutesResponse;
        const fleetPayload = { fleets: Array.isArray(cached?.fleets) ? cached.fleets : [] } as FleetResponse;
        setRouteOptions(Array.isArray(routesPayload?.routes) ? routesPayload.routes : []);
        setAircraftOptions(
          Array.isArray(fleetPayload?.fleets)
            ? fleetPayload.fleets.flatMap((fleet) =>
                (Array.isArray(fleet?.aircraft) ? fleet.aircraft : []).map((aircraft) => ({
                  id: Number(aircraft?.id || 0) || 0,
                  fleetId: Number(fleet?.id || 0) || 0,
                  model: String(aircraft?.model || "Aircraft").trim() || "Aircraft",
                  registration: String(aircraft?.registration || "").trim(),
                  fleetName: String(fleet?.name || fleet?.code || "Fleet").trim() || "Fleet",
                }))
              )
            : []
        );
      } else {
        setRouteOptions([]);
        setAircraftOptions([]);
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const airlineOptions = useMemo(() => {
    return Array.from(new Set(routeOptions.map((r) => String(r.airlineCode || "").trim()).filter(Boolean))).sort();
  }, [routeOptions]);

  const hubOptions = useMemo(() => {
    return Array.from(new Set(routeOptions.map((r) => String(r.fromCode || "").trim().toUpperCase()).filter(Boolean))).sort();
  }, [routeOptions]);

  const filteredRoutes = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const normalizedCity = filterCity.trim().toLowerCase();
    const base = [...routeOptions].sort((left, right) => {
      const leftFlight = String(left.flightNumber || left.callsign || "");
      const rightFlight = String(right.flightNumber || right.callsign || "");
      return leftFlight.localeCompare(rightFlight);
    });

    return base.filter((route) => {
      if (filterAirline !== "all" && String(route.airlineCode || "").trim() !== filterAirline) return false;
      if (filterHub !== "all" && String(route.fromCode || "").trim().toUpperCase() !== filterHub) return false;
      if (normalizedCity) {
        const match = [route.fromCode, route.fromName, route.toCode, route.toName].some(
          (v) => String(v || "").toLowerCase().includes(normalizedCity)
        );
        if (!match) return false;
      }
      if (normalizedSearch) {
        const match = [route.flightNumber, route.callsign, route.fromCode, route.fromName, route.toCode, route.toName, route.routeText].some(
          (v) => String(v || "").toLowerCase().includes(normalizedSearch)
        );
        if (!match) return false;
      }
      return true;
    });
  }, [routeOptions, search, filterAirline, filterCity, filterHub]);

  useEffect(() => {
    if (!filteredRoutes.length) {
      if (selectedRouteId !== null) {
        setSelectedRouteId(null);
      }
      return;
    }

    if (selectedRouteId && filteredRoutes.some((route) => route.id === selectedRouteId)) {
      return;
    }

    setSelectedRouteId(filteredRoutes[0]?.id || null);
  }, [filteredRoutes, selectedRouteId]);

  const selectedRoute = useMemo(
    () => filteredRoutes.find((route) => route.id === selectedRouteId) || null,
    [filteredRoutes, selectedRouteId]
  );

  const selectedMapRoute = useMemo<FlightMapRoute | null>(() => {
    const fromLat = Number(selectedRoute?.fromLat);
    const fromLon = Number(selectedRoute?.fromLon);
    const toLat = Number(selectedRoute?.toLat);
    const toLon = Number(selectedRoute?.toLon);

    if (!selectedRoute || !Number.isFinite(fromLat) || !Number.isFinite(fromLon) || !Number.isFinite(toLat) || !Number.isFinite(toLon)) {
      return null;
    }

    const distanceMatch = String(selectedRoute.distance || "").match(/([\d.]+)/);
    const distance = distanceMatch ? Math.round(Number(distanceMatch[1]) || 0) : 0;
    const durationMatch = String(selectedRoute.duration || "").match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    const durationMinutes = durationMatch ? Number(durationMatch[1]) * 60 + Number(durationMatch[2]) : 0;

    return {
      id: String(selectedRoute.flightNumber || selectedRoute.callsign || selectedRoute.id),
      airline: String(selectedRoute.airlineCode || "NWS"),
      legs: [
        {
          from: {
            icao: String(selectedRoute.fromCode || "").trim().toUpperCase() || undefined,
            name: String(selectedRoute.fromName || selectedRoute.fromCode || t("bookings.currentLocation")).trim(),
            lat: fromLat,
            lon: fromLon,
          },
          to: {
            icao: String(selectedRoute.toCode || "").trim().toUpperCase() || undefined,
            name: String(selectedRoute.toName || selectedRoute.toCode || t("bookings.routeDestinationFallback")).trim(),
            lat: toLat,
            lon: toLon,
          },
          distance,
          duration: durationMinutes,
        },
      ],
      totalDistance: distance,
      totalDuration: durationMinutes,
      aircraft: String(selectedRoute.flightNumber || selectedRoute.callsign || t("bookings.field.route")).trim(),
    };
  }, [selectedRoute, t]);

  const mapRoutes = useMemo<SelectableRoute[]>(() => {
    return filteredRoutes
      .filter((route) => {
        return (
          Number.isFinite(Number(route.fromLat)) &&
          Number.isFinite(Number(route.fromLon)) &&
          Number.isFinite(Number(route.toLat)) &&
          Number.isFinite(Number(route.toLon)) &&
          String(route.fromCode || "").trim() &&
          String(route.toCode || "").trim()
        );
      })
      .map((route) => ({
        id: String(route.id),
        from: {
          icao: String(route.fromCode || "").trim().toUpperCase() || undefined,
          name: String(route.fromName || route.fromCode || t("bookings.currentLocation")).trim(),
          lat: Number(route.fromLat),
          lon: Number(route.fromLon),
        },
        to: {
          icao: String(route.toCode || "").trim().toUpperCase() || undefined,
          name: String(route.toName || route.toCode || t("bookings.routeDestinationFallback")).trim(),
          lat: Number(route.toLat),
          lon: Number(route.toLon),
        },
        label: getRouteLabel(route),
        active: route.id === selectedRouteId,
      }));
  }, [filteredRoutes, selectedRouteId, t]);

  const airportFallbacks = useMemo<Airport[]>(() => {
    const airports = new Map<string, Airport>();
    filteredRoutes.forEach((route) => {
      const fromCode = String(route.fromCode || "").trim().toUpperCase();
      const toCode = String(route.toCode || "").trim().toUpperCase();
      const fromLat = Number(route.fromLat);
      const fromLon = Number(route.fromLon);
      const toLat = Number(route.toLat);
      const toLon = Number(route.toLon);

      if (fromCode && Number.isFinite(fromLat) && Number.isFinite(fromLon) && !airports.has(fromCode)) {
        airports.set(fromCode, {
          icao: fromCode,
          name: String(route.fromName || fromCode).trim() || fromCode,
          lat: fromLat,
          lon: fromLon,
        });
      }

      if (toCode && Number.isFinite(toLat) && Number.isFinite(toLon) && !airports.has(toCode)) {
        airports.set(toCode, {
          icao: toCode,
          name: String(route.toName || toCode).trim() || toCode,
          lat: toLat,
          lon: toLon,
        });
      }
    });

    return Array.from(airports.values());
  }, [filteredRoutes]);

  const routeStats = useMemo(() => {
    const originSet = new Set(filteredRoutes.map((route) => String(route.fromCode || "").trim().toUpperCase()).filter(Boolean));
    const destinationSet = new Set(filteredRoutes.map((route) => String(route.toCode || "").trim().toUpperCase()).filter(Boolean));

    return {
      routes: filteredRoutes.length,
      origins: originSet.size,
      destinations: destinationSet.size,
    };
  }, [filteredRoutes]);

  const handleReportOutdatedRoute = async (route: RouteOption) => {
    setReportingRouteId(route.id);
    try {
      const response = await fetch(`/api/pilot/routes/${route.id}/report-outdated`, {
        method: "POST",
        credentials: "include",
      });
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        duplicate?: boolean;
        ticket?: { number?: number | string };
        error?: string;
      } | null;

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || t("bookings.toast.reportInactiveError"));
      }

      if (payload.duplicate) {
        toast.success(
          t("bookings.toast.reportInactiveDuplicate").replace("{{ticket}}", String(payload?.ticket?.number || "#"))
        );
      } else {
        toast.success(
          t("bookings.toast.reportInactiveSuccess").replace("{{ticket}}", String(payload?.ticket?.number || "#"))
        );
        addNotification({
          category: "system",
          title: t("bookings.notification.reportTitle"),
          description: tr("bookings.notification.reportDescription", {
            route: getRouteLabel(route),
            ticket: String(payload?.ticket?.number || "#"),
          }),
        });
      }
    } catch (error) {
      toast.error(String(error || t("bookings.toast.reportInactiveError")));
    } finally {
      setReportingRouteId(null);
    }
  };

  const activeFilterCount = (filterAirline !== "all" ? 1 : 0) + (filterCity.trim() ? 1 : 0) + (filterHub !== "all" ? 1 : 0);

  return (
    <div className="relative -mx-8 -mt-6 overflow-hidden rounded-2xl" style={{ height: "calc(100svh - 100px)" }}>
      {/* ── Full-screen map ── */}
      {isLoading ? (
        <div className="flex h-full items-center justify-center bg-slate-100 text-sm text-gray-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t("allFlights.loading")}
        </div>
      ) : (
        <FlightMap
          route={selectedMapRoute}
          airports={airportFallbacks}
          availableRoutes={mapRoutes}
          selectedAirportCode={String(selectedRoute?.toCode || "").trim().toUpperCase() || null}
          onAirportSelect={(airportCode) => {
            const nextRoute = filteredRoutes.find(
              (route) => String(route.toCode || "").trim().toUpperCase() === String(airportCode).trim().toUpperCase()
            );
            if (nextRoute) setSelectedRouteId(nextRoute.id);
          }}
        />
      )}

      {/* ── Top-left controls ── */}
      <div className="absolute left-4 top-4 z-[1000] flex items-center gap-2">
        <button
          type="button"
          onClick={() => setSidebarOpen((v) => !v)}
          className="flex items-center gap-2 rounded-full bg-white/95 px-4 py-2 text-sm font-medium text-gray-700 shadow-lg backdrop-blur-sm transition hover:bg-white"
        >
          <MapPin className="h-4 w-4 text-[#E31E24]" />
          {sidebarOpen ? "Скрыть рейсы" : `Рейсы (${filteredRoutes.length})`}
        </button>
        <button
          type="button"
          onClick={() => void loadData({ silent: true })}
          disabled={isRefreshing}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/95 shadow-lg backdrop-blur-sm transition hover:bg-white"
          title="Обновить"
        >
          <RefreshCcw className={`h-4 w-4 text-gray-600 ${isRefreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* ── Top-right: stats + filter button ── */}
      <div className="absolute right-4 top-4 z-[1000] flex items-center gap-2">
        <div className="flex items-center gap-1.5 rounded-full bg-white/95 px-4 py-2 text-xs text-gray-600 shadow-lg backdrop-blur-sm">
          <span className="font-semibold text-gray-900">{routeStats.routes}</span> рейсов ·
          <span className="font-semibold text-gray-900">{routeStats.origins}</span> аэропортов
        </div>
        <button
          type="button"
          onClick={() => setFilterOpen((v) => !v)}
          className={`relative flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium shadow-lg backdrop-blur-sm transition ${
            filterOpen || activeFilterCount > 0
              ? "bg-[#E31E24] text-white"
              : "bg-white/95 text-gray-700 hover:bg-white"
          }`}
        >
          <Search className="h-4 w-4" />
          Фильтры
          {activeFilterCount > 0 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[11px] font-bold text-[#E31E24]">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* ── Filter panel ── */}
      {filterOpen && (
        <div className="absolute right-4 top-16 z-[1000] w-80 rounded-2xl bg-white/98 p-4 shadow-2xl backdrop-blur-sm">
          {/* City/ICAO search */}
          <div className="mb-4">
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500">Город или ИКАО</div>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={filterCity}
                onChange={(e) => setFilterCity(e.target.value)}
                placeholder="Москва, UUEE, Antalya…"
                className="w-full rounded-xl border border-gray-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-[#E31E24] focus:ring-1 focus:ring-[#E31E24]"
              />
            </div>
          </div>

          {/* Search by flight number */}
          <div className="mb-4">
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500">Номер рейса</div>
            <div className="relative">
              <Plane className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="2S023…"
                className="w-full rounded-xl border border-gray-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-[#E31E24] focus:ring-1 focus:ring-[#E31E24]"
              />
            </div>
          </div>

          {/* Airline filter */}
          {airlineOptions.length > 1 && (
            <div className="mb-4">
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500">Авиакомпания</div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setFilterAirline("all")}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${filterAirline === "all" ? "bg-[#E31E24] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                >
                  Все
                </button>
                {airlineOptions.map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => setFilterAirline(filterAirline === code ? "all" : code)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition ${filterAirline === code ? "bg-[#E31E24] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                  >
                    {code}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Hub filter */}
          <div>
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500">Хаб вылета</div>
            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
              <button
                type="button"
                onClick={() => setFilterHub("all")}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${filterHub === "all" ? "bg-[#E31E24] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
              >
                Все
              </button>
              {hubOptions.map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setFilterHub(filterHub === code ? "all" : code)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${filterHub === code ? "bg-[#E31E24] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                >
                  {code}
                </button>
              ))}
            </div>
          </div>

          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={() => { setFilterAirline("all"); setFilterCity(""); setFilterHub("all"); setSearch(""); }}
              className="mt-4 w-full rounded-xl border border-gray-200 py-1.5 text-xs text-gray-500 hover:bg-gray-50 transition"
            >
              Сбросить все фильтры
            </button>
          )}
        </div>
      )}

      {/* ── Sidebar ── */}
      {sidebarOpen && (
        <div className="absolute left-4 top-16 bottom-4 z-[999] w-80 overflow-hidden rounded-2xl bg-white/98 shadow-2xl backdrop-blur-sm flex flex-col">
          <div className="border-b border-gray-100 px-4 py-3">
            <div className="text-sm font-semibold text-gray-800">{t("allFlights.listTitle")}</div>
            <div className="text-xs text-gray-500">{filteredRoutes.length} рейсов</div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {filteredRoutes.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-400">{t("allFlights.empty")}</div>
            ) : null}
            {filteredRoutes.map((route) => {
              const isActive = route.id === selectedRouteId;
              return (
                <button
                  key={route.id}
                  type="button"
                  onClick={() => setSelectedRouteId(route.id)}
                  className={`w-full rounded-xl border p-3 text-left transition ${
                    isActive ? "border-[#E31E24] bg-red-50 shadow-sm" : "border-gray-100 hover:border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-sm text-gray-900">{route.flightNumber || route.callsign || `#${route.id}`}</span>
                        <span className="text-[10px] text-gray-400">{getRouteFrequencyLabel(route, t)}</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-600 mt-0.5">
                        <span className="font-medium">{route.fromCode || "—"}</span>
                        <ArrowRight className="h-3 w-3 text-gray-400" />
                        <span className="font-medium">{route.toCode || "—"}</span>
                      </div>
                      <div className="text-[11px] text-gray-400 truncate mt-0.5">
                        {(route.fromName || "") + (route.toName ? ` · ${route.toName}` : "")}
                      </div>
                    </div>
                    <div className="text-right text-[11px] text-gray-400 shrink-0">
                      <div>{formatRouteDistanceNm(route.distance)}</div>
                      <div>{formatRouteDuration(route.duration)}</div>
                    </div>
                  </div>
                  {isActive && (
                    <div className="mt-2 flex flex-wrap gap-1.5 border-t border-red-100 pt-2">
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                        {getRouteAircraftTypeLabel(route, aircraftOptions, t)}
                      </span>
                      {route.routeText && (
                        <div className="w-full text-[11px] text-sky-600 break-all">{route.routeText}</div>
                      )}
                      <button
                        type="button"
                        className="mt-1 flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-700 hover:bg-amber-100 transition"
                        onClick={(e) => { e.stopPropagation(); void handleReportOutdatedRoute(route); }}
                        disabled={reportingRouteId === route.id}
                      >
                        {reportingRouteId === route.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <AlertTriangle className="h-3 w-3" />}
                        {t("bookings.reportInactive")}
                      </button>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          <div className="border-t border-gray-100 p-3">
            <Button size="sm" className="w-full bg-[#E31E24] hover:bg-[#c41a20] text-white" onClick={onOpenBookings}>
              <Plane className="mr-2 h-3.5 w-3.5" />
              {t("allFlights.openBookings")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}