import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { useLanguage } from "../context/language-context";
import {
  MapPin,
  Plane,
  Search,
  Filter,
  Globe,
  Info
} from "lucide-react";
import { Card, CardContent } from "./ui/card";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { ScrollArea } from "./ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { FlightMap, Airport, Route } from "./dashboard/flight-map";

type ApiRoute = {
  id: string | number;
  airlineCode?: string;
  fleetIds?: Array<string | number>;
  fromCode?: string;
  fromName?: string;
  fromLat?: number | null;
  fromLon?: number | null;
  toCode?: string;
  toName?: string;
  toLat?: number | null;
  toLon?: number | null;
  distance?: string;
  duration?: string | number;
  serviceDays?: number[];
  frequency?: string;
};

type ApiHub = {
  id: string | number;
  name?: string;
  airportCodes?: string[];
  airportLabels?: string[];
  airportsText?: string | null;
};

type HubOption = {
  value: string;
  label: string;
  airportCodes: string[];
};

const AIRLINE_BRANDS = [
  { code: "NWS", label: "Nordwind Airlines", accentClass: "border-[#E31E24]/30 bg-[#E31E24]/6 text-[#E31E24]" },
  { code: "KAR", label: "IKAR", accentClass: "border-emerald-500/30 bg-emerald-500/6 text-emerald-700" },
  { code: "STW", label: "Southwind Airlines", accentClass: "border-amber-500/30 bg-amber-500/6 text-amber-700" },
] as const;

const extractHubAirportCodes = (hub: ApiHub) => {
  const directCodes = Array.isArray(hub.airportCodes) ? hub.airportCodes : [];
  const labelCodes = Array.isArray(hub.airportLabels)
    ? hub.airportLabels.map((item) => String(item || "").split(" - ")[0].trim().toUpperCase()).filter(Boolean)
    : [];

  return Array.from(new Set([...directCodes, ...labelCodes].map((code) => String(code || "").trim().toUpperCase()).filter(Boolean)));
};

function AirlineWordmark({ code, language }: { code: string; language: string }) {
  const airlineSuffix = language === "ru" ? "Авиалинии" : "Airlines";

  if (code === "KAR") {
    return (
      <div className="flex items-center gap-2">
        <div className="h-6 w-6 rounded-full bg-emerald-600/10 ring-1 ring-emerald-600/20 flex items-center justify-center">
          <div className="h-2.5 w-2.5 rotate-45 rounded-sm bg-emerald-600" />
        </div>
        <div className="leading-none">
          <div className="text-[13px] font-black uppercase tracking-[0.2em] text-emerald-700">IKAR</div>
          <div className="text-[9px] uppercase tracking-[0.18em] text-emerald-700/70">{airlineSuffix}</div>
        </div>
      </div>
    );
  }

  if (code === "STW") {
    return (
      <div className="flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/10 ring-1 ring-amber-500/25">
          <div className="h-3 w-3 rounded-full bg-amber-500 shadow-[0_0_0_2px_rgba(251,191,36,0.18)]" />
        </div>
        <div className="leading-none">
          <div className="text-[12px] font-black uppercase tracking-[0.12em] text-amber-700">Southwind</div>
          <div className="text-[9px] uppercase tracking-[0.18em] text-amber-700/70">{airlineSuffix}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-1">
        <div className="h-5 w-2.5 -skew-x-[22deg] rounded-sm bg-[#E31E24]" />
        <div className="h-5 w-2.5 -skew-x-[22deg] rounded-sm bg-[#E31E24]" />
      </div>
      <div className="leading-none">
        <div className="text-[12px] font-black uppercase tracking-[0.12em] text-[#E31E24]">Nordwind</div>
        <div className="text-[9px] uppercase tracking-[0.18em] text-[#E31E24]/70">{airlineSuffix}</div>
      </div>
    </div>
  );
}

const parseDistanceNm = (value: unknown) => {
  const text = String(value || "").trim();
  if (!text) return 0;
  const numeric = Number(text.replace(/[^\d.-]/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
};

const parseDurationMinutes = (value: unknown) => {
  const text = String(value || "").trim();
  if (!text) return 0;

  if (/^\d+$/.test(text)) {
    const seconds = Number(text);
    if (!Number.isFinite(seconds) || seconds <= 0) return 0;
    return Math.round(seconds / 60);
  }

  const hhmmss = text.match(/^(\d{1,3}):(\d{1,2})(?::(\d{1,2}))?$/);
  if (hhmmss) {
    const hours = Number(hhmmss[1] || 0);
    const minutes = Number(hhmmss[2] || 0);
    const seconds = Number(hhmmss[3] || 0);
    return Math.round(hours * 60 + minutes + seconds / 60);
  }

  return 0;
};

const estimateDailyFlights = (route: ApiRoute) => {
  const serviceDays = Array.isArray(route.serviceDays) ? route.serviceDays.length : 0;
  if (serviceDays > 0) {
    return serviceDays / 7;
  }
  if (route.frequency === "weekly3") return 3 / 7;
  if (route.frequency === "weekly5") return 5 / 7;
  return 1;
};

export function Routes() {
  const { t, language } = useLanguage();
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);
  const formatDurationLabel = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return language === "ru" ? `${hours}ч ${remainingMinutes}м` : `${hours}h ${remainingMinutes}m`;
  };
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAirline, setSelectedAirline] = useState("ALL");
  const [selectedHub, setSelectedHub] = useState("ALL");
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [apiRoutes, setApiRoutes] = useState<ApiRoute[]>([]);
  const [apiHubs, setApiHubs] = useState<ApiHub[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadRoutes = async () => {
      if (mounted) {
        setIsLoading(true);
        setHasError(false);
      }
      try {
        const response = await fetch("/api/vamsys/routes", { credentials: "include" });
        if (!response.ok) {
          throw new Error("routes_fetch_failed");
        }
        const payload = await response.json();
        const rows = Array.isArray(payload?.routes) ? payload.routes : [];
        const hubs = Array.isArray(payload?.hubs) ? payload.hubs : [];
        if (!mounted) return;
        setApiRoutes(rows);
        setApiHubs(hubs);
      } catch {
        if (!mounted) return;
        setApiRoutes([]);
        setApiHubs([]);
        setHasError(true);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    loadRoutes();
    return () => {
      mounted = false;
    };
  }, []);

  const routes = useMemo<Route[]>(() => {
    return apiRoutes
      .filter((route) => Number.isFinite(Number(route.fromLat)) && Number.isFinite(Number(route.fromLon)) && Number.isFinite(Number(route.toLat)) && Number.isFinite(Number(route.toLon)))
      .map((route) => {
        const unknownLabel = tr("Неизвестно", "Unknown");
        const from: Airport = {
          code: String(route.fromCode || "").trim() || "—",
          name: String(route.fromName || route.fromCode || unknownLabel).trim() || unknownLabel,
          lat: Number(route.fromLat),
          lon: Number(route.fromLon),
        };
        const to: Airport = {
          code: String(route.toCode || "").trim() || "—",
          name: String(route.toName || route.toCode || unknownLabel).trim() || unknownLabel,
          lat: Number(route.toLat),
          lon: Number(route.toLon),
        };

        return {
          id: String(route.id || ""),
          airline: String(route.airlineCode || "NWS").toUpperCase(),
          aircraft: route.fleetIds?.length ? `${tr("Флот", "Fleet")} ${String(route.fleetIds[0])}` : "—",
          totalDistance: parseDistanceNm(route.distance),
          totalDuration: parseDurationMinutes(route.duration),
          legs: [
            {
              from,
              to,
              distance: parseDistanceNm(route.distance),
              duration: parseDurationMinutes(route.duration),
            },
          ],
        };
      });
  }, [apiRoutes, language]);

  const availableAirlines = useMemo(
    () => AIRLINE_BRANDS.filter((brand) => routes.some((route) => route.airline === brand.code)),
    [routes]
  );

  const airlineScopedRoutes = useMemo(
    () => (selectedAirline === "ALL" ? routes : routes.filter((route) => route.airline === selectedAirline)),
    [routes, selectedAirline]
  );

  const hubOptions = useMemo<HubOption[]>(() => {
    const activeDepartureCodes = new Set(
      airlineScopedRoutes.map((route) => String(route.legs[0].from.code || "").trim().toUpperCase()).filter(Boolean)
    );

    return apiHubs
      .map((hub) => {
        const airportCodes = extractHubAirportCodes(hub).filter((code) => activeDepartureCodes.has(code));
        if (!airportCodes.length) {
          return null;
        }

        const hubName = String(hub.name || airportCodes[0]).trim() || airportCodes[0];
        return {
          value: String(hub.id || hubName),
          label: `${hubName} · ${airportCodes.join(", ")}`,
          airportCodes,
        };
      })
      .filter((hub): hub is HubOption => Boolean(hub))
      .sort((left, right) => left.label.localeCompare(right.label));
  }, [airlineScopedRoutes, apiHubs]);

  const selectedHubOption = useMemo(
    () => (selectedHub === "ALL" ? null : hubOptions.find((hub) => hub.value === selectedHub) || null),
    [hubOptions, selectedHub]
  );

  useEffect(() => {
    if (selectedAirline !== "ALL" && !availableAirlines.some((brand) => brand.code === selectedAirline)) {
      setSelectedAirline("ALL");
    }
  }, [availableAirlines, selectedAirline]);

  useEffect(() => {
    if (selectedHub !== "ALL" && !selectedHubOption) {
      setSelectedHub("ALL");
    }
  }, [selectedHub, selectedHubOption]);

  // Filter Logic
  const filteredRoutes = useMemo(() => {
    return routes.filter(route => {
      const matchSearch = 
        searchQuery === "" || 
        route.legs[0].from.code?.includes(searchQuery.toUpperCase()) || 
        route.legs[0].to.code?.includes(searchQuery.toUpperCase()) ||
        route.legs[0].from.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        route.legs[0].to.name.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchAirline = selectedAirline === "ALL" || route.airline === selectedAirline;
      const departureCode = String(route.legs[0].from.code || "").trim().toUpperCase();
      const matchHub = !selectedHubOption || selectedHubOption.airportCodes.includes(departureCode);

      return matchSearch && matchAirline && matchHub;
    });
  }, [routes, searchQuery, selectedAirline, selectedHubOption]);

  useEffect(() => {
    if (selectedRoute && !filteredRoutes.some((route) => route.id === selectedRoute.id)) {
      setSelectedRoute(null);
    }
  }, [filteredRoutes, selectedRoute]);

  const mapRoutes = useMemo(
    () => filteredRoutes.map((route) => ({
      id: route.id,
      from: route.legs[0].from,
      to: route.legs[0].to,
      label: `${route.airline} · ${route.legs[0].from.code} → ${route.legs[0].to.code}`,
      active: selectedRoute?.id === route.id,
    })),
    [filteredRoutes, selectedRoute]
  );

  const stats = useMemo(() => {
    const destinationCount = new Set(filteredRoutes.map((r) => r.legs[0].to.code)).size;
    const majorHubs = selectedHub === "ALL" ? hubOptions.length : filteredRoutes.length > 0 ? 1 : 0;
    const routeMap = new Map(apiRoutes.map((r) => [String(r.id || ""), r]));
    const dailyFlights = filteredRoutes.reduce((sum, route) => {
      const row = routeMap.get(String(route.id));
      if (!row) return sum + 1;
      return sum + estimateDailyFlights(row);
    }, 0);

    return {
      destinationCount,
      majorHubs,
      dailyFlights: Math.max(0, Math.round(dailyFlights)),
    };
  }, [apiRoutes, filteredRoutes, hubOptions.length, selectedHub]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Hero Section */}
      <section className="bg-[#2A2A2A] text-white py-12">
        <div className="max-w-7xl mx-auto px-4">
          <h1 className="text-4xl font-bold mb-4">{t("routes.hero.title")}</h1>
          <Link to="/tickets">
            <Button className="bg-[#E31E24] hover:bg-[#C11A20] text-white px-6 py-3 text-base font-semibold rounded-xl">
              {tr("Связаться с нами", "Contact us")}
            </Button>
          </Link>
        </div>
      </section>

      {/* Main Content */}
      <div className="flex-1 max-w-7xl mx-auto w-full px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Sidebar Controls */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="border-none shadow-md">
            <CardContent className="p-6 space-y-6">
              <div>
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Filter size={18} className="text-[#E31E24]" />
                  {tr("Фильтры", "Filters")}
                </h3>
                
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input 
                      placeholder={tr("Поиск направления...", "Search destination...")} 
                      className="pl-9"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-500">{tr("Авиакомпания", "Airline")}</label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedAirline("ALL")}
                        className={`inline-flex h-11 items-center rounded-xl border px-4 text-sm font-semibold transition ${
                          selectedAirline === "ALL"
                            ? "border-[#E31E24] bg-[#E31E24] text-white shadow-sm"
                            : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        {tr("Все", "All")}
                      </button>

                      {availableAirlines.map((brand) => {
                        const isActive = selectedAirline === brand.code;
                        return (
                          <button
                            key={brand.code}
                            type="button"
                            onClick={() => setSelectedAirline(brand.code)}
                            className={`inline-flex min-w-[170px] items-center rounded-xl border px-3 py-2 text-left transition ${
                              isActive
                                ? `${brand.accentClass} shadow-sm ring-1 ring-current/10`
                                : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                            }`}
                            aria-pressed={isActive}
                            title={brand.label}
                          >
                            <AirlineWordmark code={brand.code} language={language} />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-500">{tr("Хаб", "Hub")}</label>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Select value={selectedHub} onValueChange={setSelectedHub}>
                        <SelectTrigger>
                          <SelectValue placeholder={tr("Все хабы", "All hubs")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ALL">{tr("Все хабы", "All hubs")}</SelectItem>
                          {hubOptions.map((hub) => (
                            <SelectItem key={hub.value} value={hub.value}>{hub.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                 <div className="flex items-center justify-between mb-4">
                   <span className="text-sm text-gray-500 font-medium">
                     {tr(`Найдено маршрутов: ${filteredRoutes.length}`, `Found ${filteredRoutes.length} routes`)}
                   </span>
                   {selectedRoute && (
                     <Button 
                       variant="ghost" 
                       size="sm" 
                       className="text-xs h-7"
                       onClick={() => setSelectedRoute(null)}
                     >
                       {tr("Сбросить выбор", "Clear selection")}
                     </Button>
                   )}
                 </div>
                 
                 <ScrollArea className="h-[400px] pr-4">
                   <div className="space-y-3">
                     {filteredRoutes.map((route) => (
                       <div 
                         key={route.id || `${route.legs[0].from.code}-${route.legs[0].to.code}`}
                         onClick={() => setSelectedRoute(route)}
                         className={`
                           group p-3 rounded-lg border cursor-pointer transition-all duration-200
                           ${selectedRoute?.id === route.id 
                             ? "bg-red-50 border-[#E31E24] ring-1 ring-[#E31E24]" 
                             : "bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm"
                           }
                         `}
                       >
                         <div className="flex items-center justify-between mb-2">
                           <Badge variant="outline" className="bg-white group-hover:bg-gray-50">
                             {route.airline}
                           </Badge>
                           <span className="text-xs text-gray-400 font-mono">
                             {formatDurationLabel(route.totalDuration)}
                           </span>
                         </div>
                         
                         <div className="flex items-center gap-3">
                           <div className="text-center w-12">
                             <div className="font-bold text-gray-900">{route.legs[0].from.code}</div>
                           </div>
                           <div className="flex-1 flex flex-col items-center">
                              <div className="w-full h-px bg-gray-300 relative top-1.5"></div>
                              <Plane size={12} className="text-gray-400 bg-white px-0.5 relative z-10 transform rotate-90" />
                           </div>
                           <div className="text-center w-12">
                             <div className="font-bold text-gray-900">{route.legs[0].to.code}</div>
                           </div>
                         </div>
                         
                         <div className="flex justify-between items-center mt-2 text-xs text-gray-500">
                            <span>{route.legs[0].to.name}</span>
                            <span className="flex items-center gap-1">
                              <Plane size={10} />
                              {route.aircraft}
                            </span>
                         </div>
                       </div>
                     ))}
                   </div>
                 </ScrollArea>
              </div>
            </CardContent>
          </Card>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
            <Info className="text-blue-500 shrink-0" size={20} />
            <div className="text-sm text-blue-800">
              <p className="font-bold mb-1">{tr("Живые данные API", "Live API Data")}</p>
              <p>{tr("Маршруты и реальные хабы подгружаются напрямую из vAMSYS.", "Routes and real hubs are loaded directly from vAMSYS.")}</p>
            </div>
          </div>
        </div>

        {/* Map Area */}
        <div className="lg:col-span-8 flex flex-col gap-6">
           <Card className="flex-1 border-none shadow-md overflow-hidden min-h-[500px] relative z-0">
             <FlightMap 
               route={selectedRoute} 
              availableRoutes={mapRoutes}
             />
             <div className="absolute bottom-4 left-4 right-4 z-[400] pointer-events-none">
                <div className="bg-white/90 backdrop-blur rounded-lg p-3 shadow-lg border border-gray-200 inline-flex items-center gap-4 pointer-events-auto">
                   <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-[#E31E24] border-2 border-white shadow-sm"></div>
                   <span className="text-xs font-medium text-gray-700">{tr("Хаб / аэропорт", "Hub / airport")}</span>
                   </div>
                   <div className="flex items-center gap-2">
                   <div className="w-10 border-t-2 border-dashed border-[#6366f1] opacity-70"></div>
                   <span className="text-xs font-medium text-gray-700">{tr("Маршрутная сеть", "Route network")}</span>
                   </div>
                </div>
             </div>
           </Card>

           {/* Stats Section */}
           <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-white border-none shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="p-3 rounded-full bg-red-50 text-[#E31E24]">
                    <Globe size={24} />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">{stats.destinationCount}</div>
                    <div className="text-sm text-gray-500">{tr("Направления", "Destinations")}</div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-white border-none shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="p-3 rounded-full bg-red-50 text-[#E31E24]">
                    <Plane size={24} />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">{stats.dailyFlights}</div>
                    <div className="text-sm text-gray-500">{tr("Рейсов в день", "Daily flights")}</div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white border-none shadow-sm hover:shadow-md transition-shadow">
                 <CardContent className="p-4 flex items-center gap-4">
                   <div className="p-3 rounded-full bg-red-50 text-[#E31E24]">
                     <MapPin size={24} />
                   </div>
                   <div>
                     <div className="text-2xl font-bold text-gray-900">{stats.majorHubs}</div>
                     <div className="text-sm text-gray-500">{tr("Реальные хабы", "Real hubs")}</div>
                   </div>
                 </CardContent>
              </Card>
           </div>

           {isLoading ? (
             <div className="text-gray-500 text-sm">{tr("Загрузка маршрутной сети...", "Loading route network...")}</div>
           ) : null}

           {hasError ? (
             <div className="text-red-600 text-sm">{tr("Не удалось загрузить маршруты из API.", "Failed to load routes from API.")}</div>
           ) : null}
        </div>

      </div>
    </div>
  );
}
