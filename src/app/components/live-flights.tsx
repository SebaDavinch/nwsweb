import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../context/language-context";
import { Plane, MapPin, Clock, Filter, LayoutGrid, Map as MapIcon, Table as TableIcon } from "lucide-react";
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
  const { t } = useLanguage();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedVAC, setSelectedVAC] = useState<"ALL" | "NWS" | "KAR" | "STW">("ALL");
  const [viewMode, setViewMode] = useState<"grid" | "map">("grid");
  const [completedViewMode, setCompletedViewMode] = useState<"gallery" | "list">("gallery");
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Boarding":
        return "bg-blue-100 text-blue-700";
      case "Climbing":
        return "bg-green-100 text-green-700";
      case "En Route":
        return "bg-yellow-100 text-yellow-700";
      case "Approach":
        return "bg-orange-100 text-orange-700";
      case "Completed":
        return "bg-gray-100 text-gray-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const formatTime = (date: Date) => {
    const hours = date.getUTCHours().toString().padStart(2, '0');
    const minutes = date.getUTCMinutes().toString().padStart(2, '0');
    const seconds = date.getUTCSeconds().toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };

  const getVACName = (vac: string) => {
    switch (vac) {
      case "NWS":
        return "Nordwind Airlines";
      case "KAR":
        return "IKAR";
      case "STW":
        return "Southwind";
      default:
        return "";
    }
  };

  const getVACColor = (vac: string) => {
    switch (vac) {
      case "NWS":
        return "bg-[#E31E24] hover:bg-[#c41a1f]";
      case "KAR":
        return "bg-green-600 hover:bg-green-700";
      case "STW":
        return "bg-purple-600 hover:bg-purple-700";
      default:
        return "bg-gray-600 hover:bg-gray-700";
    }
  };

  // Get VAC primary color (for icons, progress bars, etc.)
  const getVACPrimaryColor = (vac: string) => {
    switch (vac) {
      case "NWS":
        return "#E31E24";
      case "KAR":
        return "#16a34a"; // green-600
      case "STW":
        return "#9333ea"; // purple-600
      default:
        return "#6b7280"; // gray-600
    }
  };

  // Get VAC background color for icons
  const getVACBgClass = (vac: string) => {
    switch (vac) {
      case "NWS":
        return "bg-[#E31E24]";
      case "KAR":
        return "bg-green-600";
      case "STW":
        return "bg-purple-600";
      default:
        return "bg-gray-600";
    }
  };

  // Get VAC text color
  const getVACTextClass = (vac: string) => {
    switch (vac) {
      case "NWS":
        return "text-[#E31E24]";
      case "KAR":
        return "text-green-600";
      case "STW":
        return "text-purple-600";
      default:
        return "text-gray-600";
    }
  };

  // Filter flights based on selected VAC
  const filteredActiveFlights = selectedVAC === "ALL" 
    ? activeFlights 
    : activeFlights.filter(f => f.vac === selectedVAC);

  const filteredCompletedFlights = selectedVAC === "ALL" 
    ? completedFlights 
    : completedFlights.filter(f => f.vac === selectedVAC);

  // Handle flight selection
  const handleFlightSelect = (flight: Flight) => {
    setSelectedFlight(flight);
    // If we're in grid view, selecting a flight switches to map view
    if (viewMode === "grid") {
        setViewMode("map");
    }
  };

  const getPilotMetaLabel = (flight: Flight) => {
    const callsign = String(flight.callsign || "").trim().toUpperCase();
    if (callsign) {
      return callsign;
    }
    return String(flight.pilotId || "—").trim() || "—";
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-[#E31E24] to-[#c41a1f] text-white py-16">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <h1 className="text-5xl font-bold mb-4">{t("live.title")}</h1>
              <p className="text-xl text-white/90">{t("live.subtitle")}</p>
            </div>
            
            {/* UTC Clock */}
            <div className="bg-white/10 backdrop-blur-sm border-2 border-white/30 rounded-2xl px-8 py-6 text-center shadow-xl">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Clock className="text-white" size={24} />
                <p className="text-sm uppercase tracking-wide font-medium text-white/90">
                  {t("live.currentTime")} UTC
                </p>
              </div>
              <div className="text-5xl font-bold font-mono tracking-wider">
                {formatTime(currentTime)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        
        {/* Active Flights Header and Controls */}
        <div className="mb-8">
            <div className="flex items-center justify-between mb-6">
            <div>
                <h2 className="text-3xl font-bold text-gray-900 mb-2">
                {t("live.activeFlights")} <span className="text-[#E31E24]">({filteredActiveFlights.length})</span>
                </h2>
                <p className="text-gray-600">{t("live.activeFlightsSubtitle")}</p>
            </div>
            
            {/* View Mode Switcher */}
            <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
                <button
                onClick={() => {
                    setViewMode("grid");
                    setSelectedFlight(null); // Clear selection when switching to grid
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                    viewMode === "grid"
                    ? "bg-white text-[#E31E24] shadow-md"
                    : "text-gray-600 hover:text-gray-900"
                }`}
                >
                <LayoutGrid size={20} />
                <span>{t("live.gridView")}</span>
                </button>
                <button
                onClick={() => setViewMode("map")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                    viewMode === "map"
                    ? "bg-white text-[#E31E24] shadow-md"
                    : "text-gray-600 hover:text-gray-900"
                }`}
                >
                <MapIcon size={20} />
                <span>{t("live.mapView")}</span>
                </button>
            </div>
            </div>
        </div>

        {/* Filter Bar */}
        <div className="mb-8 bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-gray-700">
                <Filter size={20} />
                <span className="font-medium">{t("live.filterByVAC")}:</span>
            </div>
            <button
                onClick={() => setSelectedVAC("ALL")}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                selectedVAC === "ALL"
                    ? "bg-gray-800 text-white shadow-md"
                    : "bg-white text-gray-700 border border-gray-300 hover:border-gray-400"
                }`}
            >
                {t("live.allAirlines")} ({activeFlights.length + completedFlights.length})
            </button>
            <button
                onClick={() => setSelectedVAC("NWS")}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                selectedVAC === "NWS"
                    ? getVACColor("NWS") + " text-white shadow-md"
                    : "bg-white text-gray-700 border border-gray-300 hover:border-[#E31E24]"
                }`}
            >
                Nordwind Airlines (NWS)
            </button>
            <button
                onClick={() => setSelectedVAC("KAR")}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                selectedVAC === "KAR"
                    ? getVACColor("KAR") + " text-white shadow-md"
                    : "bg-white text-gray-700 border border-gray-300 hover:border-blue-600"
                }`}
            >
                IKAR (KAR)
            </button>
            <button
                onClick={() => setSelectedVAC("STW")}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                selectedVAC === "STW"
                    ? getVACColor("STW") + " text-white shadow-md"
                    : "bg-white text-gray-700 border border-gray-300 hover:border-orange-600"
                }`}
            >
                Southwind (STW)
            </button>
            </div>
        </div>

        {isLoadingFlights && !activeFlights.length ? (
          <div className="mb-8 rounded-lg border border-gray-200 bg-white p-4 text-gray-600">Loading live telemetry...</div>
        ) : null}

        {hasFlightsError ? (
          <div className="mb-8 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
            Failed to refresh flight telemetry. Showing last available data.
          </div>
        ) : null}

        {/* Grid View */}
        {viewMode === "grid" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
            {filteredActiveFlights.map((flight, index) => (
                <div
                key={index}
                onClick={() => handleFlightSelect(flight)}
                className="bg-white rounded-lg p-6 border-2 border-gray-200 hover:border-[#E31E24] hover:shadow-lg transition-all cursor-pointer"
                >
                {/* Flight Header */}
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                    <div className={`${getVACBgClass(flight.vac)} p-2 rounded`}>
                        <Plane className="text-white" size={20} />
                    </div>
                    <div>
                        <div className="font-mono text-lg font-bold">{flight.flightNumber}</div>
                        <div className="text-sm text-gray-600">{flight.aircraft}</div>
                    </div>
                    </div>
                    <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                        flight.status
                    )}`}
                    >
                    {flight.status}
                    </span>
                </div>

                {/* Route */}
                <div className="flex items-center justify-between mb-4">
                    <div className="flex-1">
                    <div className="text-xs text-gray-500 mb-1">
                        <MapPin className="inline" size={12} /> {t("live.departure")}
                    </div>
                    <div className="font-bold text-lg">{flight.departure}</div>
                    <div className="text-sm text-gray-600">{flight.departureCity}</div>
                    </div>
                    <div className="px-4">
                    <Plane className={getVACTextClass(flight.vac)} size={20} />
                    </div>
                    <div className="flex-1 text-right">
                    <div className="text-xs text-gray-500 mb-1">
                        <MapPin className="inline" size={12} /> {t("live.arrival")}
                    </div>
                    <div className="font-bold text-lg">{flight.destination}</div>
                    <div className="text-sm text-gray-600">{flight.destinationCity}</div>
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="mb-4">
                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                    <span>{t("live.progress")}</span>
                    <span>{flight.progress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                        className="h-2 rounded-full transition-all"
                        style={{ 
                        width: `${flight.progress}%`,
                        backgroundColor: getVACPrimaryColor(flight.vac)
                        }}
                    ></div>
                    </div>
                </div>

                {/* Pilot Info */}
                <div className="flex items-center gap-2 pt-3 border-t border-gray-200 mb-3">
                    <div className="text-xl">
                    👨‍✈️
                    </div>
                    <div className="text-sm text-gray-600">
                    {t("live.pilot")}: <span className="text-gray-900 font-medium">{flight.pilot} - {getPilotMetaLabel(flight)}</span>
                    </div>
                </div>

                {/* ETD, ETE, ETA */}
                {flight.etd && flight.ete && flight.eta && (
                    <div className="grid grid-cols-3 gap-2 bg-gray-50 rounded-lg p-3 border border-gray-100">
                    <div className="text-center">
                        <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">ETD</div>
                        <div className="text-sm font-mono font-semibold text-gray-900">{flight.etd}</div>
                    </div>
                    <div className="text-center border-x border-gray-200">
                        <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">ETE</div>
                        <div className="text-sm font-mono font-semibold text-[#E31E24]">{flight.ete}</div>
                    </div>
                    <div className="text-center">
                        <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">ETA</div>
                        <div className="text-sm font-mono font-semibold text-gray-900">{flight.eta}</div>
                    </div>
                    </div>
                )}
                </div>
            ))}
            </div>
        )}

        {/* Map View */}
        {viewMode === "map" && (
            <div className="mb-16">
            <LiveMap 
                flights={filteredActiveFlights}
                selectedFlight={selectedFlight}
                onFlightSelect={(flight) => setSelectedFlight(flight)}
                onCloseDetail={() => setSelectedFlight(null)}
            />
            </div>
        )}

        {/* Completed Flights Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                {t("live.completedFlights")} <span className="text-[#E31E24]">({filteredCompletedFlights.length})</span>
              </h2>
              <p className="text-gray-600">{t("live.completedFlightsSubtitle")}</p>
            </div>

            {/* View Mode Switcher for Completed Flights */}
            <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => setCompletedViewMode("gallery")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                  completedViewMode === "gallery"
                    ? "bg-white text-[#E31E24] shadow-md"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <LayoutGrid size={20} />
                <span>{t("live.galleryView") || "Gallery"}</span>
              </button>
              <button
                onClick={() => setCompletedViewMode("list")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                  completedViewMode === "list"
                    ? "bg-white text-[#E31E24] shadow-md"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <TableIcon size={20} />
                <span>{t("live.gridView") || "Grid"}</span>
              </button>
            </div>
          </div>
        </div>

        {completedViewMode === "gallery" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredCompletedFlights.map((flight, index) => (
            <div
                key={index}
                className="group bg-white rounded-xl p-6 border border-gray-200 hover:border-[#E31E24] hover:shadow-xl transition-all duration-300 relative overflow-hidden"
            >
                {/* Decorative gradient overlay */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-gray-100 to-transparent rounded-bl-full opacity-50"></div>
                
                {/* Flight Header */}
                <div className="flex items-start justify-between mb-5 relative z-10">
                <div className="flex items-center gap-3">
                    <div className="bg-gradient-to-br from-gray-400 to-gray-500 p-3 rounded-lg shadow-md group-hover:scale-110 transition-transform">
                    <Plane className="text-white" size={20} />
                    </div>
                    <div>
                    <div className="font-mono text-xl font-bold text-gray-900">{flight.flightNumber}</div>
                    <div className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                        <span className="inline-block w-2 h-2 bg-green-500 rounded-full"></span>
                        {flight.aircraft}
                    </div>
                    </div>
                </div>
                <div className="text-right bg-gray-50 rounded-lg px-3 py-2">
                    <div className="text-xs font-medium text-green-700 mb-1">✓ {flight.status}</div>
                    <div className="text-xs text-gray-600 font-semibold">{flight.completedDate}</div>
                    <div className="text-xs text-gray-500 font-mono mt-0.5">{flight.completedTime} UTC</div>
                </div>
                </div>

                {/* Route - Horizontal Layout */}
                <div className="bg-gradient-to-r from-gray-50 to-white rounded-lg p-4 mb-4 border border-gray-100">
                <div className="flex items-center justify-between">
                    <div className="flex-1">
                    <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                        <MapPin size={12} className="text-[#E31E24]" />
                        <span className="uppercase tracking-wide">{t("live.departure")}</span>
                    </div>
                    <div className="font-bold text-lg text-gray-900">{flight.departure}</div>
                    <div className="text-sm text-gray-600">{flight.departureCity}</div>
                    </div>
                    
                    <div className="px-4 flex flex-col items-center">
                    <Plane className="text-gray-400 transform rotate-90" size={20} />
                    <div className="w-16 h-0.5 bg-gradient-to-r from-gray-300 via-[#E31E24] to-gray-300 my-1"></div>
                    </div>
                    
                    <div className="flex-1 text-right">
                    <div className="flex items-center justify-end gap-1 text-xs text-gray-500 mb-1">
                        <MapPin size={12} className="text-green-600" />
                        <span className="uppercase tracking-wide">{t("live.arrival")}</span>
                    </div>
                    <div className="font-bold text-lg text-gray-900">{flight.destination}</div>
                    <div className="text-sm text-gray-600">{flight.destinationCity}</div>
                    </div>
                </div>
                </div>

                {/* Duration */}
                <div className="flex items-center gap-2 mb-4 bg-blue-50 rounded-lg px-3 py-2 border border-blue-100">
                <Clock className="text-blue-600" size={16} />
                <div className="text-sm text-gray-700">
                    <span className="text-gray-500">{t("live.duration")}:</span>{" "}
                    <span className="font-bold text-blue-700">{flight.duration}</span>
                </div>
                </div>

                {/* Pilot Info */}
                <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
                <div className="text-2xl">👨‍✈️</div>
                <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">{t("live.pilot")}</div>
                    <div className="text-sm font-semibold text-gray-900">
                    {flight.pilot} <span className="text-[#E31E24]">• {getPilotMetaLabel(flight)}</span>
                    </div>
                </div>
                </div>
            </div>
            ))}
        </div>
        ) : (
          <div className="overflow-hidden bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t("live.flight") || "Flight"}</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t("live.route") || "Route"}</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t("live.aircraft") || "Aircraft"}</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t("live.pilot") || "Pilot"}</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t("live.date") || "Date"}</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t("live.duration") || "Duration"}</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">{t("live.status") || "Status"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredCompletedFlights.map((flight, index) => (
                    <tr key={index} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-8 rounded-full ${getVACBgClass(flight.vac)}`}></div>
                          <div>
                            <div className="font-mono font-bold text-gray-900">{flight.flightNumber}</div>
                            <div className="text-xs text-gray-500">{getVACName(flight.vac)}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900">{flight.departure}</span>
                          <span className="text-gray-400">→</span>
                          <span className="font-bold text-gray-900">{flight.destination}</span>
                        </div>
                        <div className="text-xs text-gray-500">{flight.departureCity} - {flight.destinationCity}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{flight.aircraft}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{flight.pilot}</div>
                        <div className="text-xs text-gray-500">{getPilotMetaLabel(flight)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{flight.completedDate}</div>
                        <div className="text-xs text-gray-500 font-mono">{flight.completedTime} UTC</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-sm text-gray-700">
                          <Clock size={14} className="text-gray-400" />
                          <span className="font-medium">{flight.duration}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          {flight.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Footer note */}
        <div className="mt-12 text-center">
            <div className="inline-block bg-blue-50 border border-blue-200 rounded-lg px-6 py-4">
            <p className="text-gray-700">{t("live.note")}</p>
            </div>
        </div>
      </div>
    </div>
  );
}
