import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../context/language-context";
import { Plane, Clock, ChevronLeft, ChevronRight, Radio } from "lucide-react";
import { LiveMap } from "./live-map";

interface Flight {
  id?: number | null;
  callsign?: string;
  flightNumber: string;
  departure: string;
  departureCity: string;
  destination: string;
  destinationCity: string;
  status: string;
  pilot: string;
  pilotId: string | number | null;
  aircraft: string;
  progress: number;
  duration?: string;
  completedDate?: string;
  completedTime?: string;
  vac: "NWS" | "KAR" | "STW"; // Virtual Airline Code
  etd?: string; // Estimated Time of Departure
  ete?: string; // Estimated Time En route
  eta?: string; // Estimated Time of Arrival
  heading?: number | null;
  speed?: number | null;
  altitude?: number | null;
  currentLat?: number | null;
  currentLon?: number | null;
  passengers?: number | null;
  aircraftRegistration?: string;
  network?: string;
  hasLiveTelemetry?: boolean;
  telemetryTrack?: Array<
    [number, number] |
    {
      lat: number;
      lon: number;
      altitude?: number | null;
      heading?: number | null;
      ts?: number | null;
    }
  >;
  departureLat?: number | null;
  departureLon?: number | null;
  arrivalLat?: number | null;
  arrivalLon?: number | null;
}

const LIVE_REFRESH_ACTIVE_MS = 100;
const LIVE_REFRESH_IDLE_MS = 30000;
const TELEMETRY_SMOOTH_MS = 16;
const ACTIVE_FLIGHTS_UI_GRACE_MS = 15000;
const ACTIVE_FLIGHTS_RENDER_GRACE_MS = 120000;

const getFlightKey = (flight: Flight) => `${flight.flightNumber || ""}:${String(flight.pilotId || "")}`;

const toFiniteOrNull = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const deriveVac = (rawFlightNumber: string, rawPilotVaId?: string) => {
  const source = `${rawFlightNumber || ""} ${rawPilotVaId || ""}`.toUpperCase();
  if (source.includes("KAR")) return "KAR";
  if (source.includes("STW")) return "STW";
  return "NWS";
};

const resolveCallsignLabel = (row: Record<string, unknown>) =>
  String(
    row.callsign ||
      row.flightNumber ||
      row.flight_number ||
      row.flightNo ||
      row.number ||
      ""
  )
    .trim()
    .toUpperCase();

const resolveAircraftLabel = (row: Record<string, unknown>) => {
  const aircraftNode =
    row.aircraft && typeof row.aircraft === "object"
      ? (row.aircraft as Record<string, unknown>)
      : {};

  return (
    String(
      (typeof row.aircraft === "string" ? row.aircraft : "") ||
        row.aircraftLabel ||
        row.aircraft_label ||
        row.aircraft_name ||
        row.aircraft_type ||
        row.aircraftType ||
        row.type ||
        row.model ||
        row.aircraftRegistration ||
        row.aircraft_registration ||
        row.registration ||
        row.tail ||
        aircraftNode.name ||
        aircraftNode.type ||
        aircraftNode.registration ||
        ""
    ).trim() || "—"
  );
};

const resolveNetworkLabel = (row: Record<string, unknown>) =>
  String(
    row.network ||
      row.networkType ||
      row.network_type ||
      row.onlineNetwork ||
      ""
  )
    .trim()
    .toUpperCase();

const resolvePassengers = (row: Record<string, unknown>) => {
  const candidates = [
    row.passengers,
    row.pax,
    row.passengerCount,
    row.passenger_count,
    row.bookedPassengers,
    row.booked_passengers,
  ];

  for (const candidate of candidates) {
    const numeric = Number(candidate);
    if (Number.isFinite(numeric) && numeric >= 0) {
      return Math.round(numeric);
    }
  }

  return null;
};

const interpolateNumber = (fromValue: unknown, toValue: unknown, factor: number) => {
  const from = Number(fromValue);
  const to = Number(toValue);
  if (Number.isFinite(from) && Number.isFinite(to)) {
    return from + (to - from) * factor;
  }
  if (Number.isFinite(to)) {
    return to;
  }
  if (Number.isFinite(from)) {
    return from;
  }
  return null;
};

const interpolateHeading = (fromValue: unknown, toValue: unknown, factor: number) => {
  const from = Number(fromValue);
  const to = Number(toValue);
  if (!Number.isFinite(from) && Number.isFinite(to)) return to;
  if (Number.isFinite(from) && !Number.isFinite(to)) return from;
  if (!Number.isFinite(from) && !Number.isFinite(to)) return null;

  let delta = to - from;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  let next = from + delta * factor;
  if (next < 0) next += 360;
  if (next >= 360) next -= 360;
  return next;
};

type JsonRecord = Record<string, unknown>;

const toRecord = (value: unknown): JsonRecord =>
  value && typeof value === "object" ? (value as JsonRecord) : {};

export function LiveFlights() {
  const { t, language } = useLanguage();
  const ru = language === "ru";
  const tr = (r: string, e: string) => (ru ? r : e);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedVAC, setSelectedVAC] = useState<"ALL" | "NWS" | "KAR" | "STW">("ALL");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedFlight, setSelectedFlight] = useState<Flight | null>(null);
  const [activeFlights, setActiveFlights] = useState<Flight[]>([]);
  const [targetActiveFlights, setTargetActiveFlights] = useState<Flight[]>([]);
  const [completedFlights, setCompletedFlights] = useState<Flight[]>([]);
  const [isLoadingFlights, setIsLoadingFlights] = useState(true);
  const [hasFlightsError, setHasFlightsError] = useState(false);
  const lastNonEmptyActiveRef = useRef<{ flights: Flight[]; updatedAt: number }>({
    flights: [],
    updatedAt: 0,
  });
  const lastNonEmptyTargetRef = useRef<{ flights: Flight[]; updatedAt: number }>({
    flights: [],
    updatedAt: 0,
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let mounted = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const scheduleNextLoad = (delayMs: number) => {
      if (!mounted) {
        return;
      }
      if (timer) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => {
        void loadFlights();
      }, Math.max(80, Number(delayMs) || LIVE_REFRESH_IDLE_MS));
    };

    const mapActiveFlight = (item: unknown): Flight => {
      const row = toRecord(item);
      const flightNumber = String(row.flightNumber || row.callsign || row.flight_number || "").trim();
      const vac = deriveVac(flightNumber, String(row.pilotVaId || row.airline || ""));
      const telemetryTrack = Array.isArray(row.telemetryTrack)
        ? row.telemetryTrack
            .flatMap((point: unknown) => {
              const pointRecord = toRecord(point);
              if (Array.isArray(point) && point.length >= 2) {
                const lat = Number(point[0]);
                const lon = Number(point[1]);
                if (Number.isFinite(lat) && Number.isFinite(lon)) {
                  return [{
                    lat,
                    lon,
                    altitude: null,
                    heading: null,
                    ts: null,
                  }];
                }
              }

              if (pointRecord) {
                const lat = Number(
                  pointRecord.lat ?? pointRecord.latitude ?? pointRecord.currentLat ?? pointRecord.positionLat ?? pointRecord.y
                );
                const lon = Number(
                  pointRecord.lon ?? pointRecord.lng ?? pointRecord.longitude ?? pointRecord.currentLon ?? pointRecord.positionLon ?? pointRecord.x
                );
                if (Number.isFinite(lat) && Number.isFinite(lon)) {
                  return [{
                    lat,
                    lon,
                    altitude: toFiniteOrNull(
                      pointRecord.altitude ?? pointRecord.altitudeFt ?? pointRecord.altitude_ft ?? pointRecord.flightLevel
                    ),
                    heading: toFiniteOrNull(
                      pointRecord.heading ?? pointRecord.magneticHeading ?? pointRecord.magnetic_heading ?? pointRecord.track ?? pointRecord.course
                    ),
                    ts: toFiniteOrNull(
                      pointRecord.ts ?? pointRecord.timestamp ?? pointRecord.time ?? pointRecord.created_at ?? pointRecord.createdAt
                    ),
                  }];
                }
              }

              return [];
            })
        : [];

      return {
        id: toFiniteOrNull(row.id),
        callsign: resolveCallsignLabel(row) || undefined,
        flightNumber: flightNumber || "—",
        departure: String(row.departure || "—").trim() || "—",
        departureCity: String(row.departureCity || row.departure_city || "—").trim() || "—",
        destination: String(row.destination || row.arrival || "—").trim() || "—",
        destinationCity: String(row.destinationCity || row.arrivalCity || row.destination_city || "—").trim() || "—",
        status: String(row.status || "En Route").trim() || "En Route",
        pilot: String(row.pilot || "—").trim() || "—",
        pilotId: String(row.pilotId || "—").trim() || "—",
        aircraft: resolveAircraftLabel(row),
        progress: Number.isFinite(Number(row.progress)) ? Math.max(0, Math.min(100, Number(row.progress))) : 0,
        vac,
        etd: String(row.time || "").trim() || undefined,
        eta: String(row.eta || row.estimatedArrivalTime || "").trim() || undefined,
        ete: String(row.remainingTime || "").trim() || undefined,
        heading: toFiniteOrNull(row.heading),
        speed: toFiniteOrNull(row.speed),
        altitude: toFiniteOrNull(row.altitude),
        currentLat: toFiniteOrNull(row.currentLat),
        currentLon: toFiniteOrNull(row.currentLon),
        passengers: resolvePassengers(row),
        aircraftRegistration:
          String(
            row.aircraftRegistration ||
              row.aircraft_registration ||
              row.registration ||
              row.tail ||
              ""
          ).trim() || undefined,
        network: resolveNetworkLabel(row) || undefined,
        hasLiveTelemetry: Boolean(row.hasLiveTelemetry),
        telemetryTrack,
        departureLat: toFiniteOrNull(row.departureLat),
        departureLon: toFiniteOrNull(row.departureLon),
        arrivalLat: toFiniteOrNull(row.arrivalLat),
        arrivalLon: toFiniteOrNull(row.arrivalLon),
      };
    };

    const mapCompletedFlight = (item: unknown): Flight => {
      const row = toRecord(item);
      const flightNumber = String(row.flightNumber || row.callsign || row.flight_number || "").trim();
      const vac = deriveVac(flightNumber, String(row.pilotVaId || row.airline || ""));
          const pilotName =
            String(
              row.pilot ||
                row.pilotName ||
                row.pilot_name ||
                row.name ||
                row.username ||
                ""
            ).trim() || "—";
      return {
        id: toFiniteOrNull(row.id),
        callsign: resolveCallsignLabel(row) || undefined,
        flightNumber: flightNumber || "—",
        departure: String(row.departure || "—").trim() || "—",
        departureCity: String(row.departureCity || "—").trim() || "—",
        destination: String(row.destination || row.arrival || "—").trim() || "—",
        destinationCity: String(row.destinationCity || row.arrivalCity || "—").trim() || "—",
        status: String(row.status || "Completed").trim() || "Completed",
        pilot: pilotName,
        pilotId: String(row.pilotId || row.pilot_id || "—").trim() || "—",
        aircraft: resolveAircraftLabel(row),
        progress: 100,
        duration: String(row.duration || "—").trim() || "—",
        completedDate: String(row.completedDate || "").trim() || "",
        completedTime: String(row.completedTime || "").trim() || "",
        vac,
      };
    };

    const loadFlights = async () => {
      let nextDelayMs = LIVE_REFRESH_IDLE_MS;
      if (mounted) {
        setHasFlightsError(false);
      }
      try {
        const [activeResponse, completedResponse] = await Promise.all([
          fetch("/api/vamsys/flight-map", { credentials: "include" }),
          fetch("/api/vamsys/completed-flights?limit=12", { credentials: "include" }),
        ]);

        const activePayload = activeResponse.ok ? await activeResponse.json() : { flights: [] };
        const completedPayload = completedResponse.ok ? await completedResponse.json() : { flights: [] };

        const active = Array.isArray(activePayload?.flights) ? activePayload.flights.map(mapActiveFlight) : [];
        const completed = Array.isArray(completedPayload?.flights) ? completedPayload.flights.map(mapCompletedFlight) : [];

        let stabilizedActive = active;
        if (active.length > 0) {
          lastNonEmptyActiveRef.current = {
            flights: active,
            updatedAt: Date.now(),
          };
        } else {
          const ageMs = Date.now() - Number(lastNonEmptyActiveRef.current.updatedAt || 0);
          if (lastNonEmptyActiveRef.current.flights.length > 0 && ageMs <= ACTIVE_FLIGHTS_UI_GRACE_MS) {
            stabilizedActive = lastNonEmptyActiveRef.current.flights;
          }
        }

        const hasAtLeastOneLive = stabilizedActive.some((flight: Flight) => Boolean(flight?.hasLiveTelemetry));
        nextDelayMs = hasAtLeastOneLive ? LIVE_REFRESH_ACTIVE_MS : LIVE_REFRESH_IDLE_MS;

        if (!mounted) return;

        setTargetActiveFlights(stabilizedActive);
        if (stabilizedActive.length > 0) {
          lastNonEmptyTargetRef.current = {
            flights: stabilizedActive,
            updatedAt: Date.now(),
          };
        }
        setCompletedFlights(completed);
        setActiveFlights((previous) => (previous.length ? previous : stabilizedActive));
      } catch {
        if (!mounted) return;
        setHasFlightsError(true);
        nextDelayMs = LIVE_REFRESH_IDLE_MS;
      } finally {
        if (mounted) {
          setIsLoadingFlights(false);
          scheduleNextLoad(nextDelayMs);
        }
      }
    };

    void loadFlights();

    return () => {
      mounted = false;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, []);

  useEffect(() => {
    const targetAgeMs = Date.now() - Number(lastNonEmptyTargetRef.current.updatedAt || 0);
    const effectiveTargetFlights = targetActiveFlights.length
      ? targetActiveFlights
      : targetAgeMs <= ACTIVE_FLIGHTS_RENDER_GRACE_MS
      ? lastNonEmptyTargetRef.current.flights
      : [];

    if (!effectiveTargetFlights.length) {
      setActiveFlights([]);
      return;
    }

    const timer = setInterval(() => {
      setActiveFlights((prev) => {
        if (!prev.length) {
          return effectiveTargetFlights;
        }

        const previousMap = new Map(prev.map((flight) => [getFlightKey(flight), flight]));
        return effectiveTargetFlights.map((targetFlight) => {
          const previous = previousMap.get(getFlightKey(targetFlight));
          if (!previous) {
            return targetFlight;
          }

          const hasLiveTrack =
            Boolean(targetFlight.hasLiveTelemetry) &&
            Array.isArray(targetFlight.telemetryTrack) &&
            targetFlight.telemetryTrack.length >= 2;

          const blendFactor = hasLiveTrack ? 0.08 : 0.35;

          return {
            ...targetFlight,
            progress: Math.max(
              0,
              Math.min(
                100,
                Number(interpolateNumber(previous.progress, targetFlight.progress, blendFactor) ?? targetFlight.progress)
              )
            ),
            currentLat: interpolateNumber(previous.currentLat, targetFlight.currentLat, blendFactor),
            currentLon: interpolateNumber(previous.currentLon, targetFlight.currentLon, blendFactor),
            heading: interpolateHeading(previous.heading, targetFlight.heading, blendFactor),
            speed: interpolateNumber(previous.speed, targetFlight.speed, blendFactor),
            altitude: interpolateNumber(previous.altitude, targetFlight.altitude, blendFactor),
          };
        });
      });
    }, TELEMETRY_SMOOTH_MS);

    return () => clearInterval(timer);
  }, [targetActiveFlights]);

  useEffect(() => {
    if (!selectedFlight) return;
    const selectedKey = getFlightKey(selectedFlight);
    const nextSelected = activeFlights.find((flight) => getFlightKey(flight) === selectedKey) || null;
    if (!nextSelected) {
      setSelectedFlight(null);
      return;
    }
    if (nextSelected !== selectedFlight) {
      setSelectedFlight(nextSelected);
    }
  }, [activeFlights, selectedFlight]);


  const filteredActiveFlights = selectedVAC === "ALL"
    ? activeFlights
    : activeFlights.filter(f => f.vac === selectedVAC);

  const filteredCompletedFlights = selectedVAC === "ALL"
    ? completedFlights
    : completedFlights.filter(f => f.vac === selectedVAC);

  const handleFlightSelect = (flight: Flight) => {
    setSelectedFlight(flight);
    setSidebarOpen(true);
  };

  const getVACColor = (vac: string) => {
    if (vac === "NWS") return "#E31E24";
    if (vac === "KAR") return "#2563eb";
    if (vac === "STW") return "#ea580c";
    return "#6b7280";
  };

  const utcTime = currentTime.toUTCString().slice(17, 25);

  return (
    <div className="flex flex-col h-[calc(100svh-68px)] bg-[#0d1117] overflow-hidden">
      {/* ── Top: sidebar + map ── */}
      <div className="flex flex-1 overflow-hidden relative">
      {/* ── Left Sidebar ── */}
      <aside
        className={`relative flex flex-col bg-[#111318] border-r border-white/6 transition-all duration-300 shrink-0 ${sidebarOpen ? "w-72" : "w-0"} overflow-hidden`}
      >
        <div className="flex flex-col h-full w-72">
          {/* Sidebar header */}
          <div className="flex items-center justify-between px-4 py-4 border-b border-white/6">
            <div>
              <div className="text-white font-bold text-sm" style={{ fontFamily: "var(--font-display)" }}>
                {tr("Живые полёты", "Live Flights")}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#E31E24] opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#E31E24]" />
                </span>
                <span className="text-white/40 text-[11px]">{filteredActiveFlights.length} {tr("рейсов", "flights")}</span>
              </div>
            </div>
          </div>

          {/* VAC filter */}
          <div className="flex gap-1 px-3 py-2 border-b border-white/6">
            {(["ALL", "NWS", "KAR", "STW"] as const).map((vac) => (
              <button
                key={vac}
                type="button"
                onClick={() => setSelectedVAC(vac)}
                className={`flex-1 text-[10px] font-bold uppercase tracking-wide rounded-lg py-1.5 transition-all ${
                  selectedVAC === vac
                    ? "bg-white/12 text-white"
                    : "text-white/35 hover:text-white/60 hover:bg-white/6"
                }`}
                style={selectedVAC === vac && vac !== "ALL" ? { color: getVACColor(vac) } : undefined}
              >
                {vac}
              </button>
            ))}
          </div>

          {/* Flight list */}
          <div className="flex-1 overflow-y-auto">
            {isLoadingFlights ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-5 h-5 border-2 border-[#E31E24] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filteredActiveFlights.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <Plane className="h-8 w-8 text-white/15" />
                <div className="text-white/25 text-xs text-center px-4">
                  {tr("Нет активных полётов", "No active flights")}
                </div>
              </div>
            ) : (
              <div className="divide-y divide-white/4">
                {filteredActiveFlights.map((flight) => {
                  const isSelected = selectedFlight?.flightNumber === flight.flightNumber && selectedFlight?.pilotId === flight.pilotId;
                  const color = getVACColor(flight.vac);
                  return (
                    <button
                      key={`${flight.flightNumber}-${String(flight.pilotId)}`}
                      type="button"
                      onClick={() => handleFlightSelect(flight)}
                      className={`w-full text-left px-4 py-3 transition-all hover:bg-white/5 ${isSelected ? "bg-white/8" : ""}`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <div className="w-1 h-4 rounded-full" style={{ backgroundColor: color }} />
                          <span className="text-white font-bold text-sm" style={{ fontFamily: "var(--font-display)" }}>
                            {flight.callsign || flight.flightNumber}
                          </span>
                        </div>
                        <span className="text-white/35 text-[10px] font-mono">{flight.aircraft}</span>
                      </div>
                      <div className="flex items-center gap-1 text-white/50 text-[11px] mb-2">
                        <span>{flight.departure}</span>
                        <svg width="16" height="6" viewBox="0 0 16 6" fill="none">
                          <line x1="0" y1="3" x2="12" y2="3" stroke="currentColor" strokeWidth="1"/>
                          <path d="M10 1L12 3L10 5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
                        </svg>
                        <span>{flight.destination}</span>
                        {flight.network && (
                          <span className="ml-auto text-[9px] border border-white/15 px-1 rounded">{flight.network}</span>
                        )}
                      </div>
                      <div className="w-full h-0.5 rounded-full bg-white/8 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${Math.min(100, flight.progress)}%`, backgroundColor: color }}
                        />
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-white/25 text-[10px]">{Math.round(flight.progress)}%</span>
                        {flight.altitude ? (
                          <span className="text-white/25 text-[10px]">
                            {flight.altitude >= 1000 ? `FL${Math.round(flight.altitude / 100)}` : `${Math.round(flight.altitude)} ft`}
                          </span>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

          </div>

          {/* UTC Clock at bottom */}
          <div className="flex items-center gap-2 px-4 py-3 border-t border-white/6">
            <Clock className="h-3.5 w-3.5 text-white/25" />
            <span className="text-white/40 text-[10px] uppercase tracking-[0.15em]">UTC</span>
            <span className="text-white font-mono font-bold text-sm ml-auto">{utcTime}</span>
          </div>
        </div>
      </aside>

      {/* Sidebar toggle button */}
      <button
        type="button"
        onClick={() => setSidebarOpen((v) => !v)}
        className="absolute left-0 top-1/2 -translate-y-1/2 z-20 flex items-center justify-center w-5 h-12 bg-[#111318] border border-white/10 rounded-r-lg text-white/40 hover:text-white/70 transition-all"
        style={{ left: sidebarOpen ? "288px" : "0px" }}
      >
        {sidebarOpen ? <ChevronLeft className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
      </button>

      {/* ── Map ── */}
      <div className="flex-1 relative overflow-hidden">
        <LiveMap
          flights={filteredActiveFlights}
          selectedFlight={selectedFlight}
          onFlightSelect={handleFlightSelect}
          onCloseDetail={() => setSelectedFlight(null)}
          className="w-full h-full bg-[#0d1117]"
        />

        {/* Top-right overlay: VAC legend + live indicator */}
        <div className="absolute top-3 right-3 z-[1000] flex items-center gap-2">
          {hasFlightsError && (
            <div className="flex items-center gap-1.5 rounded-lg bg-red-900/80 px-3 py-1.5 text-[11px] text-red-200 backdrop-blur-sm border border-red-500/20">
              <Radio className="h-3 w-3" />
              {tr("Ошибка загрузки", "Load error")}
            </div>
          )}
          <div className="flex items-center gap-1.5 rounded-lg bg-black/50 px-3 py-1.5 text-[11px] text-white/60 backdrop-blur-sm border border-white/8">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#E31E24] opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#E31E24]" />
            </span>
            {tr("В воздухе", "Airborne")}: <span className="text-white font-semibold ml-1">{filteredActiveFlights.length}</span>
          </div>
          <div className="rounded-lg bg-black/50 px-3 py-1.5 text-[11px] font-mono text-white/60 backdrop-blur-sm border border-white/8">
            {utcTime} <span className="text-white/35">UTC</span>
          </div>
        </div>

        {/* VAC colour legend — top-left below controls */}
        <div className="absolute top-12 left-3 z-[1000] flex flex-col gap-1">
          {[
            { vac: "NWS", label: "Nordwind" },
            { vac: "KAR", label: "IKAR" },
            { vac: "STW", label: "Southwind" },
          ].map(({ vac, label }) => (
            <div key={vac} className="flex items-center gap-2 rounded-lg bg-black/50 px-2.5 py-1 text-[10px] backdrop-blur-sm border border-white/6">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getVACColor(vac) }} />
              <span className="text-white/50">{vac}</span>
              <span className="text-white/25">{label}</span>
            </div>
          ))}
        </div>
      </div>
      </div>{/* end top flex row */}

      {/* ── Completed Flights Table ── */}
      <div className="shrink-0 border-t border-white/8 bg-[#0a0d12] flex flex-col" style={{ maxHeight: 220 }}>
          {/* Table header */}
          <div className="flex items-center gap-4 px-4 py-2 border-b border-white/6 shrink-0">
            <span className="text-white/35 text-[10px] uppercase tracking-[0.18em]">
              {tr("Завершённые полёты", "Completed flights")}
            </span>
            <span className="text-white/20 text-[10px]">({filteredCompletedFlights.length})</span>
          </div>
          <div className="overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-white/5">
                  {[
                    tr("Рейс", "Flight"),
                    tr("Маршрут", "Route"),
                    tr("Пилот", "Pilot"),
                    tr("ВС", "Aircraft"),
                    tr("Сеть", "Network"),
                    tr("Время", "Time"),
                  ].map((col) => (
                    <th key={col} className="text-left px-4 py-2 text-white/25 font-medium uppercase tracking-[0.12em] whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredCompletedFlights.map((flight, i) => {
                  const color = getVACColor(flight.vac);
                  return (
                    <tr
                      key={`comp-${flight.flightNumber}-${String(flight.pilotId)}-${i}`}
                      className="border-b border-white/4 hover:bg-white/3 transition-colors"
                    >
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                          <span className="text-white font-semibold" style={{ fontFamily: "var(--font-display)" }}>
                            {flight.callsign || flight.flightNumber}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-white/60">
                          <span>{flight.departure}</span>
                          <svg width="12" height="4" viewBox="0 0 12 4" fill="none">
                            <line x1="0" y1="2" x2="9" y2="2" stroke="currentColor" strokeWidth="1"/>
                            <path d="M7 0.5L9 2L7 3.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
                          </svg>
                          <span>{flight.destination}</span>
                          {flight.departureCity && flight.destinationCity && (
                            <span className="text-white/25 hidden lg:inline">
                              ({flight.departureCity} – {flight.destinationCity})
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-white/50 whitespace-nowrap">{flight.pilot || "—"}</td>
                      <td className="px-4 py-2.5 text-white/40 whitespace-nowrap font-mono">{flight.aircraft || "—"}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        {flight.network ? (
                          <span className="text-[10px] border border-white/12 text-white/40 px-1.5 py-0.5 rounded">
                            {flight.network}
                          </span>
                        ) : <span className="text-white/20">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-white/30 whitespace-nowrap font-mono">
                        {flight.completedTime || flight.eta || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          {filteredCompletedFlights.length === 0 && (
            <div className="flex items-center justify-center py-5 text-white/20 text-xs">
              {tr("Завершённых рейсов нет", "No completed flights")}
            </div>
          )}
          </div>
        </div>
    </div>
  );
}
