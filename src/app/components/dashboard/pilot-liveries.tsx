import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Palette, Search } from "lucide-react";
import { useLanguage } from "../../context/language-context";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { createDashboardSessionCache, fetchDashboardSessionCache, getDashboardSessionCache } from "./dashboard-session-cache";
import { fetchDashboardBootstrap, getCachedDashboardBootstrap } from "./dashboard-bootstrap-cache";

interface FleetResource {
  label: string;
  url?: string | null;
}

interface FleetLivery {
  id: number;
  name: string;
  aircraft?: string | null;
  aircraftType?: string | null;
  addon?: string | null;
  liveryCode?: string | null;
  status?: string | null;
}

interface DashboardAircraft {
  id: string;
  model: string;
  registration: string;
  liveries?: FleetResource[];
}

interface FleetGroup {
  id: string;
  name: string;
  code: string;
  aircraft: DashboardAircraft[];
  liveries?: FleetLivery[];
}

interface FleetResponse {
  fleets?: FleetGroup[];
  error?: string;
}

interface FlatLivery {
  key: string;
  name: string;
  status: string;
  aircraftLabel: string;
  fleetLabel: string;
  addon: string;
  code: string;
  url?: string | null;
}

const pilotLiveriesCache = createDashboardSessionCache<FleetGroup[]>("nws.dashboard.pilotLiveries.v1", 10 * 60 * 1000);

const normalizeFleetGroups = (value: unknown): FleetGroup[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((fleet, fleetIndex) => {
    const record = (fleet && typeof fleet === "object" ? fleet : {}) as Record<string, unknown>;
    const aircraft = Array.isArray(record.aircraft) ? record.aircraft : [];
    const liveries = Array.isArray(record.liveries) ? record.liveries : [];

    return {
      id: String(record.id || `fleet-${fleetIndex + 1}`),
      name: String(record.name || record.code || `Fleet ${fleetIndex + 1}`),
      code: String(record.code || ""),
      aircraft: aircraft.map((item, aircraftIndex) => {
        const aircraftRecord = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
        return {
          id: String(aircraftRecord.id || `aircraft-${fleetIndex + 1}-${aircraftIndex + 1}`),
          model: String(aircraftRecord.model || "Aircraft"),
          registration: String(aircraftRecord.registration || ""),
          liveries: Array.isArray(aircraftRecord.liveries) ? (aircraftRecord.liveries as FleetResource[]) : [],
        };
      }),
      liveries: liveries.map((item) => item as FleetLivery),
    };
  });
};

const normalizeStatusLabel = (value?: string | null) => {
  const status = String(value || "pending").trim().toLowerCase();
  if (status === "approved") {
    return "approved";
  }
  if (status === "rejected") {
    return "rejected";
  }
  if (status === "ignored") {
    return "ignored";
  }
  return "pending";
};

const statusClassName = (status: string) => {
  if (status === "approved") {
    return "border-green-200 bg-green-50 text-green-700";
  }
  if (status === "rejected") {
    return "border-red-200 bg-red-50 text-red-700";
  }
  if (status === "ignored") {
    return "border-gray-200 bg-gray-100 text-gray-700";
  }
  return "border-amber-200 bg-amber-50 text-amber-700";
};

export function PilotLiveries() {
  const { t } = useLanguage();
  const [fleets, setFleets] = useState<FleetGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let active = true;

    const loadLiveries = async () => {
      setIsLoading(true);
      setHasError(false);

      try {
        const nextFleets = await fetchDashboardSessionCache(pilotLiveriesCache, async () => {
          const payload = await fetchDashboardBootstrap();
          return normalizeFleetGroups(payload?.fleets);
        });

        if (!active) {
          return;
        }

        setFleets(nextFleets);
      } catch (error) {
        console.error("Failed to load liveries tab", error);
        if (!active) {
          return;
        }

        const cached = getDashboardSessionCache(pilotLiveriesCache) || normalizeFleetGroups(getCachedDashboardBootstrap()?.fleets);
        if (cached) {
          setFleets(cached);
        } else {
          setFleets([]);
          setHasError(true);
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void loadLiveries();

    return () => {
      active = false;
    };
  }, []);

  const liveries = useMemo(() => {
    const entries: FlatLivery[] = [];

    fleets.forEach((fleet) => {
      const fleetLabel = [String(fleet.name || "").trim(), String(fleet.code || "").trim()].filter(Boolean).join(" · ");

      (Array.isArray(fleet.liveries) ? fleet.liveries : []).forEach((livery) => {
        entries.push({
          key: `live-${fleet.id}-${livery.id}`,
          name: String(livery.name || "Livery").trim() || "Livery",
          status: normalizeStatusLabel(livery.status),
          aircraftLabel: [String(livery.aircraftType || "").trim(), String(livery.aircraft || "").trim()].filter(Boolean).join(" · ") || "Unknown aircraft",
          fleetLabel: fleetLabel || "Fleet",
          addon: String(livery.addon || "").trim(),
          code: String(livery.liveryCode || "").trim(),
          url: null,
        });
      });

      (Array.isArray(fleet.aircraft) ? fleet.aircraft : []).forEach((aircraft) => {
        (Array.isArray(aircraft.liveries) ? aircraft.liveries : []).forEach((resource, index) => {
          entries.push({
            key: `res-${fleet.id}-${aircraft.id}-${index}-${resource.label}`,
            name: String(resource.label || "Livery").trim() || "Livery",
            status: "resource",
            aircraftLabel: [String(aircraft.model || "").trim(), String(aircraft.registration || "").trim()].filter(Boolean).join(" · ") || "Aircraft",
            fleetLabel: fleetLabel || "Fleet",
            addon: "",
            code: "",
            url: String(resource.url || "").trim() || null,
          });
        });
      });
    });

    return entries;
  }, [fleets]);

  const filtered = useMemo(() => {
    const query = String(search || "").trim().toLowerCase();
    if (!query) {
      return liveries;
    }

    return liveries.filter((item) =>
      [item.name, item.aircraftLabel, item.fleetLabel, item.addon, item.code, item.status]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [liveries, search]);

  const downloadableCount = filtered.filter((item) => Boolean(item.url)).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1d1d1f]">{t("dashboard.fleet.liveries")}</h1>
          <p className="text-sm text-gray-500">Просмотр всех доступных ливрей и ссылок для скачивания.</p>
        </div>
        <div className="relative w-full xl:max-w-md">
          <Search className="absolute left-3 top-3.5 h-4 w-4 text-gray-400" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("dashboard.fleet.searchPlaceholder")} className="pl-9" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-none shadow-sm">
          <CardContent className="p-5">
            <div className="text-sm text-gray-500">{t("dashboard.fleet.stats.liveries")}</div>
            <div className="mt-2 text-2xl font-semibold text-gray-900">{filtered.length}</div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="p-5">
            <div className="text-sm text-gray-500">Download links</div>
            <div className="mt-2 text-2xl font-semibold text-gray-900">{downloadableCount}</div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="p-5">
            <div className="text-sm text-gray-500">Fleets</div>
            <div className="mt-2 text-2xl font-semibold text-gray-900">{new Set(filtered.map((item) => item.fleetLabel)).size}</div>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <Card className="border-none shadow-sm"><CardContent className="p-8 text-center text-gray-500">{t("dashboard.fleet.loading")}</CardContent></Card>
      ) : hasError ? (
        <Card className="border-none shadow-sm"><CardContent className="p-8 text-center text-red-600">{t("dashboard.fleet.error")}</CardContent></Card>
      ) : filtered.length === 0 ? (
        <Card className="border-none shadow-sm"><CardContent className="p-8 text-center text-gray-500">{t("dashboard.fleet.noResources")}</CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((item) => (
            <Card key={item.key} className="border-none shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-start justify-between gap-3 text-base">
                  <span className="line-clamp-2">{item.name}</span>
                  <Badge variant="outline" className={statusClassName(item.status)}>{item.status}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-gray-600">
                <div className="flex items-start gap-2">
                  <Palette className="mt-0.5 h-4 w-4 shrink-0 text-[#E31E24]" />
                  <div>
                    <div className="font-medium text-gray-900">{item.aircraftLabel}</div>
                    <div className="text-xs text-gray-500">{item.fleetLabel}</div>
                  </div>
                </div>

                {item.addon ? <div><span className="text-gray-500">Addon: </span><span className="font-medium text-gray-900">{item.addon}</span></div> : null}
                {item.code ? <div><span className="text-gray-500">Code: </span><span className="font-medium text-gray-900">{item.code}</span></div> : null}

                {item.url ? (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Скачать
                  </a>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-gray-100 px-3 py-2 text-sm font-medium text-gray-400"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Ссылка недоступна
                  </button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
