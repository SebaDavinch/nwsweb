import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MapPin,
  Plane,
  PlaneTakeoff,
  LayoutGrid,
  List,
  Check,
  Navigation,
  Clock,
  Ruler,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "../../context/language-context";
import { useNotifications } from "../../context/notifications-context";
import { Button } from "../ui/button";
import { FlightMap, type Airport, type Route as FlightMapRoute, type SelectableRoute } from "./flight-map";
import { getFlagUri, icaoToCountry } from "./flag-data";

interface RouteOption {
  id: number;
  flightNumber?: string;
  callsign?: string;
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

const upper = (v: unknown) => String(v || "").trim().toUpperCase();

const defaultDepartureTime = () => {
  const d = new Date(Date.now() + 40 * 60 * 1000);
  // datetime-local format: YYYY-MM-DDTHH:MM
  return d.toISOString().slice(0, 16);
};

function Flag({ icao, className = "h-3.5 w-5" }: { icao?: string; className?: string }) {
  const code = icaoToCountry(icao || "");
  const uri = code ? getFlagUri(code) : "";
  if (!uri) return null;
  return <img src={uri} alt={code} className={`inline-block rounded-[2px] border border-black/10 object-cover ${className}`} />;
}

type Step = "map" | "flights";

function FlightCard({
  route,
  selected,
  onSelect,
  aircraftModels,
  tr,
}: {
  route: RouteOption;
  selected: boolean;
  onSelect: () => void;
  aircraftModels?: string[];
  tr: (ru: string, en: string) => string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group relative overflow-hidden rounded-xl border bg-white p-4 text-left transition-all dark:bg-white/5 ${
        selected ? "border-[#E31E24] shadow-md ring-1 ring-[#E31E24]/30" : "border-gray-200 hover:border-[#E31E24]/40 hover:shadow-sm dark:border-white/10 dark:hover:border-[#E31E24]/40"
      }`}
    >
      {selected ? <div className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-[#E31E24] text-white"><Check className="h-3.5 w-3.5" /></div> : null}
      <div className="flex items-center gap-2">
        <span className="font-mono text-lg font-bold text-gray-900 dark:text-zinc-100">{route.flightNumber || route.callsign}</span>
        <span className="rounded bg-gray-100 px-2 py-0.5 text-[11px] font-semibold uppercase text-gray-600 dark:bg-white/10 dark:text-zinc-300">{route.airlineCode || "NWS"}</span>
      </div>
      <div className="mt-2 flex items-center gap-2 text-sm text-gray-700 dark:text-zinc-200">
        <Flag icao={route.fromCode} />
        <span className="font-mono font-semibold">{route.fromCode}</span>
        <div className="mx-1 h-px flex-1 bg-gradient-to-r from-gray-300 to-gray-200 dark:from-white/20 dark:to-white/5" />
        <Plane className="h-3.5 w-3.5 text-[#E31E24]" />
        <div className="mx-1 h-px flex-1 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-white/5 dark:to-white/20" />
        <Flag icao={route.toCode} />
        <span className="font-mono font-semibold">{route.toCode}</span>
      </div>
      <div className="mt-2 truncate text-xs text-gray-400 dark:text-zinc-500">
        {route.fromName} → {route.toName}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-3 text-xs text-gray-500 dark:text-zinc-400">
        {route.distance ? <span className="inline-flex items-center gap-1"><Ruler className="h-3 w-3" />{route.distance}</span> : null}
        {route.duration ? <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{route.duration}</span> : null}
        {route.frequency ? <span className="inline-flex items-center gap-1"><Navigation className="h-3 w-3" />{route.frequency}</span> : null}
        <span className="ml-auto font-medium text-[#E31E24] opacity-0 transition-opacity group-hover:opacity-100">{tr("Выбрать →", "Select →")}</span>
      </div>
      {aircraftModels && aircraftModels.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {aircraftModels.map((m) => (
            <span key={m} className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] text-gray-500 dark:bg-white/10 dark:text-zinc-400">{m}</span>
          ))}
        </div>
      )}
    </button>
  );
}

export function PilotDispatch({ variant = "site" }: { variant?: "site" | "app" }) {
  const { t, language } = useLanguage();
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);
  const navigate = useNavigate();
  const { addNotification } = useNotifications();
  const inApp = variant === "app";
  // Куда возвращаться/уходить после брони — зависит от контекста (сайт ЛК vs приложение).
  const bookingsTo = inApp ? "/app/flight" : "/dashboard?tab=my-flights";

  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [aircraft, setAircraft] = useState<AircraftOption[]>([]);
  const [locationCode, setLocationCode] = useState("");
  const [locationLabel, setLocationLabel] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [step, setStep] = useState<Step>("map");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [hoverAirport, setHoverAirport] = useState<string | null>(null);
  const [destinationCode, setDestinationCode] = useState("");
  const [view, setView] = useState<"cards" | "list">("cards");

  // Выбор рейса/ВС/времени (экран подтверждения).
  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null);
  const [aircraftId, setAircraftId] = useState<number | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [departureTime, setDepartureTime] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [movingTo, setMovingTo] = useState("");
  const [syncingLocation, setSyncingLocation] = useState(false);

  const syncLocation = async () => {
    setSyncingLocation(true);
    try {
      const locRes = await fetch("/api/pilot/location?force=true", { credentials: "include" });
      const locP = await locRes.json().catch(() => null);
      const code = upper(locP?.airportCode);
      setLocationCode(code);
      setLocationLabel(String(locP?.locationLabel || "").trim());
    } finally {
      setSyncingLocation(false);
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const [routesRes, fleetRes, locRes] = await Promise.all([
        fetch("/api/vamsys/routes", { credentials: "include" }),
        fetch("/api/vamsys/fleet", { credentials: "include" }),
        fetch("/api/pilot/location", { credentials: "include" }),
      ]);
      const routesP = await routesRes.json().catch(() => null);
      const fleetP = await fleetRes.json().catch(() => null);
      const locP = await locRes.json().catch(() => null);

      setRoutes(Array.isArray(routesP?.routes) ? routesP.routes : []);
      setAircraft(
        Array.isArray(fleetP?.fleets)
          ? fleetP.fleets.flatMap((fleet: any) =>
              (Array.isArray(fleet?.aircraft) ? fleet.aircraft : []).map((ac: any) => ({
                id: Number(ac?.id || 0) || 0,
                fleetId: Number(fleet?.id || 0) || 0,
                model: String(ac?.model || "Aircraft").trim() || "Aircraft",
                registration: String(ac?.registration || "").trim(),
                fleetName: String(fleet?.name || fleet?.code || "Fleet").trim() || "Fleet",
              }))
            )
          : []
      );
      const code = upper(locP?.airportCode);
      setLocationCode(code);
      setLocationLabel(String(locP?.locationLabel || "").trim());
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  // Аэропорт, из которого смотрим вылеты (по умолчанию — локация пилота, при ховере — другой).
  const focusCode = hoverAirport || locationCode;

  const routesFromFocus = useMemo(
    () => routes.filter((r) => upper(r.fromCode) === focusCode && upper(r.toCode) && Number.isFinite(Number(r.toLat)) && Number.isFinite(Number(r.toLon))),
    [routes, focusCode]
  );

  const originAirport = useMemo<Airport | null>(() => {
    const src = routes.find((r) => upper(r.fromCode) === focusCode);
    const lat = Number(src?.fromLat);
    const lon = Number(src?.fromLon);
    if (!src || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return {
      icao: upper(src.fromCode) || undefined,
      name: String(src.fromName || focusCode || "").trim(),
      lat,
      lon,
    };
  }, [routes, focusCode]);

  // Направления (уникальные аэропорты прилёта) из текущего фокуса.
  const destinations = useMemo(() => {
    const map = new Map<string, { code: string; name: string; lat: number; lon: number; count: number }>();
    for (const r of routesFromFocus) {
      const code = upper(r.toCode);
      const existing = map.get(code);
      if (existing) existing.count += 1;
      else
        map.set(code, {
          code,
          name: String(r.toName || code).trim(),
          lat: Number(r.toLat),
          lon: Number(r.toLon),
          count: 1,
        });
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [routesFromFocus]);

  const mapRoutes = useMemo<SelectableRoute[]>(() => {
    if (!originAirport) return [];
    return routesFromFocus.map((r) => ({
      id: String(r.id),
      from: originAirport,
      to: {
        icao: upper(r.toCode) || undefined,
        name: String(r.toName || r.toCode || "").trim(),
        lat: Number(r.toLat),
        lon: Number(r.toLon),
      },
      label: `${r.flightNumber || r.callsign || `Route ${r.id}`} · ${r.fromCode} → ${r.toCode}`,
      active: upper(r.toCode) === destinationCode,
    }));
  }, [originAirport, routesFromFocus, destinationCode]);

  // Рейсы к выбранному направлению.
  const flightsToDestination = useMemo(
    () =>
      routes
        .filter((r) => upper(r.fromCode) === locationCode && upper(r.toCode) === destinationCode)
        .sort((a, b) => String(a.flightNumber || a.callsign || "").localeCompare(String(b.flightNumber || b.callsign || ""))),
    [routes, locationCode, destinationCode]
  );

  const selectedRoute = useMemo(
    () => flightsToDestination.find((r) => r.id === selectedRouteId) || null,
    [flightsToDestination, selectedRouteId]
  );

  // Флот, доступный для выбранного маршрута.
  const routeAircraft = useMemo(() => {
    if (!selectedRoute) return [];
    if (!Array.isArray(selectedRoute.fleetIds) || !selectedRoute.fleetIds.length) return aircraft;
    return aircraft.filter((a) => selectedRoute.fleetIds?.includes(a.fleetId));
  }, [aircraft, selectedRoute]);

  // Уникальные типы ВС (для фильтра и карточек маршрутов)
  const routeAircraftTypes = useMemo(
    () => [...new Set(routeAircraft.map((a) => a.model).filter(Boolean))],
    [routeAircraft]
  );

  const filteredAircraft = useMemo(
    () => (typeFilter ? routeAircraft.filter((a) => a.model === typeFilter) : routeAircraft),
    [routeAircraft, typeFilter]
  );

  // Map fleetId → уникальные модели (для карточек в списке рейсов)
  const fleetModelsMap = useMemo(() => {
    const map = new Map<number, string[]>();
    for (const a of aircraft) {
      if (!map.has(a.fleetId)) map.set(a.fleetId, []);
      const list = map.get(a.fleetId)!;
      if (!list.includes(a.model)) list.push(a.model);
    }
    return map;
  }, [aircraft]);

  const getRouteAircraftModels = (route: RouteOption): string[] => {
    if (!Array.isArray(route.fleetIds) || !route.fleetIds.length) return [];
    const models = new Set<string>();
    for (const fid of route.fleetIds) {
      for (const m of fleetModelsMap.get(fid) ?? []) models.add(m);
    }
    return [...models];
  };

  const selectedMapRoute = useMemo<FlightMapRoute | null>(() => {
    if (!selectedRoute) return null;
    const fromLat = Number(selectedRoute.fromLat);
    const fromLon = Number(selectedRoute.fromLon);
    const toLat = Number(selectedRoute.toLat);
    const toLon = Number(selectedRoute.toLon);
    if (![fromLat, fromLon, toLat, toLon].every(Number.isFinite)) return null;
    return {
      id: String(selectedRoute.id),
      airline: String(selectedRoute.airlineCode || "NWS"),
      legs: [
        {
          from: { icao: upper(selectedRoute.fromCode), name: String(selectedRoute.fromName || "").trim(), lat: fromLat, lon: fromLon },
          to: { icao: upper(selectedRoute.toCode), name: String(selectedRoute.toName || "").trim(), lat: toLat, lon: toLon },
          distance: 0,
          duration: 0,
        },
      ],
      totalDistance: 0,
      totalDuration: 0,
      aircraft: String(selectedRoute.flightNumber || selectedRoute.callsign || ""),
    };
  }, [selectedRoute]);

  // ── Действия ──
  const chooseDestination = (code: string) => {
    const normalized = upper(code);
    setDestinationCode(normalized);
    setHoverAirport(null);
    // Если из текущей локации к этому пункту единственный рейс — сразу выбрать его.
    const toThere = routes.filter((r) => upper(r.fromCode) === locationCode && upper(r.toCode) === normalized);
    setSelectedRouteId(toThere.length === 1 ? toThere[0].id : null);
    setAircraftId(null);
    setTypeFilter("");
    setDepartureTime(defaultDepartureTime());
    setStep("flights");
  };

  const backToMap = () => {
    setStep("map");
    setSelectedRouteId(null);
    setAircraftId(null);
    setTypeFilter("");
    setDepartureTime("");
  };

  const moveToAirport = async (code: string) => {
    const normalized = upper(code);
    if (!normalized) return;
    setMovingTo(normalized);
    try {
      const res = await fetch("/api/pilot/location", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ airportCode: normalized }),
      });
      const p = await res.json().catch(() => null);
      if (!res.ok || !p?.ok) throw new Error(p?.error || tr("Не удалось переместиться", "Move failed"));
      setLocationCode(upper(p.airportCode) || normalized);
      setLocationLabel(String(p.locationLabel || "").trim());
      setDestinationCode("");
      setStep("map");
      toast.success(tr(`Вы перемещены в ${normalized}`, `Moved to ${normalized}`));
    } catch (e) {
      toast.error(String(e instanceof Error ? e.message : e));
    } finally {
      setMovingTo("");
    }
  };

  const dispatchBooking = async () => {
    if (!selectedRoute || !aircraftId) {
      toast.error(tr("Выберите рейс и воздушное судно", "Select a flight and aircraft"));
      return;
    }
    const dep = departureTime ? new Date(`${departureTime}:00Z`) : new Date(Date.now() + 60 * 60 * 1000);
    setSubmitting(true);
    try {
      const res = await fetch("/api/pilot/bookings", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ routeId: selectedRoute.id, aircraftId, departureTime: dep.toISOString() }),
      });
      const p = await res.json().catch(() => null);
      if (!res.ok) throw new Error(p?.error || tr("Не удалось создать бронь", "Booking failed"));
      addNotification({
        category: "booking",
        title: tr("Бронь создана", "Booking created"),
        description: `${selectedRoute.flightNumber || selectedRoute.callsign} · ${selectedRoute.fromCode} → ${selectedRoute.toCode}`,
      });
      toast.success(tr("Рейс забронирован", "Flight booked"));
      navigate(bookingsTo);
    } catch (e) {
      toast.error(String(e instanceof Error ? e.message : e));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[70vh] items-center justify-center gap-2 text-sm text-gray-500 dark:text-zinc-400">
        <Loader2 className="h-5 w-5 animate-spin" />
        {tr("Загрузка диспетчеризации…", "Loading dispatch…")}
      </div>
    );
  }

  return (
    <div className={`flex flex-col overflow-hidden border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-zinc-900 ${inApp ? "h-full border-0 rounded-none" : "h-[calc(100vh-2rem)] rounded-2xl border"}`}>
      {/* Шапка */}
      <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 dark:border-white/10">
        <div className="flex items-center gap-3">
          {step === "flights" ? (
            <Button variant="ghost" size="sm" onClick={backToMap}>
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              {tr("К карте", "Back to map")}
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => navigate(bookingsTo)}>
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              {inApp ? tr("Полёт", "Flight") : tr("Брони", "Bookings")}
            </Button>
          )}
          <div className="flex items-center gap-2">
            <PlaneTakeoff className="h-5 w-5 text-[#E31E24]" />
            <span className="font-bold text-gray-900 dark:text-zinc-100">{tr("Диспетчеризация", "Dispatch")}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-zinc-400">
          <MapPin className="h-4 w-4 text-[#E31E24]" />
          <Flag icao={locationCode} />
          <span className="font-mono font-semibold text-gray-800 dark:text-zinc-200">{locationCode || "—"}</span>
          {locationLabel ? <span className="hidden sm:inline">· {locationLabel}</span> : null}
          <button
            type="button"
            onClick={() => void syncLocation()}
            disabled={syncingLocation}
            title={tr("Синхронизировать локацию с vAMSYS", "Sync location with vAMSYS")}
            className="ml-1 rounded p-0.5 text-gray-400 transition hover:text-[#E31E24] disabled:opacity-40"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncingLocation ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {error ? (
        <div className="flex flex-1 items-center justify-center text-sm text-gray-500 dark:text-zinc-400">
          {tr("Не удалось загрузить данные. Обновите страницу.", "Failed to load data. Refresh the page.")}
        </div>
      ) : step === "map" ? (
        <div className="relative flex flex-1 overflow-hidden isolate">
          {/* Сайдбар */}
          <div className={`relative z-[1000] flex flex-col border-r border-gray-100 bg-white transition-all dark:border-white/10 dark:bg-zinc-900 ${sidebarOpen ? "w-72" : "w-0"}`}>
            {sidebarOpen ? (
              <>
                <div className="border-b border-gray-100 p-3 dark:border-white/10">
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-zinc-500">
                    {hoverAirport ? tr("Рейсы из", "Flights from") : tr("Вылеты из вашей локации", "Departures from your location")}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <Flag icao={focusCode} />
                    <span className="font-mono text-lg font-bold text-gray-900 dark:text-zinc-100">{focusCode || "—"}</span>
                    <span className="ml-auto rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600 dark:bg-white/10 dark:text-zinc-300">
                      {destinations.length} {tr("напр.", "dest.")}
                    </span>
                  </div>
                  {hoverAirport && hoverAirport !== locationCode ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2 w-full"
                      onClick={() => void moveToAirport(hoverAirport)}
                      disabled={Boolean(movingTo)}
                    >
                      {movingTo === hoverAirport ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Navigation className="mr-1.5 h-3.5 w-3.5" />}
                      {tr(`Переместиться в ${hoverAirport}`, `Move to ${hoverAirport}`)}
                    </Button>
                  ) : null}
                </div>
                <div className="nws-scroll-hover flex-1 overflow-y-auto p-2">
                  {destinations.length === 0 ? (
                    <div className="px-3 py-8 text-center text-sm text-gray-400 dark:text-zinc-500">
                      {tr("Из этого аэропорта нет маршрутов.", "No routes from this airport.")}
                    </div>
                  ) : (
                    destinations.map((d) => (
                      <button
                        key={d.code}
                        type="button"
                        onMouseEnter={() => setHoverAirport(focusCode === locationCode ? null : focusCode)}
                        onClick={() => chooseDestination(d.code)}
                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors hover:bg-gray-50 dark:hover:bg-white/5"
                      >
                        <Flag icao={d.code} />
                        <div className="min-w-0 flex-1">
                          <div className="font-mono text-sm font-semibold text-gray-900 dark:text-zinc-100">{d.code}</div>
                          <div className="truncate text-xs text-gray-500 dark:text-zinc-400">{d.name}</div>
                        </div>
                        <span className="rounded-full bg-[#E31E24]/10 px-2 py-0.5 text-[11px] font-bold text-[#E31E24] dark:text-red-300">{d.count}</span>
                        <ChevronRight className="h-4 w-4 text-gray-300 dark:text-zinc-600" />
                      </button>
                    ))
                  )}
                </div>
              </>
            ) : null}
            <button
              type="button"
              onClick={() => setSidebarOpen((v) => !v)}
              className="absolute -right-3 top-3 z-[1001] flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-sm hover:bg-gray-50 dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              title={sidebarOpen ? tr("Свернуть", "Collapse") : tr("Развернуть", "Expand")}
            >
              {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          </div>

          {/* Карта */}
          <div className="relative flex-1">
            <FlightMap
              route={null}
              availableRoutes={mapRoutes}
              originAirport={originAirport}
              selectedAirportCode={destinationCode || null}
              showOriginMarker
              theme={inApp ? "dark" : "light"}
              onAirportSelect={(code) => chooseDestination(code)}
            />
          </div>
        </div>
      ) : (
        // ── Экран выбора рейса ──
        <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
          <div className="nws-scroll-hover flex-1 overflow-y-auto p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-zinc-100">
                <Flag icao={locationCode} className="h-4 w-6" />
                <span className="font-mono">{locationCode}</span>
                <Plane className="h-4 w-4 text-gray-400" />
                <Flag icao={destinationCode} className="h-4 w-6" />
                <span className="font-mono">{destinationCode}</span>
                <span className="ml-2 text-sm font-normal text-gray-400 dark:text-zinc-500">
                  {flightsToDestination.length} {tr("рейс(ов)", "flight(s)")}
                </span>
              </div>
              <div className="flex items-center gap-1 rounded-lg border border-gray-200 p-0.5 dark:border-white/10">
                <Button variant={view === "cards" ? "default" : "ghost"} size="sm" className={view === "cards" ? "bg-[#E31E24] hover:bg-[#c41a20] text-white" : "text-gray-600 dark:text-zinc-300"} onClick={() => setView("cards")}>
                  <LayoutGrid className="mr-1.5 h-4 w-4" />
                  {tr("Карточки", "Cards")}
                </Button>
                <Button variant={view === "list" ? "default" : "ghost"} size="sm" className={view === "list" ? "bg-[#E31E24] hover:bg-[#c41a20] text-white" : "text-gray-600 dark:text-zinc-300"} onClick={() => setView("list")}>
                  <List className="mr-1.5 h-4 w-4" />
                  {tr("Список", "List")}
                </Button>
              </div>
            </div>

            {flightsToDestination.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 px-5 py-10 text-center text-sm text-gray-400 dark:border-white/10 dark:text-zinc-500">
                {tr("Рейсов по этому направлению нет.", "No flights for this destination.")}
              </div>
            ) : view === "cards" ? (
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                {flightsToDestination.map((r) => (
                  <FlightCard key={r.id} route={r} selected={r.id === selectedRouteId} onSelect={() => { setSelectedRouteId(r.id); setAircraftId(null); setTypeFilter(""); setDepartureTime(defaultDepartureTime()); }} aircraftModels={getRouteAircraftModels(r)} tr={tr} />
                ))}
              </div>
            ) : (
              <div className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 dark:divide-white/10 dark:border-white/10">
                {flightsToDestination.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => { setSelectedRouteId(r.id); setAircraftId(null); setTypeFilter(""); setDepartureTime(defaultDepartureTime()); }}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${r.id === selectedRouteId ? "bg-[#E31E24]/5 dark:bg-[#E31E24]/10" : "hover:bg-gray-50 dark:hover:bg-white/5"}`}
                  >
                    <div className="font-mono font-bold text-gray-900 dark:text-zinc-100">{r.flightNumber || r.callsign}</div>
                    <div className="text-sm text-gray-500 dark:text-zinc-400">{r.fromCode} → {r.toCode}</div>
                    <div className="ml-auto flex items-center gap-3 text-xs text-gray-400 dark:text-zinc-500">
                      {r.distance ? <span className="inline-flex items-center gap-1"><Ruler className="h-3 w-3" />{r.distance}</span> : null}
                      {r.duration ? <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{r.duration}</span> : null}
                    </div>
                    {r.id === selectedRouteId ? <Check className="h-4 w-4 text-[#E31E24]" /> : null}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Панель подтверждения */}
          <div className="w-full shrink-0 border-t border-gray-100 bg-gray-50/60 p-4 lg:w-96 lg:border-l lg:border-t-0 dark:border-white/10 dark:bg-white/[0.02]">
            {selectedRoute ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
                  <div className="flex items-center justify-between">
                    <div className="font-mono text-lg font-bold text-gray-900 dark:text-zinc-100">{selectedRoute.flightNumber || selectedRoute.callsign}</div>
                    <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600 dark:bg-white/10 dark:text-zinc-300">{selectedRoute.airlineCode || "NWS"}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-sm text-gray-600 dark:text-zinc-300">
                    <Flag icao={selectedRoute.fromCode} /> <span className="font-mono">{selectedRoute.fromCode}</span>
                    <Plane className="h-3.5 w-3.5 text-gray-300 dark:text-zinc-600" />
                    <Flag icao={selectedRoute.toCode} /> <span className="font-mono">{selectedRoute.toCode}</span>
                  </div>
                  <div className="mt-2 flex gap-4 text-xs text-gray-400 dark:text-zinc-500">
                    {selectedRoute.distance ? <span className="inline-flex items-center gap-1"><Ruler className="h-3 w-3" />{selectedRoute.distance}</span> : null}
                    {selectedRoute.duration ? <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{selectedRoute.duration}</span> : null}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400">{tr("Воздушное судно", "Aircraft")}</label>
                  {routeAircraft.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-gray-200 px-3 py-3 text-center text-xs text-gray-400 dark:border-white/10 dark:text-zinc-500">
                      {tr("Нет доступного флота для маршрута.", "No aircraft available for this route.")}
                    </div>
                  ) : (
                    <>
                      {routeAircraftTypes.length > 1 && (
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() => { setTypeFilter(""); setAircraftId(null); }}
                            className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${!typeFilter ? "bg-[#E31E24] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-white/10 dark:text-zinc-300"}`}
                          >
                            {tr("Все", "All")}
                          </button>
                          {routeAircraftTypes.map((t) => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => { setTypeFilter(t); setAircraftId(null); }}
                              className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${typeFilter === t ? "bg-[#E31E24] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-white/10 dark:text-zinc-300"}`}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      )}
                      <div className="nws-scroll-hover max-h-44 space-y-1 overflow-y-auto rounded-lg border border-gray-200 bg-white p-1 dark:border-white/10 dark:bg-white/5">
                        {filteredAircraft.map((a) => (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => setAircraftId(a.id)}
                            className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors ${a.id === aircraftId ? "bg-[#E31E24]/10 text-[#E31E24] dark:text-red-300" : "hover:bg-gray-50 text-gray-700 dark:text-zinc-300 dark:hover:bg-white/5"}`}
                          >
                            <Plane className="h-3.5 w-3.5 shrink-0" />
                            {routeAircraftTypes.length > 1 || !typeFilter
                              ? <span className="font-medium">{a.model}</span>
                              : null}
                            {a.registration ? <span className="font-mono text-xs text-gray-400 dark:text-zinc-500">{a.registration}</span> : null}
                            {a.id === aircraftId ? <Check className="ml-auto h-4 w-4" /> : null}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400">{tr("Время вылета (UTC)", "Departure (UTC)")}</label>
                  <input
                    type="datetime-local"
                    value={departureTime}
                    onChange={(e) => setDepartureTime(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#E31E24] focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-zinc-100 dark:[color-scheme:dark]"
                  />
                  <p className="text-[11px] text-gray-400 dark:text-zinc-500">{tr("Предзаполнено: текущее время + 40 мин (UTC).", "Pre-filled: current time + 40 min (UTC).")}</p>
                </div>

                <Button
                  className="w-full bg-[#E31E24] hover:bg-[#c41a20] text-white"
                  disabled={!aircraftId || submitting}
                  onClick={() => void dispatchBooking()}
                >
                  {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlaneTakeoff className="mr-2 h-4 w-4" />}
                  {tr("Подтвердить и забронировать", "Confirm & book")}
                </Button>
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-sm text-gray-400 dark:text-zinc-500">
                <Plane className="h-10 w-10 text-gray-200 dark:text-zinc-700" />
                {tr("Выберите рейс слева, чтобы продолжить.", "Select a flight on the left to continue.")}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
