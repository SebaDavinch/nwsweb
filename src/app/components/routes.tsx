import { useEffect, useMemo, useState } from "react";
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
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAirline, setSelectedAirline] = useState("ALL");
  const [selectedHub, setSelectedHub] = useState("ALL");
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [apiRoutes, setApiRoutes] = useState<ApiRoute[]>([]);
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
        if (!mounted) return;
        setApiRoutes(rows);
      } catch {
        if (!mounted) return;
        setApiRoutes([]);
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
        const from: Airport = {
          code: String(route.fromCode || "").trim() || "—",
          name: String(route.fromName || route.fromCode || "Unknown").trim() || "Unknown",
          lat: Number(route.fromLat),
          lon: Number(route.fromLon),
        };
        const to: Airport = {
          code: String(route.toCode || "").trim() || "—",
          name: String(route.toName || route.toCode || "Unknown").trim() || "Unknown",
          lat: Number(route.toLat),
          lon: Number(route.toLon),
        };

        return {
          id: String(route.id || ""),
          airline: String(route.airlineCode || "NWS").toUpperCase(),
          aircraft: route.fleetIds?.length ? `Fleet ${String(route.fleetIds[0])}` : "—",
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
  }, [apiRoutes]);

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
      const matchHub = selectedHub === "ALL" || route.legs[0].from.code === selectedHub;

      return matchSearch && matchAirline && matchHub;
    });
  }, [routes, searchQuery, selectedAirline, selectedHub]);

  const uniqueHubs = useMemo(
    () => Array.from(new Set(routes.map(r => r.legs[0].from.code))).filter(Boolean).sort(),
    [routes]
  );

  const airlines = useMemo(
    () => Array.from(new Set(routes.map((r) => r.airline))).filter(Boolean).sort(),
    [routes]
  );

  const airportsForMap = useMemo(() => {
    const map = new Map<string, Airport>();
    for (const route of filteredRoutes) {
      const from = route.legs[0].from;
      const to = route.legs[0].to;
      if (from?.code) map.set(from.code, from);
      if (to?.code) map.set(to.code, to);
    }
    return Array.from(map.values());
  }, [filteredRoutes]);

  const stats = useMemo(() => {
    const destinationCount = new Set(filteredRoutes.map((r) => r.legs[0].to.code)).size;
    const majorHubs = new Set(filteredRoutes.map((r) => r.legs[0].from.code)).size;
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
  }, [apiRoutes, filteredRoutes]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Hero Section */}
      <section className="bg-[#2A2A2A] text-white py-12">
        <div className="max-w-7xl mx-auto px-4">
          <h1 className="text-4xl font-bold mb-4">{t("routes.hero.title")}</h1>
          <p className="text-xl text-gray-300 max-w-2xl">
            {t("routes.hero.subtitle")}
          </p>
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
                  Filters
                </h3>
                
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input 
                      placeholder="Search destination..." 
                      className="pl-9"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-gray-500">Airline</label>
                      <Select value={selectedAirline} onValueChange={setSelectedAirline}>
                        <SelectTrigger>
                          <SelectValue placeholder="All" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ALL">All Airlines</SelectItem>
                          {airlines.map((airline) => (
                            <SelectItem key={airline} value={airline}>{airline}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-gray-500">Hub</label>
                      <Select value={selectedHub} onValueChange={setSelectedHub}>
                        <SelectTrigger>
                          <SelectValue placeholder="All Hubs" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ALL">All Hubs</SelectItem>
                          {uniqueHubs.map(hub => (
                            <SelectItem key={hub} value={hub || "UNK"}>{hub}</SelectItem>
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
                     Found {filteredRoutes.length} routes
                   </span>
                   {selectedRoute && (
                     <Button 
                       variant="ghost" 
                       size="sm" 
                       className="text-xs h-7"
                       onClick={() => setSelectedRoute(null)}
                     >
                       Clear Selection
                     </Button>
                   )}
                 </div>
                 
                 <ScrollArea className="h-[400px] pr-4">
                   <div className="space-y-3">
                     {filteredRoutes.map((route, idx) => (
                       <div 
                         key={idx}
                         onClick={() => setSelectedRoute(route)}
                         className={`
                           group p-3 rounded-lg border cursor-pointer transition-all duration-200
                           ${selectedRoute === route 
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
                             {Math.floor(route.totalDuration / 60)}h {route.totalDuration % 60}m
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
              <p className="font-bold mb-1">Live API Data</p>
              <p>Routes, hubs and destination stats are loaded from vAMSYS API.</p>
            </div>
          </div>
        </div>

        {/* Map Area */}
        <div className="lg:col-span-8 flex flex-col gap-6">
           <Card className="flex-1 border-none shadow-md overflow-hidden min-h-[500px] relative z-0">
             <FlightMap 
               route={selectedRoute} 
               airports={airportsForMap}
             />
             <div className="absolute bottom-4 left-4 right-4 z-[400] pointer-events-none">
                <div className="bg-white/90 backdrop-blur rounded-lg p-3 shadow-lg border border-gray-200 inline-flex items-center gap-4 pointer-events-auto">
                   <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-[#E31E24] border-2 border-white shadow-sm"></div>
                      <span className="text-xs font-medium text-gray-700">Hub / Destination</span>
                   </div>
                   <div className="flex items-center gap-2">
                      <div className="w-8 h-1 bg-[#E31E24] rounded-full opacity-60"></div>
                      <span className="text-xs font-medium text-gray-700">Flight Path</span>
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
                    <div className="text-sm text-gray-500">Destinations</div>
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
                    <div className="text-sm text-gray-500">Daily Flights</div>
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
                     <div className="text-sm text-gray-500">Major Hubs</div>
                   </div>
                 </CardContent>
              </Card>
           </div>

           {isLoading ? (
             <div className="text-gray-500 text-sm">Loading route network...</div>
           ) : null}

           {hasError ? (
             <div className="text-red-600 text-sm">Failed to load routes from API.</div>
           ) : null}
        </div>

      </div>
    </div>
  );
}
