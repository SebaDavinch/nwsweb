import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  CalendarPlus,
  Check,
  ChevronsUpDown,
  ExternalLink,
  Eye,
  Loader2,
  MapPin,
  Plane,
  RefreshCcw,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "../../context/language-context";
import { useNotifications } from "../../context/notifications-context";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { ScrollArea } from "../ui/scroll-area";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "../ui/command";
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

interface AircraftTypeOption {
  key: string;
  model: string;
  fleetName: string;
  label: string;
}

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
  network?: string;
  altitude?: string;
  passengers?: number | null;
  cargo?: number | null;
  userRoute?: string;
  departureTime?: string | null;
  arrivalTime?: string | null;
  estimatedArrivalTime?: string | null;
  validTo?: string | null;
  createdAt?: string | null;
  deletedAt?: string | null;
  status: string;
  statusLabel: string;
  canCancel: boolean;
}

interface BookingDetailResponse {
  booking?: Booking;
}

interface BookingsResponse {
  bookings?: Booking[];
  error?: string;
  code?: string;
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

interface PilotLocationResponse {
  airportCode?: string | null;
  locationLabel?: string | null;
}

interface NotamSummaryResponse {
  summary?: {
    unread?: number;
  };
}

interface BookingFormState {
  destinationCode: string;
  routeId: string;
  routeQuery: string;
  aircraftMode: "direct" | "type";
  aircraftTypeKey: string;
  aircraftTypeQuery: string;
  aircraftId: string;
  aircraftQuery: string;
  departureTime: string;
}

const toUtcDateTimeValue = (value: Date | string) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const parseUtcDateTimeValue = (value: string) => {
  const match = String(value || "")
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0));
  return Number.isNaN(date.getTime()) ? null : date;
};

const roundUpUtcMinutes = (date: Date, stepMinutes: number) => {
  const rounded = new Date(date.getTime());
  rounded.setUTCSeconds(0, 0);
  const currentMinutes = rounded.getUTCMinutes();
  const nextMinutes = Math.ceil(currentMinutes / stepMinutes) * stepMinutes;
  if (nextMinutes >= 60) {
    rounded.setUTCHours(rounded.getUTCHours() + 1, 0, 0, 0);
  } else {
    rounded.setUTCMinutes(nextMinutes, 0, 0);
  }
  return rounded;
};

const buildDefaultDepartureTime = () => {
  const now = new Date();
  const minTarget = new Date(now.getTime() + 30 * 60_000);
  const maxTarget = new Date(now.getTime() + 40 * 60_000);

  let selected = roundUpUtcMinutes(minTarget, 5);
  if (selected.getTime() > maxTarget.getTime()) {
    selected = new Date(now.getTime() + 35 * 60_000);
    selected.setUTCSeconds(0, 0);
  }

  return toUtcDateTimeValue(selected);
};

const createEmptyForm = (): BookingFormState => ({
  destinationCode: "",
  routeId: "",
  routeQuery: "",
  aircraftMode: "direct",
  aircraftTypeKey: "",
  aircraftTypeQuery: "",
  aircraftId: "",
  aircraftQuery: "",
  departureTime: buildDefaultDepartureTime(),
});

const getRouteOptionLabel = (route: RouteOption) =>
  `${route.flightNumber || route.callsign || `Route ${route.id}`} · ${route.fromCode || "—"} → ${route.toCode || "—"}`;

const getAircraftOptionLabel = (aircraft: AircraftOption) =>
  `${aircraft.model} · ${aircraft.registration || "No reg"} · ${aircraft.fleetName}`;

const getAircraftTypeKey = (aircraft: Pick<AircraftOption, "model" | "fleetName">) =>
  `${String(aircraft.model || "").trim()}::${String(aircraft.fleetName || "").trim()}`;

const getAircraftTypeLabel = (aircraft: Pick<AircraftOption, "model" | "fleetName">) =>
  `${aircraft.model} · ${aircraft.fleetName}`;

const ICAO_PREFIX_TO_COUNTRY: Record<string, string> = {
  UR: "RU",
  UW: "RU",
  UU: "RU",
  LT: "TR",
  LG: "GR",
  LF: "FR",
  ED: "DE",
  EG: "GB",
  LE: "ES",
  LI: "IT",
  EHAM: "NL",
};

const resolveCountryCodeByIcao = (icao?: string | null) => {
  const normalized = String(icao || "").trim().toUpperCase();
  if (!normalized) {
    return "";
  }

  if (ICAO_PREFIX_TO_COUNTRY[normalized]) {
    return ICAO_PREFIX_TO_COUNTRY[normalized];
  }

  const prefix = normalized.slice(0, 2);
  return ICAO_PREFIX_TO_COUNTRY[prefix] || "";
};

const deriveCityFromLocationLabel = (label?: string | null, fallbackIcao?: string | null) => {
  const raw = String(label || "").trim();
  if (!raw) {
    return String(fallbackIcao || "").trim().toUpperCase();
  }

  const noParen = raw.replace(/\s*\([A-Z]{4}\)\s*/g, " ").trim();
  const noAirportWord = noParen
    .replace(/\binternational\s+airport\b/gi, "")
    .replace(/\bairport\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  return noAirportWord || String(fallbackIcao || "").trim().toUpperCase();
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

const formatRouteDuration = (value?: string | null) => {
  const raw = String(value || "").trim();
  if (!raw) {
    return "-";
  }

  const match = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (match) {
    const hours = String(Number(match[1] || 0)).padStart(2, "0");
    const minutes = String(Number(match[2] || 0)).padStart(2, "0");
    return `${hours}:${minutes}`;
  }

  return raw;
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

const formatDateTime = (value?: string | null) => {
  if (!value) {
    return "—";
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
  });
};

export function PilotBookings() {
  const { t } = useLanguage();
  const { addNotification } = useNotifications();
  const tr = (key: string, vars?: Record<string, string | number>) => {
    const template = t(key);
    if (!vars) {
      return template;
    }

    return Object.entries(vars).reduce(
      (current, [varKey, varValue]) =>
        current.split(`{{${varKey}}}`).join(String(varValue)),
      template
    );
  };
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [routeOptions, setRouteOptions] = useState<RouteOption[]>([]);
  const [aircraftOptions, setAircraftOptions] = useState<AircraftOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [dispatchingBookingId, setDispatchingBookingId] = useState<number | null>(null);
  const [cancelBookingId, setCancelBookingId] = useState<number | null>(null);
  const [reportingRouteId, setReportingRouteId] = useState<number | null>(null);
  const [connectionMessage, setConnectionMessage] = useState("");
  const [bookingGateMessage, setBookingGateMessage] = useState("");
  const [pilotLocationCode, setPilotLocationCode] = useState("");
  const [pilotLocationLabel, setPilotLocationLabel] = useState("");
  const [form, setForm] = useState<BookingFormState>(() => createEmptyForm());
  const [isAircraftTypePickerOpen, setIsAircraftTypePickerOpen] = useState(false);
  const [isAircraftPickerOpen, setIsAircraftPickerOpen] = useState(false);

  const currentLocationCity = useMemo(
    () => deriveCityFromLocationLabel(pilotLocationLabel, pilotLocationCode),
    [pilotLocationCode, pilotLocationLabel]
  );
  const currentLocationCountryCode = useMemo(
    () => resolveCountryCodeByIcao(pilotLocationCode),
    [pilotLocationCode]
  );
  const currentLocationDisplay = useMemo(() => {
    const code = String(pilotLocationCode || "").trim().toUpperCase();
    if (!code) {
      return t("bookings.notSet");
    }

    return `${currentLocationCity} (${code})`;
  }, [currentLocationCity, pilotLocationCode, t]);

  const resolveBookingsConnectionMessage = (
    payload: Pick<BookingsResponse, "error" | "code"> | null,
    status?: number
  ) => {
    const code = String(payload?.code || "").trim().toLowerCase();

    if (code === "pilot_api_not_connected") {
      return t("bookings.connection.connectPilotApi");
    }

    if (code === "auth_required") {
      return t("bookings.connection.authRequired");
    }

    if (code === "pilot_api_not_configured") {
      return t("bookings.connection.notConfigured");
    }

    if ((status || 0) === 401) {
      return t("bookings.connection.authRequired");
    }

    if ((status || 0) >= 500) {
      return t("bookings.connection.serviceUnavailable");
    }

    return String(payload?.error || "").trim() || t("bookings.connection.failedLoad");
  };

  const selectedRoute = useMemo(() => {
    const routeId = Number(form.routeId || 0) || 0;
    return routeOptions.find((item) => item.id === routeId) || null;
  }, [form.routeId, routeOptions]);

  const visibleRouteOptions = useMemo(() => {
    const normalizedLocationCode = String(pilotLocationCode || "").trim().toUpperCase();
    if (!normalizedLocationCode) {
      return routeOptions;
    }

    return routeOptions.filter((item) => String(item.fromCode || "").trim().toUpperCase() === normalizedLocationCode);
  }, [pilotLocationCode, routeOptions]);

  const destinationOptions = useMemo(() => {
    const destinations = new Map<
      string,
      {
        code: string;
        name: string;
        lat: number;
        lon: number;
        routeCount: number;
      }
    >();

    visibleRouteOptions.forEach((route) => {
      const code = String(route.toCode || "").trim().toUpperCase();
      const lat = Number(route.toLat);
      const lon = Number(route.toLon);
      if (!code || !Number.isFinite(lat) || !Number.isFinite(lon)) {
        return;
      }

      const existing = destinations.get(code);
      if (existing) {
        existing.routeCount += 1;
        return;
      }

      destinations.set(code, {
        code,
        name: String(route.toName || code).trim() || code,
        lat,
        lon,
        routeCount: 1,
      });
    });

    return Array.from(destinations.values()).sort((left, right) => {
      if (right.routeCount !== left.routeCount) {
        return right.routeCount - left.routeCount;
      }

      return left.name.localeCompare(right.name);
    });
  }, [visibleRouteOptions]);

  const selectedDestination = useMemo(
    () => destinationOptions.find((item) => item.code === String(form.destinationCode || "").trim().toUpperCase()) || null,
    [destinationOptions, form.destinationCode]
  );

  const bookingOriginAirport = useMemo<Airport | null>(() => {
    const normalizedLocation = String(pilotLocationCode || "").trim().toUpperCase();
    const sourceRoute = normalizedLocation
      ? visibleRouteOptions.find((route) => String(route.fromCode || "").trim().toUpperCase() === normalizedLocation)
      : selectedRoute;

    const lat = Number(sourceRoute?.fromLat);
    const lon = Number(sourceRoute?.fromLon);
    if (!sourceRoute || !Number.isFinite(lat) || !Number.isFinite(lon)) {
      return null;
    }

    return {
      icao: String(sourceRoute.fromCode || normalizedLocation || "").trim().toUpperCase() || undefined,
      name:
        String(
          sourceRoute.fromName ||
            pilotLocationLabel ||
            normalizedLocation ||
            t("bookings.currentLocation")
        ).trim() || t("bookings.currentLocation"),
      lat,
      lon,
    };
  }, [pilotLocationCode, pilotLocationLabel, selectedRoute, t, visibleRouteOptions]);

  const bookingMapRoutes = useMemo<SelectableRoute[]>(() => {
    if (!bookingOriginAirport) {
      return [];
    }

    const originCode = String(bookingOriginAirport.icao || bookingOriginAirport.code || "").trim().toUpperCase();

    return visibleRouteOptions
      .filter((route) => {
        const fromCode = String(route.fromCode || "").trim().toUpperCase();
        const toCode = String(route.toCode || "").trim().toUpperCase();
        return (
          fromCode === originCode &&
          Boolean(toCode) &&
          Number.isFinite(Number(route.toLat)) &&
          Number.isFinite(Number(route.toLon))
        );
      })
      .map((route) => ({
        id: String(route.id),
        from: bookingOriginAirport,
        to: {
          icao: String(route.toCode || "").trim().toUpperCase() || undefined,
          name:
            String(route.toName || route.toCode || t("bookings.routeDestinationFallback")).trim() ||
            t("bookings.routeDestinationFallback"),
          lat: Number(route.toLat),
          lon: Number(route.toLon),
        },
        label: `${route.flightNumber || route.callsign || `Route ${route.id}`} · ${route.fromCode || "—"} → ${route.toCode || "—"}`,
        active:
          String(route.toCode || "").trim().toUpperCase() === String(form.destinationCode || "").trim().toUpperCase() ||
          route.id === selectedRoute?.id,
      }));
  }, [bookingOriginAirport, form.destinationCode, selectedRoute, t, visibleRouteOptions]);

  const bookingMapFallbackAirports = useMemo<Airport[]>(() => {
    return destinationOptions.map((destination) => ({
      icao: destination.code,
      name: destination.name,
      lat: destination.lat,
      lon: destination.lon,
    }));
  }, [destinationOptions]);

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
    const durationMinutes = durationMatch
      ? Number(durationMatch[1]) * 60 + Number(durationMatch[2])
      : 0;

    return {
      id: String(selectedRoute.flightNumber || selectedRoute.callsign || selectedRoute.id),
      airline: String(selectedRoute.airlineCode || "NWS"),
      legs: [
        {
          from: {
            icao: String(selectedRoute.fromCode || "").trim().toUpperCase() || undefined,
            name: String(selectedRoute.fromName || selectedRoute.fromCode || "Departure").trim() || "Departure",
            lat: fromLat,
            lon: fromLon,
          },
          to: {
            icao: String(selectedRoute.toCode || "").trim().toUpperCase() || undefined,
            name: String(selectedRoute.toName || selectedRoute.toCode || "Arrival").trim() || "Arrival",
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

  const visibleBookingRoutes = useMemo(() => {
    const destinationCode = String(form.destinationCode || "").trim().toUpperCase();
    const items = destinationCode
      ? visibleRouteOptions.filter((route) => String(route.toCode || "").trim().toUpperCase() === destinationCode)
      : visibleRouteOptions;

    return [...items].sort((left, right) => {
      const leftFlight = String(left.flightNumber || left.callsign || "");
      const rightFlight = String(right.flightNumber || right.callsign || "");
      return leftFlight.localeCompare(rightFlight);
    });
  }, [form.destinationCode, visibleRouteOptions]);

  const filteredAircraft = useMemo(() => {
    if (!selectedRoute || !Array.isArray(selectedRoute.fleetIds) || !selectedRoute.fleetIds.length) {
      return aircraftOptions;
    }

    return aircraftOptions.filter((item) => selectedRoute.fleetIds?.includes(item.fleetId));
  }, [aircraftOptions, selectedRoute]);

  const aircraftTypeOptions = useMemo(() => {
    const unique = new Map<string, AircraftTypeOption>();
    filteredAircraft.forEach((aircraft) => {
      const key = getAircraftTypeKey(aircraft);
      if (!unique.has(key)) {
        unique.set(key, {
          key,
          model: aircraft.model,
          fleetName: aircraft.fleetName,
          label: getAircraftTypeLabel(aircraft),
        });
      }
    });
    return Array.from(unique.values()).sort((left, right) => left.label.localeCompare(right.label));
  }, [filteredAircraft]);

  const selectedAircraftType = useMemo(() => {
    if (!form.aircraftTypeKey) {
      return null;
    }

    return aircraftTypeOptions.find((item) => item.key === form.aircraftTypeKey) || null;
  }, [aircraftTypeOptions, form.aircraftTypeKey]);

  const typeFilteredAircraft = useMemo(() => {
    if (!selectedAircraftType) {
      return [];
    }

    return filteredAircraft.filter((item) => getAircraftTypeKey(item) === selectedAircraftType.key);
  }, [filteredAircraft, selectedAircraftType]);

  const selectableAircraftOptions = useMemo(
    () => (form.aircraftMode === "type" ? typeFilteredAircraft : filteredAircraft),
    [filteredAircraft, form.aircraftMode, typeFilteredAircraft]
  );

  useEffect(() => {
    if (!form.routeId) {
      if (form.routeQuery) {
        setForm((current) => ({
          ...current,
          routeQuery: "",
        }));
      }
      return;
    }

    if (selectedRoute) {
      const nextLabel = getRouteOptionLabel(selectedRoute);
      if (form.routeQuery !== nextLabel) {
        setForm((current) => ({
          ...current,
          routeQuery: nextLabel,
        }));
      }
    }
  }, [form.routeId, form.routeQuery, selectedRoute]);

  useEffect(() => {
    if (!selectedRoute) {
      return;
    }

    const nextDestinationCode = String(selectedRoute.toCode || "").trim().toUpperCase();
    if (nextDestinationCode && nextDestinationCode !== String(form.destinationCode || "").trim().toUpperCase()) {
      setForm((current) => ({
        ...current,
        destinationCode: nextDestinationCode,
      }));
    }
  }, [form.destinationCode, selectedRoute]);

  useEffect(() => {
    if (!form.routeId) {
      return;
    }

    const routeId = Number(form.routeId || 0) || 0;
    if (!visibleRouteOptions.some((item) => item.id === routeId)) {
      setForm((current) => ({
        ...current,
        routeId: "",
        routeQuery: "",
      }));
    }
  }, [form.routeId, visibleRouteOptions]);

  useEffect(() => {
    const normalizedDestination = String(form.destinationCode || "").trim().toUpperCase();
    if (!normalizedDestination) {
      return;
    }

    if (!destinationOptions.some((destination) => destination.code === normalizedDestination)) {
      setForm((current) => ({
        ...current,
        destinationCode: "",
        routeId: "",
        routeQuery: "",
      }));
      return;
    }

    if (selectedRoute && String(selectedRoute.toCode || "").trim().toUpperCase() !== normalizedDestination) {
      setForm((current) => ({
        ...current,
        routeId: "",
        routeQuery: "",
      }));
    }
  }, [destinationOptions, form.destinationCode, selectedRoute]);

  useEffect(() => {
    if (form.aircraftMode !== "type") {
      return;
    }

    if (!form.aircraftTypeKey) {
      if (form.aircraftTypeQuery) {
        setForm((current) => ({
          ...current,
          aircraftTypeQuery: "",
        }));
      }
      return;
    }

    if (selectedAircraftType && form.aircraftTypeQuery !== selectedAircraftType.label) {
      setForm((current) => ({
        ...current,
        aircraftTypeQuery: selectedAircraftType.label,
      }));
    }
  }, [form.aircraftMode, form.aircraftTypeKey, form.aircraftTypeQuery, selectedAircraftType]);

  useEffect(() => {
    if (form.aircraftMode !== "type" || !form.aircraftTypeKey) {
      return;
    }

    if (!aircraftTypeOptions.some((item) => item.key === form.aircraftTypeKey)) {
      setForm((current) => ({
        ...current,
        aircraftTypeKey: "",
        aircraftTypeQuery: "",
        aircraftId: "",
        aircraftQuery: "",
      }));
    }
  }, [aircraftTypeOptions, form.aircraftMode, form.aircraftTypeKey]);

  useEffect(() => {
    if (!form.aircraftId) {
      if (form.aircraftQuery) {
        setForm((current) => ({
          ...current,
          aircraftQuery: "",
        }));
      }
      return;
    }

    const aircraftId = Number(form.aircraftId || 0) || 0;
    const selectedAircraft = selectableAircraftOptions.find((item) => item.id === aircraftId) || null;
    if (!selectedAircraft) {
      setForm((current) => ({
        ...current,
        aircraftId: "",
        aircraftQuery: "",
      }));
      return;
    }

    const nextLabel = getAircraftOptionLabel(selectedAircraft);
    if (form.aircraftQuery !== nextLabel) {
      setForm((current) => ({
        ...current,
        aircraftQuery: nextLabel,
      }));
    }
  }, [form.aircraftId, form.aircraftQuery, selectableAircraftOptions]);

  const loadBookings = async ({ silent = false } = {}) => {
    if (silent) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const response = await fetch("/api/pilot/bookings?page[size]=20&sort=departure_time", {
        credentials: "include",
      });
      const payload = (await response.json().catch(() => null)) as BookingsResponse | null;

      if (!response.ok) {
        setBookings([]);
        setConnectionMessage(resolveBookingsConnectionMessage(payload, response.status));
        return;
      }

      setBookings(Array.isArray(payload?.bookings) ? payload.bookings : []);
      setConnectionMessage("");
    } catch {
      setBookings([]);
      setConnectionMessage(t("bookings.connection.failedLoad"));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const loadSupportingData = async () => {
      try {
        const [routesResponse, fleetResponse, locationResponse, notamsResponse] = await Promise.all([
          fetch("/api/vamsys/routes", { credentials: "include" }),
          fetch("/api/vamsys/fleet", { credentials: "include" }),
          fetch("/api/pilot/location", { credentials: "include" }),
          fetch("/api/vamsys/notams", { credentials: "include" }),
        ]);

        const routesPayload = (await routesResponse.json().catch(() => null)) as RoutesResponse | null;
        const fleetPayload = (await fleetResponse.json().catch(() => null)) as FleetResponse | null;
        const locationPayload = (await locationResponse.json().catch(() => null)) as PilotLocationResponse | null;
        const notamsPayload = (await notamsResponse.json().catch(() => null)) as NotamSummaryResponse | null;

        if (!isMounted) {
          return;
        }

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
        setPilotLocationCode(String(locationPayload?.airportCode || "").trim().toUpperCase());
        setPilotLocationLabel(String(locationPayload?.locationLabel || "").trim());
        const unreadNotams = Number(notamsPayload?.summary?.unread || 0) || 0;
        setBookingGateMessage(
          unreadNotams > 0
            ? tr("bookings.gate.unreadNotams", { count: unreadNotams })
            : ""
        );
      } catch {
        if (isMounted) {
          setRouteOptions([]);
          setAircraftOptions([]);
          setPilotLocationCode("");
          setPilotLocationLabel("");
          setBookingGateMessage("");
        }
      }
    };

    loadSupportingData();
    loadBookings();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleRefresh = async () => {
    await loadBookings({ silent: true });
  };

  const handleViewDetails = async (bookingId: number) => {
    setIsLoadingDetails(true);
    setIsDetailsOpen(true);

    try {
      const response = await fetch(`/api/pilot/bookings/${bookingId}`, {
        credentials: "include",
      });
      const payload = (await response.json().catch(() => null)) as BookingDetailResponse & {
        error?: string;
      };

      if (!response.ok || !payload?.booking) {
        throw new Error(payload?.error || t("bookings.toast.detailsError"));
      }

      setSelectedBooking(payload.booking);
    } catch (error) {
      setSelectedBooking(null);
      toast.error(String(error || t("bookings.toast.detailsError")));
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleAircraftModeChange = (mode: "direct" | "type") => {
    setForm((current) => ({
      ...current,
      aircraftMode: mode,
      aircraftTypeKey: "",
      aircraftTypeQuery: "",
      aircraftId: "",
      aircraftQuery: "",
    }));
  };

  const handleDestinationSelect = (destinationCode: string) => {
    const normalizedDestination = String(destinationCode || "").trim().toUpperCase();
    const matchingRoutes = visibleRouteOptions.filter(
      (route) => String(route.toCode || "").trim().toUpperCase() === normalizedDestination
    );
    const currentRouteId = Number(form.routeId || 0) || 0;
    const preservedRoute = matchingRoutes.find((route) => route.id === currentRouteId) || null;
    const autoRoute = preservedRoute || (matchingRoutes.length === 1 ? matchingRoutes[0] : null);

    setForm((current) => ({
      ...current,
      destinationCode: normalizedDestination,
      routeId: autoRoute ? String(autoRoute.id) : "",
      routeQuery: autoRoute ? getRouteOptionLabel(autoRoute) : "",
    }));
  };

  const handleRouteSelect = (route: RouteOption) => {
    setForm((current) => ({
      ...current,
      destinationCode: String(route.toCode || "").trim().toUpperCase(),
      routeId: String(route.id),
      routeQuery: getRouteOptionLabel(route),
    }));
  };

  const handleAircraftTypeSelect = (typeKey: string) => {
    const matchedType = aircraftTypeOptions.find((item) => item.key === typeKey) || null;
    const matchedAircraft = matchedType
      ? filteredAircraft.filter((item) => getAircraftTypeKey(item) === matchedType.key)
      : [];

    setForm((current) => ({
      ...current,
      aircraftTypeKey: typeKey,
      aircraftTypeQuery: matchedType?.label || "",
      aircraftId: matchedAircraft.length === 1 ? String(matchedAircraft[0].id) : "",
      aircraftQuery: matchedAircraft.length === 1 ? getAircraftOptionLabel(matchedAircraft[0]) : "",
    }));
    setIsAircraftTypePickerOpen(false);
  };

  const handleAircraftSelect = (aircraftId: string) => {
    const pool = form.aircraftMode === "type" ? typeFilteredAircraft : filteredAircraft;
    const matchedAircraft = pool.find((aircraft) => aircraft.id === Number(aircraftId)) || null;
    setForm((current) => ({
      ...current,
      aircraftId,
      aircraftQuery: matchedAircraft ? getAircraftOptionLabel(matchedAircraft) : "",
    }));
    setIsAircraftPickerOpen(false);
  };

  const handleCreateBooking = async () => {
    const routeId = Number(form.routeId || 0) || 0;
    const aircraftId = Number(form.aircraftId || 0) || 0;
    const departureDate = form.departureTime ? parseUtcDateTimeValue(form.departureTime) : null;
    const departureTime = departureDate && !Number.isNaN(departureDate.getTime()) ? departureDate.toISOString() : "";

    if (routeId <= 0 || aircraftId <= 0 || !departureTime) {
      toast.error(t("bookings.toast.selectRequired"));
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/pilot/bookings", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          routeId,
          aircraftId,
          departureTime,
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        booking?: Booking;
        error?: string;
        code?: string;
      };

      if (!response.ok) {
        if (payload?.code === "notams_unread") {
          setBookingGateMessage(String(payload.error || t("bookings.gate.notamsRequired")));
        }
        if (payload?.code === "booking_departure_mismatch") {
          setBookingGateMessage(String(payload.error || t("bookings.toast.createError")));
        }
        throw new Error(payload?.error || t("bookings.toast.createError"));
      }

      toast.success(t("bookings.toast.createSuccess"));
      addNotification({
        category: "booking",
        title: t("bookings.notification.createdTitle"),
        description: tr("bookings.notification.createdDescription", {
          flight: selectedRoute?.flightNumber || selectedRoute?.callsign || `Route ${routeId}`,
          date: formatDateTime(departureTime),
        }),
      });
      setIsCreateOpen(false);
      setForm(createEmptyForm());
      await loadBookings({ silent: true });
    } catch (error) {
      toast.error(String(error || t("bookings.toast.createError")));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenDispatch = async (booking: Booking) => {
    if (!booking.routeId) {
      toast.error(t("bookings.toast.dispatchUnavailable"));
      return;
    }

    setDispatchingBookingId(booking.id);
    try {
      const response = await fetch("/api/pilot/dispatch-url", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          routeId: booking.routeId,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        url?: string | null;
        error?: string;
      };

      if (!response.ok || !payload?.url) {
        throw new Error(payload?.error || t("bookings.toast.dispatchError"));
      }

      addNotification({
        category: "booking",
        title: t("bookings.notification.dispatchTitle"),
        description: tr("bookings.notification.dispatchDescription", {
          flight: booking.flightNumber,
        }),
      });
      window.open(payload.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(String(error || t("bookings.toast.dispatchError")));
    } finally {
      setDispatchingBookingId(null);
    }
  };

  const handleReportOutdatedRoute = async (route: RouteOption) => {
    const routeId = Number(route.id || 0) || 0;
    if (routeId <= 0) {
      toast.error(t("bookings.toast.reportInactiveError"));
      return;
    }

    setReportingRouteId(routeId);
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
        toast.success(tr("bookings.toast.reportInactiveDuplicate", { ticket: payload?.ticket?.number || "#" }));
      } else {
        toast.success(tr("bookings.toast.reportInactiveSuccess", { ticket: payload?.ticket?.number || "#" }));
        addNotification({
          category: "system",
          title: t("bookings.notification.reportTitle"),
          description: tr("bookings.notification.reportDescription", {
            flight: route.flightNumber || route.callsign || `Route ${routeId}`,
          }),
        });
      }
    } catch (error) {
      toast.error(String(error || t("bookings.toast.reportInactiveError")));
    } finally {
      setReportingRouteId(null);
    }
  };

  const handleCancelBooking = async () => {
    if (!cancelBookingId) {
      return;
    }

    try {
      const response = await fetch(`/api/pilot/bookings/${cancelBookingId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload?.error || t("bookings.toast.cancelError"));
      }

      toast.success(t("bookings.toast.cancelSuccess"));
      addNotification({
        category: "booking",
        title: t("bookings.notification.cancelTitle"),
        description: tr("bookings.notification.cancelDescription", {
          flight:
            bookings.find((item) => item.id === cancelBookingId)?.flightNumber ||
            `Booking #${cancelBookingId}`,
        }),
      });
      setCancelBookingId(null);
      await loadBookings({ silent: true });
    } catch (error) {
      toast.error(String(error || t("bookings.toast.cancelError")));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#1d1d1f]">{t("bookings.title")}</h2>
          <p className="text-sm text-gray-500">{t("bookings.subtitle")}</p>
          {pilotLocationCode ? (
            <div className="mt-1 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">
              {currentLocationCountryCode ? (
                <img
                  src={`https://flagcdn.com/${currentLocationCountryCode.toLowerCase()}.svg`}
                  alt={currentLocationCountryCode}
                  className="h-3.5 w-5 rounded-[2px] object-cover"
                  loading="lazy"
                  decoding="async"
                />
              ) : null}
              <span className="font-medium text-slate-700">{t("bookings.currentLocation")}:</span>
              <span className="truncate">{currentLocationDisplay}</span>
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleRefresh} disabled={isLoading || isRefreshing}>
            {isRefreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
            {t("bookings.refresh")}
          </Button>
          <Button className="bg-[#E31E24] hover:bg-[#c21920] text-white" onClick={() => setIsCreateOpen(true)} disabled={Boolean(bookingGateMessage)}>
            <CalendarPlus className="mr-2 h-4 w-4" />
            {t("bookings.new")}
          </Button>
        </div>
      </div>

      {connectionMessage ? (
        <Card className="border border-amber-200 bg-amber-50 shadow-none">
          <CardContent className="p-4 text-sm text-amber-900">{connectionMessage}</CardContent>
        </Card>
      ) : null}

      {bookingGateMessage ? (
        <Card className="border border-red-200 bg-red-50 shadow-none">
          <CardContent className="p-4 text-sm text-red-900">{bookingGateMessage}</CardContent>
        </Card>
      ) : null}

      {isLoading ? (
        <Card className="border-none shadow-sm">
          <CardContent className="flex items-center gap-3 p-6 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("bookings.loading")}
          </CardContent>
        </Card>
      ) : bookings.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {bookings.map((booking) => (
            <Card key={booking.id} className="border-none shadow-sm">
              <CardContent className="space-y-4 p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#E31E24]/10 text-[#E31E24]">
                        <Plane className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-lg font-bold text-[#1d1d1f]">{booking.flightNumber}</div>
                        <div className="truncate text-sm text-gray-500">{booking.routeLabel}</div>
                      </div>
                    </div>
                  </div>
                  <Badge variant="outline" className="w-fit bg-white">
                    {booking.statusLabel}
                  </Badge>
                </div>

                <div className="grid gap-3 text-sm text-gray-600 sm:grid-cols-2">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-gray-400">{t("bookings.field.departure")}</div>
                    <div className="font-medium text-gray-900">{formatDateTime(booking.departureTime)}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-gray-400">{t("bookings.field.aircraft")}</div>
                    <div className="font-medium text-gray-900">{booking.aircraft}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-gray-400">{t("bookings.field.network")}</div>
                    <div className="font-medium text-gray-900">{booking.network || "—"}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-gray-400">{t("bookings.field.created")}</div>
                    <div className="font-medium text-gray-900">{formatDateTime(booking.createdAt)}</div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link to={`/dashboard/booking/${booking.id}`}>
                      <Eye className="mr-2 h-4 w-4" />
                      {t("bookings.openPage")}
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleViewDetails(booking.id)}>
                    <Eye className="mr-2 h-4 w-4" />
                    {t("bookings.details")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenDispatch(booking)}
                    disabled={dispatchingBookingId === booking.id || !booking.routeId}
                  >
                    {dispatchingBookingId === booking.id ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <ExternalLink className="mr-2 h-4 w-4" />
                    )}
                    Phoenix
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={() => setCancelBookingId(booking.id)}
                    disabled={!booking.canCancel}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {t("bookings.cancel")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-none shadow-sm">
          <CardContent className="flex flex-col items-center justify-center gap-3 p-10 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-gray-400">
              <Plane className="h-6 w-6" />
            </div>
            <div>
              <div className="font-semibold text-[#1d1d1f]">{t("bookings.emptyTitle")}</div>
              <div className="text-sm text-gray-500">{t("bookings.emptyDesc")}</div>
            </div>
            <Button className="bg-[#E31E24] hover:bg-[#c21920] text-white" onClick={() => setIsCreateOpen(true)}>
              <CalendarPlus className="mr-2 h-4 w-4" />
              {t("bookings.create")}
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-h-[92vh] !w-[min(1440px,calc(100vw-3rem))] !max-w-[min(1440px,calc(100vw-3rem))] overflow-hidden border-none p-0">
          <div className="grid max-h-[92vh] min-h-[680px] grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)]">
            <div className="flex min-h-0 flex-col gap-5 overflow-y-auto bg-slate-950 px-6 py-6 text-white">
              <DialogHeader className="text-left">
                <DialogTitle className="text-2xl text-white">{t("bookings.dialog.createTitle")}</DialogTitle>
                <DialogDescription className="text-sm text-slate-300">
                  {t("bookings.dialog.createDescription")}
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">{t("bookings.currentLocation")}</div>
                  <div className="mt-3 flex items-start gap-3">
                    <div className="mt-0.5 rounded-full bg-sky-500/15 p-2 text-sky-300">
                      <MapPin className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2 text-lg font-semibold text-white">
                        {currentLocationCountryCode ? (
                          <img
                            src={`https://flagcdn.com/${currentLocationCountryCode.toLowerCase()}.svg`}
                            alt={currentLocationCountryCode}
                            className="h-4 w-6 shrink-0 rounded-[2px] object-cover"
                            loading="lazy"
                            decoding="async"
                          />
                        ) : null}
                        <span className="truncate">{currentLocationDisplay}</span>
                      </div>
                      <div className="mt-1 text-sm text-slate-300">{pilotLocationCode ? t("bookings.locationCompactHint") : t("bookings.setLocationHint")}</div>
                    </div>
                  </div>
                </div>
              </div>

              {selectedRoute ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">{t("bookings.selectedFlight")}</div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-lg font-semibold text-white">{selectedRoute.flightNumber || selectedRoute.callsign || `Route ${selectedRoute.id}`}</div>
                      <div className="text-sm text-slate-300">{selectedRoute.fromCode || "—"} → {selectedRoute.toCode || "—"}</div>
                    </div>
                    <Badge variant="outline" className="border-white/10 bg-white/10 text-white">
                      {formatRouteDistanceNm(selectedRoute.distance)}
                    </Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300">
                    <span className="rounded-full bg-white/5 px-2.5 py-1">{formatRouteDuration(selectedRoute.duration)}</span>
                    <span className="rounded-full bg-white/5 px-2.5 py-1">{getRouteFrequencyLabel(selectedRoute, t)}</span>
                    <span className="max-w-full truncate rounded-full bg-white/5 px-2.5 py-1">{t("bookings.aircraftType")}: {getRouteAircraftTypeLabel(selectedRoute, aircraftOptions, t)}</span>
                    <span className="rounded-full bg-white/5 px-2.5 py-1">{selectedRoute.type || t("bookings.typeScheduled")}</span>
                  </div>
                  {selectedRoute.routeText ? (
                    <div className="mt-3 rounded-xl border border-white/10 bg-black/10 px-3 py-2 text-xs text-slate-300">
                      {selectedRoute.routeText}
                    </div>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-amber-400/30 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20 hover:text-white"
                      disabled={reportingRouteId === selectedRoute.id}
                      onClick={() => void handleReportOutdatedRoute(selectedRoute)}
                    >
                      {reportingRouteId === selectedRoute.id ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <AlertTriangle className="mr-2 h-4 w-4" />
                      )}
                      {t("bookings.reportInactive")}
                    </Button>
                  </div>
                  <div className="mt-2 text-xs text-slate-400">{t("bookings.reportInactiveHint")}</div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                  {t("bookings.chooseFlightHint")}
                </div>
              )}

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="mb-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant={form.aircraftMode === "direct" ? "default" : "outline"}
                    className={form.aircraftMode === "direct" ? "bg-[#E31E24] text-white hover:bg-[#c21920]" : "border-white/10 bg-transparent text-white hover:bg-white/10 hover:text-white"}
                    onClick={() => handleAircraftModeChange("direct")}
                  >
                    {t("bookings.selectAircraftDirectly")}
                  </Button>
                  <Button
                    type="button"
                    variant={form.aircraftMode === "type" ? "default" : "outline"}
                    className={form.aircraftMode === "type" ? "bg-[#E31E24] text-white hover:bg-[#c21920]" : "border-white/10 bg-transparent text-white hover:bg-white/10 hover:text-white"}
                    onClick={() => handleAircraftModeChange("type")}
                  >
                    {t("bookings.selectByAircraftType")}
                  </Button>
                </div>

                {form.aircraftMode === "type" ? (
                  <div className="grid gap-3">
                    <div className="space-y-2">
                      <Label className="text-slate-200">{t("bookings.aircraftType")}</Label>
                      <Popover open={isAircraftTypePickerOpen} onOpenChange={setIsAircraftTypePickerOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            role="combobox"
                            aria-expanded={isAircraftTypePickerOpen}
                            className="w-full justify-between border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                          >
                            <span className="truncate">{selectedAircraftType ? selectedAircraftType.label : t("bookings.selectAircraftType")}</span>
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[var(--radix-popover-trigger-width)] border-white/10 bg-slate-950 p-0 text-white" align="start">
                          <Command className="bg-slate-950 text-white">
                            <CommandInput placeholder={t("bookings.typeModelPlaceholder")} className="text-white placeholder:text-slate-400" />
                            <CommandList>
                              <CommandEmpty className="py-3 text-slate-400">{t("bookings.noAircraftTypeFound")}</CommandEmpty>
                              <CommandGroup>
                                {aircraftTypeOptions.map((typeOption) => (
                                  <CommandItem
                                    key={typeOption.key}
                                    value={`${typeOption.label} ${typeOption.model} ${typeOption.fleetName}`}
                                    className="text-slate-100 aria-selected:bg-slate-100 aria-selected:text-slate-950"
                                    onSelect={() => handleAircraftTypeSelect(typeOption.key)}
                                  >
                                    <span className="truncate">{typeOption.label}</span>
                                    <Check className={`ml-auto h-4 w-4 ${form.aircraftTypeKey === typeOption.key ? "opacity-100" : "opacity-0"}`} />
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-slate-200">{t("bookings.field.aircraft")}</Label>
                      <Popover open={isAircraftPickerOpen} onOpenChange={setIsAircraftPickerOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            role="combobox"
                            aria-expanded={isAircraftPickerOpen}
                            disabled={!selectedAircraftType}
                            className="w-full justify-between border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white disabled:opacity-50"
                          >
                            <span className="truncate">{form.aircraftId ? form.aircraftQuery : selectedAircraftType ? t("bookings.selectAircraft") : t("bookings.selectAircraftTypeFirst")}</span>
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[var(--radix-popover-trigger-width)] border-white/10 bg-slate-950 p-0 text-white" align="start">
                          <Command className="bg-slate-950 text-white">
                            <CommandInput placeholder={t("bookings.registrationPlaceholder")} className="text-white placeholder:text-slate-400" />
                            <CommandList>
                              <CommandEmpty className="py-3 text-slate-400">{t("bookings.noAircraftFound")}</CommandEmpty>
                              <CommandGroup>
                                {typeFilteredAircraft.map((aircraft) => (
                                  <CommandItem
                                    key={aircraft.id}
                                    value={`${aircraft.registration} ${aircraft.model} ${aircraft.fleetName}`}
                                    className="text-slate-100 aria-selected:bg-slate-100 aria-selected:text-slate-950"
                                    onSelect={() => handleAircraftSelect(String(aircraft.id))}
                                  >
                                    <span className="truncate">{getAircraftOptionLabel(aircraft)}</span>
                                    <Check className={`ml-auto h-4 w-4 ${form.aircraftId === String(aircraft.id) ? "opacity-100" : "opacity-0"}`} />
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label className="text-slate-200">{t("bookings.field.aircraft")}</Label>
                    <Popover open={isAircraftPickerOpen} onOpenChange={setIsAircraftPickerOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          role="combobox"
                          aria-expanded={isAircraftPickerOpen}
                          className="w-full justify-between border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                        >
                          <span className="truncate">{form.aircraftId ? form.aircraftQuery : t("bookings.selectFromFleet")}</span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[var(--radix-popover-trigger-width)] border-white/10 bg-slate-950 p-0 text-white" align="start">
                        <Command className="bg-slate-950 text-white">
                          <CommandInput placeholder={t("bookings.registrationOrModelPlaceholder")} className="text-white placeholder:text-slate-400" />
                          <CommandList>
                            <CommandEmpty className="py-3 text-slate-400">{t("bookings.noAircraftFound")}</CommandEmpty>
                            <CommandGroup>
                              {filteredAircraft.map((aircraft) => (
                                <CommandItem
                                  key={aircraft.id}
                                  value={`${aircraft.registration} ${aircraft.model} ${aircraft.fleetName}`}
                                  className="text-slate-100 aria-selected:bg-slate-100 aria-selected:text-slate-950"
                                  onSelect={() => handleAircraftSelect(String(aircraft.id))}
                                >
                                  <span className="truncate">{getAircraftOptionLabel(aircraft)}</span>
                                  <Check className={`ml-auto h-4 w-4 ${form.aircraftId === String(aircraft.id) ? "opacity-100" : "opacity-0"}`} />
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                )}

                {form.aircraftMode === "type" && selectedAircraftType && typeFilteredAircraft.length === 1 ? (
                  <div className="mt-3 text-xs text-slate-400">{t("bookings.autoSelectedSingleAircraft")}</div>
                ) : null}
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <Label htmlFor="booking-departure-time" className="text-slate-200">{t("bookings.field.departureTime")} (UTC)</Label>
                <Input
                  id="booking-departure-time"
                  type="datetime-local"
                  className="mt-2 border-white/10 bg-white/5 text-white [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:invert"
                  style={{ colorScheme: "dark" }}
                  value={form.departureTime}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      departureTime: event.target.value,
                    }))
                  }
                />
              </div>

              <div className="mt-auto flex flex-wrap gap-3 pt-2">
                <Button variant="outline" className="border-white/10 bg-transparent text-white hover:bg-white/10 hover:text-white" onClick={() => setIsCreateOpen(false)}>
                  {t("bookings.close")}
                </Button>
                <Button className="bg-[#E31E24] text-white hover:bg-[#c21920]" onClick={handleCreateBooking} disabled={isSubmitting || Boolean(bookingGateMessage)}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarPlus className="mr-2 h-4 w-4" />}
                  {t("bookings.create")}
                </Button>
              </div>
            </div>

            <div className="flex min-h-0 min-w-0 flex-col gap-4 overflow-x-hidden bg-slate-100 p-4 lg:p-5">
              <div className="min-w-0 overflow-hidden rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3 px-1">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{t("bookings.destinationMap")}</div>
                    <div className="text-xs text-slate-500">
                      {pilotLocationCode
                        ? t("bookings.destinationMapHintWithLocation")
                        : t("bookings.destinationMapHintNoLocation")}
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-slate-50 text-slate-700">
                    {tr("bookings.availableFlightsCount", { count: visibleBookingRoutes.length })}
                  </Badge>
                </div>
                <div className="h-[360px] overflow-hidden rounded-2xl bg-slate-100">
                  <FlightMap
                    route={selectedMapRoute}
                    airports={!selectedMapRoute ? bookingMapFallbackAirports : []}
                    availableRoutes={!selectedMapRoute ? bookingMapRoutes : []}
                    originAirport={bookingOriginAirport}
                    selectedAirportCode={form.destinationCode || null}
                    onAirportSelect={handleDestinationSelect}
                  />
                </div>
              </div>

              <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{t("bookings.availableFlights")}</div>
                    <div className="text-xs text-slate-500">
                      {selectedDestination
                        ? tr("bookings.flightsFromTo", {
                            from: pilotLocationCode || selectedRoute?.fromCode || t("bookings.currentLocationLower"),
                            to: selectedDestination.code,
                          })
                        : t("bookings.selectDestinationHint")}
                    </div>
                  </div>
                  {selectedDestination ? (
                    <Button type="button" variant="outline" size="sm" onClick={() => setForm((current) => ({ ...current, destinationCode: "", routeId: "", routeQuery: "" }))}>
                      {t("bookings.showAll")}
                    </Button>
                  ) : null}
                </div>

                <ScrollArea className="h-[260px] w-full overflow-x-hidden pr-2">
                  <div className="w-full space-y-3 pr-3">
                    {visibleBookingRoutes.length > 0 ? (
                      visibleBookingRoutes.map((route) => {
                        const isSelected = selectedRoute?.id === route.id;
                        return (
                          <button
                            key={route.id}
                            type="button"
                            onClick={() => handleRouteSelect(route)}
                            className={`w-full overflow-hidden rounded-2xl border px-4 py-3 text-left transition ${
                              isSelected
                                ? "border-[#E31E24] bg-[#E31E24]/5 shadow-sm"
                                : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-slate-100"
                            }`}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-base font-semibold text-slate-900">{route.flightNumber || route.callsign || `Route ${route.id}`}</div>
                                <div className="truncate text-sm text-slate-600">{route.fromCode || "—"} → {route.toCode || "—"}</div>
                              </div>
                              <Badge variant="outline" className="shrink-0 bg-white text-slate-700">
                                {formatRouteDistanceNm(route.distance)}
                              </Badge>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                              <span className="shrink-0 rounded-full bg-white px-2.5 py-1">{formatRouteDuration(route.duration)}</span>
                              <span className="shrink-0 rounded-full bg-white px-2.5 py-1">{getRouteFrequencyLabel(route, t)}</span>
                              <span className="max-w-full truncate rounded-full bg-white px-2.5 py-1">{t("bookings.aircraftType")}: {getRouteAircraftTypeLabel(route, aircraftOptions, t)}</span>
                              <span className="max-w-full truncate rounded-full bg-white px-2.5 py-1">{route.toName || route.toCode || t("bookings.routeDestinationFallback")}</span>
                            </div>
                          </button>
                        );
                      })
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                        {t("bookings.noAvailableFlights")}
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("bookings.detailsTitle")}</DialogTitle>
            <DialogDescription>{t("bookings.detailsDescription")}</DialogDescription>
          </DialogHeader>

          {isLoadingDetails ? (
            <div className="flex items-center gap-3 py-6 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("bookings.loadingDetails")}
            </div>
          ) : selectedBooking ? (
            <div className="grid gap-4 text-sm md:grid-cols-2">
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-400">{t("bookings.field.flight")}</div>
                <div className="font-medium text-gray-900">{selectedBooking.flightNumber}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-400">{t("bookings.field.status")}</div>
                <div className="font-medium text-gray-900">{selectedBooking.statusLabel}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-400">{t("bookings.field.route")}</div>
                <div className="font-medium text-gray-900">{selectedBooking.routeLabel}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-400">{t("bookings.field.aircraft")}</div>
                <div className="font-medium text-gray-900">{selectedBooking.aircraft}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-400">{t("bookings.field.departureTime")}</div>
                <div className="font-medium text-gray-900">{formatDateTime(selectedBooking.departureTime)}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-400">{t("bookings.field.validTo")}</div>
                <div className="font-medium text-gray-900">{formatDateTime(selectedBooking.validTo)}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-400">{t("bookings.field.network")}</div>
                <div className="font-medium text-gray-900">{selectedBooking.network || "—"}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-400">{t("bookings.field.altitude")}</div>
                <div className="font-medium text-gray-900">{selectedBooking.altitude || "—"}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-400">{t("bookings.field.passengers")}</div>
                <div className="font-medium text-gray-900">{selectedBooking.passengers ?? "—"}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-400">{t("bookings.field.cargo")}</div>
                <div className="font-medium text-gray-900">{selectedBooking.cargo ?? "—"}</div>
              </div>
              <div className="md:col-span-2">
                <div className="text-xs uppercase tracking-wide text-gray-400">{t("bookings.field.userRoute")}</div>
                <div className="whitespace-pre-wrap font-medium text-gray-900">{selectedBooking.userRoute || "—"}</div>
              </div>
            </div>
          ) : (
            <div className="py-6 text-sm text-gray-500">{t("bookings.noDetails")}</div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={cancelBookingId !== null} onOpenChange={(open) => !open && setCancelBookingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("bookings.cancelTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("bookings.cancelDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("bookings.keepBooking")}</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={handleCancelBooking}>
              {t("bookings.cancelBooking")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
