import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, Cloud, ExternalLink, Loader2, Plane, RefreshCcw, Send, Trash2 } from "lucide-react";
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

interface SimbriefPayload {
  ok?: boolean;
  available?: boolean;
  url?: string | null;
  html?: string | null;
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
  const [cascadeCancellationCount, setCascadeCancellationCount] = useState(1);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isOpeningSimbrief, setIsOpeningSimbrief] = useState(false);
  const [isRefreshingSimbrief, setIsRefreshingSimbrief] = useState(false);

  useEffect(() => {
    if (!booking?.network) {
      setNetworkValue("");
      return;
    }
    setNetworkValue(booking.network);
  }, [booking?.network]);

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
      navigate("/dashboard?tab=bookings", { replace: true });
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

  const openSimbrief = async () => {
    if (!booking) {
      return;
    }

    setIsOpeningSimbrief(true);
    try {
      const response = await fetch(`/api/pilot/bookings/${booking.id}/simbrief`, {
        credentials: "include",
      });
      const payload = (await response.json().catch(() => null)) as SimbriefPayload | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to load SimBrief OFP");
      }

      if (payload?.url) {
        window.open(payload.url, "_blank", "noopener,noreferrer");
        return;
      }

      toast.message(payload?.message || "SimBrief OFP is not available for this booking yet.");
    } catch (error) {
      toast.error(String(error || "Failed to open SimBrief OFP"));
    } finally {
      setIsOpeningSimbrief(false);
    }
  };

  const refreshSimbrief = async () => {
    if (!booking) {
      return;
    }

    setIsRefreshingSimbrief(true);
    try {
      const response = await fetch(`/api/pilot/bookings/${booking.id}/simbrief`, {
        method: "PUT",
        credentials: "include",
      });
      const payload = (await response.json().catch(() => null)) as SimbriefPayload | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to refresh SimBrief OFP");
      }

      if (payload?.url) {
        toast.success("SimBrief OFP updated");
        window.open(payload.url, "_blank", "noopener,noreferrer");
        return;
      }

      toast.message(payload?.message || "SimBrief is not connected for this booking.");
    } catch (error) {
      toast.error(String(error || "Failed to refresh SimBrief OFP"));
    } finally {
      setIsRefreshingSimbrief(false);
    }
  };

  if (isAuthLoading) {
    return <div className="min-h-[50vh] flex items-center justify-center">Loading...</div>;
  }

  if (!isAuthenticated || !pilot) {
    return <Navigate to="/login" replace />;
  }

  if (bookingId <= 0) {
    return <Navigate to="/dashboard?tab=bookings" replace />;
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-4 px-4 py-4 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="outline" onClick={() => navigate("/dashboard?tab=bookings")}> 
          <ArrowLeft className="mr-2 h-4 w-4" />
          К бронированиям
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => window.location.reload()}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            {t("bookings.refresh")}
          </Button>
          <Button className="bg-[#E31E24] text-white hover:bg-[#c21920]" onClick={handleOpenDispatch} disabled={isDispatching || !booking?.routeId}>
            {isDispatching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Phoenix / VATSIM
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Card className="border-none shadow-sm">
          <CardContent className="flex items-center gap-3 p-6 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("bookings.loadingDetails")}
          </CardContent>
        </Card>
      ) : !booking ? (
        <Card className="border-none shadow-sm">
          <CardContent className="p-6 text-sm text-gray-500">{t("bookings.noDetails")}</CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="space-y-4">
            <Card className="border-none shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg text-[#1d1d1f]">
                  <Plane className="h-5 w-5 text-[#E31E24]" />
                  {booking.flightNumber} · {booking.departureCode} to {booking.arrivalCode}
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm text-gray-700 sm:grid-cols-2">
                <div><span className="text-gray-500">{t("bookings.field.status")}: </span><span className="font-medium">{booking.statusLabel}</span></div>
                <div><span className="text-gray-500">{t("bookings.field.aircraft")}: </span><span className="font-medium">{booking.aircraft}</span></div>
                <div><span className="text-gray-500">{t("bookings.field.departureTime")}: </span><span className="font-medium">{formatDateTime(booking.departureTime)}</span></div>
                <div><span className="text-gray-500">{t("bookings.field.validTo")}: </span><span className="font-medium">{formatDateTime(booking.validTo)}</span></div>
                <div><span className="text-gray-500">{t("bookings.field.altitude")}: </span><span className="font-medium">{booking.altitude || "-"}</span></div>
                <div><span className="text-gray-500">{t("bookings.field.network")}: </span><span className="font-medium">{booking.network || "Offline"}</span></div>
                <div className="sm:col-span-2"><span className="text-gray-500">{t("bookings.field.userRoute")}: </span><span className="font-medium">{booking.userRoute || route?.routeText || "-"}</span></div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Карта маршрута</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[420px] overflow-hidden rounded-xl bg-slate-100">
                  <FlightMap route={mapRoute} />
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card className="border-none shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base"><Cloud className="h-4 w-4 text-blue-600" />METAR {booking.departureCode}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-800">{metarFrom?.raw || "METAR unavailable"}</div>
                  <div className="text-xs text-slate-500">Observed: {formatDateTime(metarFrom?.observedAt || null)}</div>
                </CardContent>
              </Card>

              <Card className="border-none shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base"><Cloud className="h-4 w-4 text-blue-600" />METAR {booking.arrivalCode}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-800">{metarTo?.raw || "METAR unavailable"}</div>
                  <div className="text-xs text-slate-500">Observed: {formatDateTime(metarTo?.observedAt || null)}</div>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="space-y-4">
            <Card className="border-none shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Операции</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label>{t("bookings.field.network")}</Label>
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

                <Button
                                    variant="outline"
                                    className="w-full justify-start border-amber-200 text-amber-700 hover:bg-amber-50 hover:text-amber-800"
                                    onClick={handleReportOutdatedRoute}
                                    disabled={isReportingRoute || !booking.routeId}
                                  >
                                    {isReportingRoute ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <AlertTriangle className="mr-2 h-4 w-4" />}
                                    {t("bookings.reportInactive")}
                                  </Button>

                                  <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => window.open(`https://map.vatsim.net/?search=${encodeURIComponent(booking.callsign || booking.flightNumber)}`, "_blank", "noopener,noreferrer")}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Отправка / просмотр в VATSIM
                </Button>

                <Button
                  variant="outline"
                  className="w-full justify-start"
                  disabled={!booking.registration}
                  onClick={() =>
                    window.open(
                      `https://www.flightradar24.com/data/aircraft/${encodeURIComponent(String(booking.registration || "").trim())}`,
                      "_blank",
                      "noopener,noreferrer"
                    )
                  }
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  FR24 по регистрации
                </Button>

                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={openSimbrief}
                  disabled={isOpeningSimbrief || isRefreshingSimbrief}
                >
                  {isOpeningSimbrief ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ExternalLink className="mr-2 h-4 w-4" />}
                  SimBrief OFP
                </Button>

                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={refreshSimbrief}
                  disabled={isRefreshingSimbrief || isOpeningSimbrief}
                >
                  {isRefreshingSimbrief ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
                  Обновить SimBrief OFP
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
                      <AlertDialogDescription>
                        Это действие необратимо.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    {cascadeCancellationCount > 1 ? (
                      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                        <div className="flex items-center gap-2 font-medium">
                          <AlertTriangle className="h-4 w-4" />
                          Будет отменена цепочка бронирований
                        </div>
                        <div className="mt-1 text-xs text-amber-700">
                          Вместе с текущим бронированием отменится еще {cascadeCancellationCount - 1} последующих по маршруту.
                        </div>
                      </div>
                    ) : null}
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={isCancelling}>Назад</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-[#E31E24] text-white hover:bg-[#c21920]"
                        disabled={isCancelling}
                        onClick={(event) => {
                          event.preventDefault();
                          void handleCancelBooking();
                        }}
                      >
                        Подтвердить отмену
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Ливреи</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  className="w-full bg-[#E31E24] text-white hover:bg-[#c21920]"
                  disabled={!liveries.length || !liveries[0]?.url}
                  onClick={() => {
                    const target = liveries[0]?.url;
                    if (target) {
                      window.open(target, "_blank", "noopener,noreferrer");
                    }
                  }}
                >
                  Скачать ливрею
                </Button>
                <div className="flex flex-wrap gap-2">
                  {liveries.length > 0 ? (
                    liveries.map((item, index) => (
                      <Badge key={`${item.label}-${index}`} variant="outline" className="bg-slate-50 text-slate-700">
                        {item.label}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-slate-500">Ливреи не найдены</span>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Сценарии (опционально)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {scenarios.length > 0 ? (
                  scenarios.map((item, index) => (
                    <Button
                      key={`${item.label}-${index}`}
                      variant="outline"
                      className="w-full justify-start"
                      disabled={!item.url}
                      onClick={() => {
                        if (item.url) {
                          window.open(item.url, "_blank", "noopener,noreferrer");
                        }
                      }}
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      {item.label}
                    </Button>
                  ))
                ) : (
                  <span className="text-sm text-slate-500">Сценарии не найдены</span>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
