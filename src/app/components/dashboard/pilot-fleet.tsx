import { Fragment, useEffect, useMemo, useState } from "react";
import {
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileText,
  History,
  Loader2,
  MapPin,
  Palette,
  Plane,
  Search,
  Settings2,
  SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../context/auth-context";
import { useLanguage } from "../../context/language-context";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { createDashboardSessionCache, fetchDashboardSessionCache, getDashboardSessionCache } from "./dashboard-session-cache";
import { fetchDashboardBootstrap, getCachedDashboardBootstrap } from "./dashboard-bootstrap-cache";

interface FleetResource {
  type?: string | null;
  label: string;
  url?: string | null;
}

interface FleetHub {
  id: number;
  name: string;
  airportsText?: string | null;
}

interface FleetAircraft {
  id: string;
  model: string;
  registration: string;
  seats: number;
  range_nm?: number;
  cruise_speed?: number;
  serviceable?: boolean;
  status?: string;
  notes?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  baseHub?: FleetHub | null;
  liveries?: FleetResource[];
  scenarios?: FleetResource[];
  links?: FleetResource[];
}

interface FleetLiveryUsage {
  pirepId?: number | null;
  bookingId?: number | null;
  createdAt?: string | null;
}

interface FleetLivery {
  id: number;
  fleetId?: number | null;
  name: string;
  aircraft?: string | null;
  aircraftType?: string | null;
  addon?: string | null;
  liveryCode?: string | null;
  approved?: boolean;
  rejected?: boolean;
  ignored?: boolean;
  status?: string | null;
  bookingId?: number | null;
  pirepsCount?: number;
  internalNote?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  pirepUsage?: FleetLiveryUsage[];
}

interface FleetGroup {
  id: string;
  name: string;
  code: string;
  airlineCode?: string | null;
  color?: string;
  status?: string;
  notes?: string | null;
  source?: string;
  baseHub?: FleetHub | null;
  liveries?: FleetLivery[];
  aircraft: FleetAircraft[];
}

interface FleetResponse {
  fleets?: FleetGroup[];
  error?: string;
}

interface AircraftPirep {
  id: number;
  flightNumber: string;
  departure: string;
  arrival: string;
  duration: string;
  distance: string;
  landing: string;
  status: string;
  completedAt: string | null;
}

interface FleetLiveryDetailResponse {
  livery?: FleetLivery | null;
  error?: string;
}

type SortKey = "registration" | "model" | "airlineCode" | "fleetName" | "fleetCode" | "status";

const pilotFleetCache = createDashboardSessionCache<FleetGroup[]>("nws.dashboard.pilotFleet.v1", 10 * 60 * 1000);

const resolveNullableNumber = (...values: unknown[]) => {
  for (const value of values) {
    if (value == null || value === "") {
      continue;
    }
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return numeric;
    }
  }
  return null;
};

const resolveNullableText = (...values: unknown[]) => {
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (normalized) {
      return normalized;
    }
  }
  return null;
};

const normalizeFleetGroups = (value: unknown): FleetGroup[] => {
  if (!Array.isArray(value)) return [];
  return value.map((fleet, fi) => {
    const r = (fleet && typeof fleet === "object" ? fleet : {}) as Record<string, unknown>;
    const aircraft = Array.isArray(r.aircraft) ? r.aircraft : [];
    const liveries = Array.isArray(r.liveries) ? r.liveries : [];
    return {
      id: String(r.id || `fleet-${fi + 1}`),
      name: String(r.name || r.code || `Fleet ${fi + 1}`),
      code: String(r.code || ""),
      airlineCode: resolveNullableText(r.airlineCode, r.airline_code, (r.airline as Record<string, unknown> | undefined)?.code),
      color: typeof r.color === "string" ? r.color : undefined,
      status: resolveNullableText(r.status, r.state) || undefined,
      notes: typeof r.notes === "string" ? r.notes : null,
      source: typeof r.source === "string" ? r.source : undefined,
      baseHub: (r.baseHub && typeof r.baseHub === "object" ? r.baseHub : r.base_hub) && typeof (r.baseHub && typeof r.baseHub === "object" ? r.baseHub : r.base_hub) === "object"
        ? ((r.baseHub && typeof r.baseHub === "object" ? r.baseHub : r.base_hub) as FleetHub)
        : null,
      aircraft: aircraft.map((item, ai) => {
        const a = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
        const rangeNm = resolveNullableNumber(a.range_nm, a.rangeNm, a.range, a.max_range, a.maxRange, a.flight_range, a.flightRange);
        const cruiseSpeed = resolveNullableNumber(a.cruise_speed, a.cruiseSpeed, a.speed, a.cruise, a.max_speed, a.maxSpeed);
        const seats = resolveNullableNumber(a.seats, a.passengers, a.capacity, a.max_pax);
        const serviceableRaw = a.serviceable ?? a.is_serviceable ?? a.isServiceable ?? a.available;
        return {
          id: String(a.id || `aircraft-${fi + 1}-${ai + 1}`),
          model: String(a.model || a.name || a.type || a.aircraft_type || a.aircraftType || "Aircraft"),
          registration: String(a.registration || a.reg || ""),
          seats: seats ?? 0,
          range_nm: rangeNm ?? undefined,
          cruise_speed: cruiseSpeed ?? undefined,
          serviceable: typeof serviceableRaw === "boolean" ? serviceableRaw : true,
          status: resolveNullableText(a.status, a.state) || undefined,
          notes: typeof a.notes === "string" ? a.notes : null,
          description: typeof a.description === "string" ? a.description : null,
          imageUrl: resolveNullableText(a.imageUrl, a.image_url),
          baseHub: (a.baseHub && typeof a.baseHub === "object" ? a.baseHub : a.base_hub) && typeof (a.baseHub && typeof a.baseHub === "object" ? a.baseHub : a.base_hub) === "object"
            ? ((a.baseHub && typeof a.baseHub === "object" ? a.baseHub : a.base_hub) as FleetHub)
            : null,
          liveries: Array.isArray(a.liveries) ? (a.liveries as FleetResource[]) : [],
          scenarios: Array.isArray(a.scenarios) ? (a.scenarios as FleetResource[]) : [],
          links: Array.isArray(a.links) ? (a.links as FleetResource[]) : [],
        };
      }),
      liveries: liveries.map((item) => item as FleetLivery),
    };
  });
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
};

const liveryStatusClassName = (status?: string | null) => {
  switch (status) {
    case "approved": return "border-green-200 bg-green-50 text-green-700";
    case "rejected": return "border-red-200 bg-red-50 text-red-700";
    case "ignored": return "border-gray-200 bg-gray-100 text-gray-700";
    default: return "border-amber-200 bg-amber-50 text-amber-700";
  }
};

const normalizeResourceItems = (items: FleetResource[] | undefined, notes?: string | null) => {
  const source = Array.isArray(items) ? items : [];
  const noteLinks = Array.from(String(notes || "").matchAll(/https?:\/\/\S+/gi)).map((m) => ({ label: m[0], url: m[0], type: "note" }));
  const merged = [...source, ...noteLinks];
  const seen = new Set<string>();
  return merged.filter((item) => {
    const key = `${String(item?.label || "").trim().toLowerCase()}|${String(item?.url || "").trim().toLowerCase()}`;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const renderResourceButton = (item: FleetResource, index: number) => {
  if (item.url) {
    return (
      <a key={`${item.label}-${index}`} href={item.url} target="_blank" rel="noreferrer"
        className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700">
        <ExternalLink className="h-4 w-4" />{item.label}
      </a>
    );
  }
  return (
    <Badge key={`${item.label}-${index}`} variant="outline" className="border-gray-200 bg-gray-50 text-gray-700">{item.label}</Badge>
  );
};

export function PilotFleet() {
  const { t } = useLanguage();
  const { isAdmin } = useAuth();

  const [fleets, setFleets] = useState<FleetGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedAircraftId, setSelectedAircraftId] = useState("");
  const [selectedLiveryId, setSelectedLiveryId] = useState<number | null>(null);
  const [liveryDetail, setLiveryDetail] = useState<FleetLivery | null>(null);
  const [isLiveryLoading, setIsLiveryLoading] = useState(false);
  const [isSavingLivery, setIsSavingLivery] = useState(false);
  const [liveryNote, setLiveryNote] = useState("");
  const [processPireps, setProcessPireps] = useState(false);
  const [liveryFeedback, setLiveryFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const [aircraftFlightsCache, setAircraftFlightsCache] = useState<Record<string, AircraftPirep[]>>({});
  const [loadingFlightsId, setLoadingFlightsId] = useState<string | null>(null);

  const [sortKey, setSortKey] = useState<SortKey>("registration");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [filterFleetId, setFilterFleetId] = useState("all");
  const [filterAirline, setFilterAirline] = useState("all");
  const [filterServiceable, setFilterServiceable] = useState("all");
  const [filterOpen, setFilterOpen] = useState(false);

  useEffect(() => {
    let active = true;
    const loadFleet = async () => {
      setIsLoading(true);
      setHasError(false);
      try {
        const nextFleets = await fetchDashboardSessionCache(pilotFleetCache, async () => {
          const payload = await fetchDashboardBootstrap();
          return normalizeFleetGroups(payload?.fleets);
        });
        if (!active) return;
        setFleets(nextFleets);
        setSelectedAircraftId(nextFleets[0]?.aircraft?.[0]?.id || "");
      } catch (error) {
        console.error("Failed to load dashboard fleet", error);
        if (active) {
          const cached = getDashboardSessionCache(pilotFleetCache) || normalizeFleetGroups(getCachedDashboardBootstrap()?.fleets);
          if (cached) {
            setFleets(cached);
            setSelectedAircraftId(cached[0]?.aircraft?.[0]?.id || "");
          } else {
            setFleets([]);
            setHasError(true);
          }
        }
      } finally {
        if (active) setIsLoading(false);
      }
    };
    void loadFleet();
    return () => { active = false; };
  }, []);

  const loadAircraftFlights = async (aircraftId: string, numericId: number) => {
    if (aircraftFlightsCache[aircraftId] !== undefined) return;
    if (numericId <= 0) return;
    setLoadingFlightsId(aircraftId);
    try {
      const response = await fetch(`/api/pilot/pireps?page[size]=5&sort=-created_at&filter[aircraft_id]=${numericId}`, {
        credentials: "include",
      });
      const payload = response.ok ? await response.json() : null;
      const pireps: AircraftPirep[] = Array.isArray(payload?.pireps) ? payload.pireps : [];
      setAircraftFlightsCache((prev) => ({ ...prev, [aircraftId]: pireps }));
    } catch {
      setAircraftFlightsCache((prev) => ({ ...prev, [aircraftId]: [] }));
    } finally {
      setLoadingFlightsId(null);
    }
  };

  // Flat aircraft list (aircraft + fleet reference)
  const flatAircraft = useMemo(() => {
    return fleets.flatMap((fleet) =>
      (Array.isArray(fleet.aircraft) ? fleet.aircraft : []).map((ac) => ({ ...ac, fleetRef: fleet }))
    );
  }, [fleets]);

  // Filtered flat aircraft
  const filteredAircraft = useMemo(() => {
    const query = search.trim().toLowerCase();
    return flatAircraft.filter((ac) => {
      if (filterFleetId !== "all" && ac.fleetRef.id !== filterFleetId) return false;
      if (filterAirline !== "all" && (ac.fleetRef.airlineCode || "") !== filterAirline) return false;
      if (filterServiceable === "serviceable" && ac.serviceable === false) return false;
      if (filterServiceable === "maintenance" && ac.serviceable !== false) return false;
      if (query) {
        const hay = [ac.registration, ac.model, ac.fleetRef.name, ac.fleetRef.code, ac.fleetRef.airlineCode, ac.status, ac.notes, ac.description]
          .join(" ").toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });
  }, [flatAircraft, filterFleetId, filterAirline, filterServiceable, search]);

  // Sorted aircraft
  const sortedAircraft = useMemo(() => {
    return [...filteredAircraft].sort((a, b) => {
      let va = "", vb = "";
      switch (sortKey) {
        case "registration": va = a.registration; vb = b.registration; break;
        case "model": va = a.model; vb = b.model; break;
        case "airlineCode": va = a.fleetRef.airlineCode || ""; vb = b.fleetRef.airlineCode || ""; break;
        case "fleetName": va = a.fleetRef.name; vb = b.fleetRef.name; break;
        case "fleetCode": va = a.fleetRef.code; vb = b.fleetRef.code; break;
        case "status": va = a.serviceable === false ? "0" : "1"; vb = b.serviceable === false ? "0" : "1"; break;
      }
      const cmp = va.localeCompare(vb, undefined, { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filteredAircraft, sortKey, sortDir]);

  // Derived selection
  const selectedAircraft = useMemo(
    () => flatAircraft.find((ac) => ac.id === selectedAircraftId) || null,
    [flatAircraft, selectedAircraftId]
  );
  const selectedFleet = useMemo(() => selectedAircraft?.fleetRef || null, [selectedAircraft]);

  // Livery sync
  useEffect(() => {
    const liveries = Array.isArray(selectedFleet?.liveries) ? selectedFleet.liveries : [];
    if (!liveries.some((item) => item.id === selectedLiveryId)) {
      setSelectedLiveryId(liveries[0]?.id || null);
    }
  }, [selectedFleet, selectedLiveryId]);

  const selectedLivery = useMemo(
    () => (Array.isArray(selectedFleet?.liveries) ? selectedFleet.liveries : []).find((item) => item.id === selectedLiveryId) || selectedFleet?.liveries?.[0] || null,
    [selectedFleet, selectedLiveryId]
  );

  useEffect(() => {
    let active = true;
    const loadLiveryDetail = async () => {
      if (!selectedFleet?.id || !selectedLivery?.id) { setLiveryDetail(null); setLiveryNote(""); setProcessPireps(false); return; }
      const numericFleetId = Number(selectedFleet.id || 0) || 0;
      if (numericFleetId <= 0) { setLiveryDetail(selectedLivery); setLiveryNote(selectedLivery.internalNote || ""); setProcessPireps(false); return; }
      setIsLiveryLoading(true);
      try {
        const response = await fetch(`/api/vamsys/fleet/${numericFleetId}/liveries/${selectedLivery.id}?pirep_limit=10`, { credentials: "include" });
        const payload = (await response.json().catch(() => null)) as FleetLiveryDetailResponse | null;
        const nextLivery = response.ok && payload?.livery ? payload.livery : selectedLivery;
        if (!active) return;
        setLiveryDetail(nextLivery || null);
        setLiveryNote(nextLivery?.internalNote || "");
        setProcessPireps(false);
      } catch (error) {
        if (!active) return;
        console.error("Failed to load livery detail", error);
        toast.error("Failed to load livery details");
        setLiveryDetail(selectedLivery);
        setLiveryNote(selectedLivery.internalNote || "");
        setProcessPireps(false);
      } finally {
        if (active) setIsLiveryLoading(false);
      }
    };
    void loadLiveryDetail();
    return () => { active = false; };
  }, [selectedFleet, selectedLivery]);

  const updateLiveryStatus = async (nextStatus: "approved" | "rejected" | "ignored") => {
    if (!selectedFleet?.id || !selectedLivery?.id) return;
    const numericFleetId = Number(selectedFleet.id || 0) || 0;
    if (numericFleetId <= 0) return;
    setIsSavingLivery(true);
    setLiveryFeedback(null);
    try {
      const body = { approved: nextStatus === "approved", rejected: nextStatus === "rejected", ignored: nextStatus === "ignored", process_pireps: processPireps, internal_note: liveryNote.trim() || null };
      const response = await fetch(`/api/admin/fleet/${numericFleetId}/liveries/${selectedLivery.id}`, { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const payload = (await response.json().catch(() => null)) as { livery?: FleetLivery; error?: string } | null;
      if (!response.ok) throw new Error(String(payload?.error || "Failed to update livery"));
      const updatedLivery = payload?.livery || null;
      setLiveryDetail(updatedLivery);
      setLiveryNote(updatedLivery?.internalNote || "");
      setProcessPireps(false);
      const successMessage = `Livery ${nextStatus}`;
      setLiveryFeedback({ type: "success", message: successMessage });
      toast.success(successMessage);
      setFleets((current) => current.map((fleet) => {
        if (fleet.id !== selectedFleet.id) return fleet;
        return { ...fleet, liveries: (Array.isArray(fleet.liveries) ? fleet.liveries : []).map((item) => item.id === updatedLivery?.id ? { ...item, ...updatedLivery } : item) };
      }));
    } catch (error) {
      console.error("Failed to update livery status", error);
      const message = error instanceof Error ? error.message : "Failed to update livery";
      setLiveryFeedback({ type: "error", message });
      toast.error(message);
    } finally {
      setIsSavingLivery(false);
    }
  };

  // Stats
  const totalAircraft = fleets.reduce((s, f) => s + (f.aircraft?.length || 0), 0);
  const serviceableAircraft = fleets.reduce((s, f) => s + (f.aircraft?.filter((a) => a.serviceable !== false).length || 0), 0);
  const totalLiveries = fleets.reduce((s, f) => s + (f.liveries?.length || 0), 0);

  // Resource items for detail panel
  const liveryItems = normalizeResourceItems(selectedAircraft?.liveries, selectedAircraft?.notes);
  const scenarioItems = normalizeResourceItems(selectedAircraft?.scenarios, selectedAircraft?.notes);
  const genericLinks = normalizeResourceItems(selectedAircraft?.links, selectedAircraft?.notes).filter(
    (item) => !liveryItems.some((e) => e.label === item.label && e.url === item.url) && !scenarioItems.some((e) => e.label === item.label && e.url === item.url)
  );

  // Filter chip options
  const airlineOptions = useMemo(() => Array.from(new Set(fleets.map((f) => f.airlineCode || "").filter(Boolean))).sort(), [fleets]);
  const activeFilterCount = (filterFleetId !== "all" ? 1 : 0) + (filterAirline !== "all" ? 1 : 0) + (filterServiceable !== "all" ? 1 : 0);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="h-3.5 w-3.5 text-gray-400" />;
    return sortDir === "asc" ? <ChevronUp className="h-3.5 w-3.5 text-[#E31E24]" /> : <ChevronDown className="h-3.5 w-3.5 text-[#E31E24]" />;
  };

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1d1d1f]">{t("dashboard.fleet.title")}</h1>
          <p className="text-sm text-gray-500">{t("dashboard.fleet.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFilterOpen((v) => !v)}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium shadow-sm transition ${
              filterOpen || activeFilterCount > 0 ? "bg-[#E31E24] text-white" : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Фильтры
            {activeFilterCount > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[11px] font-bold text-[#E31E24]">{activeFilterCount}</span>
            )}
          </button>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("dashboard.fleet.searchPlaceholder")}
              className="w-64 rounded-xl border border-gray-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-[#E31E24] focus:ring-1 focus:ring-[#E31E24]"
            />
          </div>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: t("dashboard.fleet.stats.groups"), value: fleets.length },
          { label: t("dashboard.fleet.stats.aircraft"), value: totalAircraft },
          { label: t("dashboard.fleet.stats.serviceable"), value: serviceableAircraft },
          { label: t("dashboard.fleet.stats.liveries"), value: totalLiveries },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="text-sm text-gray-500">{label}</div>
            <div className="mt-2 text-2xl font-semibold text-gray-900">{value}</div>
          </div>
        ))}
      </div>

      {/* ── Filter panel ── */}
      {filterOpen && (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm space-y-4">
          {/* Fleet type */}
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Тип ВС</div>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" onClick={() => setFilterFleetId("all")}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${filterFleetId === "all" ? "bg-[#E31E24] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                Все
              </button>
              {fleets.map((fleet) => (
                <button key={fleet.id} type="button" onClick={() => setFilterFleetId(filterFleetId === fleet.id ? "all" : fleet.id)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${filterFleetId === fleet.id ? "bg-[#E31E24] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                  {fleet.code || fleet.name}
                </button>
              ))}
            </div>
          </div>

          {/* Airline filter */}
          {airlineOptions.length > 1 && (
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Авиакомпания</div>
              <div className="flex flex-wrap gap-1.5">
                <button type="button" onClick={() => setFilterAirline("all")}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${filterAirline === "all" ? "bg-[#E31E24] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                  Все
                </button>
                {airlineOptions.map((code) => (
                  <button key={code} type="button" onClick={() => setFilterAirline(filterAirline === code ? "all" : code)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition ${filterAirline === code ? "bg-[#E31E24] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                    {code}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Status filter */}
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Статус</div>
            <div className="flex flex-wrap gap-1.5">
              {(["all", "serviceable", "maintenance"] as const).map((opt) => (
                <button key={opt} type="button" onClick={() => setFilterServiceable(opt)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${filterServiceable === opt ? "bg-[#E31E24] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                  {opt === "all" ? "Все" : opt === "serviceable" ? t("dashboard.fleet.serviceable") : t("dashboard.fleet.maintenance")}
                </button>
              ))}
            </div>
          </div>

          {activeFilterCount > 0 && (
            <button type="button" onClick={() => { setFilterFleetId("all"); setFilterAirline("all"); setFilterServiceable("all"); }}
              className="w-full rounded-xl border border-gray-200 py-1.5 text-xs text-gray-500 hover:bg-gray-50 transition">
              Сбросить все фильтры
            </button>
          )}
        </div>
      )}

      {/* ── Table ── */}
      {isLoading ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-10 text-center text-sm text-gray-500 shadow-sm">{t("dashboard.fleet.loading")}</div>
      ) : hasError ? (
        <div className="rounded-2xl border border-red-100 bg-white p-10 text-center text-sm text-red-600 shadow-sm">{t("dashboard.fleet.error")}</div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-left">
                <tr>
                  {(
                    [
                      { col: "registration" as SortKey, label: "Борт" },
                      { col: "model" as SortKey, label: "Название" },
                      { col: "airlineCode" as SortKey, label: "Авиакомпания" },
                      { col: "fleetName" as SortKey, label: t("dashboard.fleet.stats.groups") },
                      { col: "fleetCode" as SortKey, label: "Код" },
                      { col: "status" as SortKey, label: "Статус" },
                    ] as { col: SortKey; label: string }[]
                  ).map(({ col, label }) => (
                    <th
                      key={col}
                      className="cursor-pointer select-none px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 hover:text-gray-700"
                      onClick={() => handleSort(col)}
                    >
                      <div className="flex items-center gap-1.5">
                        {label}
                        <SortIcon col={col} />
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {sortedAircraft.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-14 text-center text-sm text-gray-400">{t("dashboard.fleet.empty")}</td>
                  </tr>
                ) : sortedAircraft.map((aircraft) => {
                  const isSelected = selectedAircraftId === aircraft.id;
                  return (
                    <Fragment key={aircraft.id}>
                      <tr
                        onClick={() => {
                          const nextId = isSelected ? "" : aircraft.id;
                          setSelectedAircraftId(nextId);
                          if (nextId) void loadAircraftFlights(nextId, Number(nextId) || 0);
                        }}
                        className={`cursor-pointer transition-colors ${isSelected ? "bg-red-50" : "hover:bg-gray-50"}`}
                      >
                        <td className="px-4 py-3 font-mono font-semibold text-gray-900">{aircraft.registration || "—"}</td>
                        <td className="px-4 py-3 text-gray-700">{aircraft.model}</td>
                        <td className="px-4 py-3">
                          {aircraft.fleetRef.airlineCode ? (
                            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">{aircraft.fleetRef.airlineCode}</span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-500">{aircraft.fleetRef.name}</td>
                        <td className="px-4 py-3">
                          <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{aircraft.fleetRef.code || "—"}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${
                            aircraft.serviceable === false
                              ? "bg-amber-50 text-amber-700 ring-amber-200"
                              : "bg-green-50 text-green-700 ring-green-200"
                          }`}>
                            {aircraft.serviceable === false ? t("dashboard.fleet.maintenance") : t("dashboard.fleet.serviceable")}
                          </span>
                        </td>
                      </tr>

                      {/* ── Expanded detail row ── */}
                      {isSelected && (
                        <tr>
                          <td colSpan={6} className="border-t border-red-100 bg-red-50/40 px-6 py-5">
                            <div className="space-y-5">
                              {aircraft.imageUrl ? (
                                <div className="overflow-hidden rounded-2xl border border-gray-100 bg-gray-50">
                                  <img src={aircraft.imageUrl} alt={aircraft.model} className="h-52 w-full object-cover" />
                                </div>
                              ) : null}

                              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                <div>
                                  <h2 className="text-xl font-semibold text-gray-900">{aircraft.model}</h2>
                                  <div className="mt-0.5 text-sm text-gray-500">
                                    {aircraft.registration || "—"}{aircraft.fleetRef.name ? ` · ${aircraft.fleetRef.name}` : ""}
                                    {aircraft.fleetRef.airlineCode ? ` · ${aircraft.fleetRef.airlineCode}` : ""}
                                  </div>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <Badge variant="outline" className="border-gray-200 bg-gray-50 text-gray-700">{aircraft.status || t("dashboard.fleet.active")}</Badge>
                                  <Badge variant="outline" className={aircraft.serviceable === false ? "border-amber-200 bg-amber-50 text-amber-700" : "border-green-200 bg-green-50 text-green-700"}>
                                    {aircraft.serviceable === false ? t("dashboard.fleet.maintenance") : t("dashboard.fleet.serviceable")}
                                  </Badge>
                                </div>
                              </div>

                              <div className="grid gap-3 sm:grid-cols-3">
                                {[
                                  { label: t("dashboard.fleet.seats"), value: aircraft.seats || 0 },
                                  { label: t("dashboard.fleet.range"), value: `${aircraft.range_nm || 0} nm` },
                                  { label: t("dashboard.fleet.cruise"), value: `${aircraft.cruise_speed || 0} kt` },
                                ].map(({ label, value }) => (
                                  <div key={label} className="rounded-xl border border-gray-200 bg-white px-4 py-3">
                                    <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
                                    <div className="mt-1 text-lg font-semibold text-gray-900">{value}</div>
                                  </div>
                                ))}
                              </div>

                              {aircraft.baseHub?.name || aircraft.fleetRef.baseHub?.name ? (
                                <div className="rounded-2xl border border-gray-200 bg-white p-4">
                                  <div className="flex items-center gap-2 text-sm font-medium text-gray-900"><MapPin className="h-4 w-4 text-red-600" />{t("dashboard.fleet.baseHub")}</div>
                                  <div className="mt-2 text-sm text-gray-700">{aircraft.baseHub?.name || aircraft.fleetRef.baseHub?.name}</div>
                                  {(aircraft.baseHub?.airportsText || aircraft.fleetRef.baseHub?.airportsText) ? (
                                    <div className="mt-1 text-xs text-gray-500">{aircraft.baseHub?.airportsText || aircraft.fleetRef.baseHub?.airportsText}</div>
                                  ) : null}
                                </div>
                              ) : null}

                              {aircraft.description || aircraft.notes || aircraft.fleetRef.notes ? (
                                <div className="rounded-2xl border border-gray-200 bg-white p-4">
                                  <div className="flex items-center gap-2 text-sm font-medium text-gray-900"><FileText className="h-4 w-4 text-red-600" />{t("dashboard.fleet.notes")}</div>
                                  <div className="mt-2 space-y-2 text-sm text-gray-600">
                                    {aircraft.description ? <p>{aircraft.description}</p> : null}
                                    {aircraft.notes ? <p>{aircraft.notes}</p> : null}
                                    {!aircraft.notes && aircraft.fleetRef.notes ? <p>{aircraft.fleetRef.notes}</p> : null}
                                  </div>
                                </div>
                              ) : null}

                              {liveryItems.length > 0 ? (
                                <div className="rounded-2xl border border-gray-200 bg-white p-4">
                                  <div className="flex items-center gap-2 text-sm font-medium text-gray-900"><Palette className="h-4 w-4 text-red-600" />{t("dashboard.fleet.liveries")}</div>
                                  <div className="mt-3 flex flex-wrap gap-2">{liveryItems.map(renderResourceButton)}</div>
                                </div>
                              ) : null}

                              {scenarioItems.length > 0 ? (
                                <div className="rounded-2xl border border-gray-200 bg-white p-4">
                                  <div className="flex items-center gap-2 text-sm font-medium text-gray-900"><Plane className="h-4 w-4 text-red-600" />{t("dashboard.fleet.scenarios")}</div>
                                  <div className="mt-3 flex flex-wrap gap-2">{scenarioItems.map(renderResourceButton)}</div>
                                </div>
                              ) : null}

                              {genericLinks.length > 0 ? (
                                <div className="rounded-2xl border border-gray-200 bg-white p-4">
                                  <div className="flex items-center gap-2 text-sm font-medium text-gray-900"><ExternalLink className="h-4 w-4 text-red-600" />{t("dashboard.fleet.resources")}</div>
                                  <div className="mt-3 flex flex-wrap gap-2">{genericLinks.map(renderResourceButton)}</div>
                                </div>
                              ) : null}

                              {/* Live liveries section */}
                              {(Array.isArray(selectedFleet?.liveries) ? selectedFleet.liveries : []).length > 0 ? (
                                <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-4">
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2 text-sm font-medium text-gray-900"><Palette className="h-4 w-4 text-red-600" />Live liveries</div>
                                    <Badge variant="outline" className="border-gray-200 bg-gray-50 text-gray-700">{selectedFleet?.liveries?.length || 0} entries</Badge>
                                  </div>
                                  <div className="grid gap-2 md:grid-cols-2">
                                    {selectedFleet?.liveries?.map((livery) => {
                                      const active = selectedLivery?.id === livery.id;
                                      return (
                                        <button key={livery.id} type="button" onClick={() => setSelectedLiveryId(livery.id)}
                                          className={`rounded-xl border px-3 py-3 text-left transition-colors ${active ? "border-red-200 bg-red-50" : "border-gray-200 bg-white hover:border-red-100 hover:bg-gray-50"}`}>
                                          <div className="flex items-start justify-between gap-3">
                                            <div>
                                              <div className="font-medium text-gray-900">{livery.name}</div>
                                              <div className="mt-1 text-xs text-gray-500">{livery.aircraftType || livery.aircraft || "Unknown aircraft"}</div>
                                            </div>
                                            <Badge variant="outline" className={liveryStatusClassName(livery.status)}>{livery.status || "pending"}</Badge>
                                          </div>
                                          <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500">
                                            {livery.addon ? <span>{livery.addon}</span> : null}
                                            {typeof livery.pirepsCount === "number" ? <span>{livery.pirepsCount} PIREPs</span> : null}
                                          </div>
                                        </button>
                                      );
                                    })}
                                  </div>

                                  {selectedLivery ? (
                                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-4">
                                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                        <div>
                                          <div className="text-lg font-semibold text-gray-900">{selectedLivery.name}</div>
                                          <div className="mt-1 text-sm text-gray-500">{selectedLivery.aircraft || "—"}{selectedLivery.aircraftType ? ` · ${selectedLivery.aircraftType}` : ""}</div>
                                          <div className="mt-1 text-xs text-gray-500">Addon: {selectedLivery.addon || "—"}{selectedLivery.liveryCode ? ` · Code: ${selectedLivery.liveryCode}` : ""}</div>
                                        </div>
                                        <Badge variant="outline" className={liveryStatusClassName((liveryDetail || selectedLivery).status)}>{(liveryDetail || selectedLivery).status || "pending"}</Badge>
                                      </div>
                                      <div className="grid gap-3 md:grid-cols-3">
                                        {[
                                          { label: "PIREP usage", value: (liveryDetail || selectedLivery).pirepsCount || 0 },
                                          { label: "Created", value: formatDateTime((liveryDetail || selectedLivery).createdAt) },
                                          { label: "Updated", value: formatDateTime((liveryDetail || selectedLivery).updatedAt) },
                                        ].map(({ label, value }) => (
                                          <div key={label} className="rounded-lg border border-gray-200 bg-white px-3 py-2">
                                            <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
                                            <div className="mt-1 font-semibold text-gray-900">{value}</div>
                                          </div>
                                        ))}
                                      </div>
                                      {isLiveryLoading ? <div className="text-sm text-gray-500">Loading livery details…</div> : null}
                                      {liveryDetail?.internalNote || selectedLivery.internalNote ? (
                                        <div className="rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-600">{liveryDetail?.internalNote || selectedLivery.internalNote}</div>
                                      ) : null}
                                      {Array.isArray(liveryDetail?.pirepUsage) && liveryDetail.pirepUsage.length > 0 ? (
                                        <div className="rounded-lg border border-gray-200 bg-white p-3">
                                          <div className="text-sm font-medium text-gray-900">Recent PIREP usage</div>
                                          <div className="mt-3 space-y-2">
                                            {liveryDetail.pirepUsage.map((entry, idx) => (
                                              <div key={`${entry.pirepId || idx}-${entry.bookingId || 0}`} className="flex items-center justify-between gap-3 text-sm text-gray-600">
                                                <span>PIREP #{entry.pirepId || "—"} · Booking #{entry.bookingId || "—"}</span>
                                                <span>{formatDateTime(entry.createdAt)}</span>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      ) : null}
                                      {isAdmin ? (
                                        <div className="rounded-xl border border-red-100 bg-red-50 p-4 space-y-4">
                                          <div className="text-sm font-medium text-red-900">Admin moderation</div>
                                          <Textarea value={liveryNote} onChange={(e) => setLiveryNote(e.target.value)} placeholder="Internal note for this livery" className="min-h-[96px] bg-white" />
                                          <label className="flex items-center gap-2 text-sm text-gray-700">
                                            <input type="checkbox" checked={processPireps} onChange={(e) => setProcessPireps(e.target.checked)} />
                                            Process affected PIREPs when changing status
                                          </label>
                                          {liveryFeedback ? (
                                            <div className={`rounded-lg border px-3 py-2 text-sm ${liveryFeedback.type === "success" ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-white text-red-700"}`}>
                                              {liveryFeedback.message}
                                            </div>
                                          ) : null}
                                          <div className="flex flex-wrap gap-2">
                                            <Button type="button" size="sm" disabled={isSavingLivery} onClick={() => updateLiveryStatus("approved")}>{isSavingLivery ? "Saving…" : "Approve"}</Button>
                                            <Button type="button" size="sm" variant="outline" disabled={isSavingLivery} onClick={() => updateLiveryStatus("ignored")}>Ignore</Button>
                                            <Button type="button" size="sm" variant="outline" disabled={isSavingLivery} onClick={() => updateLiveryStatus("rejected")}>Reject</Button>
                                          </div>
                                        </div>
                                      ) : null}
                                    </div>
                                  ) : null}
                                </div>
                              ) : null}

                              {/* Config & Equipment */}
                              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                                <div className="flex items-center gap-2 text-sm font-medium text-gray-900 mb-3">
                                  <Settings2 className="h-4 w-4 text-red-600" />
                                  {t("dashboard.fleet.configEquipment") || "Config & Equipment"}
                                </div>
                                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 text-sm">
                                  {[
                                    { label: t("dashboard.fleet.seats") || "Seats", value: aircraft.seats || "—" },
                                    { label: t("dashboard.fleet.range") || "Range", value: aircraft.range_nm ? `${aircraft.range_nm} nm` : "—" },
                                    { label: t("dashboard.fleet.cruise") || "Cruise speed", value: aircraft.cruise_speed ? `${aircraft.cruise_speed} kt` : "—" },
                                    { label: t("dashboard.fleet.status") || "Status", value: aircraft.status || t("dashboard.fleet.active") || "Active" },
                                    { label: t("dashboard.fleet.fleet") || "Fleet", value: aircraft.fleetRef.name || "—" },
                                    { label: t("dashboard.fleet.airline") || "Airline", value: aircraft.fleetRef.airlineCode || "—" },
                                  ].map(({ label, value }) => (
                                    <div key={label} className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                                      <span className="text-xs text-gray-500">{label}</span>
                                      <span className="font-medium text-gray-900">{value}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Latest Flights */}
                              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                                <div className="flex items-center justify-between gap-2 mb-3">
                                  <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                                    <History className="h-4 w-4 text-red-600" />
                                    {t("dashboard.fleet.latestFlights") || "Latest Flights"}
                                  </div>
                                </div>
                                {loadingFlightsId === aircraft.id ? (
                                  <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    {t("common.loading") || "Loading..."}
                                  </div>
                                ) : (aircraftFlightsCache[aircraft.id] || []).length > 0 ? (
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                      <thead>
                                        <tr className="border-b border-gray-100 text-xs text-gray-500">
                                          <th className="pb-2 text-left font-medium">{t("dashboard.fleet.flight") || "Flight"}</th>
                                          <th className="pb-2 text-left font-medium">{t("dashboard.fleet.route") || "Route"}</th>
                                          <th className="pb-2 text-left font-medium">{t("dashboard.fleet.duration") || "Duration"}</th>
                                          <th className="pb-2 text-left font-medium">{t("dashboard.fleet.landing") || "Landing"}</th>
                                          <th className="pb-2 text-left font-medium">{t("dashboard.fleet.flightStatus") || "Status"}</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-gray-50">
                                        {(aircraftFlightsCache[aircraft.id] || []).map((pirep) => (
                                          <tr key={pirep.id} className="text-gray-700">
                                            <td className="py-2 pr-3 font-medium">{pirep.flightNumber}</td>
                                            <td className="py-2 pr-3">{pirep.departure} → {pirep.arrival}</td>
                                            <td className="py-2 pr-3">{pirep.duration}</td>
                                            <td className="py-2 pr-3">{pirep.landing}</td>
                                            <td className="py-2">
                                              <Badge variant="outline" className="border-gray-200 bg-gray-50 text-gray-700 text-xs">{pirep.status}</Badge>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                ) : (
                                  <div className="text-sm text-gray-400 py-2">{t("dashboard.fleet.noFlights") || "No flights recorded on this aircraft."}</div>
                                )}
                              </div>

                              {liveryItems.length === 0 && scenarioItems.length === 0 && genericLinks.length === 0 && (selectedFleet?.liveries?.length || 0) === 0 ? (
                                <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-500">{t("dashboard.fleet.noResources")}</div>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Row count footer */}
          <div className="border-t border-gray-100 bg-gray-50 px-4 py-2 text-xs text-gray-500">
            Показано {sortedAircraft.length} из {totalAircraft} воздушных судов
          </div>
        </div>
      )}
    </div>
  );
}
