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
      const [routesResponse, fleetResponse] = await Promise.all([
        fetch("/api/vamsys/routes", { credentials: "include" }),
        fetch("/api/vamsys/fleet", { credentials: "include" }),
      ]);

      const routesPayload = (await routesResponse.json().catch(() => null)) as RoutesResponse | null;
      const fleetPayload = (await fleetResponse.json().catch(() => null)) as FleetResponse | null;

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
      setRouteOptions([]);
      setAircraftOptions([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const filteredRoutes = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const base = [...routeOptions].sort((left, right) => {
      const leftFlight = String(left.flightNumber || left.callsign || "");
      const rightFlight = String(right.flightNumber || right.callsign || "");
      return leftFlight.localeCompare(rightFlight);
    });

    if (!normalizedSearch) {
      return base;
    }

    return base.filter((route) =>
      [
        route.flightNumber,
        route.callsign,
        route.fromCode,
        route.fromName,
        route.toCode,
        route.toName,
        route.routeText,
      ].some((value) => String(value || "").toLowerCase().includes(normalizedSearch))
    );
  }, [routeOptions, search]);

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1d1d1f]">{t("dashboard.tabs.allFlights")}</h1>
          <p className="mt-1 text-sm text-gray-500">{t("allFlights.subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => void loadData({ silent: true })} disabled={isRefreshing || isLoading}>
            {isRefreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
            {t("allFlights.refresh")}
          </Button>
          <Button className="bg-[#E31E24] hover:bg-[#c41a20] text-white" onClick={onOpenBookings}>
            <Plane className="mr-2 h-4 w-4" />
            {t("allFlights.openBookings")}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-none shadow-sm">
          <CardContent className="p-5">
            <div className="text-sm text-gray-500">{t("allFlights.kpi.routes")}</div>
            <div className="mt-1 text-3xl font-bold text-[#1d1d1f]">{routeStats.routes}</div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="p-5">
            <div className="text-sm text-gray-500">{t("allFlights.kpi.origins")}</div>
            <div className="mt-1 text-3xl font-bold text-[#1d1d1f]">{routeStats.origins}</div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="p-5">
            <div className="text-sm text-gray-500">{t("allFlights.kpi.destinations")}</div>
            <div className="mt-1 text-3xl font-bold text-[#1d1d1f]">{routeStats.destinations}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        <Card className="border-none shadow-md overflow-hidden">
          <CardHeader className="border-b border-gray-100">
            <CardTitle className="flex items-center gap-2 text-lg text-[#1d1d1f]">
              <MapPin className="h-5 w-5 text-[#E31E24]" />
              {t("allFlights.mapTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex min-h-[520px] items-center justify-center text-sm text-gray-500">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("allFlights.loading")}
              </div>
            ) : (
              <div className="h-[520px]">
                <FlightMap
                  route={selectedMapRoute}
                  airports={airportFallbacks}
                  availableRoutes={mapRoutes}
                  selectedAirportCode={String(selectedRoute?.toCode || "").trim().toUpperCase() || null}
                  onAirportSelect={(airportCode) => {
                    const nextRoute = filteredRoutes.find(
                      (route) => String(route.toCode || "").trim().toUpperCase() === String(airportCode).trim().toUpperCase()
                    );
                    if (nextRoute) {
                      setSelectedRouteId(nextRoute.id);
                    }
                  }}
                />
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-none shadow-sm">
            <CardContent className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t("allFlights.searchPlaceholder")}
                  className="pl-9"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-md">
            <CardHeader className="border-b border-gray-100">
              <CardTitle className="text-lg text-[#1d1d1f]">{t("allFlights.listTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="max-h-[560px] space-y-3 overflow-y-auto p-4">
              {!isLoading && filteredRoutes.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
                  {t("allFlights.empty")}
                </div>
              ) : null}

              {filteredRoutes.map((route) => {
                const isActive = route.id === selectedRouteId;
                return (
                  <button
                    key={route.id}
                    type="button"
                    onClick={() => setSelectedRouteId(route.id)}
                    className={`w-full rounded-2xl border p-4 text-left transition ${
                      isActive ? "border-[#E31E24] bg-red-50/70 shadow-sm" : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-lg font-bold text-[#1d1d1f]">{route.flightNumber || route.callsign || `Route ${route.id}`}</div>
                          <Badge variant="outline" className="border-gray-200 bg-white text-gray-700">
                            {getRouteFrequencyLabel(route, t)}
                          </Badge>
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-sm text-gray-600">
                          <span>{route.fromCode || "—"}</span>
                          <ArrowRight className="h-3.5 w-3.5 text-gray-400" />
                          <span>{route.toCode || "—"}</span>
                        </div>
                        <div className="mt-1 text-xs text-gray-500">
                          {(route.fromName || route.fromCode || "—") + " • " + (route.toName || route.toCode || "—")}
                        </div>
                      </div>
                      <div className="text-right text-xs text-gray-500">
                        <div>{formatRouteDistanceNm(route.distance)}</div>
                        <div className="mt-1">{formatRouteDuration(route.duration)}</div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                      <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
                        {getRouteAircraftTypeLabel(route, aircraftOptions, t)}
                      </Badge>
                      {route.routeText ? (
                        <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-700">
                          {route.routeText}
                        </Badge>
                      ) : null}
                    </div>

                    {isActive ? (
                      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-red-100 pt-4">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="border-amber-300 text-amber-700 hover:bg-amber-50 hover:text-amber-800"
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleReportOutdatedRoute(route);
                          }}
                          disabled={reportingRouteId === route.id}
                        >
                          {reportingRouteId === route.id ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <AlertTriangle className="mr-2 h-4 w-4" />
                          )}
                          {t("bookings.reportInactive")}
                        </Button>
                        <div className="text-xs text-gray-500">{t("bookings.reportInactiveHint")}</div>
                      </div>
                    ) : null}
                  </button>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}