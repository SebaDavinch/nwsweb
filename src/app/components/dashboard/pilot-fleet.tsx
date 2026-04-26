import { useEffect, useMemo, useState } from "react";
import { ExternalLink, FileText, MapPin, Palette, Plane, Search } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../context/auth-context";
import { useLanguage } from "../../context/language-context";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { createDashboardSessionCache, fetchDashboardSessionCache, getDashboardSessionCache } from "./dashboard-session-cache";

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

interface FleetLiveryDetailResponse {
  livery?: FleetLivery | null;
  error?: string;
}

const pilotFleetCache = createDashboardSessionCache<FleetGroup[]>("nws.dashboard.pilotFleet.v1", 10 * 60 * 1000);

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

const normalizeResourceItems = (items: FleetResource[] | undefined, notes?: string | null) => {
  const source = Array.isArray(items) ? items : [];
  const noteLinks = Array.from(String(notes || "").matchAll(/https?:\/\/\S+/gi)).map((match) => ({
    label: match[0],
    url: match[0],
    type: "note",
  }));
  const merged = [...source, ...noteLinks];
  const seen = new Set<string>();

  return merged.filter((item) => {
    const key = `${String(item?.label || "").trim().toLowerCase()}|${String(item?.url || "").trim().toLowerCase()}`;
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

const renderResourceButton = (item: FleetResource, index: number) => {
  if (item.url) {
    return (
      <a
        key={`${item.label}-${index}`}
        href={item.url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700"
      >
        <ExternalLink className="h-4 w-4" />
        {item.label}
      </a>
    );
  }

  return (
    <Badge key={`${item.label}-${index}`} variant="outline" className="border-gray-200 bg-gray-50 text-gray-700">
      {item.label}
    </Badge>
  );
};

export function PilotFleet() {
  const { t } = useLanguage();
  const { isAdmin } = useAuth();
  const [fleets, setFleets] = useState<FleetGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedFleetId, setSelectedFleetId] = useState("");
  const [selectedAircraftId, setSelectedAircraftId] = useState("");
  const [selectedLiveryId, setSelectedLiveryId] = useState<number | null>(null);
  const [liveryDetail, setLiveryDetail] = useState<FleetLivery | null>(null);
  const [isLiveryLoading, setIsLiveryLoading] = useState(false);
  const [isSavingLivery, setIsSavingLivery] = useState(false);
  const [liveryNote, setLiveryNote] = useState("");
  const [processPireps, setProcessPireps] = useState(false);
  const [liveryFeedback, setLiveryFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    let active = true;

    const loadFleet = async () => {
      setIsLoading(true);
      setHasError(false);

      try {
        const nextFleets = await fetchDashboardSessionCache(pilotFleetCache, async () => {
          const response = await fetch("/api/vamsys/dashboard/fleet", {
            credentials: "include",
          });
          const payload = (await response.json().catch(() => null)) as FleetResponse | null;
          if (!response.ok) {
            throw new Error(String(payload?.error || "Failed to load fleet"));
          }
          return Array.isArray(payload?.fleets) ? payload.fleets : [];
        });
        if (!active) {
          return;
        }
        setFleets(nextFleets);
        setSelectedFleetId(nextFleets[0]?.id || "");
        setSelectedAircraftId(nextFleets[0]?.aircraft?.[0]?.id || "");
      } catch (error) {
        console.error("Failed to load dashboard fleet", error);
        if (active) {
          const cached = getDashboardSessionCache(pilotFleetCache);
          if (cached) {
            setFleets(cached);
            setSelectedFleetId(cached[0]?.id || "");
            setSelectedAircraftId(cached[0]?.aircraft?.[0]?.id || "");
          } else {
            setFleets([]);
            setHasError(true);
          }
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void loadFleet();

    return () => {
      active = false;
    };
  }, []);

  const filteredFleets = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return fleets;
    }

    return fleets
      .map((fleet) => ({
        ...fleet,
        aircraft: (Array.isArray(fleet.aircraft) ? fleet.aircraft : []).filter((item) => {
          const haystack = [
            item.model,
            item.registration,
            item.status,
            item.notes,
            item.description,
            fleet.name,
            fleet.code,
          ]
            .join(" ")
            .toLowerCase();
          return haystack.includes(query);
        }),
      }))
      .filter((fleet) => {
        const fleetMatch = [fleet.name, fleet.code, fleet.notes].join(" ").toLowerCase().includes(query);
        return fleetMatch || fleet.aircraft.length > 0;
      });
  }, [fleets, search]);

  useEffect(() => {
    if (!filteredFleets.some((fleet) => fleet.id === selectedFleetId)) {
      setSelectedFleetId(filteredFleets[0]?.id || "");
    }
  }, [filteredFleets, selectedFleetId]);

  const selectedFleet = useMemo(
    () => filteredFleets.find((fleet) => fleet.id === selectedFleetId) || filteredFleets[0] || null,
    [filteredFleets, selectedFleetId]
  );

  useEffect(() => {
    const aircraft = Array.isArray(selectedFleet?.aircraft) ? selectedFleet.aircraft : [];
    if (!aircraft.some((item) => item.id === selectedAircraftId)) {
      setSelectedAircraftId(aircraft[0]?.id || "");
    }
  }, [selectedAircraftId, selectedFleet]);

  const selectedAircraft = useMemo(
    () => (Array.isArray(selectedFleet?.aircraft) ? selectedFleet.aircraft : []).find((item) => item.id === selectedAircraftId) || selectedFleet?.aircraft?.[0] || null,
    [selectedAircraftId, selectedFleet]
  );

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
      if (!selectedFleet?.id || !selectedLivery?.id) {
        setLiveryDetail(null);
        setLiveryNote("");
        setProcessPireps(false);
        return;
      }

      const numericFleetId = Number(selectedFleet.id || 0) || 0;
      if (numericFleetId <= 0) {
        setLiveryDetail(selectedLivery);
        setLiveryNote(selectedLivery.internalNote || "");
        setProcessPireps(false);
        return;
      }

      setIsLiveryLoading(true);

      try {
        const response = await fetch(`/api/vamsys/fleet/${numericFleetId}/liveries/${selectedLivery.id}?pirep_limit=10`, {
          credentials: "include",
        });
        const payload = (await response.json().catch(() => null)) as FleetLiveryDetailResponse | null;
        const nextLivery = response.ok && payload?.livery ? payload.livery : selectedLivery;
        if (!active) {
          return;
        }
        setLiveryDetail(nextLivery || null);
        setLiveryNote(nextLivery?.internalNote || "");
        setProcessPireps(false);
      } catch (error) {
        if (!active) {
          return;
        }
        console.error("Failed to load livery detail", error);
        toast.error("Failed to load livery details");
        setLiveryDetail(selectedLivery);
        setLiveryNote(selectedLivery.internalNote || "");
        setProcessPireps(false);
      } finally {
        if (active) {
          setIsLiveryLoading(false);
        }
      }
    };

    void loadLiveryDetail();

    return () => {
      active = false;
    };
  }, [selectedFleet, selectedLivery]);

  const updateLiveryStatus = async (nextStatus: "approved" | "rejected" | "ignored") => {
    if (!selectedFleet?.id || !selectedLivery?.id) {
      return;
    }

    const numericFleetId = Number(selectedFleet.id || 0) || 0;
    if (numericFleetId <= 0) {
      return;
    }

    setIsSavingLivery(true);
    setLiveryFeedback(null);
    try {
      const body = {
        approved: nextStatus === "approved",
        rejected: nextStatus === "rejected",
        ignored: nextStatus === "ignored",
        process_pireps: processPireps,
        internal_note: liveryNote.trim() || null,
      };
      const response = await fetch(`/api/admin/fleet/${numericFleetId}/liveries/${selectedLivery.id}`, {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const payload = (await response.json().catch(() => null)) as { livery?: FleetLivery; error?: string } | null;
      if (!response.ok) {
        throw new Error(String(payload?.error || "Failed to update livery"));
      }

      const updatedLivery = payload?.livery || null;
      setLiveryDetail(updatedLivery);
      setLiveryNote(updatedLivery?.internalNote || "");
      setProcessPireps(false);
      const successMessage = `Livery ${nextStatus}`;
      setLiveryFeedback({ type: "success", message: successMessage });
      toast.success(successMessage);
      setFleets((current) => current.map((fleet) => {
        if (fleet.id !== selectedFleet.id) {
          return fleet;
        }
        return {
          ...fleet,
          liveries: (Array.isArray(fleet.liveries) ? fleet.liveries : []).map((item) => item.id === updatedLivery?.id ? { ...item, ...updatedLivery } : item),
        };
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

  const totalAircraft = fleets.reduce((sum, fleet) => sum + (Array.isArray(fleet.aircraft) ? fleet.aircraft.length : 0), 0);
  const serviceableAircraft = fleets.reduce(
    (sum, fleet) => sum + (Array.isArray(fleet.aircraft) ? fleet.aircraft.filter((item) => item.serviceable !== false).length : 0),
    0
  );
  const totalLiveries = fleets.reduce((sum, fleet) => sum + (Array.isArray(fleet.liveries) ? fleet.liveries.length : 0), 0);
  const serviceableLabel = t("dashboard.fleet.stats.serviceable");

  const liveryItems = normalizeResourceItems(selectedAircraft?.liveries, selectedAircraft?.notes);
  const scenarioItems = normalizeResourceItems(selectedAircraft?.scenarios, selectedAircraft?.notes);
  const genericLinks = normalizeResourceItems(selectedAircraft?.links, selectedAircraft?.notes).filter(
    (item) => !liveryItems.some((entry) => entry.label === item.label && entry.url === item.url) && !scenarioItems.some((entry) => entry.label === item.label && entry.url === item.url)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1d1d1f]">{t("dashboard.fleet.title")}</h1>
          <p className="text-sm text-gray-500">{t("dashboard.fleet.subtitle")}</p>
        </div>
        <div className="relative w-full xl:max-w-md">
          <Search className="absolute left-3 top-3.5 h-4 w-4 text-gray-400" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("dashboard.fleet.searchPlaceholder")} className="pl-9" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-4">
        <Card className="border-none shadow-sm"><CardContent className="p-5"><div className="text-sm text-gray-500">{t("dashboard.fleet.stats.groups")}</div><div className="mt-2 text-2xl font-semibold text-gray-900">{fleets.length}</div></CardContent></Card>
        <Card className="border-none shadow-sm"><CardContent className="p-5"><div className="text-sm text-gray-500">{t("dashboard.fleet.stats.aircraft")}</div><div className="mt-2 text-2xl font-semibold text-gray-900">{totalAircraft}</div></CardContent></Card>
        <Card className="border-none shadow-sm"><CardContent className="p-5">{serviceableLabel ? <div className="text-sm text-gray-500">{serviceableLabel}</div> : null}<div className={serviceableLabel ? "mt-2 text-2xl font-semibold text-gray-900" : "text-2xl font-semibold text-gray-900"}>{serviceableAircraft}</div></CardContent></Card>
        <Card className="border-none shadow-sm"><CardContent className="p-5"><div className="text-sm text-gray-500">{t("dashboard.fleet.stats.liveries")}</div><div className="mt-2 text-2xl font-semibold text-gray-900">{totalLiveries}</div></CardContent></Card>
      </div>

      {isLoading ? (
        <Card className="border-none shadow-sm"><CardContent className="p-8 text-center text-gray-500">{t("dashboard.fleet.loading")}</CardContent></Card>
      ) : hasError ? (
        <Card className="border-none shadow-sm"><CardContent className="p-8 text-center text-red-600">{t("dashboard.fleet.error")}</CardContent></Card>
      ) : filteredFleets.length === 0 ? (
        <Card className="border-none shadow-sm"><CardContent className="p-8 text-center text-gray-500">{t("dashboard.fleet.empty")}</CardContent></Card>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,360px)_minmax(0,1fr)]">
          <Card className="border-none shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t("dashboard.fleet.groupsTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {filteredFleets.map((fleet) => {
                const active = selectedFleet?.id === fleet.id;
                return (
                  <button
                    key={fleet.id}
                    type="button"
                    onClick={() => {
                      setSelectedFleetId(fleet.id);
                      setSelectedAircraftId(fleet.aircraft?.[0]?.id || "");
                    }}
                    className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${active ? "border-red-200 bg-red-50" : "border-gray-200 bg-white hover:border-red-100 hover:bg-gray-50"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-gray-900">{fleet.name}</div>
                        <div className="mt-1 text-xs text-gray-500">{fleet.code || "-"} - {fleet.aircraft?.length || 0} {t("dashboard.fleet.aircraftCount")}</div>
                      </div>
                      <span className="mt-1 inline-block h-3 w-3 shrink-0 rounded-full border border-gray-200" style={{ backgroundColor: fleet.color || "#E31E24" }} />
                    </div>
                    {fleet.baseHub?.name ? <div className="mt-2 text-xs text-gray-500">{t("dashboard.fleet.baseHub")}: {fleet.baseHub.name}</div> : null}
                  </button>
                );
              })}
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t("dashboard.fleet.aircraftTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(Array.isArray(selectedFleet?.aircraft) ? selectedFleet.aircraft : []).length > 0 ? (
                selectedFleet?.aircraft.map((aircraft) => {
                  const active = selectedAircraft?.id === aircraft.id;
                  return (
                    <button
                      key={aircraft.id}
                      type="button"
                      onClick={() => setSelectedAircraftId(aircraft.id)}
                      className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${active ? "border-red-200 bg-red-50" : "border-gray-200 bg-white hover:border-red-100 hover:bg-gray-50"}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium text-gray-900">{aircraft.model || "Aircraft"}</div>
                          <div className="mt-1 text-xs text-gray-500">{aircraft.registration || "-"}</div>
                        </div>
                        <Badge variant="outline" className={aircraft.serviceable === false ? "border-amber-200 bg-amber-50 text-amber-700" : "border-green-200 bg-green-50 text-green-700"}>
                          {aircraft.serviceable === false ? t("dashboard.fleet.maintenance") : t("dashboard.fleet.serviceable")}
                        </Badge>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500">
                        <span>{aircraft.seats || 0} {t("dashboard.fleet.seats").toLowerCase()}</span>
                        <span>{aircraft.range_nm || 0} nm</span>
                        <span>{aircraft.cruise_speed || 0} kt</span>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="rounded-lg border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-500">{t("dashboard.fleet.noAircraft")}</div>
              )}
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t("dashboard.fleet.detailsTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {selectedAircraft ? (
                <>
                  {selectedAircraft.imageUrl ? (
                    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-gray-50">
                      <img src={selectedAircraft.imageUrl} alt={selectedAircraft.model} className="h-56 w-full object-cover" />
                    </div>
                  ) : null}

                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <h2 className="text-2xl font-semibold text-gray-900">{selectedAircraft.model}</h2>
                      <div className="mt-1 text-sm text-gray-500">{selectedAircraft.registration || "-"} {selectedFleet?.name ? `- ${selectedFleet.name}` : ""}</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className="border-gray-200 bg-gray-50 text-gray-700">{selectedAircraft.status || t("dashboard.fleet.active")}</Badge>
                      <Badge variant="outline" className={selectedAircraft.serviceable === false ? "border-amber-200 bg-amber-50 text-amber-700" : "border-green-200 bg-green-50 text-green-700"}>
                        {selectedAircraft.serviceable === false ? t("dashboard.fleet.maintenance") : t("dashboard.fleet.serviceable")}
                      </Badge>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3"><div className="text-xs uppercase tracking-wide text-gray-500">{t("dashboard.fleet.seats")}</div><div className="mt-1 text-lg font-semibold text-gray-900">{selectedAircraft.seats || 0}</div></div>
                    <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3"><div className="text-xs uppercase tracking-wide text-gray-500">{t("dashboard.fleet.range")}</div><div className="mt-1 text-lg font-semibold text-gray-900">{selectedAircraft.range_nm || 0} nm</div></div>
                    <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3"><div className="text-xs uppercase tracking-wide text-gray-500">{t("dashboard.fleet.cruise")}</div><div className="mt-1 text-lg font-semibold text-gray-900">{selectedAircraft.cruise_speed || 0} kt</div></div>
                  </div>

                  {selectedAircraft.baseHub?.name || selectedFleet?.baseHub?.name ? (
                    <div className="rounded-2xl border border-gray-200 bg-white p-4">
                      <div className="flex items-center gap-2 text-sm font-medium text-gray-900"><MapPin className="h-4 w-4 text-red-600" />{t("dashboard.fleet.baseHub")}</div>
                      <div className="mt-2 text-sm text-gray-700">{selectedAircraft.baseHub?.name || selectedFleet?.baseHub?.name}</div>
                      {(selectedAircraft.baseHub?.airportsText || selectedFleet?.baseHub?.airportsText) ? <div className="mt-1 text-xs text-gray-500">{selectedAircraft.baseHub?.airportsText || selectedFleet?.baseHub?.airportsText}</div> : null}
                    </div>
                  ) : null}

                  {selectedAircraft.description || selectedAircraft.notes || selectedFleet?.notes ? (
                    <div className="rounded-2xl border border-gray-200 bg-white p-4">
                      <div className="flex items-center gap-2 text-sm font-medium text-gray-900"><FileText className="h-4 w-4 text-red-600" />{t("dashboard.fleet.notes")}</div>
                      <div className="mt-2 space-y-2 text-sm text-gray-600">
                        {selectedAircraft.description ? <p>{selectedAircraft.description}</p> : null}
                        {selectedAircraft.notes ? <p>{selectedAircraft.notes}</p> : null}
                        {!selectedAircraft.notes && selectedFleet?.notes ? <p>{selectedFleet.notes}</p> : null}
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
                            <button
                              key={livery.id}
                              type="button"
                              onClick={() => setSelectedLiveryId(livery.id)}
                              className={`rounded-xl border px-3 py-3 text-left transition-colors ${active ? "border-red-200 bg-red-50" : "border-gray-200 bg-white hover:border-red-100 hover:bg-gray-50"}`}
                            >
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
                              <div className="mt-1 text-sm text-gray-500">{selectedLivery.aircraft || "-"}{selectedLivery.aircraftType ? ` · ${selectedLivery.aircraftType}` : ""}</div>
                              <div className="mt-1 text-xs text-gray-500">Addon: {selectedLivery.addon || "-"}{selectedLivery.liveryCode ? ` · Code: ${selectedLivery.liveryCode}` : ""}</div>
                            </div>
                            <Badge variant="outline" className={liveryStatusClassName((liveryDetail || selectedLivery).status)}>{(liveryDetail || selectedLivery).status || "pending"}</Badge>
                          </div>

                          <div className="grid gap-4 md:grid-cols-3">
                            <div className="rounded-lg border border-gray-200 bg-white px-3 py-2"><div className="text-xs uppercase tracking-wide text-gray-500">PIREP usage</div><div className="mt-1 font-semibold text-gray-900">{(liveryDetail || selectedLivery).pirepsCount || 0}</div></div>
                            <div className="rounded-lg border border-gray-200 bg-white px-3 py-2"><div className="text-xs uppercase tracking-wide text-gray-500">Created</div><div className="mt-1 font-semibold text-gray-900">{formatDateTime((liveryDetail || selectedLivery).createdAt)}</div></div>
                            <div className="rounded-lg border border-gray-200 bg-white px-3 py-2"><div className="text-xs uppercase tracking-wide text-gray-500">Updated</div><div className="mt-1 font-semibold text-gray-900">{formatDateTime((liveryDetail || selectedLivery).updatedAt)}</div></div>
                          </div>

                          {isLiveryLoading ? <div className="text-sm text-gray-500">Loading livery details...</div> : null}

                          {liveryDetail?.internalNote || selectedLivery.internalNote ? (
                            <div className="rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-600">
                              {liveryDetail?.internalNote || selectedLivery.internalNote}
                            </div>
                          ) : null}

                          {Array.isArray(liveryDetail?.pirepUsage) && liveryDetail.pirepUsage.length > 0 ? (
                            <div className="rounded-lg border border-gray-200 bg-white p-3">
                              <div className="text-sm font-medium text-gray-900">Recent PIREP usage</div>
                              <div className="mt-3 space-y-2">
                                {liveryDetail.pirepUsage.map((entry, index) => (
                                  <div key={`${entry.pirepId || index}-${entry.bookingId || 0}`} className="flex items-center justify-between gap-3 text-sm text-gray-600">
                                    <span>PIREP #{entry.pirepId || "-"} · Booking #{entry.bookingId || "-"}</span>
                                    <span>{formatDateTime(entry.createdAt)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}

                          {isAdmin ? (
                            <div className="rounded-xl border border-red-100 bg-red-50 p-4 space-y-4">
                              <div className="text-sm font-medium text-red-900">Admin moderation</div>
                              <Textarea value={liveryNote} onChange={(event) => setLiveryNote(event.target.value)} placeholder="Internal note for this livery" className="min-h-[96px] bg-white" />
                              <label className="flex items-center gap-2 text-sm text-gray-700">
                                <input type="checkbox" checked={processPireps} onChange={(event) => setProcessPireps(event.target.checked)} />
                                Process affected PIREPs when changing status
                              </label>
                              {liveryFeedback ? (
                                <div className={`rounded-lg border px-3 py-2 text-sm ${liveryFeedback.type === "success" ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-white text-red-700"}`}>
                                  {liveryFeedback.message}
                                </div>
                              ) : null}
                              <div className="flex flex-wrap gap-2">
                                <Button type="button" size="sm" disabled={isSavingLivery} onClick={() => updateLiveryStatus("approved")}>{isSavingLivery ? "Saving..." : "Approve"}</Button>
                                <Button type="button" size="sm" variant="outline" disabled={isSavingLivery} onClick={() => updateLiveryStatus("ignored")}>Ignore</Button>
                                <Button type="button" size="sm" variant="outline" disabled={isSavingLivery} onClick={() => updateLiveryStatus("rejected")}>Reject</Button>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {liveryItems.length === 0 && scenarioItems.length === 0 && genericLinks.length === 0 && (selectedFleet?.liveries?.length || 0) === 0 ? (
                    <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-500">{t("dashboard.fleet.noResources")}</div>
                  ) : null}
                </>
              ) : (
                <div className="rounded-lg border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-500">{t("dashboard.fleet.selectAircraft")}</div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}