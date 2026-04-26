import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Clock,
  Filter,
  MapPin,
  Navigation,
  Plane,
  RefreshCcw,
  RotateCcw,
  Send,
} from "lucide-react";
import { useLanguage } from "../../context/language-context";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Slider } from "../ui/slider";
import { toast } from "sonner";
import { FlightMap, type Airport, type Route as FlightMapRoute } from "./flight-map";

interface FleetResponse {
  fleets?: Array<{
    id: number;
    name: string;
    code: string;
    aircraft: Array<{
      id: number;
      model: string;
      registration: string;
      seats: number;
    }>;
  }>;
}

interface RoutesResponse {
  routes?: Array<{
    from: string;
    to: string;
    fromCode?: string;
    fromName?: string;
    fromLat?: number | null;
    fromLon?: number | null;
    toCode?: string;
    toName?: string;
    toLat?: number | null;
    toLon?: number | null;
    distance: string;
    duration: string;
    frequency: string;
  }>;
}

interface AircraftOption {
  id: string;
  model: string;
  registration: string;
  vacCode: string;
  vacName: string;
}

interface RouteOption {
  id: string;
  fromCode: string;
  fromName: string;
  fromLat: number;
  fromLon: number;
  toCode: string;
  toName: string;
  toLat: number;
  toLon: number;
  distanceNm: number;
  durationText: string;
  durationMinutes: number;
}

interface GeneratedPlan {
  mapRoute: FlightMapRoute;
  legs: RouteOption[];
  totalDistanceNm: number;
  totalDurationMinutes: number;
  aircraft: AircraftOption | null;
}

type VacFilter = "ALL" | "NWS" | "KAR" | "STW";

const inferVacCode = (fleetName: string, fleetCode: string) => {
  const source = `${fleetName} ${fleetCode}`.toUpperCase();

  if (source.includes("STW") || source.includes("SOUTHWIND")) {
    return "STW";
  }

  if (source.includes("KAR") || source.includes("IKAR") || source.includes("PEGAS")) {
    return "KAR";
  }

  return "NWS";
};

const extractCodeAndName = (value: string) => {
  const match = value.match(/^(.*)\(([^)]+)\)$/);
  if (!match) {
    const trimmed = value.trim();
    return { name: trimmed, code: trimmed };
  }

  return {
    name: match[1].trim(),
    code: match[2].trim(),
  };
};

const parseDistanceNm = (value: string) => {
  const match = value.match(/([\d.]+)/);
  const numeric = match ? Number(match[1]) : NaN;
  return Number.isFinite(numeric) ? Math.round(numeric) : 0;
};

const parseDurationMinutes = (value: string) => {
  if (!value) {
    return 0;
  }

  const text = value.trim().toLowerCase();
  const hourMatch = text.match(/(\d+)\s*h/);
  const minuteMatch = text.match(/(\d+)\s*m/);

  if (hourMatch || minuteMatch) {
    const hours = hourMatch ? Number(hourMatch[1]) : 0;
    const minutes = minuteMatch ? Number(minuteMatch[1]) : 0;
    return hours * 60 + minutes;
  }

  const hhmmss = text.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (hhmmss) {
    const hours = Number(hhmmss[1]);
    const minutes = Number(hhmmss[2]);
    const seconds = hhmmss[3] ? Number(hhmmss[3]) : 0;
    return hours * 60 + minutes + Math.round(seconds / 60);
  }

  const onlyNumber = Number(text.replace(/[^\d.]/g, ""));
  return Number.isFinite(onlyNumber) ? Math.round(onlyNumber) : 0;
};

const formatDuration = (minutesTotal: number) => {
  const hours = Math.floor(minutesTotal / 60);
  const minutes = minutesTotal % 60;
  if (hours <= 0) {
    return `${minutes}m`;
  }
  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
};

const buildChainedRoute = (
  routes: RouteOption[],
  maxLegCount: number,
  maxTotalMinutes: number
): RouteOption[] | null => {
  if (!routes.length || maxLegCount <= 0) {
    return null;
  }

  const byFrom = new Map<string, RouteOption[]>();
  routes.forEach((route) => {
    const existing = byFrom.get(route.fromCode) || [];
    existing.push(route);
    byFrom.set(route.fromCode, existing);
  });

  const startCandidates = Array.from(byFrom.keys());
  if (!startCandidates.length) {
    return null;
  }

  const attempts = Math.max(60, startCandidates.length * 8);
  let best: RouteOption[] | null = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const start = startCandidates[Math.floor(Math.random() * startCandidates.length)];
    const pickedLegs: RouteOption[] = [];
    const visitedAirports = new Set<string>([start]);
    let totalMinutes = 0;
    let current = start;

    for (let legIndex = 0; legIndex < maxLegCount; legIndex += 1) {
      const options = (byFrom.get(current) || []).filter((leg) => {
        if (leg.distanceNm <= 0 || leg.durationMinutes <= 0) {
          return false;
        }

        if (legIndex < maxLegCount - 1 && visitedAirports.has(leg.toCode)) {
          return false;
        }

        if (totalMinutes + leg.durationMinutes > maxTotalMinutes) {
          return false;
        }

        return true;
      });

      if (!options.length) {
        break;
      }

      const ranked = [...options]
        .map((option) => {
          const onward = (byFrom.get(option.toCode) || []).filter(
            (next) => !visitedAirports.has(next.toCode)
          ).length;
          return {
            option,
            onward,
            distance: option.distanceNm,
          };
        })
        .sort((left, right) => {
          if (right.onward !== left.onward) {
            return right.onward - left.onward;
          }
          return right.distance - left.distance;
        });

      const pickPool = ranked.slice(0, Math.min(3, ranked.length));
      const picked = pickPool[Math.floor(Math.random() * pickPool.length)].option;

      pickedLegs.push(picked);
      totalMinutes += picked.durationMinutes;
      current = picked.toCode;
      visitedAirports.add(picked.toCode);
    }

    if (pickedLegs.length > 0) {
      if (
        !best ||
        pickedLegs.length > best.length ||
        (pickedLegs.length === best.length &&
          pickedLegs.reduce((sum, leg) => sum + leg.distanceNm, 0) >
            best.reduce((sum, leg) => sum + leg.distanceNm, 0))
      ) {
        best = pickedLegs;
      }

      if (pickedLegs.length >= maxLegCount) {
        break;
      }
    }
  }

  return best;
};

interface Where2FlyProps {
  onOpenBookings?: () => void;
}

export function Where2Fly({ onOpenBookings }: Where2FlyProps) {
  const { t } = useLanguage();

  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aircraftOptions, setAircraftOptions] = useState<AircraftOption[]>([]);
  const [routeOptions, setRouteOptions] = useState<RouteOption[]>([]);

  const [selectedVac, setSelectedVac] = useState<VacFilter>("ALL");
  const [selectedAircraft, setSelectedAircraft] = useState("ALL");
  const [maxLegs, setMaxLegs] = useState([5]);
  const [maxDistance, setMaxDistance] = useState([2500]);
  const [maxTime, setMaxTime] = useState([8]);

  const [generatedPlan, setGeneratedPlan] = useState<GeneratedPlan | null>(null);
  const [generationError, setGenerationError] = useState("");

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      setIsLoading(true);
      try {
        const [fleetResponse, routesResponse] = await Promise.all([
          fetch("/api/vamsys/fleet"),
          fetch("/api/vamsys/routes"),
        ]);

        const fleetJson = (await fleetResponse.json()) as FleetResponse;
        const routesJson = (await routesResponse.json()) as RoutesResponse;

        if (!isMounted) {
          return;
        }

        const mappedAircraft: AircraftOption[] = (fleetJson.fleets || []).flatMap((fleet) =>
          (fleet.aircraft || []).map((aircraft) => ({
            id: `${fleet.code || fleet.name}-${aircraft.id}`,
            model: aircraft.model || "Unknown",
            registration: aircraft.registration || "N/A",
            vacCode: inferVacCode(fleet.name || "", fleet.code || ""),
            vacName: fleet.name || fleet.code || "VAC",
          }))
        );

        const mappedRoutes: RouteOption[] = (routesJson.routes || [])
          .map((route, index) => {
            const from = extractCodeAndName(route.from || "");
            const to = extractCodeAndName(route.to || "");

            const fromLat =
              typeof route.fromLat === "number" && Number.isFinite(route.fromLat)
                ? route.fromLat
                : null;
            const fromLon =
              typeof route.fromLon === "number" && Number.isFinite(route.fromLon)
                ? route.fromLon
                : null;
            const toLat =
              typeof route.toLat === "number" && Number.isFinite(route.toLat)
                ? route.toLat
                : null;
            const toLon =
              typeof route.toLon === "number" && Number.isFinite(route.toLon)
                ? route.toLon
                : null;

            const distanceNm = parseDistanceNm(route.distance || "0");
            const durationMinutes = parseDurationMinutes(route.duration || "");

            return {
              id: `${route.fromCode || from.code}-${route.toCode || to.code}-${index}`,
              fromCode: route.fromCode || from.code,
              fromName: route.fromName || from.name,
              fromLat: fromLat ?? 0,
              fromLon: fromLon ?? 0,
              toCode: route.toCode || to.code,
              toName: route.toName || to.name,
              toLat: toLat ?? 0,
              toLon: toLon ?? 0,
              distanceNm,
              durationText: route.duration || "—",
              durationMinutes,
            };
          })
          .filter(
            (route) =>
              route.distanceNm > 0 &&
              route.durationMinutes > 0 &&
              route.fromLat !== 0 &&
              route.fromLon !== 0 &&
              route.toLat !== 0 &&
              route.toLon !== 0
          );

        setAircraftOptions(mappedAircraft);
        setRouteOptions(mappedRoutes);
      } catch {
        if (!isMounted) {
          return;
        }

        setAircraftOptions([]);
        setRouteOptions([]);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredAircraft = useMemo(() => {
    if (selectedVac === "ALL") {
      return aircraftOptions;
    }

    return aircraftOptions.filter((item) => item.vacCode === selectedVac);
  }, [aircraftOptions, selectedVac]);

  const candidateRoutes = useMemo(() => {
    return routeOptions.filter((route) => route.distanceNm <= maxDistance[0]);
  }, [routeOptions, maxDistance]);

  const airports = useMemo<Airport[]>(() => {
    const index = new Map<string, Airport>();

    routeOptions.forEach((route) => {
      if (!index.has(route.fromCode)) {
        index.set(route.fromCode, {
          icao: route.fromCode,
          name: route.fromName,
          lat: route.fromLat,
          lon: route.fromLon,
        });
      }

      if (!index.has(route.toCode)) {
        index.set(route.toCode, {
          icao: route.toCode,
          name: route.toName,
          lat: route.toLat,
          lon: route.toLon,
        });
      }
    });

    return Array.from(index.values());
  }, [routeOptions]);

  const routePath = useMemo(() => {
    if (!generatedPlan || generatedPlan.legs.length === 0) {
      return "";
    }

    const first = generatedPlan.legs[0];
    const path = [first.fromCode, ...generatedPlan.legs.map((leg) => leg.toCode)];
    return path.join(" → ");
  }, [generatedPlan]);

  const handleGenerate = () => {
    setGenerationError("");
    setIsGenerating(true);

    if (candidateRoutes.length === 0) {
      setGeneratedPlan(null);
      setGenerationError("No routes available for selected limits");
      setIsGenerating(false);
      return;
    }

    const selectedLegs = buildChainedRoute(candidateRoutes, maxLegs[0], maxTime[0] * 60);

    if (!selectedLegs) {
      setGeneratedPlan(null);
      setGenerationError("Could not generate route with current constraints");
      setIsGenerating(false);
      return;
    }

    const totalDistanceNm = Math.round(
      selectedLegs.reduce((sum, leg) => sum + leg.distanceNm, 0)
    );
    const totalDurationMinutes = Math.round(
      selectedLegs.reduce((sum, leg) => sum + leg.durationMinutes, 0)
    );

    const aircraft =
      selectedAircraft === "ALL"
        ? filteredAircraft[Math.floor(Math.random() * filteredAircraft.length)] || null
        : filteredAircraft.find((item) => item.id === selectedAircraft) || null;

    const mapRoute: FlightMapRoute = {
      id: `${selectedVac}-${Date.now()}`,
      airline: selectedVac === "ALL" ? "NWS" : selectedVac,
      legs: selectedLegs.map((leg) => ({
        from: {
          icao: leg.fromCode,
          name: leg.fromName,
          lat: leg.fromLat,
          lon: leg.fromLon,
        },
        to: {
          icao: leg.toCode,
          name: leg.toName,
          lat: leg.toLat,
          lon: leg.toLon,
        },
        distance: leg.distanceNm,
        duration: leg.durationMinutes,
      })),
      totalDistance: totalDistanceNm,
      totalDuration: totalDurationMinutes,
      aircraft: aircraft?.model || "Any",
      registration: aircraft?.registration,
    };

    setGeneratedPlan({
      mapRoute,
      legs: selectedLegs,
      totalDistanceNm,
      totalDurationMinutes,
      aircraft,
    });
    setIsGenerating(false);
    toast.success(t("where2fly.generate"));
  };

  const handleReset = () => {
    setSelectedVac("ALL");
    setSelectedAircraft("ALL");
    setMaxLegs([5]);
    setMaxDistance([2500]);
    setMaxTime([8]);
    setGeneratedPlan(null);
    setGenerationError("");
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] gap-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#2A2A2A] flex items-center gap-2">
            <Navigation className="w-6 h-6 text-[#E31E24]" />
            {t("where2fly.title")}
          </h2>
          <p className="text-gray-500 text-sm">{t("where2fly.subtitle")}</p>
        </div>

        <div className="flex items-center gap-2">
          {generatedPlan && (
            <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs border border-emerald-200">
              <AlertTriangle size={12} />
              <span>Pilot API booking is available in the Bookings tab</span>
            </div>
          )}
          <Badge variant="outline" className="bg-white">
            {routeOptions.length} routes loaded
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full min-h-0">
        <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-4 h-full min-h-0 overflow-y-auto pr-2">
          <Card className="bg-white shadow-sm border-gray-200">
            <CardContent className="p-6 space-y-6">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-gray-700 font-bold">
                  <Filter className="w-4 h-4" /> {t("where2fly.filters")}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-gray-500"
                  onClick={handleReset}
                >
                  <RotateCcw className="w-3 h-3 mr-1" /> {t("where2fly.reset")}
                </Button>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                  {t("where2fly.airline")}
                </Label>
                <Select
                  value={selectedVac}
                  onValueChange={(value) => {
                    setSelectedVac(value as VacFilter);
                    setSelectedAircraft("ALL");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All VA</SelectItem>
                    <SelectItem value="NWS">Nordwind (NWS)</SelectItem>
                    <SelectItem value="KAR">Ikar (KAR)</SelectItem>
                    <SelectItem value="STW">Southwind (STW)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                  {t("where2fly.aircraftType")}
                </Label>
                <Select value={selectedAircraft} onValueChange={setSelectedAircraft}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">{t("where2fly.allAircraft")}</SelectItem>
                    {filteredAircraft.map((aircraft) => (
                      <SelectItem key={aircraft.id} value={aircraft.id}>
                        {aircraft.model} · {aircraft.registration}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-6 pt-4 border-t border-gray-100">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs font-bold text-gray-700">
                      {t("where2fly.maxLegs")}: {maxLegs[0]}
                    </Label>
                  </div>
                  <Slider
                    value={maxLegs}
                    onValueChange={setMaxLegs}
                    max={10}
                    min={1}
                    step={1}
                    className="[&_[role=slider]]:h-4 [&_[role=slider]]:w-4"
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs font-bold text-gray-700">
                      {t("where2fly.maxDistance")}: {maxDistance[0]} NM
                    </Label>
                  </div>
                  <Slider
                    value={maxDistance}
                    onValueChange={setMaxDistance}
                    max={6000}
                    min={200}
                    step={100}
                    className="[&_[role=slider]]:h-4 [&_[role=slider]]:w-4"
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs font-bold text-gray-700">
                      {t("where2fly.maxDuration")}: {maxTime[0]}h
                    </Label>
                  </div>
                  <Slider
                    value={maxTime}
                    onValueChange={setMaxTime}
                    max={18}
                    min={1}
                    step={1}
                    className="[&_[role=slider]]:h-4 [&_[role=slider]]:w-4"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100">
                <Button
                  onClick={handleGenerate}
                  disabled={isLoading || isGenerating || routeOptions.length === 0}
                  className="w-full bg-[#E31E24] hover:bg-[#c41a1f] text-white font-bold h-12 shadow-md"
                >
                  {isGenerating ? (
                    <RefreshCcw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 mr-2 -rotate-45" />
                  )}
                  {t("where2fly.generate")}
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="text-xs text-gray-500 px-1 flex items-center gap-2">
            <Filter className="w-4 h-4" />
            {filteredAircraft.length} aircraft · {candidateRoutes.length} routes · up to {maxLegs[0]} legs
          </div>
        </div>

        <div className="lg:col-span-7 xl:col-span-8 flex flex-col h-full gap-4">
          <Card className="flex-1 overflow-hidden shadow-sm border-gray-200 relative">
            <FlightMap airports={airports} route={generatedPlan?.mapRoute || null} />

            {!generatedPlan && (
              <div className="absolute top-4 left-4 z-[400] bg-white/90 backdrop-blur p-4 rounded-lg shadow-lg border border-gray-200 max-w-xs">
                <h3 className="font-bold text-[#2A2A2A] mb-1">Interactive Route Map</h3>
                <p className="text-sm text-gray-600">
                  {isLoading
                    ? "Loading live vAMSYS fleet and routes..."
                    : "Configure filters and generate a route from live vAMSYS data."}
                </p>
                {generationError ? (
                  <p className="text-xs text-red-500 mt-2">{generationError}</p>
                ) : null}
              </div>
            )}
          </Card>

          {generatedPlan && (
            <Card className="shrink-0 bg-white border border-gray-200 shadow-lg animate-in slide-in-from-bottom-4 duration-300">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-6 gap-4">
                  <div className="min-w-0">
                    <div className="text-sm text-gray-500">{t("where2fly.route")}</div>
                    <div className="text-lg font-bold text-gray-900 truncate">{routePath}</div>
                    <div className="text-sm text-gray-500">{generatedPlan.legs.length} legs</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm text-gray-500">{t("where2fly.aircraft")}</div>
                    <div className="text-lg font-bold text-gray-900">
                      {generatedPlan.aircraft?.model || t("where2fly.allAircraft")}
                    </div>
                    <div className="text-xs font-mono text-[#E31E24]">
                      {generatedPlan.aircraft?.registration || "ANY"}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 pt-6 border-t border-gray-100">
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-2 text-[#E31E24] mb-1">
                      <Clock size={16} />
                    </div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide">
                      {t("where2fly.totalTime")}
                    </div>
                    <div className="text-xl font-bold text-gray-900">
                      {formatDuration(generatedPlan.totalDurationMinutes)}
                    </div>
                  </div>
                  <div className="text-center border-x border-gray-100">
                    <div className="flex items-center justify-center gap-2 text-[#E31E24] mb-1">
                      <Send size={16} className="-rotate-45" />
                    </div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide">
                      {t("where2fly.totalDistance")}
                    </div>
                    <div className="text-xl font-bold text-gray-900">
                      {generatedPlan.totalDistanceNm} NM
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-2 text-[#E31E24] mb-1">
                      <MapPin size={16} />
                    </div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide">
                      {t("where2fly.legs")}
                    </div>
                    <div className="text-xl font-bold text-gray-900">{generatedPlan.legs.length}</div>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-100 space-y-1.5 max-h-28 overflow-auto pr-1">
                  {generatedPlan.legs.map((leg, index) => (
                    <div
                      key={`${leg.id}-${index}`}
                      className="text-xs text-gray-700 flex items-center justify-between"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <Plane size={12} className="text-[#E31E24]" />
                        {index + 1}. {leg.fromCode} → {leg.toCode}
                      </span>
                      <span className="text-gray-500">
                        {leg.distanceNm} NM · {leg.durationText}
                      </span>
                    </div>
                  ))}
                </div>

                {onOpenBookings ? (
                  <div className="mt-4 pt-4 border-t border-gray-100 flex justify-end">
                    <Button onClick={onOpenBookings} className="bg-[#E31E24] hover:bg-[#c41a1f] text-white">
                      Continue to bookings
                    </Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
