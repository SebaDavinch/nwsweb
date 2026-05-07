import { useEffect, useState } from "react";
import { useLanguage } from "../../context/language-context";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Card, CardContent } from "../ui/card";
import { ToggleGroup, ToggleGroupItem } from "../ui/toggle-group";
import { Plane, Clock, MapPin, Calendar, TrendingUp, LayoutGrid, List, Scale, Star } from "lucide-react";
import { toast } from "sonner";
import { CountryFlag } from "./country-flag";
import { createDashboardSessionCache, fetchDashboardSessionCache, getDashboardSessionCache } from "./dashboard-session-cache";

interface Flight {
  id: number;
  flightNumber: string;
  departure: string;
  departureIcao?: string;
  departureAirport?: string;
  departureCity?: string;
  departureCountryIso2?: string | null;
  arrival: string;
  arrivalIcao?: string;
  arrivalAirport?: string;
  arrivalCountryIso2?: string | null;
  destination?: string;
  destinationCity?: string;
  date?: string;
  duration: string;
  aircraft: string;
  status: string;
  distance: string;
  landing: string;
  landingRate?: number | null;
  gForce?: number | null;
  completedDate?: string;
  needReply?: boolean;
}

interface RecentFlightsResponse {
  flights?: Array<Partial<Flight>>;
  error?: string;
}

interface RecentFlightsProps {
  onOpenPirep?: (pirepId: number) => void;
}

interface FlightLogPreferences {
  savedPirepIds: number[];
  comparePirepIds: number[];
}

type RecentFlightsViewMode = "gallery" | "list";

const RECENT_FLIGHTS_VIEW_MODE_KEY = "nws.dashboard.recentFlights.viewMode";
const recentFlightsCache = createDashboardSessionCache<Flight[]>("nws.dashboard.recentFlights.v2", 2 * 60 * 1000);

const normalizeNumber = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const formatAirportDisplay = (city?: string, airport?: string, code?: string) => {
  const resolvedCode = String(code || "").trim() || "—";
  const resolvedAirport = String(airport || "").trim() || resolvedCode;
  const resolvedCity = String(city || "").trim() || resolvedAirport;

  if (resolvedAirport.toLowerCase() === resolvedCity.toLowerCase()) {
    return {
      primary: resolvedCity,
      secondary: `(${resolvedCode})`,
    };
  }

  return {
    primary: resolvedCity,
    secondary: `(${resolvedAirport}, ${resolvedCode})`,
  };
};

const formatGForce = (value?: number | null) => {
  if (!Number.isFinite(Number(value))) {
    return "—";
  }

  return `${Number(value).toFixed(2)} G`;
};

const normalizePirepStatus = (value?: string | null) => {
  return String(value || "completed")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
};

const getRecentFlightStatusKey = (flight: Pick<Flight, "status" | "needReply">) => {
  if (flight.needReply) {
    return "needs_reply";
  }

  const normalized = normalizePirepStatus(flight.status);

  if (["accepted", "auto_accepted", "approved", "completed"].includes(normalized)) {
    return "accepted";
  }

  if (["rejected", "denied", "failed", "cancelled"].includes(normalized)) {
    return "rejected";
  }

  if (["invalidated", "invalid", "void"].includes(normalized)) {
    return "invalidated";
  }

  if (["pending", "submitted", "in_review", "processing", "awaiting_review"].includes(normalized)) {
    return "awaiting_review";
  }

  return normalized || "completed";
};

const formatPirepStatusLabel = (
  flight: Pick<Flight, "status" | "needReply">,
  t: (key: string) => string
) => {
  const key = getRecentFlightStatusKey(flight);

  if (key === "accepted") {
    return t("dashboard.recent.status.accepted");
  }
  if (key === "rejected") {
    return t("dashboard.recent.status.rejected");
  }
  if (key === "awaiting_review") {
    return t("dashboard.recent.status.awaitingReview");
  }
  if (key === "needs_reply") {
    return t("dashboard.recent.status.needsReply");
  }
  if (key === "invalidated") {
    return t("dashboard.recent.status.invalidated");
  }

  return key
    .split(/[_-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const getPirepStatusBadgeClassName = (flight: Pick<Flight, "status" | "needReply">) => {
  const normalized = getRecentFlightStatusKey(flight);

  if (["accepted"].includes(normalized)) {
    return "bg-green-100 text-green-800";
  }

  if (["rejected"].includes(normalized)) {
    return "bg-red-100 text-red-800";
  }

  if (["awaiting_review", "needs_reply"].includes(normalized)) {
    return "bg-amber-100 text-amber-800";
  }

  if (["invalidated"].includes(normalized)) {
    return "bg-slate-200 text-slate-800";
  }

  return "bg-gray-100 text-gray-700";
};

const getLandingRateClassName = (value?: number | null) => {
  if (!Number.isFinite(Number(value))) {
    return "text-gray-500";
  }

  return Number(value) <= -300 ? "text-red-600" : "text-green-600";
};

export function RecentFlights({ onOpenPirep }: RecentFlightsProps) {
  const { t } = useLanguage();
  const [flights, setFlights] = useState<Flight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [viewMode, setViewMode] = useState<RecentFlightsViewMode>("gallery");
  const [statusFilter, setStatusFilter] = useState("all");
  const [preferences, setPreferences] = useState<FlightLogPreferences>({
    savedPirepIds: [],
    comparePirepIds: [],
  });
  const [isSavingPreferences, setIsSavingPreferences] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const savedViewMode = window.localStorage.getItem(RECENT_FLIGHTS_VIEW_MODE_KEY);
    if (savedViewMode === "gallery" || savedViewMode === "list") {
      setViewMode(savedViewMode);
    }
  }, []);

  const handleViewModeChange = (nextViewMode: string) => {
    if (nextViewMode !== "gallery" && nextViewMode !== "list") {
      return;
    }

    setViewMode(nextViewMode);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(RECENT_FLIGHTS_VIEW_MODE_KEY, nextViewMode);
    }
  };

  useEffect(() => {
    let active = true;

    const loadPreferences = async () => {
      try {
        const response = await fetch("/api/pilot/preferences", { credentials: "include" });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !active) {
          return;
        }
        const nextPreferences = payload?.preferences?.flightLog;
        setPreferences({
          savedPirepIds: Array.isArray(nextPreferences?.savedPirepIds)
            ? nextPreferences.savedPirepIds.map((item: unknown) => Number(item || 0) || 0).filter((item: number) => item > 0)
            : [],
          comparePirepIds: Array.isArray(nextPreferences?.comparePirepIds)
            ? nextPreferences.comparePirepIds.map((item: unknown) => Number(item || 0) || 0).filter((item: number) => item > 0).slice(0, 3)
            : [],
        });
      } catch {
        if (active) {
          setPreferences({ savedPirepIds: [], comparePirepIds: [] });
        }
      }
    };

    void loadPreferences();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setHasError(false);

      try {
        const normalized = await fetchDashboardSessionCache(recentFlightsCache, async () => {
          const response = await fetch("/api/vamsys/recent-flights", {
            credentials: "include",
          });
          const payload = (await response.json().catch(() => null)) as RecentFlightsResponse | null;
          if (!response.ok) {
            throw new Error(String(payload?.error || "Failed to fetch recent flights"));
          }

          return Array.isArray(payload?.flights)
            ? payload.flights.map((item) => {
                const landingRate = normalizeNumber(item?.landingRate);
                const landingLabel = String(item?.landing || "").trim() || (landingRate !== null ? `${landingRate} fpm` : "—");
                return {
                  id: Number(item?.id || 0) || 0,
                  flightNumber: String(item?.flightNumber || "—").trim() || "—",
                  departure: String(item?.departure || "—").trim() || "—",
                  departureIcao: String(item?.departureIcao || item?.departure || "—").trim() || "—",
                  departureAirport: String(item?.departureAirport || item?.departureCity || item?.departure || "—").trim() || "—",
                  departureCity: String(item?.departureCity || item?.departureAirport || item?.departure || "—").trim() || "—",
                  departureCountryIso2: String(item?.departureCountryIso2 || "").trim() || null,
                  arrival: String(item?.arrival || item?.destination || "—").trim() || "—",
                  arrivalIcao: String(item?.arrivalIcao || item?.arrival || item?.destination || "—").trim() || "—",
                  arrivalAirport: String(item?.arrivalAirport || item?.destinationCity || item?.arrival || item?.destination || "—").trim() || "—",
                  destinationCity: String(item?.destinationCity || item?.arrivalAirport || item?.arrival || item?.destination || "—").trim() || "—",
                  arrivalCountryIso2: String(item?.arrivalCountryIso2 || "").trim() || null,
                  date: String(item?.completedDate || item?.date || "").trim(),
                  duration: String(item?.duration || "—").trim() || "—",
                  aircraft: String(item?.aircraft || "—").trim() || "—",
                  status: String(item?.status || "Completed").trim() || "Completed",
                  needReply: Boolean(item?.needReply),
                  distance: String(item?.distance || "—").trim() || "—",
                  landing: landingLabel,
                  landingRate,
                  gForce: normalizeNumber(item?.gForce),
                  completedDate: String(item?.completedDate || item?.date || "").trim(),
                } satisfies Flight;
              })
            : [];
        });

        setFlights(normalized);
      } catch {
        const cached = getDashboardSessionCache(recentFlightsCache);
        if (cached) {
          setFlights(cached);
        } else {
          setFlights([]);
          setHasError(true);
        }
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, []);

  const persistFlightLogPreferences = async (nextPreferences: FlightLogPreferences) => {
    setPreferences(nextPreferences);
    setIsSavingPreferences(true);
    try {
      const response = await fetch("/api/pilot/preferences", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flightLog: nextPreferences,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || payload?.ok === false) {
        throw new Error(String(payload?.error || "Failed to save flight log preferences"));
      }
    } catch (error) {
      toast.error(String(error instanceof Error ? error.message : "Failed to save flight log preferences"));
    } finally {
      setIsSavingPreferences(false);
    }
  };

  const toggleSavedFlight = async (flightId: number) => {
    const isSaved = preferences.savedPirepIds.includes(flightId);
    const nextPreferences = {
      ...preferences,
      savedPirepIds: isSaved
        ? preferences.savedPirepIds.filter((item) => item !== flightId)
        : [flightId, ...preferences.savedPirepIds.filter((item) => item !== flightId)].slice(0, 48),
    };
    await persistFlightLogPreferences(nextPreferences);
  };

  const toggleCompareFlight = async (flightId: number) => {
    const isCompared = preferences.comparePirepIds.includes(flightId);
    const nextCompare = isCompared
      ? preferences.comparePirepIds.filter((item) => item !== flightId)
      : [...preferences.comparePirepIds, flightId].slice(0, 3);

    if (!isCompared && preferences.comparePirepIds.length >= 3) {
      toast.error(t("dashboard.recent.compareMax"));
      return;
    }

    await persistFlightLogPreferences({
      ...preferences,
      comparePirepIds: nextCompare,
    });
  };

  if (isLoading) {
    return <div className="text-gray-500">{t("dashboard.recent.loading")}</div>;
  }

  if (hasError) {
    return <div className="text-red-600">{t("dashboard.recent.error")}</div>;
  }

  if (!flights.length) {
    return <div className="text-gray-500">{t("dashboard.recent.empty")}</div>;
  }

  const statusOptions = Array.from(
    flights.reduce((map, flight) => {
      const key = getRecentFlightStatusKey(flight);
      map.set(key, (map.get(key) || 0) + 1);
      return map;
    }, new Map<string, number>())
  )
    .sort((left, right) => {
      const order = ["needs_reply", "awaiting_review", "accepted", "rejected", "invalidated"];
      const leftIndex = order.indexOf(left[0]);
      const rightIndex = order.indexOf(right[0]);
      if (leftIndex >= 0 || rightIndex >= 0) {
        if (leftIndex < 0) {
          return 1;
        }
        if (rightIndex < 0) {
          return -1;
        }
        return leftIndex - rightIndex;
      }
      return right[1] - left[1];
    })
    .map(([status, count]) => ({
      status,
      count,
      label: formatPirepStatusLabel({ status, needReply: status === "needs_reply" }, t),
    }));

  const filteredFlights =
    statusFilter === "all"
      ? flights
      : flights.filter((flight) => getRecentFlightStatusKey(flight) === statusFilter);
  const savedFlights = flights.filter((flight) => preferences.savedPirepIds.includes(flight.id));
  const comparedFlights = flights.filter((flight) => preferences.comparePirepIds.includes(flight.id));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#2A2A2A]">{t("dashboard.recent.title")}</h2>
          <p className="text-gray-600">{t("dashboard.recent.subtitle")}</p>
        </div>
        <ToggleGroup
          type="single"
          value={viewMode}
          onValueChange={handleViewModeChange}
          variant="outline"
          className="inline-flex self-start"
          aria-label={t("dashboard.recent.title")}
        >
          <ToggleGroupItem value="gallery" aria-label={t("dashboard.recent.gallery")}>
            <LayoutGrid className="h-4 w-4" />
            {t("dashboard.recent.gallery")}
          </ToggleGroupItem>
          <ToggleGroupItem value="list" aria-label={t("dashboard.recent.list")}>
            <List className="h-4 w-4" />
            {t("dashboard.recent.list")}
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {(savedFlights.length > 0 || comparedFlights.length > 0) ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <Card className="border-none shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-[#2A2A2A]">{t("dashboard.recent.savedFlights")}</div>
                  <div className="text-xs text-gray-500">{t("dashboard.recent.savedFlightsDesc")}</div>
                </div>
                <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">{savedFlights.length}</Badge>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {savedFlights.length > 0 ? savedFlights.map((flight) => (
                  <button
                    key={`saved-${flight.id}`}
                    type="button"
                    onClick={() => onOpenPirep?.(flight.id)}
                    className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:border-[#E31E24] hover:text-[#E31E24]"
                  >
                    {flight.flightNumber} · {flight.departure} - {flight.arrival}
                  </button>
                )) : <div className="text-sm text-gray-500">{t("dashboard.recent.noSaved")}</div>}
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-[#2A2A2A]">{t("dashboard.recent.compareFlights")}</div>
                  <div className="text-xs text-gray-500">{t("dashboard.recent.compareFlightsDesc")}</div>
                </div>
                <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-700">{comparedFlights.length}/3</Badge>
              </div>
              {comparedFlights.length > 0 ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {comparedFlights.map((flight) => (
                    <div key={`compare-${flight.id}`} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                      <div className="text-sm font-semibold text-[#2A2A2A]">{flight.flightNumber}</div>
                      <div className="mt-1 text-xs text-gray-500">{flight.departure} - {flight.arrival}</div>
                      <div className="mt-3 space-y-1 text-xs text-gray-600">
                        <div>{t("dashboard.recent.duration")}: <span className="font-semibold text-[#2A2A2A]">{flight.duration}</span></div>
                        <div>{t("dashboard.recent.distance")}: <span className="font-semibold text-[#2A2A2A]">{flight.distance}</span></div>
                        <div>{t("dashboard.recent.landing")}: <span className={`font-semibold ${getLandingRateClassName(flight.landingRate)}`}>{flight.landing}</span></div>
                        <div>{t("dashboard.recent.gForce")}: <span className="font-semibold text-[#2A2A2A]">{formatGForce(flight.gForce)}</span></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 text-sm text-gray-500">{t("dashboard.recent.compareHint")}</div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t("dashboard.recent.filters")}</div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={statusFilter === "all" ? "default" : "outline"}
            className={statusFilter === "all" ? "bg-[#E31E24] text-white hover:bg-[#c21920]" : ""}
            onClick={() => setStatusFilter("all")}
          >
            {t("dashboard.recent.filterAll")}
            <Badge variant="outline" className="ml-2 border-white/30 bg-white/20 text-inherit">
              {flights.length}
            </Badge>
          </Button>

          {statusOptions.map((option) => (
            <Button
              key={option.status}
              size="sm"
              variant={statusFilter === option.status ? "default" : "outline"}
              className={statusFilter === option.status ? "bg-[#E31E24] text-white hover:bg-[#c21920]" : ""}
              onClick={() => setStatusFilter(option.status)}
            >
              {option.label}
              <Badge variant="outline" className="ml-2 border-white/30 bg-white/20 text-inherit">
                {option.count}
              </Badge>
            </Button>
          ))}
        </div>
      </div>

      {filteredFlights.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
          {t("dashboard.recent.emptyFiltered")}
        </div>
      ) : null}

      {viewMode === "gallery" && filteredFlights.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredFlights.map((flight) => {
            const departureDisplay = formatAirportDisplay(flight.departureCity, flight.departureAirport, flight.departureIcao || flight.departure);
            const arrivalDisplay = formatAirportDisplay(flight.destinationCity, flight.arrivalAirport, flight.arrivalIcao || flight.arrival);
            const isSaved = preferences.savedPirepIds.includes(flight.id);
            const isCompared = preferences.comparePirepIds.includes(flight.id);
            return (
            <Card key={flight.id} className="border-2 hover:border-[#E31E24] transition-colors">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4 pb-4 border-b">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-[#E31E24] rounded-lg flex items-center justify-center">
                      <Plane className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-[#2A2A2A]">{flight.flightNumber || "—"}</h3>
                      <p className="text-sm text-gray-600">{flight.aircraft}</p>
                    </div>
                  </div>
                  <div className={`text-xs px-3 py-1 rounded-full font-semibold ${getPirepStatusBadgeClassName(flight)}`}>
                    {formatPirepStatusLabel(flight, t)}
                  </div>
                </div>

                <div className="mb-4 flex flex-wrap gap-2">
                  <Button size="sm" variant={isSaved ? "default" : "outline"} className={isSaved ? "bg-amber-500 text-white hover:bg-amber-600" : ""} onClick={() => void toggleSavedFlight(flight.id)} disabled={isSavingPreferences}>
                    <Star className={`mr-2 h-4 w-4 ${isSaved ? "fill-current" : ""}`} />
                    {isSaved ? t("dashboard.recent.saved") : t("dashboard.recent.save")}
                  </Button>
                  <Button size="sm" variant={isCompared ? "default" : "outline"} className={isCompared ? "bg-sky-600 text-white hover:bg-sky-700" : ""} onClick={() => void toggleCompareFlight(flight.id)} disabled={isSavingPreferences}>
                    <Scale className="mr-2 h-4 w-4" />
                    {isCompared ? t("dashboard.recent.compared") : t("dashboard.recent.compare")}
                  </Button>
                </div>

                <div className="mb-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1 text-left">
                      <div className="flex items-start gap-2">
                        <CountryFlag iso2={flight.departureCountryIso2} className="h-4 w-6 mt-1 shrink-0" fallbackText={flight.departure.slice(0, 2)} />
                        <div className="break-words text-lg font-bold text-[#2A2A2A]">{departureDisplay.primary}</div>
                      </div>
                      <div className="mt-1 text-xs text-gray-600">{departureDisplay.secondary}</div>
                    </div>
                    <div className="relative mx-2 mt-4 hidden h-6 flex-1 sm:block">
                      <div className="border-t-2 border-dashed border-gray-300"></div>
                      <Plane className="absolute top-1/2 left-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 text-[#E31E24]" />
                    </div>
                    <div className="min-w-0 flex-1 text-right">
                      <div className="flex items-start justify-end gap-2">
                        <div className="break-words text-lg font-bold text-[#2A2A2A]">{arrivalDisplay.primary}</div>
                        <CountryFlag iso2={flight.arrivalCountryIso2} className="h-4 w-6 mt-1 shrink-0" fallbackText={flight.arrival.slice(0, 2)} />
                      </div>
                      <div className="mt-1 text-xs text-gray-600">{arrivalDisplay.secondary}</div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-gray-600 mb-1">
                      <Clock className="w-4 h-4" />
                      <span className="text-xs">{t("dashboard.recent.duration")}</span>
                    </div>
                    <div className="font-bold text-[#2A2A2A]">{flight.duration}</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-gray-600 mb-1">
                      <MapPin className="w-4 h-4" />
                      <span className="text-xs">{t("dashboard.recent.distance")}</span>
                    </div>
                    <div className="font-bold text-[#2A2A2A]">{flight.distance}</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-gray-600 mb-1">
                      <Calendar className="w-4 h-4" />
                      <span className="text-xs">{t("dashboard.recent.date")}</span>
                    </div>
                    <div className="font-bold text-[#2A2A2A]">
                      {flight.date
                        ? new Date(flight.date).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })
                        : "—"}
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-gray-600 mb-1">
                      <TrendingUp className="w-4 h-4" />
                      <span className="text-xs">{t("dashboard.recent.landing")}</span>
                    </div>
                    <div className={`font-bold ${getLandingRateClassName(flight.landingRate)}`}>{flight.landing}</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-gray-600 mb-1">
                      <TrendingUp className="w-4 h-4" />
                      <span className="text-xs">{t("dashboard.recent.gForce")}</span>
                    </div>
                    <div className="font-bold text-[#2A2A2A]">{formatGForce(flight.gForce)}</div>
                  </div>
                </div>

                {onOpenPirep && flight.id > 0 ? (
                  <div className="mt-4 flex justify-end">
                    <Button size="sm" variant="outline" onClick={() => onOpenPirep(flight.id)}>
                      {t("dashboard.recent.viewDetails")}
                    </Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          );})}
        </div>
      ) : viewMode === "list" && filteredFlights.length > 0 ? (
        <div className="space-y-3">
          {filteredFlights.map((flight) => {
            const departureDisplay = formatAirportDisplay(flight.departureCity, flight.departureAirport, flight.departureIcao || flight.departure);
            const arrivalDisplay = formatAirportDisplay(flight.destinationCity, flight.arrivalAirport, flight.arrivalIcao || flight.arrival);
            const isSaved = preferences.savedPirepIds.includes(flight.id);
            const isCompared = preferences.comparePirepIds.includes(flight.id);
            return (
            <Card key={flight.id} className="border hover:border-[#E31E24] transition-colors">
              <CardContent className="p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#E31E24]">
                      <Plane className="h-5 w-5 text-white" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-bold text-[#2A2A2A]">{flight.flightNumber || "—"}</h3>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getPirepStatusBadgeClassName(flight)}`}>
                          {formatPirepStatusLabel(flight, t)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">{flight.aircraft}</p>
                      <div className="mt-2 flex flex-col gap-2 text-sm text-[#2A2A2A]">
                        <div className="flex flex-wrap items-center gap-2 font-semibold">
                          <CountryFlag iso2={flight.departureCountryIso2} className="h-4 w-6 shrink-0" fallbackText={flight.departure.slice(0, 2)} />
                          <span title={departureDisplay.primary}>{departureDisplay.primary}</span>
                          <Plane className="h-3.5 w-3.5 shrink-0 text-[#E31E24]" />
                          <span title={arrivalDisplay.primary}>{arrivalDisplay.primary}</span>
                          <CountryFlag iso2={flight.arrivalCountryIso2} className="h-4 w-6 shrink-0" fallbackText={flight.arrival.slice(0, 2)} />
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                          <span>{departureDisplay.secondary}</span>
                          <span>•</span>
                          <span>{arrivalDisplay.secondary}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-5 lg:min-w-[520px]">
                    <div className="rounded-lg bg-gray-50 px-3 py-2">
                      <div className="mb-1 flex items-center gap-1.5 text-xs text-gray-500">
                        <Clock className="h-3.5 w-3.5" />
                        {t("dashboard.recent.duration")}
                      </div>
                      <div className="font-semibold text-[#2A2A2A]">{flight.duration}</div>
                    </div>
                    <div className="rounded-lg bg-gray-50 px-3 py-2">
                      <div className="mb-1 flex items-center gap-1.5 text-xs text-gray-500">
                        <MapPin className="h-3.5 w-3.5" />
                        {t("dashboard.recent.distance")}
                      </div>
                      <div className="font-semibold text-[#2A2A2A]">{flight.distance}</div>
                    </div>
                    <div className="rounded-lg bg-gray-50 px-3 py-2">
                      <div className="mb-1 flex items-center gap-1.5 text-xs text-gray-500">
                        <Calendar className="h-3.5 w-3.5" />
                        {t("dashboard.recent.date")}
                      </div>
                      <div className="font-semibold text-[#2A2A2A]">
                        {flight.date
                          ? new Date(flight.date).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                            })
                          : "—"}
                      </div>
                    </div>
                    <div className="rounded-lg bg-gray-50 px-3 py-2">
                      <div className="mb-1 flex items-center gap-1.5 text-xs text-gray-500">
                        <TrendingUp className="h-3.5 w-3.5" />
                        {t("dashboard.recent.landing")}
                      </div>
                      <div className={`font-semibold ${getLandingRateClassName(flight.landingRate)}`}>{flight.landing}</div>
                    </div>
                    <div className="rounded-lg bg-gray-50 px-3 py-2">
                      <div className="mb-1 flex items-center gap-1.5 text-xs text-gray-500">
                        <TrendingUp className="h-3.5 w-3.5" />
                        {t("dashboard.recent.gForce")}
                      </div>
                      <div className="font-semibold text-[#2A2A2A]">{formatGForce(flight.gForce)}</div>
                    </div>
                  </div>

                  <div className="flex flex-wrap justify-end gap-2 lg:min-w-[280px]">
                    <Button size="sm" variant={isSaved ? "default" : "outline"} className={isSaved ? "bg-amber-500 text-white hover:bg-amber-600" : ""} onClick={() => void toggleSavedFlight(flight.id)} disabled={isSavingPreferences}>
                      <Star className={`mr-2 h-4 w-4 ${isSaved ? "fill-current" : ""}`} />
                      {isSaved ? "Saved" : "Save"}
                    </Button>
                    <Button size="sm" variant={isCompared ? "default" : "outline"} className={isCompared ? "bg-sky-600 text-white hover:bg-sky-700" : ""} onClick={() => void toggleCompareFlight(flight.id)} disabled={isSavingPreferences}>
                      <Scale className="mr-2 h-4 w-4" />
                      {isCompared ? "Compared" : "Compare"}
                    </Button>
                    {onOpenPirep && flight.id > 0 ? (
                      <Button size="sm" variant="outline" onClick={() => onOpenPirep(flight.id)}>
                        {t("dashboard.recent.viewDetails")}
                      </Button>
                    ) : null}
                  </div>
                </div>
              </CardContent>
            </Card>
          );})}
        </div>
      ) : null}
    </div>
  );
}
