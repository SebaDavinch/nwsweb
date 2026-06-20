import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, ClipboardList, Cloud, ExternalLink, Loader2, Plane, RefreshCcw, Send, Trash2 } from "lucide-react";
import { Navigate, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { useAuth } from "../../context/auth-context";
import { useLanguage } from "../../context/language-context";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../ui/alert-dialog";
import { FlightMap, type Route as FlightMapRoute } from "./flight-map";
import { PassengerManifest } from "./passenger-manifest";
import { FlightPhaseBadge, normalizeFlightPhase, type FlightPhase } from "./flight-phase";

interface LiveFlight {
  flightNumber?: string;
  status?: string;
  currentPhase?: string;
  altitude?: number | null;
  speed?: number | null;
  heading?: number | null;
  progress?: number | null;
  eta?: string;
  ete?: string;
  remainingDistanceNm?: number | null;
  currentLat?: number | null;
  currentLon?: number | null;
  departureLat?: number | null;
  departureLon?: number | null;
  arrivalLat?: number | null;
  arrivalLon?: number | null;
  hasLiveTelemetry?: boolean;
}

interface FlightMapResponse {
  flights?: LiveFlight[];
}

const LIVE_POLL_MS = 12_000;

const normalizeCallsign = (value?: string | null) =>
  String(value || "").trim().toUpperCase().replace(/\s+/g, "");

interface Booking {
  id: number;
  routeId?: number | null;
  aircraftId?: number | null;
  flightNumber: string;
  callsign: string;
  departureCode: string;
  departureName: string;
  arrivalCode: string;
  arrivalName: string;
  routeLabel: string;
  aircraft: string;
  registration?: string;
  network?: string;
  altitude?: string;
  passengers?: number | null;
  cargo?: number | null;
  userRoute?: string;
  departureTime?: string | null;
  validTo?: string | null;
  statusLabel: string;
}

interface BookingDetailResponse {
  booking?: Booking;
  error?: string;
}

interface BookingListItem {
  id: number;
  departureCode: string;
  arrivalCode: string;
  departureTime?: string | null;
  status?: string;
}

interface BookingListResponse {
  bookings?: BookingListItem[];
}

interface SimbriefOFP {
  units: string;
  route: string | null;
  originIcao: string | null;
  destIcao: string | null;
  altnIcao: string | null;
  aircraft: string | null;
  registration: string | null;
  cruiseAlt: string | null;
  costIndex: string | null;
  ete: string | null;
  timeGenerated: string | null;
  remarks: string | null;
  fuel: { ramp: number | null; burn: number | null; altn: number | null; reserve: number | null; extra: number | null; taxi: number | null };
  weights: { zfw: number | null; tow: number | null; ldw: number | null; paxCount: number | null };
}

interface SimbriefPayload {
  ok?: boolean;
  available?: boolean;
  url?: string | null;
  pdfUrl?: string | null;
  html?: string | null;
  ofp?: SimbriefOFP | null;
  canGenerate?: boolean;
  message?: string;
  code?: string;
  error?: string;
}

interface RouteOption {
  id: number;
  routeText?: string;
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
}

interface DashboardResource {
  label: string;
  url?: string | null;
}

interface DashboardAircraft {
  id: string;
  registration?: string;
  liveries?: DashboardResource[];
  scenarios?: DashboardResource[];
}

interface DashboardFleetResponse {
  fleets?: Array<{
    aircraft?: DashboardAircraft[];
  }>;
}

interface MetarResponse {
  metar?: {
    station: string;
    raw: string;
    observedAt: string | null;
  } | null;
  error?: string;
}

const formatDateTime = (value?: string | null) => {
  if (!value) {
    return "-";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  });
};

const parseDistanceNm = (value?: string) => {
  const raw = String(value || "").trim();
  if (!raw) {
    return 0;
  }
  const match = raw.match(/(\d+(?:[.,]\d+)?)/);
  if (!match) {
    return 0;
  }
  return Math.round(Number(match[1].replace(",", ".")) || 0);
};

const parseDurationMinutes = (value?: string) => {
  const raw = String(value || "").trim();
  const match = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) {
    return 0;
  }
  return Number(match[1]) * 60 + Number(match[2]);
};

const getBookingTimestamp = (value?: string | null) => {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
};

const getBookingLifecycleStatus = (value?: string) => {
  return String(value || "upcoming").trim().toLowerCase() || "upcoming";
};

const isOpenBookingStatus = (status?: string) => {
  return ["active", "upcoming", "pending"].includes(getBookingLifecycleStatus(status));
};

const computeCascadeCancellationCount = (bookings: BookingListItem[], selectedBookingId: number) => {
  const openBookings = (Array.isArray(bookings) ? bookings : [])
    .filter((booking) => isOpenBookingStatus(booking.status))
    .slice()
    .sort((left, right) => getBookingTimestamp(left.departureTime) - getBookingTimestamp(right.departureTime));

  const target = openBookings.find((booking) => Number(booking.id || 0) === selectedBookingId) || null;
  if (!target) {
    return 1;
  }

  const selectedIds = new Set<number>([selectedBookingId]);
  let currentDepartureCode = String(target.arrivalCode || "").trim().toUpperCase();

  while (currentDepartureCode) {
    const nextBooking = openBookings.find((booking) => {
      const bookingId = Number(booking.id || 0) || 0;
      const departureCode = String(booking.departureCode || "").trim().toUpperCase();
      return bookingId > 0 && !selectedIds.has(bookingId) && departureCode === currentDepartureCode;
    });

    if (!nextBooking) {
      break;
    }

    const nextId = Number(nextBooking.id || 0) || 0;
    selectedIds.add(nextId);
    currentDepartureCode = String(nextBooking.arrivalCode || "").trim().toUpperCase();
  }

  return Math.max(1, selectedIds.size);
};

const NETWORK_OPTIONS = ["VATSIM", "IVAO", "POSCON", "PilotEdge", "Offline"];

export function PilotBookingView() {
  const { t } = useLanguage();
  const { isAuthenticated, isAuthLoading, pilot } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();

  const bookingId = Number(id || 0) || 0;

  const [booking, setBooking] = useState<Booking | null>(null);
  const [route, setRoute] = useState<RouteOption | null>(null);
  const [isReportingRoute, setIsReportingRoute] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isDispatching, setIsDispatching] = useState(false);
  const [isUpdatingNetwork, setIsUpdatingNetwork] = useState(false);
  const [networkValue, setNetworkValue] = useState("");
  const [liveries, setLiveries] = useState<DashboardResource[]>([]);
  const [scenarios, setScenarios] = useState<DashboardResource[]>([]);
  const [metarFrom, setMetarFrom] = useState<MetarResponse["metar"] | null>(null);
  const [metarTo, setMetarTo] = useState<MetarResponse["metar"] | null>(null);
  const [isRefreshingMetar, setIsRefreshingMetar] = useState(false);
  const [cascadeCancellationCount, setCascadeCancellationCount] = useState(1);
  const [isCancelling, setIsCancelling] = useState(false);
  const [simbriefData, setSimbriefData] = useState<SimbriefPayload | null>(null);
  const [isLoadingSimbrief, setIsLoadingSimbrief] = useState(false);
  const [isLinkingSimbrief, setIsLinkingSimbrief] = useState(false);
  const [liveFlight, setLiveFlight] = useState<LiveFlight | null>(null);

  useEffect(() => {
    if (!booking?.network) {
      setNetworkValue("");
      return;
    }
    setNetworkValue(booking.network);
  }, [booking?.network]);

  useEffect(() => {
    if (bookingId <= 0) return;
    let active = true;
    setIsLoadingSimbrief(true);
    fetch(`/api/pilot/bookings/${bookingId}/simbrief`, { credentials: "include" })
      .then((r) => r.json().catch(() => null))
      .then((payload: SimbriefPayload | null) => { if (active) setSimbriefData(payload); })
      .catch(() => null)
      .finally(() => { if (active) setIsLoadingSimbrief(false); });
    return () => { active = false; };
  }, [bookingId]);

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      if (bookingId <= 0) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const bookingResponse = await fetch(`/api/pilot/bookings/${bookingId}`, {
          credentials: "include",
        });
        const bookingPayload = (await bookingResponse.json().catch(() => null)) as BookingDetailResponse | null;
        if (!bookingResponse.ok || !bookingPayload?.booking) {
          throw new Error(bookingPayload?.error || t("bookings.toast.detailsError"));
        }
        const nextBooking = bookingPayload.booking;
        if (!active) {
          return;
        }
        setBooking(nextBooking);

        const [routesResponse, fleetResponse, bookingsResponse] = await Promise.all([
          fetch("/api/vamsys/routes", { credentials: "include" }),
          fetch("/api/vamsys/dashboard/fleet", { credentials: "include" }),
          fetch("/api/pilot/bookings?limit=150", { credentials: "include" }),
        ]);

        const routesPayload = (await routesResponse.json().catch(() => null)) as { routes?: RouteOption[] } | null;
        const fleetPayload = (await fleetResponse.json().catch(() => null)) as DashboardFleetResponse | null;
        const bookingsPayload = (await bookingsResponse.json().catch(() => null)) as BookingListResponse | null;

        if (!active) {
          return;
        }

        const routes = Array.isArray(routesPayload?.routes) ? routesPayload.routes : [];
        const matchedRoute = routes.find((item) => item.id === Number(nextBooking.routeId || 0)) || null;
        setRoute(matchedRoute);

        const aircraftPool = (Array.isArray(fleetPayload?.fleets) ? fleetPayload.fleets : []).flatMap((fleet) =>
          Array.isArray(fleet.aircraft) ? fleet.aircraft : []
        );
        const matchedAircraft =
          aircraftPool.find((item) => Number(item.id || 0) === Number(nextBooking.aircraftId || 0)) ||
          aircraftPool.find(
            (item) =>
              String(item.registration || "").trim().toUpperCase() ===
              String(nextBooking.registration || "").trim().toUpperCase()
          ) ||
          null;

        setLiveries(Array.isArray(matchedAircraft?.liveries) ? matchedAircraft.liveries : []);
        setScenarios(Array.isArray(matchedAircraft?.scenarios) ? matchedAircraft.scenarios : []);
        setCascadeCancellationCount(
          computeCascadeCancellationCount(
            Array.isArray(bookingsPayload?.bookings) ? bookingsPayload.bookings : [],
            Number(nextBooking.id || 0)
          )
        );

        const metarRequests = [
          nextBooking.departureCode
            ? fetch(`/api/weather/metar/${encodeURIComponent(nextBooking.departureCode)}`, { credentials: "include" })
            : null,
          nextBooking.arrivalCode
            ? fetch(`/api/weather/metar/${encodeURIComponent(nextBooking.arrivalCode)}`, { credentials: "include" })
            : null,
        ];

        const [fromResponse, toResponse] = await Promise.all(
          metarRequests.map((promise) => promise || Promise.resolve(null))
        );

        const fromPayload = fromResponse
          ? ((await fromResponse.json().catch(() => null)) as MetarResponse | null)
          : null;
        const toPayload = toResponse
          ? ((await toResponse.json().catch(() => null)) as MetarResponse | null)
          : null;

        if (!active) {
          return;
        }

        setMetarFrom(fromPayload?.metar || null);
        setMetarTo(toPayload?.metar || null);
      } catch (error) {
        if (active) {
          toast.error(String(error || t("bookings.toast.detailsError")));
          setBooking(null);
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void loadData();

    return () => {
      active = false;
    };
  }, [bookingId, t]);

  // Live flight tracking — poll the flight map and match the active flight to this booking
  useEffect(() => {
    if (!booking) {
      return;
    }

    const candidates = [normalizeCallsign(booking.callsign), normalizeCallsign(booking.flightNumber)].filter(Boolean);
    if (!candidates.length) {
      return;
    }

    let active = true;

    const poll = async () => {
      try {
        const response = await fetch("/api/vamsys/flight-map", { credentials: "include" });
        if (!response.ok) {
          return;
        }
        const payload = (await response.json().catch(() => null)) as FlightMapResponse | null;
        if (!active) {
          return;
        }
        const flights = Array.isArray(payload?.flights) ? payload.flights : [];
        const match =
          flights.find((flight) => candidates.includes(normalizeCallsign(flight.flightNumber))) || null;
        setLiveFlight(match);
      } catch {
        /* keep last known live state on transient errors */
      }
    };

    void poll();
    const timer = window.setInterval(() => void poll(), LIVE_POLL_MS);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [booking]);

  const livePhase = useMemo<FlightPhase | null>(() => {
    if (!liveFlight) {
      return null;
    }
    return normalizeFlightPhase(liveFlight.currentPhase || liveFlight.status, {
      altitude: liveFlight.altitude,
      speed: liveFlight.speed,
      heading: liveFlight.heading,
      progress: liveFlight.progress,
      currentLat: liveFlight.currentLat,
      currentLon: liveFlight.currentLon,
      departureLat: liveFlight.departureLat,
      departureLon: liveFlight.departureLon,
      arrivalLat: liveFlight.arrivalLat,
      arrivalLon: liveFlight.arrivalLon,
    });
  }, [liveFlight]);

  const mapRoute = useMemo<FlightMapRoute | null>(() => {
    if (!booking || !route) {
      return null;
    }

    const fromLat = Number(route.fromLat);
    const fromLon = Number(route.fromLon);
    const toLat = Number(route.toLat);
    const toLon = Number(route.toLon);
    if (!Number.isFinite(fromLat) || !Number.isFinite(fromLon) || !Number.isFinite(toLat) || !Number.isFinite(toLon)) {
      return null;
    }

    const distance = parseDistanceNm(route.distance);
    const durationMinutes = parseDurationMinutes(route.duration);

    return {
      id: String(booking.flightNumber || booking.callsign || booking.id),
      airline: "NWS",
      aircraft: booking.aircraft,
      registration: booking.registration,
      totalDistance: distance,
      totalDuration: durationMinutes,
      legs: [
        {
          from: {
            icao: booking.departureCode,
            name: booking.departureName,
            lat: fromLat,
            lon: fromLon,
          },
          to: {
            icao: booking.arrivalCode,
            name: booking.arrivalName,
            lat: toLat,
            lon: toLon,
          },
          distance,
          duration: durationMinutes,
        },
      ],
    };
  }, [booking, route]);

  const handleOpenDispatch = async () => {
    if (!booking?.routeId) {
      toast.error(t("bookings.toast.dispatchUnavailable"));
      return;
    }

    setIsDispatching(true);
    try {
      const response = await fetch("/api/pilot/dispatch-url", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ routeId: booking.routeId }),
      });
      const payload = (await response.json().catch(() => null)) as { url?: string; error?: string } | null;
      if (!response.ok || !payload?.url) {
        throw new Error(payload?.error || t("bookings.toast.dispatchError"));
      }
      window.open(payload.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(String(error || t("bookings.toast.dispatchError")));
    } finally {
      setIsDispatching(false);
    }
  };

  const handleNetworkUpdate = async (value: string) => {
    if (!booking) {
      return;
    }

    setNetworkValue(value);
    setIsUpdatingNetwork(true);
    try {
      const response = await fetch(`/api/pilot/bookings/${booking.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ network: value === "Offline" ? "" : value }),
      });
      const payload = (await response.json().catch(() => null)) as BookingDetailResponse & { error?: string };
      if (!response.ok || !payload?.booking) {
        throw new Error(payload?.error || "Failed to update booking network");
      }
      setBooking(payload.booking);
      toast.success("Сеть обновлена");
    } catch (error) {
      toast.error(String(error || "Не удалось обновить сеть"));
      setNetworkValue(booking.network || "");
    } finally {
      setIsUpdatingNetwork(false);
    }
  };

  const handleCancelBooking = async () => {
    if (!booking) {
      return;
    }

    setIsCancelling(true);
    try {
      const response = await fetch(`/api/pilot/bookings/${booking.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const payload = (await response.json().catch(() => null)) as { error?: string; cancelledCount?: number } | null;
      if (!response.ok) {
        throw new Error(payload?.error || t("bookings.toast.cancelError"));
      }

      const cancelledCount = Number(payload?.cancelledCount || 0) || 1;
      if (cancelledCount > 1) {
        toast.success(`Бронирование отменено вместе с цепочкой (${cancelledCount} шт.)`);
      } else {
        toast.success(t("bookings.toast.cancelSuccess"));
      }
      navigate("/dashboard?tab=my-flights", { replace: true });
    } catch (error) {
      toast.error(String(error || t("bookings.toast.cancelError")));
    } finally {
      setIsCancelling(false);
    }
  };

  const handleReportOutdatedRoute = async () => {
    const routeId = Number(booking?.routeId || 0) || 0;
    if (routeId <= 0) {
      toast.error(t("bookings.toast.reportInactiveError"));
      return;
    }

    setIsReportingRoute(true);
    try {
      const response = await fetch(`/api/pilot/routes/${routeId}/report-outdated`, {
        method: "POST",
        credentials: "include",
      });
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        duplicate?: boolean;
        ticket?: { number?: number } | null;
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
      }
    } catch (error) {
      toast.error(String(error || t("bookings.toast.reportInactiveError")));
    } finally {
      setIsReportingRoute(false);
    }
  };

  const linkSimbrief = async () => {
    if (!booking) return;
    setIsLinkingSimbrief(true);
    try {
      const response = await fetch(`/api/pilot/bookings/${booking.id}/simbrief`, {
        method: "PUT",
        credentials: "include",
      });
      const payload = (await response.json().catch(() => null)) as SimbriefPayload | null;
      if (!response.ok) throw new Error(payload?.error || "Failed to link SimBrief OFP");
      setSimbriefData(payload);
      if (payload?.available) {
        toast.success("SimBrief OFP привязан");
        // Auto-fill altitude from OFP if booking doesn't have one yet
        const cruiseAltRaw = payload?.ofp?.cruiseAlt;
        if (cruiseAltRaw && booking && !booking.altitude) {
          const n = Number(cruiseAltRaw);
          const altStr = Number.isFinite(n) && n > 1000 ? `FL${Math.round(n / 100)}` : String(cruiseAltRaw);
          try {
            const patchRes = await fetch(`/api/pilot/bookings/${booking.id}`, {
              method: "PATCH",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ altitude: altStr }),
            });
            const patchPayload = (await patchRes.json().catch(() => null)) as BookingDetailResponse & { error?: string };
            if (patchRes.ok && patchPayload?.booking) {
              setBooking(patchPayload.booking);
            }
          } catch { /* non-critical */ }
        }
      } else {
        toast.message(payload?.message || "SimBrief OFP не найден — создайте план в SimBrief и попробуйте снова.");
      }
    } catch (error) {
      toast.error(String(error || "Failed to link SimBrief OFP"));
    } finally {
      setIsLinkingSimbrief(false);
    }
  };

  const handleCancelAndRebook = async () => {
    if (!booking) return;
    const routeId = booking.routeId;
    setIsCancelling(true);
    try {
      const response = await fetch(`/api/pilot/bookings/${booking.id}`, { method: "DELETE", credentials: "include" });
      const payload = (await response.json().catch(() => null)) as { error?: string; cancelledCount?: number } | null;
      if (!response.ok) throw new Error(payload?.error || t("bookings.toast.cancelError"));
      navigate(routeId ? `/dashboard?tab=my-flights&rebook=${routeId}` : "/dashboard?tab=my-flights", { replace: true });
    } catch (error) {
      toast.error(String(error || t("bookings.toast.cancelError")));
    } finally {
      setIsCancelling(false);
    }
  };

  const refreshMetar = async () => {
    if (!booking) return;
    setIsRefreshingMetar(true);
    try {
      const [fromRes, toRes] = await Promise.all([
        fetch(`/api/weather/metar/${encodeURIComponent(booking.departureCode)}`, { credentials: "include" }),
        fetch(`/api/weather/metar/${encodeURIComponent(booking.arrivalCode)}`, { credentials: "include" }),
      ]);
      const fromPayload = fromRes.ok ? ((await fromRes.json().catch(() => null)) as MetarResponse | null) : null;
      const toPayload = toRes.ok ? ((await toRes.json().catch(() => null)) as MetarResponse | null) : null;
      setMetarFrom(fromPayload?.metar || null);
      setMetarTo(toPayload?.metar || null);
    } catch { /* ignore */ } finally {
      setIsRefreshingMetar(false);
    }
  };

  const formatTimeOnly = (value?: string | null) => {
    if (!value) return "—";
    const d = new Date(value);
    if (isNaN(d.getTime())) return value;
    return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
  };

  const computeSta = (dep?: string | null, durationMin?: number) => {
    if (!dep || !durationMin) return null;
    const d = new Date(dep);
    if (isNaN(d.getTime())) return null;
    return new Date(d.getTime() + durationMin * 60000);
  };

  if (isAuthLoading) {
    return <div className="min-h-[50vh] flex items-center justify-center">Loading...</div>;
  }

  if (!isAuthenticated || !pilot) {
    return <Navigate to="/login" replace />;
  }

  if (bookingId <= 0) {
    return <Navigate to="/dashboard?tab=my-flights" replace />;
  }

  const durationMin = booking ? parseDurationMinutes(route?.duration || "") : 0;
  const staDate = booking ? computeSta(booking.departureTime, durationMin) : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard?tab=my-flights")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          К бронированиям
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            <RefreshCcw className="mr-2 h-3.5 w-3.5" />
            {t("bookings.refresh")}
          </Button>
          <Button size="sm" className="bg-[#E31E24] text-white hover:bg-[#c21920]" onClick={handleOpenDispatch} disabled={isDispatching || !booking?.routeId}>
            {isDispatching ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-2 h-3.5 w-3.5" />}
            Phoenix / VATSIM
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24 text-sm text-gray-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t("bookings.loadingDetails")}
        </div>
      ) : !booking ? (
        <div className="flex items-center justify-center py-24 text-sm text-gray-500">{t("bookings.noDetails")}</div>
      ) : (
        <>
          {/* Map — full width */}
          <div className="h-[360px] w-full bg-slate-900">
            <FlightMap route={mapRoute} />
          </div>

          {/* Validity alert */}
          {booking.validTo && (
            <div className="flex items-center gap-2 border-b border-amber-100 bg-amber-50 px-6 py-2.5 text-sm text-amber-800">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Рейс необходимо начать до {formatDateTime(booking.validTo)} UTC
            </div>
          )}

          {/* Main grid */}
          <div className="mx-auto max-w-[1400px] px-6 py-6">
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_340px]">

              {/* ── Left column ───────────────────────────────────────────── */}
              <div className="space-y-4 min-w-0">

                {/* Flight Info card */}
                <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                  {/* Header row */}
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 px-6 py-4">
                    <div>
                      <div className="text-[11px] uppercase tracking-widest text-gray-400 mb-0.5">Callsign · Номер рейса</div>
                      <div className="text-xl font-bold text-gray-900 font-mono tracking-wide">
                        {booking.callsign} <span className="text-gray-300">|</span> {booking.flightNumber}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[11px] uppercase tracking-widest text-gray-400 mb-1">Статус</div>
                      {livePhase ? (
                        <FlightPhaseBadge phase={livePhase} size="lg" />
                      ) : (
                        <Badge variant="outline" className="border-gray-200 text-gray-600">{booking.statusLabel}</Badge>
                      )}
                    </div>
                  </div>

                  {/* Live tracking strip */}
                  {liveFlight && (
                    <div className="border-b border-gray-100 bg-gradient-to-r from-slate-50 to-white px-6 py-4">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-emerald-600">
                          <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                          </span>
                          {t("phase.live")}
                        </span>
                        {typeof liveFlight.progress === "number" && (
                          <span className="font-mono text-xs font-semibold text-gray-500">
                            {Math.round(liveFlight.progress)}%
                          </span>
                        )}
                      </div>
                      {/* progress bar */}
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-700"
                          style={{ width: `${Math.max(0, Math.min(100, Math.round(Number(liveFlight.progress) || 0)))}%` }}
                        />
                      </div>
                      {/* telemetry chips */}
                      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {[
                          {
                            label: "ALT",
                            value:
                              typeof liveFlight.altitude === "number"
                                ? liveFlight.altitude >= 1000
                                  ? `FL${Math.round(liveFlight.altitude / 100)}`
                                  : `${Math.round(liveFlight.altitude)} ft`
                                : "—",
                          },
                          {
                            label: "GS",
                            value: typeof liveFlight.speed === "number" ? `${Math.round(liveFlight.speed)} kt` : "—",
                          },
                          {
                            label: "DIST REM",
                            value:
                              typeof liveFlight.remainingDistanceNm === "number"
                                ? `${Math.round(liveFlight.remainingDistanceNm)} nm`
                                : "—",
                          },
                          { label: "ETE", value: liveFlight.ete || "—" },
                        ].map(({ label, value }) => (
                          <div key={label} className="rounded-lg bg-white px-3 py-2 ring-1 ring-gray-100">
                            <div className="text-[10px] uppercase tracking-widest text-gray-400">{label}</div>
                            <div className="mt-0.5 font-mono text-sm font-bold text-gray-800">{value}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Route display */}
                  <div className="px-6 py-5">
                    <div className="flex items-center gap-4">
                      {/* Departure */}
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] uppercase tracking-widest text-gray-400 mb-1">Вылет</div>
                        <div className="text-4xl font-bold font-mono text-gray-900 leading-none">{booking.departureCode}</div>
                        <div className="mt-1.5 text-sm text-gray-500 truncate">{booking.departureName}</div>
                      </div>

                      {/* Route line */}
                      <div className="flex flex-col items-center gap-1.5 flex-none">
                        <div className="flex items-center gap-1">
                          <div className="h-px w-12 bg-gray-200 sm:w-20" />
                          <Plane className="h-5 w-5 text-[#E31E24]" />
                          <div className="h-px w-12 bg-gray-200 sm:w-20" />
                        </div>
                        {route?.distance && (
                          <div className="text-xs font-medium text-gray-400">{route.distance}</div>
                        )}
                        {route?.duration && (
                          <div className="text-xs text-gray-400">{route.duration}</div>
                        )}
                      </div>

                      {/* Arrival */}
                      <div className="flex-1 min-w-0 text-right">
                        <div className="text-[11px] uppercase tracking-widest text-gray-400 mb-1">Прилёт</div>
                        <div className="text-4xl font-bold font-mono text-gray-900 leading-none">{booking.arrivalCode}</div>
                        <div className="mt-1.5 text-sm text-gray-500 truncate">{booking.arrivalName}</div>
                      </div>
                    </div>

                    {/* Stats grid */}
                    <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {[
                        { label: "STD", value: formatTimeOnly(booking.departureTime) },
                        { label: "Длительность", value: route?.duration || "—" },
                        { label: "Расстояние", value: route?.distance || "—" },
                        { label: "STA", value: staDate ? formatTimeOnly(staDate.toISOString()) : "—" },
                      ].map(({ label, value }) => (
                        <div key={label} className="rounded-xl bg-gray-50 px-4 py-3">
                          <div className="text-[11px] uppercase tracking-widest text-gray-400">{label}</div>
                          <div className="mt-1 text-base font-bold text-gray-800 font-mono">{value}</div>
                        </div>
                      ))}
                    </div>

                    {/* METAR row */}
                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] uppercase tracking-widest text-gray-400">METAR</span>
                        <button
                          type="button"
                          onClick={() => void refreshMetar()}
                          disabled={isRefreshingMetar}
                          className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors disabled:opacity-40"
                        >
                          <RefreshCcw className={`h-3 w-3 ${isRefreshingMetar ? "animate-spin" : ""}`} />
                          {isRefreshingMetar ? "Обновление..." : "Обновить"}
                        </button>
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {[
                          { code: booking.departureCode, metar: metarFrom },
                          { code: booking.arrivalCode, metar: metarTo },
                        ].map(({ code, metar }) => (
                          <div key={code} className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                            <div className="mb-1.5 flex items-center gap-2">
                              <Cloud className="h-3.5 w-3.5 text-blue-500" />
                              <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">METAR {code}</span>
                            </div>
                            <div className="font-mono text-xs text-gray-700 break-all leading-relaxed">
                              {metar?.raw || <span className="text-gray-400 not-italic">Нет данных</span>}
                            </div>
                            {metar?.observedAt && (
                              <div className="mt-1 text-[10px] text-gray-400">{formatDateTime(metar.observedAt)}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Aircraft / flight details card */}
                <div className="rounded-2xl border border-gray-200 bg-white shadow-sm px-6 py-5">
                  <div className="text-[11px] uppercase tracking-widest text-gray-400 mb-4">Информация о рейсе</div>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
                    <div>
                      <div className="text-[11px] uppercase text-gray-400">Воздушное судно</div>
                      <div className="mt-0.5 font-bold text-gray-900 font-mono">{booking.registration || "—"}</div>
                      <div className="text-xs text-gray-500">{booking.aircraft}</div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase text-gray-400">Эшелон</div>
                      <div className="mt-0.5 font-bold text-gray-900">
                        {booking.altitude || (() => {
                          const raw = simbriefData?.ofp?.cruiseAlt;
                          if (!raw) return "—";
                          const n = Number(raw);
                          return Number.isFinite(n) && n > 1000
                            ? `FL${Math.round(n / 100)}`
                            : String(raw);
                        })()}
                        {!booking.altitude && simbriefData?.ofp?.cruiseAlt && (
                          <span className="ml-1.5 text-[10px] font-normal text-blue-500">SimBrief</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase text-gray-400">Пассажиры</div>
                      <div className="mt-0.5 font-bold text-gray-900">{booking.passengers ?? "—"}</div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase text-gray-400">Груз</div>
                      <div className="mt-0.5 font-bold text-gray-900">{booking.cargo ? `${booking.cargo} kg` : "—"}</div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase text-gray-400">Сеть</div>
                      <div className="mt-0.5 font-bold text-gray-900">{booking.network || "Offline"}</div>
                    </div>
                  </div>
                  {(booking.userRoute || route?.routeText) && (
                    <div className="mt-4">
                      <div className="text-[11px] uppercase text-gray-400 mb-1.5">Маршрут</div>
                      <div className="rounded-xl bg-gray-50 px-4 py-3 font-mono text-xs text-gray-700 break-all leading-relaxed">
                        {booking.userRoute || route?.routeText}
                      </div>
                    </div>
                  )}
                </div>

                {/* Passenger manifest */}
                <PassengerManifest
                  bookingId={booking.id}
                  departureCode={booking.departureCode}
                  arrivalCode={booking.arrivalCode}
                  passengers={booking.passengers}
                  flightNumber={booking.flightNumber}
                />
              </div>

              {/* ── Right sidebar ─────────────────────────────────────────── */}
              <div className="space-y-4">

                {/* Booking actions */}
                <div className="rounded-2xl border border-gray-200 bg-white shadow-sm px-5 py-4">
                  <div className="text-[11px] uppercase tracking-widest text-gray-400 mb-3">Действия с бронированием</div>
                  <div className="space-y-2">
                    {/* Phoenix dispatch — opens vAMSYS dispatch which pre-files to VATSIM */}
                    <Button
                      className="w-full justify-start bg-[#E31E24] text-white hover:bg-[#c21920]"
                      onClick={handleOpenDispatch}
                      disabled={isDispatching || !booking.routeId}
                    >
                      {isDispatching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                      Подать на VATSIM / Phoenix
                    </Button>
                    {/* View booking in vAMSYS Phoenix portal */}
                    <Button variant="outline" className="w-full justify-start"
                      onClick={() => window.open(`https://vamsys.io/phoenix/bookings/${booking.id}`, "_blank", "noopener,noreferrer")}>
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Просмотреть в vAMSYS
                    </Button>
                    {/* VATSIM Prefile — direct flight plan filing on my.vatsim.net */}
                    <Button variant="outline" className="w-full justify-start"
                      onClick={() => {
                        const cs = encodeURIComponent(booking.callsign || booking.flightNumber);
                        const dep = encodeURIComponent(booking.departureCode);
                        const arr = encodeURIComponent(booking.arrivalCode);
                        const alt = encodeURIComponent(booking.altitude || "");
                        const rt = encodeURIComponent(booking.userRoute || route?.routeText || "");
                        window.open(
                          `https://my.vatsim.net/pilots/pre-file?callsign=${cs}&departure=${dep}&arrival=${arr}&altitude=${alt}&route=${rt}`,
                          "_blank", "noopener,noreferrer"
                        );
                      }}>
                      <ExternalLink className="mr-2 h-4 w-4" />
                      VATSIM Prefile
                    </Button>
                    {/* VATSIM map — live tracking */}
                    <Button variant="outline" className="w-full justify-start"
                      onClick={() => window.open(`https://map.vatsim.net/?search=${encodeURIComponent(booking.callsign || booking.flightNumber)}`, "_blank", "noopener,noreferrer")}>
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Карта VATSIM
                    </Button>
                    {/* FR24 — live flight by callsign */}
                    <Button variant="outline" className="w-full justify-start"
                      onClick={() => window.open(`https://www.flightradar24.com/${encodeURIComponent(booking.callsign || booking.flightNumber)}`, "_blank", "noopener,noreferrer")}>
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Flightradar24 (рейс)
                    </Button>
                    {/* FR24 by registration — aircraft history */}
                    {booking.registration && (
                      <Button variant="outline" className="w-full justify-start text-gray-500"
                        onClick={() => window.open(`https://www.flightradar24.com/data/aircraft/${encodeURIComponent(String(booking.registration || "").trim())}`, "_blank", "noopener,noreferrer")}>
                        <ExternalLink className="mr-2 h-4 w-4" />
                        FR24 по регистрации ({booking.registration})
                      </Button>
                    )}
                    <Button variant="outline" className="w-full justify-start"
                      onClick={() => navigate(`/dashboard?tab=manual-pirep&bookingId=${booking.id}`)}>
                      <ClipboardList className="mr-2 h-4 w-4" />
                      Подать ручной PIREP
                    </Button>
                    <Button variant="outline" className="w-full justify-start border-amber-200 text-amber-700 hover:bg-amber-50"
                      onClick={handleReportOutdatedRoute} disabled={isReportingRoute || !booking.routeId}>
                      {isReportingRoute ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <AlertTriangle className="mr-2 h-4 w-4" />}
                      {t("bookings.reportInactive")}
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" className="w-full justify-start" disabled={isCancelling}>
                          {isCancelling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                          Отменить бронирование
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Отменить текущее бронирование?</AlertDialogTitle>
                          <AlertDialogDescription>Это действие необратимо.</AlertDialogDescription>
                        </AlertDialogHeader>
                        {cascadeCancellationCount > 1 && (
                          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                            <div className="flex items-center gap-2 font-medium">
                              <AlertTriangle className="h-4 w-4" />
                              Будет отменена цепочка бронирований
                            </div>
                            <div className="mt-1 text-xs text-amber-700">
                              Вместе с текущим отменится ещё {cascadeCancellationCount - 1} по маршруту.
                            </div>
                          </div>
                        )}
                        <AlertDialogFooter>
                          <AlertDialogCancel disabled={isCancelling}>Назад</AlertDialogCancel>
                          <AlertDialogAction className="bg-[#E31E24] text-white hover:bg-[#c21920]" disabled={isCancelling}
                            onClick={(e) => { e.preventDefault(); void handleCancelBooking(); }}>
                            Подтвердить отмену
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    {/* Cancel & Rebook */}
                    {booking.routeId && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" className="w-full justify-start border-orange-200 text-orange-700 hover:bg-orange-50" disabled={isCancelling}>
                            {isCancelling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
                            Отмена + перебронь
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Отменить и забронировать снова?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Текущее бронирование будет отменено, и вы попадёте сразу к форме нового бронирования на этот же маршрут.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel disabled={isCancelling}>Назад</AlertDialogCancel>
                            <AlertDialogAction className="bg-orange-600 text-white hover:bg-orange-700" disabled={isCancelling}
                              onClick={(e) => { e.preventDefault(); void handleCancelAndRebook(); }}>
                              Подтвердить
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>

                {/* Network select */}
                <div className="rounded-2xl border border-gray-200 bg-white shadow-sm px-5 py-4">
                  <div className="text-[11px] uppercase tracking-widest text-gray-400 mb-3">Сеть</div>
                  <Select value={networkValue || "Offline"} onValueChange={handleNetworkUpdate} disabled={isUpdatingNetwork}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select network" />
                    </SelectTrigger>
                    <SelectContent>
                      {NETWORK_OPTIONS.map((network) => (
                        <SelectItem key={network} value={network}>{network}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* SimBrief */}
                <div className="rounded-2xl border border-gray-200 bg-white shadow-sm px-5 py-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-[11px] uppercase tracking-widest text-gray-400">SimBrief OFP</div>
                    {isLoadingSimbrief && <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />}
                    {!isLoadingSimbrief && simbriefData?.available && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        OFP привязан
                      </span>
                    )}
                    {!isLoadingSimbrief && simbriefData && !simbriefData.available && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-2 py-0.5 text-[10px] font-medium text-gray-400 border border-gray-200">
                        Не привязан
                      </span>
                    )}
                  </div>
                  <div className="space-y-2">
                    {simbriefData?.available ? (
                      <>
                        {simbriefData.url && (
                          <Button
                            variant="outline"
                            className="w-full justify-start"
                            onClick={() => window.open(simbriefData.url!, "_blank", "noopener,noreferrer")}
                          >
                            <ExternalLink className="mr-2 h-4 w-4" />
                            Открыть OFP
                          </Button>
                        )}
                        {simbriefData.pdfUrl && (
                          <Button
                            variant="outline"
                            className="w-full justify-start text-gray-600"
                            onClick={() => window.open(simbriefData.pdfUrl!, "_blank", "noopener,noreferrer")}
                          >
                            <ExternalLink className="mr-2 h-4 w-4" />
                            Скачать PDF
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start text-gray-400 text-xs"
                          onClick={() => void linkSimbrief()}
                          disabled={isLinkingSimbrief}
                        >
                          {isLinkingSimbrief ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="mr-2 h-3.5 w-3.5" />}
                          Обновить из SimBrief
                        </Button>
                      </>
                    ) : (
                      <>
                        <p className="text-xs text-gray-400 mb-2">
                          Создайте план в SimBrief для этого рейса, затем нажмите «Связать» — vAMSYS привяжет последний OFP к бронированию.
                        </p>
                        <Button
                          className="w-full justify-start bg-[#E31E24] text-white hover:bg-[#c21920]"
                          onClick={() => void linkSimbrief()}
                          disabled={isLinkingSimbrief || isLoadingSimbrief}
                        >
                          {isLinkingSimbrief ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
                          Связать из SimBrief
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {/* OFP Data */}
                {simbriefData?.ofp && (() => {
                  const ofp = simbriefData.ofp!;
                  const u = ofp.units;
                  const fmt = (v: number | null) => v != null ? v.toLocaleString("ru-RU") : "—";
                  return (
                    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm px-5 py-4 space-y-4">
                      <div className="text-[11px] uppercase tracking-widest text-gray-400">OFP · Данные плана</div>

                      {/* Header chips */}
                      <div className="flex flex-wrap gap-1.5">
                        {ofp.aircraft && <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs font-semibold text-slate-700">{ofp.aircraft}</span>}
                        {ofp.registration && <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-600">{ofp.registration}</span>}
                        {ofp.cruiseAlt && <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">FL{Math.round(Number(ofp.cruiseAlt) / 100)}</span>}
                        {ofp.costIndex && <span className="rounded-md bg-gray-50 px-2 py-0.5 text-xs text-gray-500">CI {ofp.costIndex}</span>}
                        {ofp.altnIcao && <span className="rounded-md bg-amber-50 px-2 py-0.5 text-xs text-amber-700">ALTN {ofp.altnIcao}</span>}
                        {ofp.ete && <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">ETE {ofp.ete}</span>}
                      </div>

                      {/* Fuel */}
                      <div>
                        <div className="mb-1.5 text-[10px] uppercase tracking-widest text-gray-400">Топливо ({u})</div>
                        <div className="grid grid-cols-2 gap-1.5">
                          {([
                            ["Ramp", ofp.fuel.ramp],
                            ["Burn", ofp.fuel.burn],
                            ["Reserve", ofp.fuel.reserve],
                            ["Alternate", ofp.fuel.altn],
                            ["Extra", ofp.fuel.extra],
                            ["Taxi", ofp.fuel.taxi],
                          ] as [string, number | null][]).filter(([, v]) => v != null).map(([label, value]) => (
                            <div key={label} className="rounded-lg bg-gray-50 px-3 py-2">
                              <div className="text-[9px] uppercase tracking-wider text-gray-400">{label}</div>
                              <div className="font-mono text-sm font-bold text-gray-800">{fmt(value)}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Weights */}
                      {(ofp.weights.zfw || ofp.weights.tow || ofp.weights.ldw) && (
                        <div>
                          <div className="mb-1.5 text-[10px] uppercase tracking-widest text-gray-400">Веса ({u})</div>
                          <div className="grid grid-cols-3 gap-1.5">
                            {([
                              ["ZFW", ofp.weights.zfw],
                              ["TOW", ofp.weights.tow],
                              ["LDW", ofp.weights.ldw],
                            ] as [string, number | null][]).map(([label, value]) => (
                              <div key={label} className="rounded-lg bg-gray-50 px-3 py-2">
                                <div className="text-[9px] uppercase tracking-wider text-gray-400">{label}</div>
                                <div className="font-mono text-sm font-bold text-gray-800">{fmt(value)}</div>
                              </div>
                            ))}
                          </div>
                          {ofp.weights.paxCount != null && (
                            <div className="mt-1.5 text-xs text-gray-400">Пассажиров: <span className="font-semibold text-gray-600">{ofp.weights.paxCount}</span></div>
                          )}
                        </div>
                      )}

                      {/* Route string */}
                      {ofp.route && (
                        <div>
                          <div className="mb-1 text-[10px] uppercase tracking-widest text-gray-400">Маршрут</div>
                          <div className="rounded-lg bg-gray-50 px-3 py-2 font-mono text-[11px] text-gray-700 break-all leading-relaxed">
                            {ofp.route}
                          </div>
                        </div>
                      )}

                      {/* Remarks */}
                      {ofp.remarks && (
                        <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-800 leading-relaxed">
                          {ofp.remarks}
                        </div>
                      )}

                      {/* Footer */}
                      {ofp.timeGenerated && (
                        <div className="text-[10px] text-gray-400">
                          Сгенерировано: {new Date(Number(ofp.timeGenerated) * 1000).toLocaleString("ru-RU", { timeZone: "UTC", timeZoneName: "short" })}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Liveries */}
                <div className="rounded-2xl border border-gray-200 bg-white shadow-sm px-5 py-4">
                  <div className="text-[11px] uppercase tracking-widest text-gray-400 mb-3">Ливреи</div>
                  <Button className="w-full bg-[#E31E24] text-white hover:bg-[#c21920] mb-2"
                    disabled={!liveries.length || !liveries[0]?.url}
                    onClick={() => { const u = liveries[0]?.url; if (u) window.open(u, "_blank", "noopener,noreferrer"); }}>
                    Скачать ливрею
                  </Button>
                  <div className="flex flex-wrap gap-1.5">
                    {liveries.length > 0
                      ? liveries.map((item, i) => (
                          <Badge key={`${item.label}-${i}`} variant="outline" className="bg-slate-50 text-slate-700 text-xs">{item.label}</Badge>
                        ))
                      : <span className="text-xs text-slate-400">Ливреи не найдены</span>}
                  </div>
                </div>

                {/* Scenarios */}
                {scenarios.length > 0 && (
                  <div className="rounded-2xl border border-gray-200 bg-white shadow-sm px-5 py-4">
                    <div className="text-[11px] uppercase tracking-widest text-gray-400 mb-3">Сценарии</div>
                    <div className="space-y-2">
                      {scenarios.map((item, i) => (
                        <Button key={`${item.label}-${i}`} variant="outline" className="w-full justify-start" disabled={!item.url}
                          onClick={() => { if (item.url) window.open(item.url, "_blank", "noopener,noreferrer"); }}>
                          <ExternalLink className="mr-2 h-4 w-4" />
                          {item.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

              </div>{/* end right sidebar */}
            </div>{/* end grid */}
          </div>{/* end max-w container */}
        </>
      )}
    </div>
  );
}
