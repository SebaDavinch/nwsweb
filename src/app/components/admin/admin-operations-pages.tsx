import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router";
import { Download, Edit, Eye, GitCompareArrows, Loader2, Plus, RefreshCw, Rocket, Search, Trash2, Upload, Wand2, X } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Label } from "../ui/label";
import { ScrollArea } from "../ui/scroll-area";
import { Separator } from "../ui/separator";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Switch } from "../ui/switch";
import { AdminRoutePreviewMap } from "./admin-route-preview-map";

interface HubItem {
  id: string;
  name: string;
  airportsText?: string;
}

interface AirportItem {
  id: number;
  name: string;
  icao?: string;
  iata?: string;
  latitude?: number | null;
  longitude?: number | null;
}

interface FleetOption {
  id: string;
  name: string;
  code?: string;
  airlineCode?: string;
  aircraftModels: string[];
  registrations: string[];
  searchText: string;
}

interface RouteMeta {
  hubId?: string | null;
  hubLabel?: string | null;
  status?: string;
  priority?: string;
  section?: string;
  notes?: string;
  remarks?: string;
  internalRemarks?: string;
  tags?: string[];
  hidden?: boolean;
  updatedAt?: string | null;
}

interface AdminRouteDetail {
  type?: string;
  callsign?: string;
  flightNumber?: string;
  airlineCode?: string;
  departureCode?: string;
  departureName?: string;
  arrivalCode?: string;
  arrivalName?: string;
  departureTimeUtc?: string;
  arrivalTimeUtc?: string;
  startDate?: string;
  endDate?: string;
  routeText?: string;
  routeNotes?: string;
  remarks?: string;
  flightLevel?: string;
  costIndex?: string;
  fuelPolicy?: string;
  aircraftTypes?: string[];
  alternates?: string[];
  fleetIds?: number[];
  serviceDays?: Array<string | number>;
  liveTags?: string[];
  liveHidden?: boolean;
  distance?: string;
  duration?: string;
  frequency?: string;
  source?: string;
}

interface AdminRouteItem {
  id: number;
  flightNumber: string;
  routeText?: string;
  airlineCode: string;
  fromCode: string;
  toCode: string;
  fromName: string;
  toName: string;
  distance: string;
  duration: string;
  fleetIds?: number[];
  meta?: RouteMeta;
  detail?: AdminRouteDetail;
}

interface RouteEditorFormState {
  hubId: string;
  status: string;
  priority: string;
  section: string;
  notes: string;
  remarks: string;
  internalRemarks: string;
  tags: string;
  hidden: boolean;
}

interface RouteLiveFormState {
  flightNumber: string;
  callsign: string;
  type: string;
  departureTimeUtc: string;
  arrivalTimeUtc: string;
  startDate: string;
  endDate: string;
  duration: string;
  distanceNm: string;
  routeText: string;
  routeRemarks: string;
  routeNotes: string;
  flightLevel: string;
  costIndex: string;
  liveTags: string;
  liveHidden: boolean;
  fleetIds: string[];
  serviceDays: string[];
}

interface RouteCreateFormState {
  flightNumber: string;
  callsign: string;
  type: string;
  departureCode: string;
  arrivalCode: string;
  departureTimeUtc: string;
  arrivalTimeUtc: string;
  startDate: string;
  endDate: string;
  duration: string;
  distanceNm: string;
  routeText: string;
  routeRemarks: string;
  routeNotes: string;
  flightLevel: string;
  costIndex: string;
  fuelPolicy: string;
  liveTags: string;
  liveHidden: boolean;
  fleetIds: string[];
  serviceDays: string[];
  hubId: string;
  status: string;
  priority: string;
  section: string;
  notes: string;
  remarks: string;
  internalRemarks: string;
  tags: string;
  hidden: boolean;
}

type RouteEditorMode = "full" | "turbo";

interface BulkRouteFormState {
  applyHub: boolean;
  hubId: string;
  applyStatus: boolean;
  status: string;
  applyPriority: boolean;
  priority: string;
  applySection: boolean;
  section: string;
  applyNotes: boolean;
  notes: string;
  applyRemarks: boolean;
  remarks: string;
  applyInternalRemarks: boolean;
  internalRemarks: string;
  applyTags: boolean;
  tags: string;
  applyHidden: boolean;
  hidden: boolean;
}

interface BookingMeta {
  tag?: string;
  priority?: string;
  notes?: string;
}

interface AdminBookingItem {
  id: number;
  pilotName: string;
  pilotUsername: string;
  callsign: string;
  routeLabel: string;
  aircraftLabel: string;
  departureTime?: string;
  createdAt?: string;
  status: string;
  meta?: BookingMeta;
}

interface AdminBookingDetailPayload {
  booking?: Record<string, unknown> | null;
  summary?: AdminBookingItem | null;
  meta?: BookingMeta | null;
}

const ROUTE_STATUSES = ["active", "seasonal", "paused", "archived"];
const ROUTE_PRIORITIES = ["normal", "high", "critical"];
const ROUTE_SECTIONS = [
  { value: "default", label: "Catalog" },
  { value: "soon-starting", label: "Soon starting" },
];
const BULK_UNCHANGED = "__unchanged__";
const ROUTE_EDITOR_MODE_KEY = "admin_routes_editor_mode";
const ROUTE_DAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const ROUTE_DAY_LABELS: Record<string, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

interface AdminRoutesManagementData {
  routes: AdminRouteItem[];
  hubs: HubItem[];
  airports: AirportItem[];
  fleets: FleetOption[];
}

let adminRoutesManagementCache: AdminRoutesManagementData | null = null;
let adminRoutesManagementRequest: Promise<AdminRoutesManagementData> | null = null;

const formatDateTime = (value?: string | null) => {
  if (!value) {
    return "—";
  }
  return String(value).slice(0, 16).replace("T", " ");
};

const formatRouteSectionLabel = (value?: string | null) => {
  if (value === "soon-starting") {
    return "Soon starting";
  }
  return "Catalog";
};

const formatRouteTextValue = (value?: string | null) => {
  const text = String(value || "").trim();
  return text || "—";
};

const normalizeRouteDayToken = (value?: string | number | null) => {
  if (typeof value === "number") {
    const index = value >= 1 && value <= 7 ? value - 1 : value >= 0 && value <= 6 ? value : null;
    return index === null ? null : ROUTE_DAY_ORDER[index] || null;
  }

  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  const compact = normalized.slice(0, 3);
  const mapped: Record<string, string> = {
    mon: "mon",
    tue: "tue",
    wed: "wed",
    thu: "thu",
    fri: "fri",
    sat: "sat",
    sun: "sun",
    1: "mon",
    2: "tue",
    3: "wed",
    4: "thu",
    5: "fri",
    6: "sat",
    7: "sun",
    0: "sun",
  };

  return mapped[normalized] || mapped[compact] || null;
};

const formatRouteDayLabel = (value?: string | number | null) => {
  const token = normalizeRouteDayToken(value);
  return token ? ROUTE_DAY_LABELS[token] : formatRouteTextValue(value == null ? "" : String(value));
};

const formatRouteList = (values?: Array<string | number> | null) => {
  if (!Array.isArray(values) || values.length === 0) {
    return "—";
  }

  const tokens = values
    .map((item) => String(item || "").trim())
    .filter(Boolean);

  return tokens.length > 0 ? tokens.join(", ") : "—";
};

const normalizeRouteDistanceNm = (value?: string | null) => {
  const normalized = String(value || "").trim();
  if (!normalized || normalized === "—") {
    return "";
  }

  const matched = normalized.match(/\d+(?:\.\d+)?/);
  return matched ? matched[0] : normalized;
};

const createRouteEditorFormState = (route?: AdminRouteItem | null): RouteEditorFormState => ({
  hubId: String(route?.meta?.hubId || ""),
  status: String(route?.meta?.status || "active"),
  priority: String(route?.meta?.priority || "normal"),
  section: String(route?.meta?.section || "default"),
  notes: String(route?.meta?.notes || ""),
  remarks: String(route?.meta?.remarks || ""),
  internalRemarks: String(route?.meta?.internalRemarks || ""),
  tags: Array.isArray(route?.meta?.tags) ? route.meta.tags.join(", ") : "",
  hidden: Boolean(route?.meta?.hidden),
});

const createRouteLiveFormState = (route?: AdminRouteItem | null, detail?: AdminRouteDetail | null): RouteLiveFormState => ({
  flightNumber: String(detail?.flightNumber || route?.flightNumber || ""),
  callsign: String(detail?.callsign || route?.flightNumber || ""),
  type: String(detail?.type || route?.detail?.type || "scheduled"),
  departureTimeUtc: String(detail?.departureTimeUtc || ""),
  arrivalTimeUtc: String(detail?.arrivalTimeUtc || ""),
  startDate: String(detail?.startDate || ""),
  endDate: String(detail?.endDate || ""),
  duration: String(detail?.duration || route?.duration || "").replace(/^—$/, ""),
  distanceNm: normalizeRouteDistanceNm(detail?.distance || route?.distance || ""),
  routeText: String(detail?.routeText || ""),
  routeRemarks: String(detail?.remarks || ""),
  routeNotes: String(detail?.routeNotes || ""),
  flightLevel: String(detail?.flightLevel || ""),
  costIndex: String(detail?.costIndex || ""),
  liveTags: Array.isArray(detail?.liveTags) ? detail.liveTags.join(", ") : "",
  liveHidden: Boolean(detail?.liveHidden),
  fleetIds: Array.isArray(detail?.fleetIds || route?.fleetIds)
    ? (detail?.fleetIds || route?.fleetIds || []).map((item) => String(item || "")).filter(Boolean)
    : [],
  serviceDays: Array.isArray(detail?.serviceDays)
    ? detail.serviceDays.map((item) => normalizeRouteDayToken(item)).filter((item): item is string => Boolean(item))
    : [],
});

const createDefaultRouteCreateFormState = (): RouteCreateFormState => ({
  flightNumber: "",
  callsign: "",
  type: "scheduled",
  departureCode: "",
  arrivalCode: "",
  departureTimeUtc: "",
  arrivalTimeUtc: "",
  startDate: "",
  endDate: "",
  duration: "",
  distanceNm: "",
  routeText: "",
  routeRemarks: "",
  routeNotes: "",
  flightLevel: "",
  costIndex: "",
  fuelPolicy: "",
  liveTags: "",
  liveHidden: false,
  fleetIds: [],
  serviceDays: ["mon", "tue", "wed", "thu", "fri"],
  hubId: "",
  status: "active",
  priority: "normal",
  section: "default",
  notes: "",
  remarks: "",
  internalRemarks: "",
  tags: "",
  hidden: false,
});

const sortAirlineCodes = (codes: string[]) => {
  const priority = ["NWS", "STW", "KAR"];
  return [...codes].sort((left, right) => {
    const leftPriority = priority.indexOf(left);
    const rightPriority = priority.indexOf(right);
    if (leftPriority !== -1 || rightPriority !== -1) {
      if (leftPriority === -1) {
        return 1;
      }
      if (rightPriority === -1) {
        return -1;
      }
      return leftPriority - rightPriority;
    }
    return left.localeCompare(right);
  });
};

const buildRouteSearchText = (route: AdminRouteItem) => {
  return [
    route.flightNumber,
    route.airlineCode,
    route.fromCode,
    route.toCode,
    route.fromName,
    route.toName,
    route.meta?.hubLabel,
    route.meta?.notes,
    route.meta?.remarks,
    route.meta?.internalRemarks,
    Array.isArray(route.meta?.tags) ? route.meta?.tags.join(" ") : "",
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
};

const buildFleetSearchText = (fleet: {
  id?: string;
  name?: string;
  code?: string;
  airlineCode?: string;
  aircraftModels?: string[];
  registrations?: string[];
}) => {
  return [
    fleet.id,
    fleet.name,
    fleet.code,
    fleet.airlineCode,
    ...(Array.isArray(fleet.aircraftModels) ? fleet.aircraftModels : []),
    ...(Array.isArray(fleet.registrations) ? fleet.registrations : []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
};

const normalizeFleetSearchTokens = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

const formatFleetSearchPreview = (values: string[], label: string) => {
  if (!Array.isArray(values) || values.length === 0) {
    return null;
  }

  const preview = values.slice(0, 3).join(", ");
  const suffix = values.length > 3 ? ` +${values.length - 3}` : "";
  return `${label}: ${preview}${suffix}`;
};

const normalizeRouteTextForCompare = (value?: string | null) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();

const collectRouteTextSuggestions = ({
  routes,
  departureCode,
  arrivalCode,
  currentValue,
}: {
  routes: AdminRouteItem[];
  departureCode?: string;
  arrivalCode?: string;
  currentValue?: string;
}) => {
  const normalizedDeparture = String(departureCode || "").trim().toUpperCase();
  const normalizedArrival = String(arrivalCode || "").trim().toUpperCase();
  const currentRouteText = normalizeRouteTextForCompare(currentValue);

  if (!normalizedDeparture || !normalizedArrival) {
    return [];
  }

  const seen = new Set<string>();
  return routes
    .filter((route) => {
      return (
        String(route.fromCode || "").trim().toUpperCase() === normalizedDeparture &&
        String(route.toCode || "").trim().toUpperCase() === normalizedArrival
      );
    })
    .map((route) => String(route.routeText || "").trim())
    .filter((value) => {
      const normalized = normalizeRouteTextForCompare(value);
      if (!normalized || normalized === currentRouteText || seen.has(normalized)) {
        return false;
      }
      seen.add(normalized);
      return true;
    })
    .slice(0, 6);
};

const createDefaultBulkFormState = (): BulkRouteFormState => ({
  applyHub: false,
  hubId: BULK_UNCHANGED,
  applyStatus: false,
  status: "active",
  applyPriority: false,
  priority: "normal",
  applySection: false,
  section: "default",
  applyNotes: false,
  notes: "",
  applyRemarks: false,
  remarks: "",
  applyInternalRemarks: false,
  internalRemarks: "",
  applyTags: false,
  tags: "",
  applyHidden: false,
  hidden: false,
});

const buildRouteMetaPayload = (state: RouteEditorFormState) => ({
  hubId: state.hubId,
  status: state.status,
  priority: state.priority,
  section: state.section,
  notes: state.notes,
  remarks: state.remarks,
  internalRemarks: state.internalRemarks,
  tags: state.tags,
  hidden: state.hidden,
});

const buildRouteUpdatePayload = (state: RouteLiveFormState) => ({
  flightNumber: state.flightNumber,
  callsign: state.callsign,
  type: state.type,
  departureTimeUtc: state.departureTimeUtc,
  arrivalTimeUtc: state.arrivalTimeUtc,
  startDate: state.startDate,
  endDate: state.endDate,
  duration: state.duration,
  distanceNm: state.distanceNm,
  ...(state.routeText.trim() ? { routeText: state.routeText } : {}),
  remarks: state.routeRemarks,
  routeNotes: state.routeNotes,
  flightLevel: state.flightLevel,
  costIndex: state.costIndex,
  liveTags: state.liveTags,
  hidden: state.liveHidden,
  fleetIds: state.fleetIds,
  serviceDays: state.serviceDays,
});

const buildRouteCreatePayload = (state: RouteCreateFormState) => ({
  flightNumber: state.flightNumber,
  callsign: state.callsign,
  type: state.type,
  departureCode: state.departureCode,
  arrivalCode: state.arrivalCode,
  departureTimeUtc: state.departureTimeUtc,
  arrivalTimeUtc: state.arrivalTimeUtc,
  startDate: state.startDate,
  endDate: state.endDate,
  duration: state.duration,
  distanceNm: state.distanceNm,
  ...(state.routeText.trim() ? { routeText: state.routeText } : {}),
  remarks: state.routeRemarks,
  routeNotes: state.routeNotes,
  flightLevel: state.flightLevel,
  costIndex: state.costIndex,
  fuelPolicy: state.fuelPolicy,
  liveTags: state.liveTags,
  hidden: state.liveHidden,
  fleetIds: state.fleetIds,
  serviceDays: state.serviceDays,
});

const buildCreateRouteMetaPayload = (state: RouteCreateFormState) =>
  buildRouteMetaPayload({
    hubId: state.hubId,
    status: state.status,
    priority: state.priority,
    section: state.section,
    notes: state.notes,
    remarks: state.remarks,
    internalRemarks: state.internalRemarks,
    tags: state.tags,
    hidden: state.hidden,
  });

const hasRouteMetaOverrides = (state: RouteCreateFormState) => {
  return Boolean(
    state.hubId ||
      state.status !== "active" ||
      state.priority !== "normal" ||
      state.section !== "default" ||
      state.notes.trim() ||
      state.remarks.trim() ||
      state.internalRemarks.trim() ||
      state.tags.trim() ||
      state.hidden
  );
};

const readApiErrorMessage = async (response: Response, fallback: string) => {
  try {
    const payload = await response.json();
    return String(payload?.error || payload?.message || fallback);
  } catch {
    return fallback;
  }
};

const getImportField = (row: Record<string, unknown>, aliases: string[]) => {
  const rowKeys = Object.keys(row);
  for (const alias of aliases) {
    const key = rowKeys.find((item) => item.trim().toLowerCase() === alias.trim().toLowerCase());
    if (key) {
      return {
        present: true,
        value: row[key],
      };
    }
  }
  return {
    present: false,
    value: undefined,
  };
};

const loadXlsx = () => import("xlsx");

const fetchAdminRoutesManagementData = async (force = false): Promise<AdminRoutesManagementData> => {
  if (!force && adminRoutesManagementCache) {
    return adminRoutesManagementCache;
  }

  if (!force && adminRoutesManagementRequest) {
    return adminRoutesManagementRequest;
  }

  const request = (async () => {
    const [routesResponse, hubsResponse, airportsResponse, fleetResponse] = await Promise.all([
      fetch("/api/admin/routes", { credentials: "include" }),
      fetch("/api/admin/hubs", { credentials: "include" }),
      fetch("/api/admin/airports", { credentials: "include" }),
      fetch("/api/admin/fleet/catalog", { credentials: "include" }),
    ]);

    const routesPayload = routesResponse.ok ? await routesResponse.json() : { routes: [] };
    const hubsPayload = hubsResponse.ok ? await hubsResponse.json() : { hubs: [] };
    const airportsPayload = airportsResponse.ok ? await airportsResponse.json() : { airports: [] };
    const fleetPayload = fleetResponse.ok ? await fleetResponse.json() : { fleets: [] };
    const nextRoutes = Array.isArray(routesPayload?.routes) ? (routesPayload.routes as AdminRouteItem[]) : [];
    const nextHubs = Array.isArray(hubsPayload?.hubs)
      ? (hubsPayload.hubs as Array<{ id: string | number; name?: string; airportsText?: string }>)
      : [];
    const nextAirports = Array.isArray(airportsPayload?.airports)
      ? (airportsPayload.airports as Array<{ id: number; name?: string; icao?: string; iata?: string; latitude?: number | null; longitude?: number | null }>)
      : [];
    const nextFleets = Array.isArray(fleetPayload?.fleets)
      ? (fleetPayload.fleets as Array<{
          id: string | number;
          name?: string;
          code?: string;
          airlineCode?: string;
          aircraft?: Array<{ model?: string; name?: string; registration?: string }>;
        }>)
      : [];

    const data = {
      routes: nextRoutes,
      hubs: nextHubs.map((hub) => ({
        id: String(hub.id),
        name: String(hub.name || "Hub"),
        airportsText: String(hub.airportsText || "") || undefined,
      })),
      airports: nextAirports.map((airport) => ({
        id: Number(airport.id || 0) || 0,
        name: String(airport.name || airport.icao || airport.iata || "Airport"),
        icao: String(airport.icao || "").trim() || undefined,
        iata: String(airport.iata || "").trim() || undefined,
        latitude: Number.isFinite(Number(airport.latitude)) ? Number(airport.latitude) : null,
        longitude: Number.isFinite(Number(airport.longitude)) ? Number(airport.longitude) : null,
      })),
      fleets: nextFleets.map((fleet) => {
        const aircraft = Array.isArray(fleet.aircraft) ? fleet.aircraft : [];
        const aircraftModels = Array.from(
          new Set(
            aircraft
              .map((item) => String(item?.model || item?.name || "").trim())
              .filter(Boolean)
          )
        );
        const registrations = Array.from(
          new Set(
            aircraft
              .map((item) => String(item?.registration || "").trim().toUpperCase())
              .filter(Boolean)
          )
        );

        const nextFleet = {
          id: String(fleet.id),
          name: String(fleet.name || fleet.code || `Fleet ${fleet.id}`),
          code: String(fleet.code || "").trim() || undefined,
          airlineCode: String(fleet.airlineCode || "").trim() || undefined,
          aircraftModels,
          registrations,
          searchText: "",
        };

        return {
          ...nextFleet,
          searchText: buildFleetSearchText(nextFleet),
        };
      }),
    } satisfies AdminRoutesManagementData;

    adminRoutesManagementCache = data;
    return data;
  })();

  adminRoutesManagementRequest = request;

  try {
    return await request;
  } finally {
    if (adminRoutesManagementRequest === request) {
      adminRoutesManagementRequest = null;
    }
  }
};

export function AdminRoutesManagement() {
  const location = useLocation();
  const [routes, setRoutes] = useState<AdminRouteItem[]>([]);
  const [hubs, setHubs] = useState<HubItem[]>([]);
  const [airports, setAirports] = useState<AirportItem[]>([]);
  const [fleets, setFleets] = useState<FleetOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [airlineFilter, setAirlineFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [hubFilter, setHubFilter] = useState("all");
  const [selectedRouteIds, setSelectedRouteIds] = useState<number[]>([]);
  const [editingRoute, setEditingRoute] = useState<AdminRouteItem | null>(null);
  const [routeDetail, setRouteDetail] = useState<AdminRouteDetail | null>(null);
  const [editorMode, setEditorMode] = useState<RouteEditorMode>("full");
  const [isRouteDetailLoading, setIsRouteDetailLoading] = useState(false);
  const [isSavingRouteMeta, setIsSavingRouteMeta] = useState(false);
  const [isClearingRouteMeta, setIsClearingRouteMeta] = useState(false);
  const [isApplyingSelection, setIsApplyingSelection] = useState(false);
  const [isBulkApplying, setIsBulkApplying] = useState(false);
  const [isDeletingRoute, setIsDeletingRoute] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [isCreatingRoute, setIsCreatingRoute] = useState(false);
  const [formState, setFormState] = useState<RouteEditorFormState>(createRouteEditorFormState());
  const [liveFormState, setLiveFormState] = useState<RouteLiveFormState>(createRouteLiveFormState());
  const [createFormState, setCreateFormState] = useState<RouteCreateFormState>(createDefaultRouteCreateFormState());
  const [createFleetSearch, setCreateFleetSearch] = useState("");
  const [liveFleetSearch, setLiveFleetSearch] = useState("");
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkFormState, setBulkFormState] = useState<BulkRouteFormState>(createDefaultBulkFormState());
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const applyLoadedData = (data: AdminRoutesManagementData) => {
    setRoutes(data.routes);
    setHubs(data.hubs);
    setAirports(data.airports);
    setFleets(data.fleets);
    setSelectedRouteIds((current) => current.filter((routeId) => data.routes.some((route) => route.id === routeId)));
  };

  const loadData = async ({ silent = false, force = false } = {}) => {
    if (silent) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const data = await fetchAdminRoutesManagementData(force);
      applyLoadedData(data);
    } catch (error) {
      console.error("Failed to load admin routes", error);
      toast.error(force ? "Failed to refresh routes" : "Failed to load routes");
      if (adminRoutesManagementCache) {
        applyLoadedData(adminRoutesManagementCache);
      } else {
        setRoutes([]);
        setHubs([]);
        setAirports([]);
        setFleets([]);
        setSelectedRouteIds([]);
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const savedEditorMode = window.localStorage.getItem(ROUTE_EDITOR_MODE_KEY);
    if (savedEditorMode === "full" || savedEditorMode === "turbo") {
      setEditorMode(savedEditorMode);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const requestedMode = params.get("mode");
    const requestedSection = params.get("section");

    if (requestedMode === "full" || requestedMode === "turbo") {
      setEditorMode(requestedMode);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(ROUTE_EDITOR_MODE_KEY, requestedMode);
      }
    }

    if (requestedSection === "all" || requestedSection === "default" || requestedSection === "soon-starting") {
      setSectionFilter(requestedSection);
    }
  }, [location.search]);

  useEffect(() => {
    if (!editingRoute) {
      setRouteDetail(null);
      setIsRouteDetailLoading(false);
      return;
    }

    let cancelled = false;

    const loadRouteDetail = async () => {
      setIsRouteDetailLoading(true);
      try {
        const response = await fetch(`/api/admin/routes/${editingRoute.id}/detail`, { credentials: "include" });
        if (!response.ok) {
          throw new Error("Failed to load route detail");
        }
        const payload = await response.json();
        if (!cancelled) {
          setRouteDetail((payload?.route as AdminRouteItem | undefined)?.detail || null);
        }
      } catch (error) {
        console.error("Failed to load route detail", error);
        if (!cancelled) {
          setRouteDetail(null);
          toast.error("Failed to load route detail");
        }
      } finally {
        if (!cancelled) {
          setIsRouteDetailLoading(false);
        }
      }
    };

    loadRouteDetail().catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [editingRoute]);

  useEffect(() => {
    if (!editingRoute) {
      setLiveFormState(createRouteLiveFormState());
      return;
    }

    setLiveFormState(createRouteLiveFormState(editingRoute, routeDetail));
  }, [editingRoute, routeDetail]);

  const airlineOptions = useMemo(
    () => sortAirlineCodes(Array.from(new Set(routes.map((route) => route.airlineCode).filter(Boolean)))),
    [routes]
  );

  const hubOptions = useMemo(
    () => [...hubs].sort((left, right) => left.name.localeCompare(right.name)),
    [hubs]
  );

  const fleetOptions = useMemo(
    () => [...fleets].sort((left, right) => `${left.airlineCode || ""}${left.name}`.localeCompare(`${right.airlineCode || ""}${right.name}`)),
    [fleets]
  );

  const createFleetSearchTokens = useMemo(() => normalizeFleetSearchTokens(createFleetSearch), [createFleetSearch]);

  const filteredCreateFleetOptions = useMemo(() => {
    if (createFleetSearchTokens.length === 0) {
      return fleetOptions;
    }

    return fleetOptions.filter((fleet) => createFleetSearchTokens.every((token) => fleet.searchText.includes(token)));
  }, [createFleetSearchTokens, fleetOptions]);

  const liveFleetSearchTokens = useMemo(() => normalizeFleetSearchTokens(liveFleetSearch), [liveFleetSearch]);

  const filteredLiveFleetOptions = useMemo(() => {
    if (liveFleetSearchTokens.length === 0) {
      return fleetOptions;
    }

    return fleetOptions.filter((fleet) => liveFleetSearchTokens.every((token) => fleet.searchText.includes(token)));
  }, [fleetOptions, liveFleetSearchTokens]);

  const airportLookupByCode = useMemo(() => {
    const lookup = new Map<string, AirportItem>();
    airports.forEach((airport) => {
      [airport.icao, airport.iata].forEach((code) => {
        const normalizedCode = String(code || "").trim().toUpperCase();
        if (normalizedCode) {
          lookup.set(normalizedCode, airport);
        }
      });
    });
    return lookup;
  }, [airports]);

  const routeCountsByAirline = useMemo(() => {
    return routes.reduce<Record<string, number>>((accumulator, route) => {
      const code = route.airlineCode || "NWS";
      accumulator[code] = (accumulator[code] || 0) + 1;
      return accumulator;
    }, {});
  }, [routes]);

  const filteredRoutes = useMemo(() => {
    const query = search.trim().toLowerCase();
    return routes.filter((route) => {
      const matchesSearch = !query || buildRouteSearchText(route).includes(query);
      const matchesAirline = airlineFilter === "all" || route.airlineCode === airlineFilter;
      const matchesStatus = statusFilter === "all" || String(route.meta?.status || "active") === statusFilter;
      const matchesPriority = priorityFilter === "all" || String(route.meta?.priority || "normal") === priorityFilter;
      const matchesSection = sectionFilter === "all" || String(route.meta?.section || "default") === sectionFilter;
      const matchesHub = hubFilter === "all" || String(route.meta?.hubId || "") === hubFilter;
      return matchesSearch && matchesAirline && matchesStatus && matchesPriority && matchesSection && matchesHub;
    });
  }, [airlineFilter, hubFilter, priorityFilter, routes, search, sectionFilter, statusFilter]);

  const soonStartingRoutes = useMemo(() => {
    return routes
      .filter((route) => String(route.meta?.section || "default") === "soon-starting")
      .sort((left, right) => String(left.flightNumber || left.id).localeCompare(String(right.flightNumber || right.id)));
  }, [routes]);

  const selectedRoutes = useMemo(() => {
    const selectedSet = new Set(selectedRouteIds);
    return routes.filter((route) => selectedSet.has(route.id));
  }, [routes, selectedRouteIds]);

  const activeServiceDaySet = useMemo(() => new Set(liveFormState.serviceDays), [liveFormState.serviceDays]);

  const createDepartureAirport = useMemo(() => {
    const token = createFormState.departureCode.trim().toUpperCase();
    return token ? airportLookupByCode.get(token) || null : null;
  }, [airportLookupByCode, createFormState.departureCode]);

  const createArrivalAirport = useMemo(() => {
    const token = createFormState.arrivalCode.trim().toUpperCase();
    return token ? airportLookupByCode.get(token) || null : null;
  }, [airportLookupByCode, createFormState.arrivalCode]);

  const createRouteSuggestions = useMemo(
    () =>
      collectRouteTextSuggestions({
        routes,
        departureCode: createFormState.departureCode,
        arrivalCode: createFormState.arrivalCode,
        currentValue: createFormState.routeText,
      }),
    [createFormState.arrivalCode, createFormState.departureCode, createFormState.routeText, routes]
  );

  const liveRouteSuggestions = useMemo(
    () =>
      collectRouteTextSuggestions({
        routes,
        departureCode: editingRoute?.fromCode || routeDetail?.departureCode,
        arrivalCode: editingRoute?.toCode || routeDetail?.arrivalCode,
        currentValue: liveFormState.routeText,
      }),
    [editingRoute?.fromCode, editingRoute?.toCode, liveFormState.routeText, routeDetail?.arrivalCode, routeDetail?.departureCode, routes]
  );

  const editorApplyTargetIds = useMemo(() => {
    const baseIds = editingRoute ? [editingRoute.id, ...selectedRouteIds] : selectedRouteIds;
    return Array.from(new Set(baseIds.filter((routeId) => Number.isFinite(routeId) && routeId > 0)));
  }, [editingRoute, selectedRouteIds]);

  const allFilteredSelected = filteredRoutes.length > 0 && filteredRoutes.every((route) => selectedRouteIds.includes(route.id));

  const toggleSelectAllFiltered = (checked: boolean) => {
    if (checked) {
      setSelectedRouteIds((current) => Array.from(new Set([...current, ...filteredRoutes.map((route) => route.id)])));
      return;
    }

    const filteredIds = new Set(filteredRoutes.map((route) => route.id));
    setSelectedRouteIds((current) => current.filter((routeId) => !filteredIds.has(routeId)));
  };

  const toggleRouteSelection = (routeId: number, checked: boolean) => {
    setSelectedRouteIds((current) => {
      if (checked) {
        return Array.from(new Set([...current, routeId]));
      }
      return current.filter((item) => item !== routeId);
    });
  };

  const openEditor = (route: AdminRouteItem) => {
    setRouteDetail(route.detail || null);
    setEditingRoute(route);
    setFormState(createRouteEditorFormState(route));
    setLiveFormState(createRouteLiveFormState(route, route.detail || null));
    setLiveFleetSearch("");
  };

  const openCreateDialog = () => {
    setCreateFormState(createDefaultRouteCreateFormState());
    setCreateFleetSearch("");
    setCreateDialogOpen(true);
  };

  const handleEditorModeChange = (nextMode: RouteEditorMode) => {
    setEditorMode(nextMode);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(ROUTE_EDITOR_MODE_KEY, nextMode);
    }
  };

  const toggleCreateServiceDay = (day: string, checked: boolean) => {
    setCreateFormState((current) => ({
      ...current,
      serviceDays: checked
        ? Array.from(new Set([...current.serviceDays, day]))
        : current.serviceDays.filter((item) => item !== day),
    }));
  };

  const toggleCreateFleet = (fleetId: string, checked: boolean) => {
    setCreateFormState((current) => ({
      ...current,
      fleetIds: checked
        ? Array.from(new Set([...current.fleetIds, fleetId]))
        : current.fleetIds.filter((item) => item !== fleetId),
    }));
  };

  const toggleLiveServiceDay = (day: string, checked: boolean) => {
    setLiveFormState((current) => ({
      ...current,
      serviceDays: checked
        ? Array.from(new Set([...current.serviceDays, day]))
        : current.serviceDays.filter((item) => item !== day),
    }));
  };

  const toggleLiveFleet = (fleetId: string, checked: boolean) => {
    setLiveFormState((current) => ({
      ...current,
      fleetIds: checked
        ? Array.from(new Set([...current.fleetIds, fleetId]))
        : current.fleetIds.filter((item) => item !== fleetId),
    }));
  };

  const createRoute = async () => {
    try {
      setIsCreatingRoute(true);
      const createResponse = await fetch("/api/admin/routes", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildRouteCreatePayload(createFormState)),
      });

      const createPayload = await createResponse.json().catch(() => null);
      if (!createResponse.ok) {
        throw new Error(String(createPayload?.error || "Failed to create route"));
      }

      const createdRouteId = Number(createPayload?.route?.id || createPayload?.id || createPayload?.data?.id || 0) || 0;
      const shouldSaveMeta = hasRouteMetaOverrides(createFormState);

      if (shouldSaveMeta && createdRouteId > 0) {
        const metaResponse = await fetch(`/api/admin/routes/${createdRouteId}/meta`, {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildCreateRouteMetaPayload(createFormState)),
        });

        if (!metaResponse.ok) {
          throw new Error(await readApiErrorMessage(metaResponse, "Route created, but overlay save failed"));
        }
      }

      setCreateDialogOpen(false);
      setCreateFormState(createDefaultRouteCreateFormState());
      await loadData({ silent: true, force: true });

      if (shouldSaveMeta && createdRouteId <= 0) {
        toast.warning("Route created, but the admin overlay was skipped because the new route id was not returned");
        return;
      }

      toast.success("Route created");
    } catch (error) {
      console.error("Failed to create route", error);
      toast.error(String(error instanceof Error ? error.message : error || "Failed to create route"));
    } finally {
      setIsCreatingRoute(false);
    }
  };

  const deleteLiveRoute = async () => {
    if (!editingRoute) {
      return;
    }

    if (!window.confirm(`Delete live route ${editingRoute.flightNumber || editingRoute.id}? This cannot be undone and related bookings/PIREPs may become orphaned.`)) {
      return;
    }

    try {
      setIsDeletingRoute(true);
      const response = await fetch(`/api/admin/routes/${editingRoute.id}`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response, "Failed to delete route"));
      }

      toast.success("Route deleted");
      setEditingRoute(null);
      setSelectedRouteIds((current) => current.filter((routeId) => routeId !== editingRoute.id));
      await loadData({ silent: true, force: true });
    } catch (error) {
      console.error("Failed to delete route", error);
      toast.error(String(error instanceof Error ? error.message : error || "Failed to delete route"));
    } finally {
      setIsDeletingRoute(false);
    }
  };

  const saveRouteMetaForIds = async (routeIds: number[], payload: ReturnType<typeof buildRouteMetaPayload>) => {
    const normalizedIds = Array.from(new Set(routeIds.filter((routeId) => Number.isFinite(routeId) && routeId > 0)));
    if (normalizedIds.length === 0) {
      throw new Error("Select at least one route");
    }

    if (normalizedIds.length === 1) {
      const response = await fetch(`/api/admin/routes/${normalizedIds[0]}/meta`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error("Save failed");
      }
      return;
    }

    const response = await fetch("/api/admin/routes/bulk-meta", {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ updates: normalizedIds.map((id) => ({ id, payload })) }),
    });
    if (!response.ok) {
      throw new Error("Bulk patch failed");
    }
  };

  const saveRoute = async () => {
    if (!editingRoute) {
      return;
    }

    try {
      setIsSavingRouteMeta(true);
      const liveResponse = await fetch(`/api/admin/routes/${editingRoute.id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildRouteUpdatePayload(liveFormState)),
      });
      if (!liveResponse.ok) {
        throw new Error(await readApiErrorMessage(liveResponse, "Failed to update live route"));
      }

      const metaResponse = await fetch(`/api/admin/routes/${editingRoute.id}/meta`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildRouteMetaPayload(formState)),
      });
      if (!metaResponse.ok) {
        throw new Error(await readApiErrorMessage(metaResponse, "Live route updated, but overlay save failed"));
      }

      toast.success("Route updated");
      setEditingRoute(null);
      await loadData({ silent: true, force: true });
    } catch (error) {
      console.error("Failed to save route", error);
      toast.error(String(error instanceof Error ? error.message : error || "Failed to save route"));
    } finally {
      setIsSavingRouteMeta(false);
    }
  };

  const applyEditorChangesToSelection = async () => {
    if (editorApplyTargetIds.length <= 1) {
      toast.error("Select more than one route to apply editor changes in bulk");
      return;
    }

    try {
      setIsApplyingSelection(true);
      await saveRouteMetaForIds(editorApplyTargetIds, buildRouteMetaPayload(formState));
      toast.success(`Editor changes applied to ${editorApplyTargetIds.length} routes`);
      setEditingRoute(null);
      await loadData({ silent: true, force: true });
    } catch (error) {
      console.error("Failed to apply editor changes to selected routes", error);
      toast.error("Failed to apply editor changes to selected routes");
    } finally {
      setIsApplyingSelection(false);
    }
  };

  const clearRouteMeta = async () => {
    if (!editingRoute) {
      return;
    }

    try {
      setIsClearingRouteMeta(true);
      const response = await fetch(`/api/admin/routes/${editingRoute.id}/meta`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        throw new Error("Delete failed");
      }
      toast.success("Route patch deleted");
      setEditingRoute(null);
      await loadData({ silent: true, force: true });
    } catch (error) {
      console.error("Failed to delete route metadata", error);
      toast.error("Failed to delete route patch");
    } finally {
      setIsClearingRouteMeta(false);
    }
  };

  const openBulkDialog = () => {
    setBulkFormState(createDefaultBulkFormState());
    setBulkDialogOpen(true);
  };

  const applyBulkPatch = async () => {
    if (selectedRouteIds.length === 0) {
      toast.error("Select at least one route");
      return;
    }

    const payload: Record<string, string | boolean> = {};
    if (bulkFormState.applyHub) {
      payload.hubId = bulkFormState.hubId === BULK_UNCHANGED || bulkFormState.hubId === "none" ? "" : bulkFormState.hubId;
    }
    if (bulkFormState.applyStatus) {
      payload.status = bulkFormState.status;
    }
    if (bulkFormState.applyPriority) {
      payload.priority = bulkFormState.priority;
    }
    if (bulkFormState.applySection) {
      payload.section = bulkFormState.section;
    }
    if (bulkFormState.applyNotes) {
      payload.notes = bulkFormState.notes;
    }
    if (bulkFormState.applyRemarks) {
      payload.remarks = bulkFormState.remarks;
    }
    if (bulkFormState.applyInternalRemarks) {
      payload.internalRemarks = bulkFormState.internalRemarks;
    }
    if (bulkFormState.applyTags) {
      payload.tags = bulkFormState.tags;
    }
    if (bulkFormState.applyHidden) {
      payload.hidden = bulkFormState.hidden;
    }

    if (Object.keys(payload).length === 0) {
      toast.error("Choose at least one field for the bulk patch");
      return;
    }

    try {
      setIsBulkApplying(true);
      const response = await fetch("/api/admin/routes/bulk-meta", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates: selectedRouteIds.map((routeId) => ({ id: routeId, payload })) }),
      });
      if (!response.ok) {
        throw new Error("Bulk patch failed");
      }
      toast.success(`Bulk patch applied to ${selectedRouteIds.length} routes`);
      setBulkDialogOpen(false);
      await loadData({ silent: true, force: true });
    } catch (error) {
      console.error("Failed to apply bulk patch", error);
      toast.error("Failed to apply bulk patch");
    } finally {
      setIsBulkApplying(false);
    }
  };

  const deleteSelectedPatches = async () => {
    if (selectedRouteIds.length === 0) {
      toast.error("Select at least one route");
      return;
    }

    if (!window.confirm(`Delete admin patch for ${selectedRouteIds.length} selected routes?`)) {
      return;
    }

    try {
      const response = await fetch("/api/admin/routes/bulk-meta", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedRouteIds }),
      });
      if (!response.ok) {
        throw new Error("Bulk delete failed");
      }
      toast.success(`Deleted patches for ${selectedRouteIds.length} routes`);
      setSelectedRouteIds([]);
      await loadData({ silent: true, force: true });
    } catch (error) {
      console.error("Failed to delete route patches", error);
      toast.error("Failed to delete selected patches");
    }
  };

  const exportRoutes = async (mode: "filtered" | "selected") => {
    const sourceRoutes = mode === "selected" ? selectedRoutes : filteredRoutes;
    if (sourceRoutes.length === 0) {
      toast.error(mode === "selected" ? "No selected routes to export" : "No filtered routes to export");
      return;
    }

    try {
      const XLSX = await loadXlsx();
      const rows = sourceRoutes.map((route) => ({
        id: route.id,
        flightNumber: route.flightNumber,
        airlineCode: route.airlineCode,
        fromCode: route.fromCode,
        toCode: route.toCode,
        fromName: route.fromName,
        toName: route.toName,
        distance: route.distance,
        duration: route.duration,
        hubId: route.meta?.hubId || "",
        hubLabel: route.meta?.hubLabel || "",
        status: route.meta?.status || "active",
        priority: route.meta?.priority || "normal",
        section: route.meta?.section || "default",
        notes: route.meta?.notes || "",
        remarks: route.meta?.remarks || "",
        internalRemarks: route.meta?.internalRemarks || "",
        tags: Array.isArray(route.meta?.tags) ? route.meta.tags.join(", ") : "",
        hidden: route.meta?.hidden ? "true" : "false",
        updatedAt: route.meta?.updatedAt || "",
      }));

      const workbook = XLSX.utils.book_new();
      const sheet = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(workbook, sheet, "Routes");
      XLSX.writeFile(workbook, `routes-${mode}-${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success(`Exported ${sourceRoutes.length} routes`);
    } catch (error) {
      console.error("Failed to export routes", error);
      toast.error("Failed to export routes");
    }
  };

  const importRoutePatchFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    try {
      const XLSX = await loadXlsx();
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[firstSheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

      const updates = rows
        .map((row) => {
          const routeIdField = getImportField(row, ["id", "routeId", "route_id", "Route ID"]);
          const routeId = Number(String(routeIdField.value || "").trim());
          if (!routeIdField.present || !Number.isFinite(routeId) || routeId <= 0) {
            return null;
          }

          const payload: Record<string, string> = {};
          const hubIdField = getImportField(row, ["hubId", "hub_id", "Hub ID"]);
          const statusField = getImportField(row, ["status", "Status"]);
          const priorityField = getImportField(row, ["priority", "Priority"]);
          const sectionField = getImportField(row, ["section", "placement", "Section"]);
          const notesField = getImportField(row, ["notes", "Notes"]);
          const remarksField = getImportField(row, ["remarks", "Remarks"]);
          const internalRemarksField = getImportField(row, ["internalRemarks", "internal_remarks", "Internal Remarks"]);
          const tagsField = getImportField(row, ["tags", "Tags"]);
          const hiddenField = getImportField(row, ["hidden", "Hidden"]);

          if (hubIdField.present) {
            payload.hubId = String(hubIdField.value || "").trim();
          }
          if (statusField.present) {
            payload.status = String(statusField.value || "").trim() || "active";
          }
          if (priorityField.present) {
            payload.priority = String(priorityField.value || "").trim() || "normal";
          }
          if (sectionField.present) {
            payload.section = String(sectionField.value || "").trim() || "default";
          }
          if (notesField.present) {
            payload.notes = String(notesField.value || "");
          }
          if (remarksField.present) {
            payload.remarks = String(remarksField.value || "");
          }
          if (internalRemarksField.present) {
            payload.internalRemarks = String(internalRemarksField.value || "");
          }
          if (tagsField.present) {
            payload.tags = String(tagsField.value || "");
          }
          if (hiddenField.present) {
            payload.hidden = String(hiddenField.value || "");
          }

          if (Object.keys(payload).length === 0) {
            return null;
          }

          return {
            id: routeId,
            payload,
          };
        })
        .filter((item): item is { id: number; payload: Record<string, string> } => Boolean(item));

      if (updates.length === 0) {
        toast.error("No valid route patch rows found in the spreadsheet");
        return;
      }

      const response = await fetch("/api/admin/routes/bulk-meta", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
      if (!response.ok) {
        throw new Error("Import failed");
      }

      toast.success(`Imported patch rows for ${updates.length} routes`);
      await loadData({ silent: true, force: true });
    } catch (error) {
      console.error("Failed to import route patch spreadsheet", error);
      toast.error("Failed to import route spreadsheet");
    }
  };

  return (
    <div className="space-y-6">
      <input ref={importInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={importRoutePatchFile} />

      <Card className="overflow-hidden border-none bg-[radial-gradient(circle_at_top_left,_rgba(227,30,36,0.16),_transparent_36%),linear-gradient(135deg,_#fff7f7,_#ffffff_58%,_#f8fafc)] shadow-sm">
        <CardContent className="space-y-5 p-5">
          <div className="flex flex-col gap-5 2xl:flex-row 2xl:items-start 2xl:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center rounded-full border border-red-200 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-red-700">
                Route control
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Routes</h2>
                <p className="max-w-2xl text-sm text-gray-600">
                  Search, compare and bulk patch routes in one place. Lists and catalogs stay cached until you run a manual refresh.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/80 bg-white/85 p-2 shadow-sm backdrop-blur">
              <Button className="bg-[#E31E24] hover:bg-[#c41a20]" onClick={openCreateDialog}>
                <Plus className="mr-2 h-4 w-4" />
                Create route
              </Button>
              <Button variant="outline" onClick={() => loadData({ silent: true, force: true })} disabled={isLoading || isRefreshing}>
                <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button variant="outline" onClick={() => exportRoutes("filtered")} disabled={filteredRoutes.length === 0}>
                <Download className="mr-2 h-4 w-4" />
                Export filtered
              </Button>
              <Button variant="outline" onClick={() => exportRoutes("selected")} disabled={selectedRoutes.length === 0}>
                <Download className="mr-2 h-4 w-4" />
                Export selected
              </Button>
              <Button variant="outline" onClick={() => importInputRef.current?.click()}>
                <Upload className="mr-2 h-4 w-4" />
                Import patch
              </Button>
              <Button onClick={openBulkDialog} disabled={selectedRouteIds.length === 0}>
                <Wand2 className="mr-2 h-4 w-4" />
                Bulk patch
              </Button>
            </div>
          </div>

          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.6fr)_repeat(4,minmax(0,0.78fr))]">
            <div className="relative w-full">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search flight, airline, airport, hub or notes..." className="border-white bg-white pl-9 shadow-sm" />
            </div>
            <Select value={airlineFilter} onValueChange={setAirlineFilter}>
              <SelectTrigger className="w-full border-white bg-white shadow-sm"><SelectValue placeholder="Airline" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All airlines</SelectItem>
                {airlineOptions.map((airlineCode) => <SelectItem key={airlineCode} value={airlineCode}>{airlineCode}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full border-white bg-white shadow-sm"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {ROUTE_STATUSES.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-full border-white bg-white shadow-sm"><SelectValue placeholder="Priority" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All priorities</SelectItem>
                {ROUTE_PRIORITIES.map((priority) => <SelectItem key={priority} value={priority}>{priority}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sectionFilter} onValueChange={setSectionFilter}>
              <SelectTrigger className="w-full border-white bg-white shadow-sm"><SelectValue placeholder="Section" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sections</SelectItem>
                {ROUTE_SECTIONS.map((section) => <SelectItem key={section.value} value={section.value}>{section.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={hubFilter} onValueChange={setHubFilter}>
              <SelectTrigger className="w-full border-white bg-white shadow-sm"><SelectValue placeholder="Hub" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All hubs</SelectItem>
                {hubOptions.map((hub) => <SelectItem key={hub.id} value={hub.id}>{hub.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/80 bg-white/70 p-2">
            <span className="px-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-500">Airlines</span>
            <Button variant={airlineFilter === "all" ? "default" : "outline"} size="sm" onClick={() => setAirlineFilter("all")}>All</Button>
            {airlineOptions.map((airlineCode) => (
              <Button key={airlineCode} variant={airlineFilter === airlineCode ? "default" : "outline"} size="sm" onClick={() => setAirlineFilter(airlineCode)}>
                {airlineCode} ({routeCountsByAirline[airlineCode] || 0})
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-none shadow-sm"><CardContent className="p-5"><div className="text-sm text-gray-500">Total routes</div><div className="mt-2 text-2xl font-semibold text-gray-900">{routes.length}</div></CardContent></Card>
        <Card className="border-none shadow-sm"><CardContent className="p-5"><div className="text-sm text-gray-500">Filtered</div><div className="mt-2 text-2xl font-semibold text-gray-900">{filteredRoutes.length}</div></CardContent></Card>
        <Card className="border-none shadow-sm"><CardContent className="p-5"><div className="text-sm text-gray-500">Selected</div><div className="mt-2 text-2xl font-semibold text-gray-900">{selectedRouteIds.length}</div></CardContent></Card>
        <Card className="border-none shadow-sm"><CardContent className="p-5"><div className="text-sm text-gray-500">Soon starting</div><div className="mt-2 text-2xl font-semibold text-gray-900">{soonStartingRoutes.length}</div></CardContent></Card>
      </div>

      {soonStartingRoutes.length > 0 ? (
        <Card className="border-none shadow-sm">
          <CardContent className="space-y-4 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Soon starting</h3>
                <p className="text-sm text-gray-500">Curated routes that should surface as upcoming highlights.</p>
              </div>
              <Button variant="outline" onClick={() => setSectionFilter("soon-starting")}>
                <Rocket className="mr-2 h-4 w-4" />
                Filter section
              </Button>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {soonStartingRoutes.slice(0, 6).map((route) => (
                <div key={`soon-${route.id}`} className="rounded-xl border border-red-100 bg-gradient-to-br from-red-50 via-white to-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-red-700">{route.flightNumber || `Route ${route.id}`}</div>
                      <div className="text-xs text-gray-500">{route.airlineCode || "NWS"}</div>
                    </div>
                    <Badge variant="outline" className="border-red-200 bg-white text-red-700">Soon starting</Badge>
                  </div>
                  <div className="mt-3 text-base font-medium text-gray-900">{route.fromCode} → {route.toCode}</div>
                  <div className="text-sm text-gray-500">{route.fromName} / {route.toName}</div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-600">
                    <span>{route.distance}</span>
                    <span>{route.duration}</span>
                    <span>{route.meta?.hubLabel || "No hub"}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-none shadow-sm">
        <CardContent className="space-y-4 p-4">
          {selectedRouteIds.length > 0 ? (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-red-100 bg-red-50 px-4 py-3">
              <div className="text-sm font-medium text-red-900">{selectedRouteIds.length} routes selected</div>
              <Button variant="outline" size="sm" onClick={openBulkDialog}><Wand2 className="mr-2 h-4 w-4" />Bulk patch</Button>
              <Button variant="outline" size="sm" onClick={deleteSelectedPatches}><Trash2 className="mr-2 h-4 w-4" />Delete patch</Button>
              <Button variant="outline" size="sm" onClick={() => exportRoutes("selected")}><Download className="mr-2 h-4 w-4" />Export</Button>
              <Button variant="outline" size="sm" onClick={() => setSelectedRouteIds([])}><X className="mr-2 h-4 w-4" />Clear selection</Button>
            </div>
          ) : null}

          <div className="rounded-md border overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium"><Checkbox checked={allFilteredSelected} onCheckedChange={(checked) => toggleSelectAllFiltered(Boolean(checked))} /></th>
                  <th className="px-4 py-3 font-medium">Flight</th>
                  <th className="px-4 py-3 font-medium">Route</th>
                  <th className="px-4 py-3 font-medium">Performance</th>
                  <th className="px-4 py-3 font-medium">Hub</th>
                  <th className="px-4 py-3 font-medium">Patch</th>
                  <th className="px-4 py-3 font-medium">Updated</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">Loading routes...</td></tr>
                ) : filteredRoutes.length > 0 ? (
                  filteredRoutes.map((route) => (
                    <tr key={route.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 align-top"><Checkbox checked={selectedRouteIds.includes(route.id)} onCheckedChange={(checked) => toggleRouteSelection(route.id, Boolean(checked))} /></td>
                      <td className="px-4 py-3 align-top">
                        <div className="font-medium text-gray-900">{route.flightNumber || `Route ${route.id}`}</div>
                        <div className="text-xs text-gray-500">{route.airlineCode || "NWS"}</div>
                      </td>
                      <td className="px-4 py-3 align-top text-gray-700">{route.fromCode} → {route.toCode}<div className="text-xs text-gray-500">{route.fromName} / {route.toName}</div></td>
                      <td className="px-4 py-3 align-top text-gray-700">{route.distance}<div className="text-xs text-gray-500">{route.duration} · {route.fleetIds?.length || 0} fleet refs</div></td>
                      <td className="px-4 py-3 align-top text-gray-700">{route.meta?.hubLabel || "—"}</td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline" className="border-gray-200 bg-gray-50 text-gray-700">{route.meta?.status || "active"}</Badge>
                          <Badge variant="outline" className="border-gray-200 bg-gray-50 text-gray-700">{route.meta?.priority || "normal"}</Badge>
                          <Badge variant="outline" className="border-gray-200 bg-gray-50 text-gray-700">{formatRouteSectionLabel(route.meta?.section)}</Badge>
                          {route.meta?.hidden ? <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">Hidden</Badge> : null}
                        </div>
                        {route.meta?.remarks ? <div className="mt-2 max-w-sm text-xs text-gray-600">Public: {route.meta.remarks}</div> : null}
                        {route.meta?.notes ? <div className="mt-1 max-w-sm text-xs text-gray-500">Admin: {route.meta.notes}</div> : <div className="mt-2 text-xs text-gray-400">No admin notes</div>}
                        {Array.isArray(route.meta?.tags) && route.meta.tags.length > 0 ? (
                          <div className="mt-2 flex max-w-sm flex-wrap gap-1">
                            {route.meta.tags.slice(0, 4).map((tag) => (
                              <Badge key={`${route.id}-${tag}`} variant="outline" className="border-red-100 bg-red-50 text-[11px] text-red-700">{tag}</Badge>
                            ))}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 align-top text-xs text-gray-500">{formatDateTime(route.meta?.updatedAt)}</td>
                      <td className="px-4 py-3 text-right align-top"><Button variant="outline" size="sm" onClick={() => openEditor(route)}><Edit className="mr-2 h-4 w-4" />Edit</Button></td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">No routes found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {selectedRoutes.length >= 2 ? (
        <Card className="border-none shadow-sm">
          <CardContent className="space-y-4 p-4">
            <div className="flex items-center gap-3">
              <GitCompareArrows className="h-5 w-5 text-gray-500" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Compare selected routes</h3>
                <p className="text-sm text-gray-500">Fast side-by-side view for the current multi-selection.</p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {selectedRoutes.slice(0, 6).map((route) => (
                <div key={`compare-${route.id}`} className="rounded-xl border border-gray-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold text-gray-900">{route.flightNumber || `Route ${route.id}`}</div>
                      <div className="text-xs text-gray-500">{route.airlineCode || "NWS"}</div>
                    </div>
                    <Badge variant="outline" className="border-gray-200 bg-gray-50 text-gray-700">{formatRouteSectionLabel(route.meta?.section)}</Badge>
                  </div>
                  <div className="mt-3 text-sm text-gray-700">{route.fromCode} → {route.toCode}</div>
                  <div className="text-xs text-gray-500">{route.fromName} / {route.toName}</div>
                  <div className="mt-4 space-y-2 text-sm text-gray-700">
                    <div>Distance: {route.distance}</div>
                    <div>Duration: {route.duration}</div>
                    <div>Hub: {route.meta?.hubLabel || "—"}</div>
                    <div>Status: {route.meta?.status || "active"}</div>
                    <div>Priority: {route.meta?.priority || "normal"}</div>
                    <div>Visibility: {route.meta?.hidden ? "Hidden" : "Visible"}</div>
                    <div>Tags: {Array.isArray(route.meta?.tags) && route.meta.tags.length > 0 ? route.meta.tags.join(", ") : "—"}</div>
                    <div>Notes: {route.meta?.notes || route.meta?.remarks || "—"}</div>
                  </div>
                </div>
              ))}
            </div>
            {selectedRoutes.length > 6 ? <div className="text-xs text-gray-500">Showing first 6 selected routes in compare mode.</div> : null}
          </CardContent>
        </Card>
      ) : null}

      <Dialog open={Boolean(editingRoute)} onOpenChange={(open) => !open && setEditingRoute(null)}>
        <DialogContent className="max-h-[92vh] overflow-hidden p-0 sm:max-w-5xl">
          <DialogHeader className="border-b border-gray-200 px-6 py-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <DialogTitle>Route editor</DialogTitle>
                <div className="text-sm text-gray-500">
                  {editingRoute?.flightNumber || `Route ${editingRoute?.id || ""}`} · {editingRoute?.fromCode || routeDetail?.departureCode || "—"} → {editingRoute?.toCode || routeDetail?.arrivalCode || "—"}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="border-gray-200 bg-gray-50 text-gray-700">{editingRoute?.airlineCode || routeDetail?.airlineCode || "NWS"}</Badge>
                  <Badge variant="outline" className="border-gray-200 bg-gray-50 text-gray-700">{formState.status}</Badge>
                  <Badge variant="outline" className="border-gray-200 bg-gray-50 text-gray-700">{formatRouteSectionLabel(formState.section)}</Badge>
                  {formState.hidden ? <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">Hidden</Badge> : null}
                  {liveFormState.liveHidden ? <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">Live hidden</Badge> : null}
                </div>
              </div>
              <div className="space-y-3 lg:max-w-md">
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant={editorMode === "full" ? "default" : "outline"} size="sm" onClick={() => handleEditorModeChange("full")}>Full</Button>
                  <Button variant={editorMode === "turbo" ? "default" : "outline"} size="sm" onClick={() => handleEditorModeChange("turbo")}>Turbo</Button>
                  {editorApplyTargetIds.length > 1 ? <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">{editorApplyTargetIds.length} routes ready for bulk apply</Badge> : null}
                </div>
                <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-900">
                  <div className="font-medium">Live route + local overlay</div>
                  <div className="mt-1 text-red-800/80">Flight data, timing, fleet and routing are saved to vAMSYS. Hub, placement, website remarks, tags and admin notes stay in the local overlay.</div>
                </div>
              </div>
            </div>
          </DialogHeader>
          <ScrollArea className="max-h-[74vh]">
            <div className="space-y-6 px-6 py-5">
              {editorMode === "full" ? (
                <div className="rounded-2xl border border-gray-200 bg-gray-50/80 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-gray-900">Live route snapshot</div>
                      <div className="text-sm text-gray-500">Reference data pulled from vAMSYS for the current route.</div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      {isRouteDetailLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      <span>{routeDetail?.source ? `Source: ${routeDetail.source}` : "Source: vAMSYS"}</span>
                    </div>
                  </div>
                  <Separator className="my-4" />
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div>
                      <div className="text-xs uppercase tracking-[0.14em] text-gray-400">Flight</div>
                      <div className="mt-1 text-sm font-medium text-gray-900">{formatRouteTextValue(routeDetail?.flightNumber || editingRoute?.flightNumber)}</div>
                      <div className="text-xs text-gray-500">Callsign: {formatRouteTextValue(routeDetail?.callsign || editingRoute?.flightNumber)}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-[0.14em] text-gray-400">Route</div>
                      <div className="mt-1 text-sm font-medium text-gray-900">{editingRoute?.fromCode || routeDetail?.departureCode || "—"} → {editingRoute?.toCode || routeDetail?.arrivalCode || "—"}</div>
                      <div className="text-xs text-gray-500">{formatRouteTextValue(routeDetail?.departureName || editingRoute?.fromName)} / {formatRouteTextValue(routeDetail?.arrivalName || editingRoute?.toName)}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-[0.14em] text-gray-400">Performance</div>
                      <div className="mt-1 text-sm font-medium text-gray-900">{formatRouteTextValue(routeDetail?.distance || editingRoute?.distance)}</div>
                      <div className="text-xs text-gray-500">Duration: {formatRouteTextValue(routeDetail?.duration || editingRoute?.duration)}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-[0.14em] text-gray-400">Type</div>
                      <div className="mt-1 text-sm font-medium capitalize text-gray-900">{formatRouteTextValue(routeDetail?.type || editingRoute?.detail?.type)}</div>
                      <div className="text-xs text-gray-500">Frequency: {formatRouteTextValue(routeDetail?.frequency || editingRoute?.detail?.frequency)}</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-gray-200 bg-gradient-to-r from-white via-gray-50 to-red-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-gray-900">Turbo summary</div>
                      <div className="text-sm text-gray-500">Short mode keeps only the key route context and editable local fields.</div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      {isRouteDetailLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      <span>{formatRouteTextValue(routeDetail?.departureCode || editingRoute?.fromCode)} → {formatRouteTextValue(routeDetail?.arrivalCode || editingRoute?.toCode)}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className={`grid gap-6 ${editorMode === "full" ? "xl:grid-cols-[1.25fr_0.95fr]" : "xl:grid-cols-[1.35fr_0.85fr]"}`}>
                <div className="space-y-6">
                  <div className="rounded-2xl border border-gray-200 bg-white p-5">
                    <div className="mb-4">
                      <h3 className="text-base font-semibold text-gray-900">Basic Information</h3>
                      <p className="text-sm text-gray-500">{editorMode === "full" ? "Core live route identity plus local hub placement." : "Turbo mode keeps the key live route controls plus local placement."}</p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Flight number</Label>
                        <Input value={liveFormState.flightNumber} onChange={(event) => setLiveFormState((current) => ({ ...current, flightNumber: event.target.value.toUpperCase() }))} placeholder="NWS101" />
                      </div>
                      <div className="space-y-2">
                        <Label>Callsign</Label>
                        <Input value={liveFormState.callsign} onChange={(event) => setLiveFormState((current) => ({ ...current, callsign: event.target.value.toUpperCase() }))} placeholder="NWS101" />
                      </div>
                      <div className="space-y-2">
                        <Label>Airline</Label>
                        <Input value={routeDetail?.airlineCode || editingRoute?.airlineCode || ""} readOnly disabled />
                      </div>
                      <div className="space-y-2">
                        <Label>Type</Label>
                        <Input value={liveFormState.type} onChange={(event) => setLiveFormState((current) => ({ ...current, type: event.target.value }))} placeholder="scheduled" />
                      </div>
                      <div className="space-y-2">
                        <Label>Departure</Label>
                        <Input value={`${editingRoute?.fromCode || routeDetail?.departureCode || "—"} · ${editingRoute?.fromName || routeDetail?.departureName || "—"}`} readOnly disabled />
                      </div>
                      <div className="space-y-2">
                        <Label>Arrival</Label>
                        <Input value={`${editingRoute?.toCode || routeDetail?.arrivalCode || "—"} · ${editingRoute?.toName || routeDetail?.arrivalName || "—"}`} readOnly disabled />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label>Hub</Label>
                        <Select value={formState.hubId || "none"} onValueChange={(value) => setFormState((current) => ({ ...current, hubId: value === "none" ? "" : value }))}>
                          <SelectTrigger><SelectValue placeholder="Select hub" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No hub</SelectItem>
                            {hubOptions.map((hub) => <SelectItem key={hub.id} value={hub.id}>{hub.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <div className="text-xs text-gray-500">Current label: {editingRoute?.meta?.hubLabel || "—"}</div>
                      </div>
                    </div>
                  </div>

                  {editorMode === "full" ? (
                    <div className="rounded-2xl border border-gray-200 bg-white p-5">
                      <div className="mb-4">
                        <h3 className="text-base font-semibold text-gray-900">Dates and Times</h3>
                        <p className="text-sm text-gray-500">Editable live schedule fields for the current route.</p>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Start date</Label>
                          <Input value={liveFormState.startDate} onChange={(event) => setLiveFormState((current) => ({ ...current, startDate: event.target.value }))} placeholder="2026-04-18 or ISO datetime" />
                        </div>
                        <div className="space-y-2">
                          <Label>End date</Label>
                          <Input value={liveFormState.endDate} onChange={(event) => setLiveFormState((current) => ({ ...current, endDate: event.target.value }))} placeholder="2026-10-31 or ISO datetime" />
                        </div>
                        <div className="space-y-2">
                          <Label>Departure UTC</Label>
                          <Input value={liveFormState.departureTimeUtc} onChange={(event) => setLiveFormState((current) => ({ ...current, departureTimeUtc: event.target.value }))} placeholder="14:30:00" />
                        </div>
                        <div className="space-y-2">
                          <Label>Arrival UTC</Label>
                          <Input value={liveFormState.arrivalTimeUtc} onChange={(event) => setLiveFormState((current) => ({ ...current, arrivalTimeUtc: event.target.value }))} placeholder="18:45:00" />
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <div className="rounded-2xl border border-gray-200 bg-white p-5">
                    <div className="mb-4">
                      <h3 className="text-base font-semibold text-gray-900">Live Routing</h3>
                      <p className="text-sm text-gray-500">Editable route text and live remarks stored in vAMSYS.</p>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Route text</Label>
                        <Textarea value={liveFormState.routeText} onChange={(event) => setLiveFormState((current) => ({ ...current, routeText: event.target.value }))} className="min-h-[132px] font-mono text-xs" placeholder="DCT ... STAR" />
                        <div className="flex flex-wrap gap-2">
                          {liveRouteSuggestions.map((suggestion) => (
                            <button
                              key={`edit-route-suggestion-${suggestion}`}
                              type="button"
                              onClick={() => setLiveFormState((current) => ({ ...current, routeText: suggestion }))}
                              className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-left text-xs text-gray-700 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                            >
                              {suggestion}
                            </button>
                          ))}
                        </div>
                        <div className="text-xs text-gray-500">
                          {liveRouteSuggestions.length > 0
                            ? `Existing route variants for ${(editingRoute?.fromCode || routeDetail?.departureCode || "DEP").trim().toUpperCase()} -> ${(editingRoute?.toCode || routeDetail?.arrivalCode || "ARR").trim().toUpperCase()}. Empty field is not sent during save, so it will not wipe the live route.`
                            : "If this field stays empty, route text is not sent during save and the current live route text remains unchanged."}
                        </div>
                        <AdminRoutePreviewMap
                          departureCode={editingRoute?.fromCode || routeDetail?.departureCode}
                          arrivalCode={editingRoute?.toCode || routeDetail?.arrivalCode}
                          routeText={liveFormState.routeText}
                          airports={airports}
                        />
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Live remarks</Label>
                          <Textarea value={liveFormState.routeRemarks} onChange={(event) => setLiveFormState((current) => ({ ...current, routeRemarks: event.target.value }))} className="min-h-[120px]" placeholder="Remarks saved on the live route" />
                        </div>
                        <div className="space-y-2">
                          <Label>Live internal remarks</Label>
                          <Textarea value={liveFormState.routeNotes} onChange={(event) => setLiveFormState((current) => ({ ...current, routeNotes: event.target.value }))} className="min-h-[120px]" placeholder="Internal remarks saved on the live route" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-gray-200 bg-white p-5">
                    <div className="mb-4">
                      <h3 className="text-base font-semibold text-gray-900">Website Overlay</h3>
                      <p className="text-sm text-gray-500">These fields stay local and drive admin curation on the website.</p>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Website remarks</Label>
                        <Textarea value={formState.remarks} onChange={(event) => setFormState((current) => ({ ...current, remarks: event.target.value }))} className="min-h-[120px]" placeholder="Site-facing remarks or dispatch hints" />
                      </div>
                      <div className="space-y-2">
                        <Label>Internal remarks</Label>
                        <Textarea value={formState.internalRemarks} onChange={(event) => setFormState((current) => ({ ...current, internalRemarks: event.target.value }))} className="min-h-[120px]" placeholder="Internal-only route notes for the admin team" />
                      </div>
                      <div className="space-y-2">
                        <Label>Admin notes</Label>
                        <Textarea value={formState.notes} onChange={(event) => setFormState((current) => ({ ...current, notes: event.target.value }))} className="min-h-[120px]" placeholder="Placement notes, release context, rollout instructions" />
                      </div>
                      <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
                        <div className="space-y-2">
                          <Label>Website tags</Label>
                          <Input value={formState.tags} onChange={(event) => setFormState((current) => ({ ...current, tags: event.target.value }))} placeholder="promo, eu-summer, longhaul" />
                          <div className="text-xs text-gray-500">Comma or line separated.</div>
                        </div>
                        <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 px-4 py-3 md:min-w-[220px]">
                          <div>
                            <div className="text-sm font-medium text-gray-900">Hide in website overlay</div>
                            <div className="text-xs text-gray-500">Keeps the route in admin while removing it from public surfacing.</div>
                          </div>
                          <Switch checked={formState.hidden} onCheckedChange={(checked) => setFormState((current) => ({ ...current, hidden: Boolean(checked) }))} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="rounded-2xl border border-gray-200 bg-white p-5">
                    <div className="mb-4">
                      <h3 className="text-base font-semibold text-gray-900">Live Flight Details and Placement</h3>
                      <p className="text-sm text-gray-500">Overlay placement stays at the top; live route parameters are editable below.</p>
                    </div>
                    <div className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
                        <div className="space-y-2">
                          <Label>Status</Label>
                          <Select value={formState.status} onValueChange={(value) => setFormState((current) => ({ ...current, status: value }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {ROUTE_STATUSES.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Priority</Label>
                          <Select value={formState.priority} onValueChange={(value) => setFormState((current) => ({ ...current, priority: value }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {ROUTE_PRIORITIES.map((priority) => <SelectItem key={priority} value={priority}>{priority}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Section</Label>
                          <Select value={formState.section} onValueChange={(value) => setFormState((current) => ({ ...current, section: value }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {ROUTE_SECTIONS.map((section) => <SelectItem key={section.value} value={section.value}>{section.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <Separator />
                      <div className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
                          <div className="space-y-2">
                            <Label>Flight length</Label>
                            <Input value={liveFormState.duration} onChange={(event) => setLiveFormState((current) => ({ ...current, duration: event.target.value }))} placeholder="02:45:00" />
                          </div>
                          <div className="space-y-2">
                            <Label>Distance (nm)</Label>
                            <Input value={liveFormState.distanceNm} onChange={(event) => setLiveFormState((current) => ({ ...current, distanceNm: event.target.value.replace(/[^0-9.]/g, "") }))} placeholder="1480" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Cruise altitude (ft)</Label>
                          <Input value={liveFormState.flightLevel} onChange={(event) => setLiveFormState((current) => ({ ...current, flightLevel: event.target.value.toUpperCase() }))} placeholder="36000" />
                        </div>
                        <div className="space-y-2">
                          <Label>Cost index</Label>
                          <Input value={liveFormState.costIndex} onChange={(event) => setLiveFormState((current) => ({ ...current, costIndex: event.target.value }))} placeholder="AUTO / 25" />
                        </div>
                        <div className="space-y-2">
                          <Label>Live tags</Label>
                          <Input value={liveFormState.liveTags} onChange={(event) => setLiveFormState((current) => ({ ...current, liveTags: event.target.value }))} placeholder="scheduled, cargo, seasonal" />
                          <div className="text-xs text-gray-500">Sent to vAMSYS as the live route `tag` field.</div>
                        </div>
                        <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 px-4 py-3">
                          <div>
                            <div className="text-sm font-medium text-gray-900">Hide live route in vAMSYS</div>
                            <div className="text-xs text-gray-500">Saves the documented live `hidden` flag on the route itself.</div>
                          </div>
                          <Switch checked={liveFormState.liveHidden} onCheckedChange={(checked) => setLiveFormState((current) => ({ ...current, liveHidden: Boolean(checked) }))} />
                        </div>
                        <div className="space-y-2">
                          <Label>Fleet refs</Label>
                          <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                            <Input
                              value={liveFleetSearch}
                              onChange={(event) => setLiveFleetSearch(event.target.value)}
                              placeholder="Type, registration or fleet ID"
                              className="pl-9 pr-9"
                            />
                            {liveFleetSearch ? (
                              <button
                                type="button"
                                onClick={() => setLiveFleetSearch("")}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-gray-700"
                                aria-label="Clear fleet search"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            ) : null}
                          </div>
                          <div className="text-xs text-gray-500">
                            Search by fleet code, aircraft type, registration or internal fleet id.
                          </div>
                          <div className="max-h-[240px] space-y-2 overflow-y-auto pr-1">
                            {filteredLiveFleetOptions.length > 0 ? (
                              filteredLiveFleetOptions.map((fleet) => {
                                const modelPreview = formatFleetSearchPreview(fleet.aircraftModels, "Types");
                                const registrationPreview = formatFleetSearchPreview(fleet.registrations, "Regs");
                                const checked = liveFormState.fleetIds.includes(fleet.id);
                                return (
                                  <label key={`edit-fleet-${fleet.id}`} className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 px-3 py-3">
                                    <Checkbox checked={checked} onCheckedChange={(value) => toggleLiveFleet(fleet.id, Boolean(value))} />
                                    <div className="min-w-0">
                                      <div className="text-sm font-medium text-gray-900">{fleet.code ? `${fleet.code} · ` : ""}{fleet.name}</div>
                                      <div className="text-xs text-gray-500">{fleet.airlineCode || "Fleet"} · ID {fleet.id}</div>
                                      {modelPreview || registrationPreview ? (
                                        <div className="mt-1 text-xs text-gray-500">
                                          {[modelPreview, registrationPreview].filter(Boolean).join(" · ")}
                                        </div>
                                      ) : null}
                                    </div>
                                  </label>
                                );
                              })
                            ) : fleetOptions.length > 0 ? (
                              <div className="rounded-xl border border-dashed border-gray-200 px-4 py-6 text-sm text-gray-500">
                                No fleet matches for “{liveFleetSearch.trim()}”. Try a shorter type, registration fragment or fleet id.
                              </div>
                            ) : (
                              <div className="rounded-xl border border-dashed border-gray-200 px-4 py-6 text-sm text-gray-500">No fleet catalog entries are available yet.</div>
                            )}
                          </div>
                        </div>
                        <div className="grid gap-3 text-sm text-gray-700">
                          <div className="flex items-start justify-between gap-4"><span className="text-gray-500">Departure</span><span className="text-right font-medium text-gray-900">{formatRouteTextValue(routeDetail?.departureCode)} · {formatRouteTextValue(routeDetail?.departureName)}</span></div>
                          <div className="flex items-start justify-between gap-4"><span className="text-gray-500">Arrival</span><span className="text-right font-medium text-gray-900">{formatRouteTextValue(routeDetail?.arrivalCode)} · {formatRouteTextValue(routeDetail?.arrivalName)}</span></div>
                          <div className="flex items-start justify-between gap-4"><span className="text-gray-500">Distance</span><span className="text-right font-medium text-gray-900">{formatRouteTextValue(routeDetail?.distance || editingRoute?.distance)}</span></div>
                          <div className="flex items-start justify-between gap-4"><span className="text-gray-500">Duration</span><span className="text-right font-medium text-gray-900">{formatRouteTextValue(routeDetail?.duration || editingRoute?.duration)}</span></div>
                          <div className="flex items-start justify-between gap-4"><span className="text-gray-500">Aircraft types</span><span className="text-right font-medium text-gray-900">{formatRouteList(routeDetail?.aircraftTypes)}</span></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {editorMode === "full" ? (
                    <>
                      <div className="rounded-2xl border border-gray-200 bg-white p-5">
                        <div className="mb-4">
                          <h3 className="text-base font-semibold text-gray-900">Days of Operation</h3>
                          <p className="text-sm text-gray-500">Editable live service days. Leave all days empty if the route should operate daily.</p>
                        </div>
                        <div className="grid grid-cols-7 gap-2">
                          {ROUTE_DAY_ORDER.map((day) => {
                            const active = activeServiceDaySet.has(day);
                            return (
                              <button
                                key={day}
                                type="button"
                                onClick={() => toggleLiveServiceDay(day, !active)}
                                className={`rounded-xl border px-2 py-3 text-center text-sm font-medium ${active ? "border-red-200 bg-red-50 text-red-700" : "border-gray-200 bg-gray-50 text-gray-400"}`}
                              >
                                {ROUTE_DAY_LABELS[day]}
                              </button>
                            );
                          })}
                        </div>
                        {activeServiceDaySet.size === 0 ? <div className="mt-3 text-xs text-gray-500">No explicit service days selected. vAMSYS treats empty `service_days` as daily operation.</div> : null}
                      </div>

                      <div className="rounded-2xl border border-gray-200 bg-white p-5">
                        <div className="mb-4">
                          <h3 className="text-base font-semibold text-gray-900">Fuel and Alternates</h3>
                          <p className="text-sm text-gray-500">Read-only operational metadata from the source route.</p>
                        </div>
                        <div className="space-y-3 text-sm text-gray-700">
                          <div className="flex items-start justify-between gap-4"><span className="text-gray-500">Alternates</span><span className="text-right font-medium text-gray-900">{formatRouteList(routeDetail?.alternates)}</span></div>
                          <div className="flex items-start justify-between gap-4"><span className="text-gray-500">Cost index</span><span className="text-right font-medium text-gray-900">{formatRouteTextValue(routeDetail?.costIndex)}</span></div>
                          <div className="flex items-start justify-between gap-4"><span className="text-gray-500">Fuel policy</span><span className="text-right font-medium text-gray-900">{formatRouteTextValue(routeDetail?.fuelPolicy)}</span></div>
                          <div className="flex items-start justify-between gap-4"><span className="text-gray-500">Live tags</span><span className="text-right font-medium text-gray-900">{formatRouteList(routeDetail?.liveTags)}</span></div>
                          <div className="flex items-start justify-between gap-4"><span className="text-gray-500">Live hidden</span><span className="text-right font-medium text-gray-900">{routeDetail?.liveHidden ? "Yes" : "No"}</span></div>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-gray-200 bg-white p-5">
                        <div className="mb-4">
                          <h3 className="text-base font-semibold text-gray-900">Reference Snapshot</h3>
                          <p className="text-sm text-gray-500">Current live snapshot from vAMSYS after the last load.</p>
                        </div>
                        <Textarea value={routeDetail?.routeNotes || ""} readOnly disabled className="min-h-[120px]" placeholder="No route notes returned by vAMSYS" />
                        {Array.isArray(routeDetail?.serviceDays) && routeDetail.serviceDays.length > 0 ? (
                          <div className="mt-3 text-xs text-gray-500">Raw days: {routeDetail.serviceDays.map((day) => formatRouteDayLabel(day)).join(", ")}</div>
                        ) : null}
                      </div>
                    </>
                  ) : (
                    <div className="rounded-2xl border border-gray-200 bg-white p-5">
                      <div className="mb-4">
                        <h3 className="text-base font-semibold text-gray-900">Turbo snapshot</h3>
                        <p className="text-sm text-gray-500">Short operational editor for quick single-route changes.</p>
                      </div>
                      <div className="space-y-3 text-sm text-gray-700">
                        <div className="space-y-2">
                          <Label>Schedule</Label>
                          <div className="grid gap-3 md:grid-cols-2">
                            <Input value={liveFormState.departureTimeUtc} onChange={(event) => setLiveFormState((current) => ({ ...current, departureTimeUtc: event.target.value }))} placeholder="Departure UTC" />
                            <Input value={liveFormState.arrivalTimeUtc} onChange={(event) => setLiveFormState((current) => ({ ...current, arrivalTimeUtc: event.target.value }))} placeholder="Arrival UTC" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Days</Label>
                          <div className="grid grid-cols-7 gap-2">
                            {ROUTE_DAY_ORDER.map((day) => {
                              const active = activeServiceDaySet.has(day);
                              return (
                                <button
                                  key={`turbo-${day}`}
                                  type="button"
                                  onClick={() => toggleLiveServiceDay(day, !active)}
                                  className={`rounded-xl border px-2 py-3 text-center text-sm font-medium ${active ? "border-red-200 bg-red-50 text-red-700" : "border-gray-200 bg-gray-50 text-gray-400"}`}
                                >
                                  {ROUTE_DAY_LABELS[day]}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <div className="flex items-start justify-between gap-4"><span className="text-gray-500">Alternates</span><span className="text-right font-medium text-gray-900">{formatRouteList(routeDetail?.alternates)}</span></div>
                        <div className="space-y-2">
                          <Label>Live remarks</Label>
                          <Textarea value={liveFormState.routeRemarks} onChange={(event) => setLiveFormState((current) => ({ ...current, routeRemarks: event.target.value }))} className="min-h-[100px]" placeholder="Remarks saved on the live route" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="flex-col-reverse gap-2 border-t border-gray-200 px-6 py-4 sm:flex-row sm:justify-between">
            <div className="flex gap-2">
              <Button variant="outline" className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700" onClick={clearRouteMeta} disabled={isClearingRouteMeta || isSavingRouteMeta || isDeletingRoute}>
                {isClearingRouteMeta ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Delete patch
              </Button>
              <Button variant="outline" className="border-red-300 text-red-700 hover:bg-red-50 hover:text-red-800" onClick={deleteLiveRoute} disabled={isClearingRouteMeta || isSavingRouteMeta || isApplyingSelection || isDeletingRoute}>
                {isDeletingRoute ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Delete route
              </Button>
            </div>
            <div className="flex gap-2">
              {editorApplyTargetIds.length > 1 ? (
                <Button variant="outline" onClick={applyEditorChangesToSelection} disabled={isSavingRouteMeta || isClearingRouteMeta || isApplyingSelection}>
                  {isApplyingSelection ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Apply overlay to {editorApplyTargetIds.length} routes
                </Button>
              ) : null}
              <Button variant="outline" onClick={() => setEditingRoute(null)} disabled={isSavingRouteMeta || isClearingRouteMeta || isApplyingSelection || isDeletingRoute}>Cancel</Button>
              <Button className="bg-[#E31E24] hover:bg-[#c41a20]" onClick={saveRoute} disabled={isSavingRouteMeta || isClearingRouteMeta || isApplyingSelection || isDeletingRoute}>
                {isSavingRouteMeta ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save route
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={createDialogOpen}
        onOpenChange={(open) => {
          setCreateDialogOpen(open);
          if (!open) {
            setCreateFormState(createDefaultRouteCreateFormState());
          }
        }}
      >
        <DialogContent className="max-h-[92vh] overflow-hidden p-0 sm:max-w-4xl">
          <DialogHeader className="border-b border-gray-200 px-6 py-5">
            <div className="space-y-2">
              <DialogTitle>Create route</DialogTitle>
              <div className="text-sm text-gray-500">Creates a live vAMSYS route using the documented `/routes` contract, then optionally applies the local admin overlay used by the website.</div>
            </div>
          </DialogHeader>
          <ScrollArea className="max-h-[74vh]">
            <div className="space-y-6 px-6 py-5">
              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <div className="mb-4">
                  <h3 className="text-base font-semibold text-gray-900">Basic Information</h3>
                  <p className="text-sm text-gray-500">Flight identity and the main route endpoints.</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div className="space-y-2">
                    <Label>Flight number</Label>
                    <Input value={createFormState.flightNumber} onChange={(event) => setCreateFormState((current) => ({ ...current, flightNumber: event.target.value.toUpperCase() }))} placeholder="NWS101" />
                  </div>
                  <div className="space-y-2">
                    <Label>Callsign</Label>
                    <Input value={createFormState.callsign} onChange={(event) => setCreateFormState((current) => ({ ...current, callsign: event.target.value.toUpperCase() }))} placeholder="NWS101" />
                  </div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Input value={createFormState.type} onChange={(event) => setCreateFormState((current) => ({ ...current, type: event.target.value }))} placeholder="scheduled" />
                  </div>
                  <div className="space-y-2">
                    <Label>Cruise altitude (ft)</Label>
                    <Input value={createFormState.flightLevel} onChange={(event) => setCreateFormState((current) => ({ ...current, flightLevel: event.target.value.toUpperCase() }))} placeholder="36000" />
                  </div>
                  <div className="space-y-2">
                    <Label>Departure ICAO/IATA</Label>
                    <Input value={createFormState.departureCode} onChange={(event) => setCreateFormState((current) => ({ ...current, departureCode: event.target.value.toUpperCase() }))} placeholder="UUEE" />
                    <div className="text-xs text-gray-500">{createDepartureAirport ? `${createDepartureAirport.icao || createDepartureAirport.iata || createFormState.departureCode} · ${createDepartureAirport.name}` : "Resolved through the airport catalog on save"}</div>
                  </div>
                  <div className="space-y-2">
                    <Label>Arrival ICAO/IATA</Label>
                    <Input value={createFormState.arrivalCode} onChange={(event) => setCreateFormState((current) => ({ ...current, arrivalCode: event.target.value.toUpperCase() }))} placeholder="URSS" />
                    <div className="text-xs text-gray-500">{createArrivalAirport ? `${createArrivalAirport.icao || createArrivalAirport.iata || createFormState.arrivalCode} · ${createArrivalAirport.name}` : "Resolved through the airport catalog on save"}</div>
                  </div>
                  <div className="space-y-2">
                    <Label>Departure UTC</Label>
                    <Input value={createFormState.departureTimeUtc} onChange={(event) => setCreateFormState((current) => ({ ...current, departureTimeUtc: event.target.value }))} placeholder="10:20" />
                  </div>
                  <div className="space-y-2">
                    <Label>Arrival UTC</Label>
                    <Input value={createFormState.arrivalTimeUtc} onChange={(event) => setCreateFormState((current) => ({ ...current, arrivalTimeUtc: event.target.value }))} placeholder="13:05" />
                  </div>
                </div>
              </div>

              <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                <div className="space-y-6">
                  <div className="rounded-2xl border border-gray-200 bg-white p-5">
                    <div className="mb-4">
                      <h3 className="text-base font-semibold text-gray-900">Schedule and Routing</h3>
                      <p className="text-sm text-gray-500">Required live route fields plus the main optional schedule parameters from vAMSYS.</p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Start date</Label>
                        <Input value={createFormState.startDate} onChange={(event) => setCreateFormState((current) => ({ ...current, startDate: event.target.value }))} placeholder="2026-04-18 or 2026-04-18T00:00:00+00:00" />
                      </div>
                      <div className="space-y-2">
                        <Label>End date</Label>
                        <Input value={createFormState.endDate} onChange={(event) => setCreateFormState((current) => ({ ...current, endDate: event.target.value }))} placeholder="2026-10-31 or 2026-10-31T23:59:59+00:00" />
                      </div>
                      <div className="space-y-2">
                        <Label>Cost index</Label>
                        <Input value={createFormState.costIndex} onChange={(event) => setCreateFormState((current) => ({ ...current, costIndex: event.target.value }))} placeholder="25" />
                      </div>
                      <div className="space-y-2">
                        <Label>Fuel policy</Label>
                        <Input value={createFormState.fuelPolicy} onChange={(event) => setCreateFormState((current) => ({ ...current, fuelPolicy: event.target.value }))} placeholder="Standard" />
                      </div>
                      <div className="space-y-2">
                        <Label>Flight length</Label>
                        <Input value={createFormState.duration} onChange={(event) => setCreateFormState((current) => ({ ...current, duration: event.target.value }))} placeholder="02:45:00" />
                      </div>
                      <div className="space-y-2">
                        <Label>Distance (nm)</Label>
                        <Input value={createFormState.distanceNm} onChange={(event) => setCreateFormState((current) => ({ ...current, distanceNm: event.target.value.replace(/[^0-9.]/g, "") }))} placeholder="1480" />
                      </div>
                    </div>
                    <div className="mt-4 space-y-2">
                      <Label>Service days</Label>
                      <div className="grid grid-cols-7 gap-2">
                        {ROUTE_DAY_ORDER.map((day) => {
                          const active = createFormState.serviceDays.includes(day);
                          return (
                            <button
                              key={`create-day-${day}`}
                              type="button"
                              onClick={() => toggleCreateServiceDay(day, !active)}
                              className={`rounded-xl border px-2 py-3 text-sm font-medium ${active ? "border-red-200 bg-red-50 text-red-700" : "border-gray-200 bg-gray-50 text-gray-500"}`}
                            >
                              {ROUTE_DAY_LABELS[day]}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="mt-4 space-y-2">
                      <Label>Route text</Label>
                      <Textarea value={createFormState.routeText} onChange={(event) => setCreateFormState((current) => ({ ...current, routeText: event.target.value }))} className="min-h-[120px] font-mono text-xs" placeholder="DCT ... STAR" />
                      <div className="flex flex-wrap gap-2">
                        {createRouteSuggestions.map((suggestion) => (
                          <button
                            key={`create-route-suggestion-${suggestion}`}
                            type="button"
                            onClick={() => setCreateFormState((current) => ({ ...current, routeText: suggestion }))}
                            className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-left text-xs text-gray-700 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                      <div className="text-xs text-gray-500">
                        {createRouteSuggestions.length > 0
                          ? `Existing route variants for ${createFormState.departureCode.trim().toUpperCase() || "DEP"} -> ${createFormState.arrivalCode.trim().toUpperCase() || "ARR"}. Empty field is not sent to vAMSYS.`
                          : "If you keep this field empty, route text is not sent to vAMSYS."}
                      </div>
                      <AdminRoutePreviewMap
                        departureCode={createFormState.departureCode}
                        arrivalCode={createFormState.arrivalCode}
                        routeText={createFormState.routeText}
                        airports={airports}
                      />
                    </div>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>vAMSYS remarks</Label>
                        <Textarea value={createFormState.routeRemarks} onChange={(event) => setCreateFormState((current) => ({ ...current, routeRemarks: event.target.value }))} className="min-h-[120px]" placeholder="Operational remarks stored on the live route" />
                      </div>
                      <div className="space-y-2">
                        <Label>vAMSYS internal remarks</Label>
                        <Textarea value={createFormState.routeNotes} onChange={(event) => setCreateFormState((current) => ({ ...current, routeNotes: event.target.value }))} className="min-h-[120px]" placeholder="Internal remarks sent as internal_remarks on the live route" />
                      </div>
                    </div>
                    <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
                      <div className="space-y-2">
                        <Label>Live tags</Label>
                        <Input value={createFormState.liveTags} onChange={(event) => setCreateFormState((current) => ({ ...current, liveTags: event.target.value }))} placeholder="scheduled, cargo, seasonal" />
                        <div className="text-xs text-gray-500">Sent to vAMSYS as the live route `tag` field.</div>
                      </div>
                      <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 px-4 py-3 md:min-w-[240px]">
                        <div>
                          <div className="text-sm font-medium text-gray-900">Hide live route in vAMSYS</div>
                          <div className="text-xs text-gray-500">Stores the documented live `hidden` flag during route creation.</div>
                        </div>
                        <Switch checked={createFormState.liveHidden} onCheckedChange={(checked) => setCreateFormState((current) => ({ ...current, liveHidden: Boolean(checked) }))} />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-gray-200 bg-white p-5">
                    <div className="mb-4">
                      <h3 className="text-base font-semibold text-gray-900">Website Overlay</h3>
                      <p className="text-sm text-gray-500">Optional local patch saved after the live route is created.</p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Hub</Label>
                        <Select value={createFormState.hubId || "none"} onValueChange={(value) => setCreateFormState((current) => ({ ...current, hubId: value === "none" ? "" : value }))}>
                          <SelectTrigger><SelectValue placeholder="Select hub" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No hub</SelectItem>
                            {hubOptions.map((hub) => <SelectItem key={`create-hub-${hub.id}`} value={hub.id}>{hub.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Status</Label>
                        <Select value={createFormState.status} onValueChange={(value) => setCreateFormState((current) => ({ ...current, status: value }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {ROUTE_STATUSES.map((status) => <SelectItem key={`create-status-${status}`} value={status}>{status}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Priority</Label>
                        <Select value={createFormState.priority} onValueChange={(value) => setCreateFormState((current) => ({ ...current, priority: value }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {ROUTE_PRIORITIES.map((priority) => <SelectItem key={`create-priority-${priority}`} value={priority}>{priority}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Section</Label>
                        <Select value={createFormState.section} onValueChange={(value) => setCreateFormState((current) => ({ ...current, section: value }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {ROUTE_SECTIONS.map((section) => <SelectItem key={`create-section-${section.value}`} value={section.value}>{section.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Website remarks</Label>
                        <Textarea value={createFormState.remarks} onChange={(event) => setCreateFormState((current) => ({ ...current, remarks: event.target.value }))} className="min-h-[110px]" placeholder="Public site-facing remarks" />
                      </div>
                      <div className="space-y-2">
                        <Label>Internal remarks</Label>
                        <Textarea value={createFormState.internalRemarks} onChange={(event) => setCreateFormState((current) => ({ ...current, internalRemarks: event.target.value }))} className="min-h-[110px]" placeholder="Internal-only remarks for admin" />
                      </div>
                    </div>
                    <div className="mt-4 space-y-4">
                      <div className="space-y-2">
                        <Label>Admin notes</Label>
                        <Textarea value={createFormState.notes} onChange={(event) => setCreateFormState((current) => ({ ...current, notes: event.target.value }))} className="min-h-[110px]" placeholder="Placement notes, rollout or publishing context" />
                      </div>
                      <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
                        <div className="space-y-2">
                          <Label>Website tags</Label>
                          <Input value={createFormState.tags} onChange={(event) => setCreateFormState((current) => ({ ...current, tags: event.target.value }))} placeholder="promo, regional, summer" />
                        </div>
                        <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 px-4 py-3 md:min-w-[220px]">
                          <div>
                            <div className="text-sm font-medium text-gray-900">Hide in website overlay</div>
                            <div className="text-xs text-gray-500">Creates the route, but keeps it hidden in the website curation layer.</div>
                          </div>
                          <Switch checked={createFormState.hidden} onCheckedChange={(checked) => setCreateFormState((current) => ({ ...current, hidden: Boolean(checked) }))} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="rounded-2xl border border-gray-200 bg-white p-5">
                    <div className="mb-4">
                      <h3 className="text-base font-semibold text-gray-900">Fleet Assignment</h3>
                      <p className="text-sm text-gray-500">Select at least one fleet reference for the new route.</p>
                    </div>
                    <div className="mb-4 space-y-2">
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                        <Input
                          value={createFleetSearch}
                          onChange={(event) => setCreateFleetSearch(event.target.value)}
                          placeholder="Type, registration or fleet ID"
                          className="pl-9 pr-9"
                        />
                        {createFleetSearch ? (
                          <button
                            type="button"
                            onClick={() => setCreateFleetSearch("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-gray-700"
                            aria-label="Clear fleet search"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>
                      <div className="text-xs text-gray-500">
                        Start typing an aircraft type, registration or fleet id to narrow the suggestions.
                      </div>
                    </div>
                    <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
                      {filteredCreateFleetOptions.length > 0 ? (
                        filteredCreateFleetOptions.map((fleet) => {
                          const modelPreview = formatFleetSearchPreview(fleet.aircraftModels, "Types");
                          const registrationPreview = formatFleetSearchPreview(fleet.registrations, "Regs");
                          const checked = createFormState.fleetIds.includes(fleet.id);
                          return (
                            <label key={`create-fleet-${fleet.id}`} className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 px-3 py-3">
                              <Checkbox checked={checked} onCheckedChange={(value) => toggleCreateFleet(fleet.id, Boolean(value))} />
                              <div className="min-w-0">
                                <div className="text-sm font-medium text-gray-900">{fleet.code ? `${fleet.code} · ` : ""}{fleet.name}</div>
                                <div className="text-xs text-gray-500">{fleet.airlineCode || "Fleet"} · ID {fleet.id}</div>
                                {modelPreview || registrationPreview ? (
                                  <div className="mt-1 text-xs text-gray-500">
                                    {[modelPreview, registrationPreview].filter(Boolean).join(" · ")}
                                  </div>
                                ) : null}
                              </div>
                            </label>
                          );
                        })
                      ) : fleetOptions.length > 0 ? (
                        <div className="rounded-xl border border-dashed border-gray-200 px-4 py-6 text-sm text-gray-500">
                          No fleet matches for “{createFleetSearch.trim()}”. Try a shorter type, registration fragment or fleet id.
                        </div>
                      ) : (
                        <div className="rounded-xl border border-dashed border-gray-200 px-4 py-6 text-sm text-gray-500">No fleet catalog entries are available yet.</div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-red-100 bg-red-50 p-5 text-sm text-red-900">
                    <div className="font-medium">Create flow</div>
                    <div className="mt-2 text-red-800/80">The live route is created first via the admin API. If you filled any website overlay fields, they are saved in a second step against the newly returned route id.</div>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="border-t border-gray-200 px-6 py-4">
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)} disabled={isCreatingRoute}>Cancel</Button>
            <Button className="bg-[#E31E24] hover:bg-[#c41a20]" onClick={createRoute} disabled={isCreatingRoute}>
              {isCreatingRoute ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Create route
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Apply Bulk Route Patch</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">Selected routes: {selectedRouteIds.length}</div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center gap-3 rounded-md border px-3 py-2">
                  <Checkbox checked={bulkFormState.applyHub} onCheckedChange={(checked) => setBulkFormState((current) => ({ ...current, applyHub: Boolean(checked) }))} />
                  <Label>Patch hub</Label>
                </div>
                <Select value={bulkFormState.hubId} onValueChange={(value) => setBulkFormState((current) => ({ ...current, hubId: value }))}>
                  <SelectTrigger><SelectValue placeholder="Select hub" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={BULK_UNCHANGED}>Keep current value</SelectItem>
                    <SelectItem value="none">No hub</SelectItem>
                    {hubOptions.map((hub) => <SelectItem key={hub.id} value={hub.id}>{hub.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-3 rounded-md border px-3 py-2">
                  <Checkbox checked={bulkFormState.applyStatus} onCheckedChange={(checked) => setBulkFormState((current) => ({ ...current, applyStatus: Boolean(checked) }))} />
                  <Label>Patch status</Label>
                </div>
                <Select value={bulkFormState.status} onValueChange={(value) => setBulkFormState((current) => ({ ...current, status: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROUTE_STATUSES.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-3 rounded-md border px-3 py-2">
                  <Checkbox checked={bulkFormState.applyPriority} onCheckedChange={(checked) => setBulkFormState((current) => ({ ...current, applyPriority: Boolean(checked) }))} />
                  <Label>Patch priority</Label>
                </div>
                <Select value={bulkFormState.priority} onValueChange={(value) => setBulkFormState((current) => ({ ...current, priority: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROUTE_PRIORITIES.map((priority) => <SelectItem key={priority} value={priority}>{priority}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-3 rounded-md border px-3 py-2">
                  <Checkbox checked={bulkFormState.applySection} onCheckedChange={(checked) => setBulkFormState((current) => ({ ...current, applySection: Boolean(checked) }))} />
                  <Label>Patch section</Label>
                </div>
                <Select value={bulkFormState.section} onValueChange={(value) => setBulkFormState((current) => ({ ...current, section: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROUTE_SECTIONS.map((section) => <SelectItem key={section.value} value={section.value}>{section.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-3 rounded-md border px-3 py-2">
                <Checkbox checked={bulkFormState.applyNotes} onCheckedChange={(checked) => setBulkFormState((current) => ({ ...current, applyNotes: Boolean(checked) }))} />
                <Label>Patch notes</Label>
              </div>
              <Textarea value={bulkFormState.notes} onChange={(event) => setBulkFormState((current) => ({ ...current, notes: event.target.value }))} className="min-h-[140px]" placeholder="Bulk notes or empty text to clear notes on selected routes" />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center gap-3 rounded-md border px-3 py-2">
                  <Checkbox checked={bulkFormState.applyRemarks} onCheckedChange={(checked) => setBulkFormState((current) => ({ ...current, applyRemarks: Boolean(checked) }))} />
                  <Label>Patch public remarks</Label>
                </div>
                <Textarea value={bulkFormState.remarks} onChange={(event) => setBulkFormState((current) => ({ ...current, remarks: event.target.value }))} className="min-h-[120px]" placeholder="Public site remarks for selected routes" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-3 rounded-md border px-3 py-2">
                  <Checkbox checked={bulkFormState.applyInternalRemarks} onCheckedChange={(checked) => setBulkFormState((current) => ({ ...current, applyInternalRemarks: Boolean(checked) }))} />
                  <Label>Patch internal remarks</Label>
                </div>
                <Textarea value={bulkFormState.internalRemarks} onChange={(event) => setBulkFormState((current) => ({ ...current, internalRemarks: event.target.value }))} className="min-h-[120px]" placeholder="Internal-only admin remarks" />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
              <div className="space-y-2">
                <div className="flex items-center gap-3 rounded-md border px-3 py-2">
                  <Checkbox checked={bulkFormState.applyTags} onCheckedChange={(checked) => setBulkFormState((current) => ({ ...current, applyTags: Boolean(checked) }))} />
                  <Label>Patch tags</Label>
                </div>
                <Input value={bulkFormState.tags} onChange={(event) => setBulkFormState((current) => ({ ...current, tags: event.target.value }))} placeholder="promo, shorthaul, priority" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-3 rounded-md border px-3 py-2">
                  <Checkbox checked={bulkFormState.applyHidden} onCheckedChange={(checked) => setBulkFormState((current) => ({ ...current, applyHidden: Boolean(checked) }))} />
                  <Label>Patch visibility</Label>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3 md:min-w-[220px]">
                  <div>
                    <div className="text-sm font-medium text-gray-900">Hide route</div>
                    <div className="text-xs text-gray-500">Apply the same visibility to all selected routes.</div>
                  </div>
                  <Switch checked={bulkFormState.hidden} onCheckedChange={(checked) => setBulkFormState((current) => ({ ...current, hidden: Boolean(checked) }))} />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDialogOpen(false)} disabled={isBulkApplying}>Cancel</Button>
            <Button className="bg-[#E31E24] hover:bg-[#c41a20]" onClick={applyBulkPatch} disabled={isBulkApplying}>
              {isBulkApplying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Apply patch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function AdminBookingsManagement() {
  const [bookings, setBookings] = useState<AdminBookingItem[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [editingBooking, setEditingBooking] = useState<AdminBookingItem | null>(null);
  const [viewingBookingId, setViewingBookingId] = useState<number | null>(null);
  const [bookingDetail, setBookingDetail] = useState<AdminBookingDetailPayload | null>(null);
  const [isBookingDetailLoading, setIsBookingDetailLoading] = useState(false);
  const [formState, setFormState] = useState({ tag: "", priority: "normal", notes: "" });

  const loadBookings = async () => {
    try {
      const response = await fetch("/api/admin/bookings?limit=150", { credentials: "include" });
      const payload = response.ok ? await response.json() : { bookings: [] };
      setBookings(Array.isArray(payload?.bookings) ? payload.bookings : []);
    } catch (error) {
      console.error("Failed to load admin bookings", error);
      setBookings([]);
    }
  };

  useEffect(() => {
    loadBookings().catch(() => undefined);
  }, []);

  const filteredBookings = useMemo(() => {
    const query = search.toLowerCase();
    return bookings.filter((booking) => {
      const matchesSearch =
        !query ||
        booking.pilotName.toLowerCase().includes(query) ||
        booking.pilotUsername.toLowerCase().includes(query) ||
        booking.callsign.toLowerCase().includes(query) ||
        booking.routeLabel.toLowerCase().includes(query) ||
        booking.aircraftLabel.toLowerCase().includes(query);
      const matchesStatus = statusFilter === "all" || booking.status === statusFilter;
      const matchesPriority = priorityFilter === "all" || String(booking.meta?.priority || "normal") === priorityFilter;
      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [bookings, priorityFilter, search, statusFilter]);

  const openEditor = (booking: AdminBookingItem) => {
    setEditingBooking(booking);
    setFormState({
      tag: String(booking.meta?.tag || ""),
      priority: String(booking.meta?.priority || "normal"),
      notes: String(booking.meta?.notes || ""),
    });
  };

  const saveMeta = async () => {
    if (!editingBooking) {
      return;
    }
    try {
      const response = await fetch(`/api/admin/bookings/${editingBooking.id}/meta`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formState),
      });
      if (!response.ok) {
        throw new Error("Save failed");
      }
      setEditingBooking(null);
      await loadBookings();
    } catch (error) {
      console.error("Failed to save booking metadata", error);
    }
  };

  const openBookingDetail = async (bookingId: number) => {
    setViewingBookingId(bookingId);
    setBookingDetail(null);
    setIsBookingDetailLoading(true);
    try {
      const response = await fetch(`/api/admin/bookings/${bookingId}`, { credentials: "include" });
      if (!response.ok) {
        throw new Error("Failed to load booking detail");
      }
      const payload = (await response.json().catch(() => null)) as AdminBookingDetailPayload | null;
      setBookingDetail(payload || null);
    } catch (error) {
      console.error("Failed to load booking detail", error);
      toast.error("Failed to load booking detail");
      setBookingDetail(null);
    } finally {
      setIsBookingDetailLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Bookings</h2>
        <p className="text-sm text-gray-500">Review current bookings, apply admin tags and highlight priority flights.</p>
      </div>

      <Card className="border-none shadow-sm">
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="relative w-full xl:max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search bookings..." className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full xl:w-48"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-full xl:w-48"><SelectValue placeholder="Priority" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All priorities</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Pilot</th>
                  <th className="px-4 py-3 font-medium">Booking</th>
                  <th className="px-4 py-3 font-medium">Aircraft</th>
                  <th className="px-4 py-3 font-medium">Departure</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Priority</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredBookings.map((booking) => (
                  <tr key={booking.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3"><div className="font-medium text-gray-900">{booking.pilotName}</div><div className="text-xs text-gray-500">{booking.pilotUsername}</div></td>
                    <td className="px-4 py-3 text-gray-700"><div className="font-medium">{booking.callsign}</div><div className="text-xs text-gray-500">{booking.routeLabel}</div></td>
                    <td className="px-4 py-3 text-gray-700">{booking.aircraftLabel}</td>
                    <td className="px-4 py-3 text-gray-700"><div>{formatDateTime(booking.departureTime)}</div><div className="text-xs text-gray-500">Created {formatDateTime(booking.createdAt)}</div></td>
                    <td className="px-4 py-3"><Badge variant="outline" className="border-gray-200 bg-gray-50 text-gray-700">{booking.status}</Badge></td>
                    <td className="px-4 py-3"><Badge variant="outline" className="border-gray-200 bg-gray-50 text-gray-700">{booking.meta?.priority || "normal"}</Badge></td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => void openBookingDetail(booking.id)}>
                          <Eye className="mr-2 h-4 w-4" />View
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => openEditor(booking)}>
                          <Edit className="mr-2 h-4 w-4" />Edit
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredBookings.length === 0 ? <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">No bookings found.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={Boolean(editingBooking)} onOpenChange={(open) => !open && setEditingBooking(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit Booking Metadata</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Tag</Label>
              <Input value={formState.tag} onChange={(event) => setFormState((current) => ({ ...current, tag: event.target.value }))} placeholder="ops-review / vip / event" />
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={formState.priority} onValueChange={(value) => setFormState((current) => ({ ...current, priority: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={formState.notes} onChange={(event) => setFormState((current) => ({ ...current, notes: event.target.value }))} className="min-h-[140px]" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingBooking(null)}>Cancel</Button>
            <Button className="bg-[#E31E24] hover:bg-[#c41a20]" onClick={saveMeta}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(viewingBookingId)} onOpenChange={(open) => !open && setViewingBookingId(null)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Booking Detail</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {isBookingDetailLoading ? (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading booking detail...
              </div>
            ) : !bookingDetail ? (
              <div className="text-sm text-gray-500">Booking detail is unavailable.</div>
            ) : (
              <>
                <div className="grid gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm md:grid-cols-3">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-gray-500">Pilot</div>
                    <div className="font-medium text-gray-900">{bookingDetail.summary?.pilotName || "—"}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-gray-500">Callsign</div>
                    <div className="font-medium text-gray-900">{bookingDetail.summary?.callsign || "—"}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-gray-500">Status</div>
                    <div className="font-medium text-gray-900">{bookingDetail.summary?.status || "—"}</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs uppercase tracking-wide text-gray-500">Raw payload</div>
                  <ScrollArea className="h-[320px] rounded-md border border-gray-200 bg-gray-950/95 p-3">
                    <pre className="text-xs leading-relaxed text-gray-100">
                      {JSON.stringify(bookingDetail.booking || {}, null, 2)}
                    </pre>
                  </ScrollArea>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingBookingId(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}