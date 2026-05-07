import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, History, LayoutGrid, List, Loader2, Palette, Pencil, Plane, Plus, RefreshCw, Settings2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Switch } from "../ui/switch";
import { Textarea } from "../ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "../ui/toggle-group";
import { fetchAdminBootstrap, getCachedAdminBootstrap } from "./admin-bootstrap-cache";
import { useLanguage } from "../../context/language-context";

interface FleetAircraft {
  id: string;
  model: string;
  registration: string;
  seats: number;
  range_nm?: number;
  cruise_speed?: number;
  serviceable?: boolean;
  status?: string;
  baseHubId?: string;
  notes?: string;
}

interface FleetGroup {
  id: string;
  name: string;
  code: string;
  airlineCode?: string;
  color?: string;
  status?: string;
  baseHubId?: string;
  notes?: string;
  source?: string;
  aircraft: FleetAircraft[];
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
  status?: string | null;
  approved?: boolean;
  rejected?: boolean;
  ignored?: boolean;
  pirepsCount?: number;
  internalNote?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  pirepUsage?: FleetLiveryUsage[];
}

interface LiveFleetGroup {
  id: string;
  name: string;
  code?: string;
  liveries?: FleetLivery[];
}

interface LiveFleetResponse {
  fleets?: LiveFleetGroup[];
  error?: string;
}

interface FleetLiveryDetailResponse {
  livery?: FleetLivery | null;
  error?: string;
}

interface HubItem {
  id: string;
  title?: string;
  name?: string;
  code?: string;
}

interface AdminAircraftFlight {
  id: number;
  flightNumber: string;
  departure: string;
  arrival: string;
  landingRate: string;
  status: string;
  createdAt: string | null;
}

type FleetViewMode = "gallery" | "list";
type FleetAirlineCode = "NWS" | "KAR" | "STW";

const FLEET_VIEW_MODE_KEY = "nws.admin.fleet.viewMode";

const FLEET_AIRLINES: Array<{ code: FleetAirlineCode; label: string; description: string }> = [
  { code: "NWS", label: "Nordwind Airlines", description: "Core Nordwind operation" },
  { code: "KAR", label: "IKAR Airlines", description: "Partner schedule and charter operation" },
  { code: "STW", label: "Southwind Airlines", description: "Southwind operation" },
];

const defaultGroupForm = {
  id: "",
  name: "",
  code: "",
  airlineCode: "NWS",
  color: "#E31E24",
  status: "active",
  baseHubId: "",
  notes: "",
};

const defaultAircraftForm = {
  id: "",
  groupId: "",
  model: "",
  registration: "",
  seats: "0",
  range_nm: "0",
  cruise_speed: "0",
  status: "active",
  baseHubId: "",
  serviceable: true,
  notes: "",
};

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
  });
};

const liveryStatusClassName = (status?: string | null) => {
  switch (status) {
    case "approved":
      return "border-green-200 bg-green-50 text-green-700";
    case "rejected":
      return "border-red-200 bg-red-50 text-red-700";
    case "ignored":
      return "border-gray-200 bg-gray-100 text-gray-700";
    case "pending":
    default:
      return "border-amber-200 bg-amber-50 text-amber-700";
  }
};

const resolveFleetAirlineCode = (fleet?: Partial<FleetGroup> | null): FleetAirlineCode => {
  const source = [fleet?.airlineCode, fleet?.name, fleet?.code, fleet?.notes]
    .map((value) => String(value || "").trim().toUpperCase())
    .filter(Boolean)
    .join(" ");

  if (source.includes("STW") || source.includes("SOUTHWIND")) {
    return "STW";
  }

  if (source.includes("KAR") || source.includes("IKAR") || source.includes("PEGAS")) {
    return "KAR";
  }

  return "NWS";
};

const resolveFleetIcaoCode = (fleet?: Partial<FleetGroup> | null) => {
  return String(fleet?.code || "").trim().toUpperCase() || "UNKN";
};

const normalizeManagedFleets = (value: unknown): FleetGroup[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((fleet, fleetIndex) => {
    const record = (fleet && typeof fleet === "object" ? fleet : {}) as Record<string, unknown>;
    const aircraft = Array.isArray(record.aircraft) ? record.aircraft : [];
    return {
      id: String(record.id || `fleet-${fleetIndex + 1}`),
      name: String(record.name || record.code || `Fleet ${fleetIndex + 1}`),
      code: String(record.code || ""),
      airlineCode: typeof record.airlineCode === "string" ? record.airlineCode : undefined,
      color: typeof record.color === "string" ? record.color : undefined,
      status: typeof record.status === "string" ? record.status : undefined,
      baseHubId: typeof record.baseHubId === "string" ? record.baseHubId : undefined,
      notes: typeof record.notes === "string" ? record.notes : undefined,
      source: typeof record.source === "string" ? record.source : undefined,
      aircraft: aircraft.map((item, aircraftIndex) => {
        const aircraftRecord = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
        return {
          id: String(aircraftRecord.id || `aircraft-${fleetIndex + 1}-${aircraftIndex + 1}`),
          model: String(aircraftRecord.model || "Aircraft"),
          registration: String(aircraftRecord.registration || ""),
          seats: Number(aircraftRecord.seats || 0) || 0,
          range_nm: Number(aircraftRecord.range_nm || 0) || 0,
          cruise_speed: Number(aircraftRecord.cruise_speed || 0) || 0,
          serviceable: aircraftRecord.serviceable === false ? false : true,
          status: typeof aircraftRecord.status === "string" ? aircraftRecord.status : undefined,
          baseHubId: typeof aircraftRecord.baseHubId === "string" ? aircraftRecord.baseHubId : undefined,
          notes: typeof aircraftRecord.notes === "string" ? aircraftRecord.notes : undefined,
        };
      }),
    };
  });
};

const normalizeLiveFleets = (value: unknown): LiveFleetGroup[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((fleet, fleetIndex) => {
    const record = (fleet && typeof fleet === "object" ? fleet : {}) as Record<string, unknown>;
    return {
      id: String(record.id || `live-fleet-${fleetIndex + 1}`),
      name: String(record.name || record.code || `Fleet ${fleetIndex + 1}`),
      code: typeof record.code === "string" ? record.code : undefined,
      liveries: Array.isArray(record.liveries) ? (record.liveries as FleetLivery[]) : [],
    };
  });
};

export function AdminFleet() {
  const { language } = useLanguage();
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);
  const initialBootstrap = getCachedAdminBootstrap();
  const [fleets, setFleets] = useState<FleetGroup[]>(() => normalizeManagedFleets(initialBootstrap?.fleets));
  const [liveFleets, setLiveFleets] = useState<LiveFleetGroup[]>(() => normalizeLiveFleets(initialBootstrap?.liveFleets));
  const [hubs, setHubs] = useState<HubItem[]>(() => Array.isArray(initialBootstrap?.hubs) ? (initialBootstrap.hubs as HubItem[]) : []);
  const [viewMode, setViewMode] = useState<FleetViewMode>("gallery");
  const [isLoading, setIsLoading] = useState(!Array.isArray(initialBootstrap?.fleets));
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoadingLiveFleet, setIsLoadingLiveFleet] = useState(!Array.isArray(initialBootstrap?.liveFleets));
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [aircraftDialogOpen, setAircraftDialogOpen] = useState(false);
  const [liveryDialogOpen, setLiveryDialogOpen] = useState(false);
  const [groupForm, setGroupForm] = useState(defaultGroupForm);
  const [aircraftForm, setAircraftForm] = useState(defaultAircraftForm);
  const [isSavingGroup, setIsSavingGroup] = useState(false);
  const [isSavingAircraft, setIsSavingAircraft] = useState(false);
  const [selectedLiveryFleetId, setSelectedLiveryFleetId] = useState("");
  const [selectedLiveryId, setSelectedLiveryId] = useState<number | null>(null);
  const [selectedLiveryDetail, setSelectedLiveryDetail] = useState<FleetLivery | null>(null);
  const [liveryNote, setLiveryNote] = useState("");
  const [processPireps, setProcessPireps] = useState(false);
  const [isLoadingLiveryDetail, setIsLoadingLiveryDetail] = useState(false);
  const [isSavingLivery, setIsSavingLivery] = useState(false);
  const [selectedAircraftId, setSelectedAircraftId] = useState<string>("");
  const [aircraftFlightsCache, setAircraftFlightsCache] = useState<Record<string, AdminAircraftFlight[]>>({});
  const [loadingFlightsId, setLoadingFlightsId] = useState<string | null>(null);

  const loadAircraftFlights = async (aircraftId: string, numericId: number) => {
    if (aircraftFlightsCache[aircraftId] !== undefined) return;
    if (numericId <= 0) { setAircraftFlightsCache((c) => ({ ...c, [aircraftId]: [] })); return; }
    setLoadingFlightsId(aircraftId);
    try {
      const res = await fetch(`/api/admin/pireps?page[size]=5&sort=-id&filter[aircraft_id]=${numericId}`, { credentials: "include" });
      const payload = await res.json().catch(() => null);
      const items: AdminAircraftFlight[] = (Array.isArray(payload?.pireps) ? payload.pireps : []).map((p: Record<string, unknown>) => ({
        id: Number(p.id || 0) || 0,
        flightNumber: String(p.flight_number || "—"),
        departure: String((p as Record<string, Record<string, unknown>>).departure_airport?.icao || p.departure_airport_id || "—"),
        arrival: String((p as Record<string, Record<string, unknown>>).arrival_airport?.icao || p.arrival_airport_id || "—"),
        landingRate: p.landing_rate != null ? `${p.landing_rate} fpm` : "—",
        status: String(p.status || "—"),
        createdAt: typeof p.created_at === "string" ? p.created_at : null,
      }));
      setAircraftFlightsCache((c) => ({ ...c, [aircraftId]: items }));
    } catch {
      setAircraftFlightsCache((c) => ({ ...c, [aircraftId]: [] }));
    } finally {
      setLoadingFlightsId(null);
    }
  };

  const loadBootstrap = async (force = false) => {
    setIsLoading(true);
    setIsLoadingLiveFleet(true);
    try {
      const payload = await fetchAdminBootstrap({ force });
      setFleets(normalizeManagedFleets(payload?.fleets));
      setLiveFleets(normalizeLiveFleets(payload?.liveFleets));
      setHubs(Array.isArray(payload?.hubs) ? (payload.hubs as HubItem[]) : []);
    } catch (error) {
      console.error("Failed to load fleet", error);
      toast.error(force ? tr("Не удалось обновить каталог флота", "Failed to refresh fleet catalog") : tr("Не удалось загрузить каталог флота", "Failed to load fleet catalog"));
      setFleets([]);
      setLiveFleets([]);
      setHubs([]);
    } finally {
      setIsLoading(false);
      setIsLoadingLiveFleet(false);
    }
  };

  useEffect(() => {
    void loadBootstrap();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const savedViewMode = window.localStorage.getItem(FLEET_VIEW_MODE_KEY);
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
      window.localStorage.setItem(FLEET_VIEW_MODE_KEY, nextViewMode);
    }
  };

  const reloadFleet = async (force = true) => {
    await loadBootstrap(force);
  };

  const liveFleetById = useMemo(
    () => new Map(liveFleets.map((fleet) => [String(fleet.id), fleet])),
    [liveFleets]
  );

  const selectedLiveFleet = useMemo(
    () => liveFleets.find((fleet) => String(fleet.id) === String(selectedLiveryFleetId)) || null,
    [liveFleets, selectedLiveryFleetId]
  );

  const selectedLiveLivery = useMemo(
    () => (Array.isArray(selectedLiveFleet?.liveries) ? selectedLiveFleet.liveries : []).find((item) => item.id === selectedLiveryId) || selectedLiveFleet?.liveries?.[0] || null,
    [selectedLiveFleet, selectedLiveryId]
  );

  const groupedFleetSections = useMemo(
    () => FLEET_AIRLINES.map((airline) => {
      const fleetsForAirline = fleets.filter((fleet) => resolveFleetAirlineCode(fleet) === airline.code);
      const groupedByType = new Map<string, FleetGroup[]>();

      fleetsForAirline.forEach((fleet) => {
        const icaoCode = resolveFleetIcaoCode(fleet);
        const current = groupedByType.get(icaoCode) || [];
        current.push(fleet);
        groupedByType.set(icaoCode, current);
      });

      const typeGroups = Array.from(groupedByType.entries())
        .sort((left, right) => left[0].localeCompare(right[0]))
        .map(([icaoCode, typeFleets]) => ({
          icaoCode,
          fleets: typeFleets.sort((left, right) => String(left.name || "").localeCompare(String(right.name || ""))),
        }));

      return {
        ...airline,
        fleetCount: fleetsForAirline.length,
        aircraftCount: fleetsForAirline.reduce((sum, fleet) => sum + (Array.isArray(fleet.aircraft) ? fleet.aircraft.length : 0), 0),
        typeGroups,
      };
    }),
    [fleets]
  );

  const openLiveryDialog = (fleetId: string) => {
    const liveFleet = liveFleetById.get(String(fleetId));
    if (!liveFleet || !Array.isArray(liveFleet.liveries) || liveFleet.liveries.length === 0) {
      toast.error(tr("Для этого флота нет доступных live-ливрей", "No live liveries available for this fleet"));
      return;
    }

    setSelectedLiveryFleetId(String(fleetId));
    setSelectedLiveryId(liveFleet.liveries[0]?.id || null);
    setSelectedLiveryDetail(liveFleet.liveries[0] || null);
    setLiveryNote(liveFleet.liveries[0]?.internalNote || "");
    setProcessPireps(false);
    setLiveryDialogOpen(true);
  };

  useEffect(() => {
    if (!liveryDialogOpen) {
      return;
    }

    const liveries = Array.isArray(selectedLiveFleet?.liveries) ? selectedLiveFleet.liveries : [];
    if (!liveries.some((item) => item.id === selectedLiveryId)) {
      setSelectedLiveryId(liveries[0]?.id || null);
    }
  }, [liveryDialogOpen, selectedLiveFleet, selectedLiveryId]);

  useEffect(() => {
    let active = true;

    const loadLiveryDetail = async () => {
      if (!liveryDialogOpen || !selectedLiveFleet?.id || !selectedLiveLivery?.id) {
        return;
      }

      const numericFleetId = Number(selectedLiveFleet.id || 0) || 0;
      if (numericFleetId <= 0) {
        setSelectedLiveryDetail(selectedLiveLivery);
        setLiveryNote(selectedLiveLivery.internalNote || "");
        return;
      }

      setIsLoadingLiveryDetail(true);
      try {
        const response = await fetch(`/api/vamsys/fleet/${numericFleetId}/liveries/${selectedLiveLivery.id}?pirep_limit=10`, {
          credentials: "include",
        });
        const payload = (await response.json().catch(() => null)) as FleetLiveryDetailResponse | null;
        const nextLivery = response.ok && payload?.livery ? payload.livery : selectedLiveLivery;
        if (!active) {
          return;
        }
        setSelectedLiveryDetail(nextLivery || null);
        setLiveryNote(nextLivery?.internalNote || "");
      } catch (error) {
        if (!active) {
          return;
        }
        console.error("Failed to load live livery detail", error);
        toast.error(tr("Не удалось загрузить детали live-ливреи", "Failed to load live livery details"));
        setSelectedLiveryDetail(selectedLiveLivery);
        setLiveryNote(selectedLiveLivery.internalNote || "");
      } finally {
        if (active) {
          setIsLoadingLiveryDetail(false);
        }
      }
    };

    void loadLiveryDetail();

    return () => {
      active = false;
    };
  }, [liveryDialogOpen, selectedLiveFleet, selectedLiveLivery]);

  const updateLiveryStatus = async (nextStatus: "approved" | "rejected" | "ignored") => {
    if (!selectedLiveFleet?.id || !selectedLiveLivery?.id) {
      return;
    }

    const numericFleetId = Number(selectedLiveFleet.id || 0) || 0;
    if (numericFleetId <= 0) {
      return;
    }

    setIsSavingLivery(true);
    try {
      const response = await fetch(`/api/admin/fleet/${numericFleetId}/liveries/${selectedLiveLivery.id}`, {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          approved: nextStatus === "approved",
          rejected: nextStatus === "rejected",
          ignored: nextStatus === "ignored",
          process_pireps: processPireps,
          internal_note: liveryNote.trim() || null,
        }),
      });
      const payload = (await response.json().catch(() => null)) as FleetLiveryDetailResponse | null;
      if (!response.ok) {
        throw new Error(String(payload?.error || "Failed to update livery"));
      }

      const updated = payload?.livery || null;
      setSelectedLiveryDetail(updated);
      setLiveryNote(updated?.internalNote || "");
      setProcessPireps(false);
      setLiveFleets((current) => current.map((fleet) => {
        if (String(fleet.id) !== String(selectedLiveFleet.id)) {
          return fleet;
        }
        return {
          ...fleet,
          liveries: (Array.isArray(fleet.liveries) ? fleet.liveries : []).map((item) => item.id === updated?.id ? { ...item, ...updated } : item),
        };
      }));
      toast.success(tr(`Ливрея: ${nextStatus}`, `Livery ${nextStatus}`));
    } catch (error) {
      const message = error instanceof Error ? error.message : tr("Не удалось обновить ливрею", "Failed to update livery");
      console.error("Failed to update live livery", error);
      toast.error(message);
    } finally {
      setIsSavingLivery(false);
    }
  };

  const openGroupDialog = (group?: FleetGroup) => {
    setGroupForm(
      group
        ? {
            id: group.id,
            name: group.name || "",
            code: group.code || "",
            airlineCode: resolveFleetAirlineCode(group),
            color: group.color || "#E31E24",
            status: group.status || "active",
            baseHubId: group.baseHubId || "",
            notes: group.notes || "",
          }
        : defaultGroupForm
    );
    setGroupDialogOpen(true);
  };

  const openAircraftDialog = (groupId: string, aircraft?: FleetAircraft) => {
    setAircraftForm(
      aircraft
        ? {
            id: aircraft.id,
            groupId,
            model: aircraft.model || "",
            registration: aircraft.registration || "",
            seats: String(aircraft.seats || 0),
            range_nm: String(aircraft.range_nm || 0),
            cruise_speed: String(aircraft.cruise_speed || 0),
            status: aircraft.status || "active",
            baseHubId: aircraft.baseHubId || "",
            serviceable: aircraft.serviceable ?? true,
            notes: aircraft.notes || "",
          }
        : {
            ...defaultAircraftForm,
            groupId,
          }
    );
    setAircraftDialogOpen(true);
  };

  const saveGroup = async () => {
    setIsSavingGroup(true);
    try {
      const url = groupForm.id ? `/api/admin/fleet/groups/${groupForm.id}` : "/api/admin/fleet/groups";
      const method = groupForm.id ? "PUT" : "POST";
      const response = await fetch(url, {
        method,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: groupForm.name,
          code: groupForm.code,
          airlineCode: groupForm.airlineCode,
          color: groupForm.color,
          status: groupForm.status,
          baseHubId: groupForm.baseHubId || undefined,
          notes: groupForm.notes,
        }),
      });
      if (!response.ok) {
        throw new Error(tr("Не удалось сохранить группу флота", "Failed to save fleet group"));
      }
      await reloadFleet();
      setGroupDialogOpen(false);
      setGroupForm(defaultGroupForm);
    } catch (error) {
      console.error("Failed to save fleet group", error);
    } finally {
      setIsSavingGroup(false);
    }
  };

  const saveAircraft = async () => {
    setIsSavingAircraft(true);
    try {
      const url = aircraftForm.id ? `/api/admin/fleet/aircraft/${aircraftForm.id}` : "/api/admin/fleet/aircraft";
      const method = aircraftForm.id ? "PUT" : "POST";
      const response = await fetch(url, {
        method,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          groupId: aircraftForm.groupId,
          model: aircraftForm.model,
          registration: aircraftForm.registration,
          seats: Number(aircraftForm.seats || 0),
          range_nm: Number(aircraftForm.range_nm || 0),
          cruise_speed: Number(aircraftForm.cruise_speed || 0),
          status: aircraftForm.status,
          baseHubId: aircraftForm.baseHubId || undefined,
          serviceable: aircraftForm.serviceable,
          notes: aircraftForm.notes,
        }),
      });
      if (!response.ok) {
        throw new Error(tr("Не удалось сохранить самолет", "Failed to save aircraft"));
      }
      await reloadFleet();
      setAircraftDialogOpen(false);
      setAircraftForm(defaultAircraftForm);
    } catch (error) {
      console.error("Failed to save aircraft", error);
    } finally {
      setIsSavingAircraft(false);
    }
  };

  const deleteGroup = async (groupId: string) => {
    if (!window.confirm(tr("Удалить эту группу флота и все самолеты внутри?", "Delete this fleet group and all aircraft inside it?"))) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/fleet/groups/${groupId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error(tr("Не удалось удалить группу флота", "Failed to delete fleet group"));
      }
      await reloadFleet();
    } catch (error) {
      console.error("Failed to delete fleet group", error);
    }
  };

  const deleteAircraft = async (aircraftId: string) => {
    if (!window.confirm(tr("Удалить этот самолет из каталога флота?", "Delete this aircraft from the fleet catalog?"))) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/fleet/aircraft/${aircraftId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error(tr("Не удалось удалить самолет", "Failed to delete aircraft"));
      }
      await reloadFleet();
    } catch (error) {
      console.error("Failed to delete aircraft", error);
    }
  };

  const syncFleet = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch("/api/admin/fleet/sync", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) {
        throw new Error(tr("Не удалось синхронизировать флот", "Failed to sync fleet"));
      }
      await reloadFleet();
    } catch (error) {
      console.error("Failed to sync fleet", error);
    } finally {
      setIsSyncing(false);
    }
  };

  const renderFleetCard = (fleet: FleetGroup) => {
    const liveFleet = liveFleetById.get(String(fleet.id));
    const liveLiveries = Array.isArray(liveFleet?.liveries) ? liveFleet.liveries : [];
    const airlineCode = resolveFleetAirlineCode(fleet);

    return (
      <Card key={fleet.id} className="border-none shadow-sm">
        <CardContent className="space-y-4 p-5">
          <div className={viewMode === "gallery" ? "flex items-start justify-between gap-4" : "flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between"}>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-900">{fleet.name}</h3>
                <span className="inline-block h-3 w-3 rounded-full border border-gray-200" style={{ backgroundColor: fleet.color || "#E31E24" }} />
              </div>
              <p className="text-xs text-gray-500">{resolveFleetIcaoCode(fleet)} · {airlineCode} · {fleet.source || "local"}</p>
              {fleet.notes ? <p className="mt-2 text-sm text-gray-500">{fleet.notes}</p> : null}
            </div>
            <div className="flex flex-wrap items-center gap-2 xl:justify-end">
              <Badge variant="outline" className="border-gray-200 bg-gray-50 text-gray-700">{Array.isArray(fleet.aircraft) ? fleet.aircraft.length : 0} {tr("самолетов", "aircraft")}</Badge>
              <Badge variant="outline" className="border-gray-200 bg-gray-50 text-gray-700">{liveLiveries.length} {tr("ливрей", "liveries")}</Badge>
              <Badge variant="outline" className="border-gray-200 bg-gray-50 text-gray-700">{fleet.status || "active"}</Badge>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => openGroupDialog(fleet)}>
              <Pencil className="h-4 w-4" />
              {tr("Изменить группу", "Edit group")}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => openAircraftDialog(fleet.id)}>
              <Plus className="h-4 w-4" />
              {tr("Добавить самолет", "Add aircraft")}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => openLiveryDialog(fleet.id)} disabled={isLoadingLiveFleet || liveLiveries.length === 0}>
              <Palette className="h-4 w-4" />
              {tr("Управлять ливреями", "Manage liveries")}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => deleteGroup(fleet.id)}>
              <Trash2 className="h-4 w-4" />
              {tr("Удалить группу", "Delete group")}
            </Button>
          </div>

          {liveLiveries.length > 0 ? (
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-800">
                  <Palette className="h-4 w-4 text-[#E31E24]" />
                  {tr("Live-ливреи", "Live liveries")}
                </div>
                <div className="text-xs text-gray-500">{liveLiveries.length} {tr("записей из vAMSYS", "entries from vAMSYS")}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                {liveLiveries.slice(0, 6).map((livery) => (
                  <button
                    key={livery.id}
                    type="button"
                    onClick={() => {
                      setSelectedLiveryFleetId(String(fleet.id));
                      setSelectedLiveryId(livery.id);
                      setSelectedLiveryDetail(livery);
                      setLiveryDialogOpen(true);
                    }}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-sm text-gray-700 hover:border-red-200 hover:bg-red-50"
                  >
                    <span className="font-medium">{livery.name}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] ${liveryStatusClassName(livery.status)}`}>{livery.status || "pending"}</span>
                  </button>
                ))}
                {liveLiveries.length > 6 ? (
                  <Button type="button" variant="ghost" size="sm" onClick={() => openLiveryDialog(fleet.id)}>
                    {tr(`Показать все ${liveLiveries.length}`, `Show all ${liveLiveries.length}`)}
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="space-y-2">
            {(fleet.aircraft || []).length > 0 ? (fleet.aircraft || []).map((aircraft) => {
              const isSelected = selectedAircraftId === aircraft.id;
              const flights = aircraftFlightsCache[aircraft.id];
              return (
                <div key={aircraft.id} className="rounded border border-gray-100 overflow-hidden">
                  {/* Row header — clickable to expand */}
                  <button
                    type="button"
                    className="w-full text-left px-3 py-3 hover:bg-gray-50 transition-colors"
                    onClick={() => {
                      const next = isSelected ? "" : aircraft.id;
                      setSelectedAircraftId(next);
                      if (next) void loadAircraftFlights(next, Number(next) || 0);
                    }}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        {isSelected ? <ChevronDown size={14} className="shrink-0 text-gray-400" /> : <ChevronRight size={14} className="shrink-0 text-gray-400" />}
                        <Plane size={14} className="shrink-0 text-[#E31E24]" />
                        <span className="font-medium text-sm text-gray-900">{aircraft.model || "Unknown"}</span>
                        <span className="text-xs text-gray-400 font-mono">{aircraft.registration || "—"}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <Badge variant="outline" className="border-gray-200 bg-gray-50 text-gray-700 text-xs">{aircraft.seats || 0} pax</Badge>
                        <Badge variant="outline" className={aircraft.serviceable === false ? "border-amber-200 bg-amber-50 text-amber-700 text-xs" : "border-green-200 bg-green-50 text-green-700 text-xs"}>
                          {aircraft.serviceable === false ? tr("обсл.", "maint.") : tr("исправен", "OK")}
                        </Badge>
                      </div>
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {isSelected && (
                    <div className="border-t border-gray-100 bg-gray-50 px-4 py-4 space-y-4">
                      {/* Config & Equipment */}
                      <div>
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                          <Settings2 className="h-3.5 w-3.5" />
                          {tr("Конфигурация", "Config & Equipment")}
                        </div>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                          {[
                            { label: tr("Места", "Seats"), value: aircraft.seats || 0 },
                            { label: tr("Дальность", "Range"), value: aircraft.range_nm ? `${aircraft.range_nm} nm` : "—" },
                            { label: tr("Скорость", "Speed"), value: aircraft.cruise_speed ? `${aircraft.cruise_speed} kt` : "—" },
                            { label: tr("Статус", "Status"), value: aircraft.status || "active" },
                            { label: tr("Флот", "Fleet"), value: fleet.name },
                            { label: tr("Авиакомпания", "Airline"), value: resolveFleetAirlineCode(fleet) },
                          ].map(({ label, value }) => (
                            <div key={label} className="rounded-lg border border-gray-200 bg-white px-3 py-2">
                              <div className="text-[10px] uppercase tracking-wide text-gray-400">{label}</div>
                              <div className="mt-0.5 text-sm font-medium text-gray-900">{value}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Latest flights */}
                      <div>
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                          <History className="h-3.5 w-3.5" />
                          {tr("Последние рейсы", "Latest Flights")}
                        </div>
                        {loadingFlightsId === aircraft.id ? (
                          <div className="flex items-center gap-2 text-sm text-gray-400">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            {tr("Загрузка...", "Loading...")}
                          </div>
                        ) : !flights || flights.length === 0 ? (
                          <div className="text-sm text-gray-400">{tr("Рейсов нет", "No flights found")}</div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b border-gray-200">
                                  <th className="pb-1 text-left font-medium text-gray-500">{tr("Рейс", "Flight")}</th>
                                  <th className="pb-1 text-left font-medium text-gray-500">{tr("Маршрут", "Route")}</th>
                                  <th className="pb-1 text-left font-medium text-gray-500">{tr("Посадка", "Landing")}</th>
                                  <th className="pb-1 text-left font-medium text-gray-500">{tr("Статус", "Status")}</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {flights.map((f) => (
                                  <tr key={f.id}>
                                    <td className="py-1.5 pr-3 font-mono font-medium text-gray-800">{f.flightNumber}</td>
                                    <td className="py-1.5 pr-3 font-mono text-gray-600">{f.departure} → {f.arrival}</td>
                                    <td className="py-1.5 pr-3 text-gray-600">{f.landingRate}</td>
                                    <td className="py-1.5"><Badge variant="outline" className="border-gray-200 bg-white text-gray-700 text-[10px]">{f.status}</Badge></td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex flex-wrap gap-2 pt-1">
                        <Button type="button" variant="outline" size="sm" onClick={() => openAircraftDialog(fleet.id, aircraft)}>
                          <Pencil className="h-4 w-4" />
                          {tr("Изменить", "Edit")}
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => deleteAircraft(aircraft.id)}>
                          <Trash2 className="h-4 w-4" />
                          {tr("Удалить", "Delete")}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            }) : (
              <div className="rounded border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-500">
                {tr("В этой группе пока нет назначенных самолетов.", "No aircraft assigned to this group yet.")}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">{tr("Управление флотом", "Fleet Management")}</h2>
          <p className="text-sm text-gray-500">{tr("Управляйте локальными группами флота, самолетами, хабами и live-синхронизацией из vAMSYS.", "Manage local fleet groups, aircraft, hubs and live sync from vAMSYS.")}</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <ToggleGroup
            type="single"
            value={viewMode}
            onValueChange={handleViewModeChange}
            variant="outline"
            aria-label={tr("Режим отображения флота", "Fleet display mode")}
          >
            <ToggleGroupItem value="gallery" aria-label={tr("Плиточный вид", "Gallery view")}>
              <LayoutGrid className="h-4 w-4" />
              {tr("Плитка", "Gallery")}
            </ToggleGroupItem>
            <ToggleGroupItem value="list" aria-label={tr("Списочный вид", "List view")}>
              <List className="h-4 w-4" />
              {tr("Список", "List")}
            </ToggleGroupItem>
          </ToggleGroup>
          <Button type="button" variant="outline" onClick={syncFleet} disabled={isSyncing}>
            {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {tr("Синхронизировать из vAMSYS", "Sync from vAMSYS")}
          </Button>
          <Button type="button" onClick={() => openGroupDialog()}>
            <Plus className="h-4 w-4" />
            {tr("Новая группа", "New group")}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex min-h-[240px] items-center justify-center rounded-lg bg-white text-gray-500 shadow-sm">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {tr("Загрузка каталога флота...", "Loading fleet catalog...")}
        </div>
      ) : (
        <div className="space-y-6">
          {groupedFleetSections.map((section) => (
            <section key={section.code} className="space-y-4">
              <div className="rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{section.label}</h3>
                    <p className="text-sm text-gray-500">{section.code === "NWS" ? tr("Основные операции Nordwind", "Core Nordwind operation") : section.code === "KAR" ? tr("Партнерские регулярные и чартерные операции", "Partner schedule and charter operation") : tr("Операции Southwind", "Southwind operation")}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="border-gray-200 bg-gray-50 text-gray-700">{section.fleetCount} {tr("групп", "groups")}</Badge>
                    <Badge variant="outline" className="border-gray-200 bg-gray-50 text-gray-700">{section.aircraftCount} {tr("самолетов", "aircraft")}</Badge>
                  </div>
                </div>
              </div>

              {section.typeGroups.length > 0 ? section.typeGroups.map((typeGroup) => (
                <div key={`${section.code}-${typeGroup.icaoCode}`} className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <div>
                      <div className="text-sm font-semibold uppercase tracking-wide text-gray-900">{typeGroup.icaoCode}</div>
                      <div className="text-xs text-gray-500">{typeGroup.fleets.length} {tr(typeGroup.fleets.length === 1 ? "группа флота" : "группы флота", typeGroup.fleets.length === 1 ? "fleet group" : "fleet groups")}</div>
                    </div>
                  </div>
                  <div className={viewMode === "gallery" ? "grid grid-cols-1 gap-4 lg:grid-cols-2" : "space-y-4"}>
                    {typeGroup.fleets.map((fleet) => renderFleetCard(fleet))}
                  </div>
                </div>
              )) : (
                <div className="rounded-lg border border-dashed border-gray-200 bg-white px-6 py-10 text-center text-sm text-gray-500 shadow-sm">
                  {tr(`Для ${section.label} пока не назначены группы флота.`, `No fleet groups assigned to ${section.label} yet.`)}
                </div>
              )}
            </section>
          ))}

          {fleets.length === 0 ? (
            <div className="rounded-lg bg-white px-6 py-12 text-center text-gray-500 shadow-sm">
              {tr("Группы флота не найдены. Создайте группу вручную или синхронизируйте live-каталог.", "No fleet groups found. Create one manually or sync the live fleet catalog.")}
            </div>
          ) : null}
        </div>
      )}

      <Dialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{groupForm.id ? tr("Изменить группу флота", "Edit Fleet Group") : tr("Создать группу флота", "Create Fleet Group")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">{tr("Название", "Name")}</label>
              <Input value={groupForm.name} onChange={(event) => setGroupForm((current) => ({ ...current, name: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">{tr("Код", "Code")}</label>
              <Input value={groupForm.code} onChange={(event) => setGroupForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">{tr("Авиакомпания", "Airline")}</label>
              <Select value={groupForm.airlineCode} onValueChange={(value) => setGroupForm((current) => ({ ...current, airlineCode: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select airline" />
                </SelectTrigger>
                <SelectContent>
                  {FLEET_AIRLINES.map((airline) => (
                    <SelectItem key={airline.code} value={airline.code}>
                      {airline.label} ({airline.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">{tr("Цвет", "Color")}</label>
              <Input type="color" value={groupForm.color} onChange={(event) => setGroupForm((current) => ({ ...current, color: event.target.value }))} className="h-10" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">{tr("Статус", "Status")}</label>
              <Select value={groupForm.status} onValueChange={(value) => setGroupForm((current) => ({ ...current, status: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{tr("Активен", "Active")}</SelectItem>
                  <SelectItem value="seasonal">{tr("Сезонный", "Seasonal")}</SelectItem>
                  <SelectItem value="retired">{tr("Списан", "Retired")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-gray-700">{tr("Базовый хаб", "Base Hub")}</label>
              <Select value={groupForm.baseHubId || "none"} onValueChange={(value) => setGroupForm((current) => ({ ...current, baseHubId: value === "none" ? "" : value }))}>
                <SelectTrigger>
                  <SelectValue placeholder={tr("Выберите хаб", "Select hub")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{tr("Без хаба", "No hub")}</SelectItem>
                  {hubs.map((hub) => (
                    <SelectItem key={hub.id} value={hub.id}>
                      {hub.title || hub.name || hub.code || hub.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-gray-700">{tr("Заметки", "Notes")}</label>
              <Textarea value={groupForm.notes} onChange={(event) => setGroupForm((current) => ({ ...current, notes: event.target.value }))} rows={4} />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setGroupDialogOpen(false)}>{tr("Отмена", "Cancel")}</Button>
            <Button type="button" onClick={saveGroup} disabled={isSavingGroup || !groupForm.name.trim()}>
              {isSavingGroup ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {tr("Сохранить группу", "Save group")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={aircraftDialogOpen} onOpenChange={setAircraftDialogOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{aircraftForm.id ? tr("Изменить самолет", "Edit Aircraft") : tr("Добавить самолет", "Add Aircraft")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-gray-700">{tr("Группа флота", "Fleet Group")}</label>
              <Select value={aircraftForm.groupId} onValueChange={(value) => setAircraftForm((current) => ({ ...current, groupId: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder={tr("Выберите группу флота", "Select fleet group")} />
                </SelectTrigger>
                <SelectContent>
                  {fleets.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">{tr("Модель", "Model")}</label>
              <Input value={aircraftForm.model} onChange={(event) => setAircraftForm((current) => ({ ...current, model: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">{tr("Регистрация", "Registration")}</label>
              <Input value={aircraftForm.registration} onChange={(event) => setAircraftForm((current) => ({ ...current, registration: event.target.value.toUpperCase() }))} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">{tr("Места", "Seats")}</label>
              <Input type="number" value={aircraftForm.seats} onChange={(event) => setAircraftForm((current) => ({ ...current, seats: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">{tr("Дальность, nm", "Range, nm")}</label>
              <Input type="number" value={aircraftForm.range_nm} onChange={(event) => setAircraftForm((current) => ({ ...current, range_nm: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">{tr("Крейсерская скорость, kt", "Cruise Speed, kt")}</label>
              <Input type="number" value={aircraftForm.cruise_speed} onChange={(event) => setAircraftForm((current) => ({ ...current, cruise_speed: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">{tr("Статус", "Status")}</label>
              <Select value={aircraftForm.status} onValueChange={(value) => setAircraftForm((current) => ({ ...current, status: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder={tr("Статус", "Status")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{tr("Активен", "Active")}</SelectItem>
                  <SelectItem value="maintenance">{tr("На обслуживании", "Maintenance")}</SelectItem>
                  <SelectItem value="retired">{tr("Списан", "Retired")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-gray-700">{tr("Базовый хаб", "Base Hub")}</label>
              <Select value={aircraftForm.baseHubId || "none"} onValueChange={(value) => setAircraftForm((current) => ({ ...current, baseHubId: value === "none" ? "" : value }))}>
                <SelectTrigger>
                  <SelectValue placeholder={tr("Выберите хаб", "Select hub")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{tr("Без хаба", "No hub")}</SelectItem>
                  {hubs.map((hub) => (
                    <SelectItem key={hub.id} value={hub.id}>
                      {hub.title || hub.name || hub.code || hub.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3 md:col-span-2">
              <div>
                <div className="text-sm font-medium text-gray-700">{tr("Исправен", "Serviceable")}</div>
                <div className="text-xs text-gray-500">{tr("Отключите, чтобы пометить самолет недоступным для вылета.", "Turn this off to mark the aircraft as unavailable for dispatch.")}</div>
              </div>
              <Switch checked={aircraftForm.serviceable} onCheckedChange={(checked) => setAircraftForm((current) => ({ ...current, serviceable: checked }))} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-gray-700">{tr("Заметки", "Notes")}</label>
              <Textarea value={aircraftForm.notes} onChange={(event) => setAircraftForm((current) => ({ ...current, notes: event.target.value }))} rows={4} />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setAircraftDialogOpen(false)}>{tr("Отмена", "Cancel")}</Button>
            <Button type="button" onClick={saveAircraft} disabled={isSavingAircraft || !aircraftForm.groupId || !aircraftForm.model.trim()}>
              {isSavingAircraft ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {tr("Сохранить самолет", "Save aircraft")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={liveryDialogOpen} onOpenChange={setLiveryDialogOpen}>
        <DialogContent className="sm:max-w-6xl">
          <DialogHeader>
            <DialogTitle>{tr("Управление live-ливреями", "Live Livery Management")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2 lg:grid-cols-[320px_minmax(0,1fr)]">
            <div className="max-h-[560px] space-y-2 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-3">
              {(selectedLiveFleet?.liveries || []).length > 0 ? selectedLiveFleet?.liveries?.map((livery) => {
                const active = selectedLiveLivery?.id === livery.id;
                return (
                  <button
                    key={livery.id}
                    type="button"
                    onClick={() => setSelectedLiveryId(livery.id)}
                    className={`w-full rounded-lg border px-3 py-3 text-left transition-colors ${active ? "border-red-200 bg-red-50" : "border-gray-200 bg-white hover:border-red-100 hover:bg-white"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-medium text-gray-900">{livery.name}</div>
                        <div className="mt-1 text-xs text-gray-500">{livery.aircraftType || livery.aircraft || "Unknown aircraft"}</div>
                      </div>
                      <Badge variant="outline" className={liveryStatusClassName(livery.status)}>{livery.status || "pending"}</Badge>
                    </div>
                    <div className="mt-2 text-xs text-gray-500">{livery.addon || "No addon"} · {livery.pirepsCount || 0} PIREPs</div>
                  </button>
                );
              }) : (
                <div className="rounded-lg border border-dashed border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-500">
                  No live liveries found for this fleet.
                </div>
              )}
            </div>

            <div className="space-y-4">
              {selectedLiveLivery ? (
                <>
                  <div className="rounded-lg border border-gray-200 bg-white p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="text-lg font-semibold text-gray-900">{selectedLiveLivery.name}</div>
                        <div className="mt-1 text-sm text-gray-500">{selectedLiveLivery.aircraft || "-"}{selectedLiveLivery.aircraftType ? ` · ${selectedLiveLivery.aircraftType}` : ""}</div>
                        <div className="mt-1 text-xs text-gray-500">{tr("Аддон", "Addon")}: {selectedLiveLivery.addon || "-"}{selectedLiveLivery.liveryCode ? ` · ${tr("Код", "Code")}: ${selectedLiveLivery.liveryCode}` : ""}</div>
                      </div>
                      <Badge variant="outline" className={liveryStatusClassName((selectedLiveryDetail || selectedLiveLivery).status)}>{(selectedLiveryDetail || selectedLiveLivery).status || "pending"}</Badge>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"><div className="text-xs uppercase tracking-wide text-gray-500">{tr("Использование PIREP", "PIREP usage")}</div><div className="mt-1 font-semibold text-gray-900">{(selectedLiveryDetail || selectedLiveLivery).pirepsCount || 0}</div></div>
                      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"><div className="text-xs uppercase tracking-wide text-gray-500">{tr("Создано", "Created")}</div><div className="mt-1 font-semibold text-gray-900">{formatDateTime((selectedLiveryDetail || selectedLiveLivery).createdAt)}</div></div>
                      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"><div className="text-xs uppercase tracking-wide text-gray-500">{tr("Обновлено", "Updated")}</div><div className="mt-1 font-semibold text-gray-900">{formatDateTime((selectedLiveryDetail || selectedLiveLivery).updatedAt)}</div></div>
                    </div>
                  </div>

                  {isLoadingLiveryDetail ? (
                    <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {tr("Загрузка деталей ливреи...", "Loading livery details...")}
                    </div>
                  ) : null}

                  {Array.isArray(selectedLiveryDetail?.pirepUsage) && selectedLiveryDetail.pirepUsage.length > 0 ? (
                    <div className="rounded-lg border border-gray-200 bg-white p-4">
                      <div className="text-sm font-medium text-gray-900">{tr("Недавнее использование PIREP", "Recent PIREP usage")}</div>
                      <div className="mt-3 space-y-2">
                        {selectedLiveryDetail.pirepUsage.map((entry, index) => (
                          <div key={`${entry.pirepId || index}-${entry.bookingId || 0}`} className="flex items-center justify-between gap-3 text-sm text-gray-600">
                            <span>PIREP #{entry.pirepId || "-"} · {tr("Бронь", "Booking")} #{entry.bookingId || "-"}</span>
                            <span>{formatDateTime(entry.createdAt)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="rounded-lg border border-red-100 bg-red-50 p-4 space-y-4">
                    <div className="text-sm font-medium text-red-900">{tr("Модерация", "Moderation")}</div>
                    <Textarea value={liveryNote} onChange={(event) => setLiveryNote(event.target.value)} placeholder={tr("Внутренняя заметка по этой ливрее", "Internal note for this livery")} rows={5} className="bg-white" />
                    <div className="flex items-center justify-between rounded-lg border border-red-100 bg-white px-4 py-3">
                      <div>
                        <div className="text-sm font-medium text-gray-700">{tr("Обработать связанные PIREP", "Process affected PIREPs")}</div>
                        <div className="text-xs text-gray-500">{tr("Применить смену статуса к связанным PIREP, если поддерживается vAMSYS.", "Apply the status change to linked PIREPs when supported by vAMSYS.")}</div>
                      </div>
                      <Switch checked={processPireps} onCheckedChange={setProcessPireps} />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" disabled={isSavingLivery} onClick={() => updateLiveryStatus("approved")}>
                        {isSavingLivery ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        {tr("Одобрить", "Approve")}
                      </Button>
                      <Button type="button" variant="outline" disabled={isSavingLivery} onClick={() => updateLiveryStatus("ignored")}>{tr("Игнорировать", "Ignore")}</Button>
                      <Button type="button" variant="outline" disabled={isSavingLivery} onClick={() => updateLiveryStatus("rejected")}>{tr("Отклонить", "Reject")}</Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded-lg border border-dashed border-gray-200 px-4 py-12 text-center text-sm text-gray-500">
                  {tr("Выберите ливрею для проверки и модерации.", "Select a livery to inspect and moderate it.")}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
