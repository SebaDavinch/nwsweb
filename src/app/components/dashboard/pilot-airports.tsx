import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { ExternalLink, MapPin, Search, X } from "lucide-react";
import { useLanguage } from "../../context/language-context";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { Input } from "../ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { FlightMap } from "./flight-map";
import { CountryFlag } from "./country-flag";
import { createDashboardSessionCache, fetchDashboardSessionCache, getDashboardSessionCache } from "./dashboard-session-cache";
import { fetchDashboardBootstrap, getCachedDashboardBootstrap } from "./dashboard-bootstrap-cache";

interface DashboardAirport {
  id: number;
  code: string;
  icao?: string | null;
  iata?: string | null;
  city?: string | null;
  name: string;
  category?: string | null;
  base?: boolean;
  suitableAlternate?: boolean;
  taxiInMinutes?: number;
  taxiOutMinutes?: number;
  airportBriefingUrl?: string | null;
  preferredAlternates?: string[];
  countryName?: string | null;
  countryIso2?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

interface AirportsResponse {
  airports?: DashboardAirport[];
  error?: string;
}

const pilotAirportsCache = createDashboardSessionCache<DashboardAirport[]>("nws.dashboard.pilotAirports.v1", 10 * 60 * 1000);

const normalizeAirports = (value: unknown): DashboardAirport[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((airport, index) => {
    const record = (airport && typeof airport === "object" ? airport : {}) as Record<string, unknown>;
    return {
      id: Number(record.id || 0) || index + 1,
      code: String(record.code || record.icao || record.iata || `APT${index + 1}`),
      icao: typeof record.icao === "string" ? record.icao : null,
      iata: typeof record.iata === "string" ? record.iata : null,
      city: typeof record.city === "string" ? record.city : null,
      name: String(record.name || record.city || record.code || "Airport"),
      category: typeof record.category === "string" ? record.category : null,
      base: Boolean(record.base),
      suitableAlternate: Boolean(record.suitableAlternate),
      taxiInMinutes: Number(record.taxiInMinutes || 0) || 0,
      taxiOutMinutes: Number(record.taxiOutMinutes || 0) || 0,
      airportBriefingUrl: typeof record.airportBriefingUrl === "string" ? record.airportBriefingUrl : null,
      preferredAlternates: Array.isArray(record.preferredAlternates) ? (record.preferredAlternates as string[]) : [],
      countryName: typeof record.countryName === "string" ? record.countryName : null,
      countryIso2: typeof record.countryIso2 === "string" ? record.countryIso2 : null,
      latitude: Number(record.latitude || 0) || null,
      longitude: Number(record.longitude || 0) || null,
    };
  });
};

export function PilotAirports() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [airports, setAirports] = useState<DashboardAirport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [search, setSearch] = useState("");
  const [countryFilter, setCountryFilter] = useState("all");
  const [baseFilter, setBaseFilter] = useState("all");
  const [selectedAirportId, setSelectedAirportId] = useState<number | null>(null);

  useEffect(() => {
    let active = true;

    const loadAirports = async () => {
      setIsLoading(true);
      setHasError(false);

      try {
        const nextAirports = await fetchDashboardSessionCache(pilotAirportsCache, async () => {
          const payload = await fetchDashboardBootstrap();
          return normalizeAirports(payload?.airports);
        });
        if (!active) {
          return;
        }
        setAirports(nextAirports);
        setSelectedAirportId(nextAirports[0]?.id || null);
      } catch (error) {
        console.error("Failed to load dashboard airports", error);
        if (active) {
          const cached = getDashboardSessionCache(pilotAirportsCache) || normalizeAirports(getCachedDashboardBootstrap()?.airports);
          if (cached) {
            setAirports(cached);
            setSelectedAirportId(cached[0]?.id || null);
          } else {
            setAirports([]);
            setHasError(true);
          }
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void loadAirports();

    return () => {
      active = false;
    };
  }, []);

  const countryOptions = useMemo(
    () => Array.from(new Set(airports.map((airport) => String(airport.countryName || "").trim()).filter(Boolean))).sort(),
    [airports]
  );

  const filteredAirports = useMemo(() => {
    const query = search.trim().toLowerCase();
    return airports.filter((airport) => {
      const matchesSearch =
        !query ||
        [airport.name, airport.code, airport.icao, airport.iata, airport.countryName, airport.category]
          .join(" ")
          .toLowerCase()
          .includes(query);
      const matchesCountry = countryFilter === "all" || airport.countryName === countryFilter;
      const matchesBase =
        baseFilter === "all" ||
        (baseFilter === "base" && airport.base) ||
        (baseFilter === "alternate" && airport.suitableAlternate) ||
        (baseFilter === "regular" && !airport.base && !airport.suitableAlternate);
      return matchesSearch && matchesCountry && matchesBase;
    });
  }, [airports, baseFilter, countryFilter, search]);

  useEffect(() => {
    if (!filteredAirports.some((airport) => airport.id === selectedAirportId)) {
      setSelectedAirportId(filteredAirports[0]?.id || null);
    }
  }, [filteredAirports, selectedAirportId]);

  const selectedAirport = useMemo(
    () => filteredAirports.find((airport) => airport.id === selectedAirportId) || filteredAirports[0] || null,
    [filteredAirports, selectedAirportId]
  );

  const mapAirports = useMemo(() =>
    filteredAirports
      .filter((a) => a.latitude && a.longitude)
      .map((a) => ({
        icao: a.icao || a.code,
        iata: a.iata || undefined,
        code: a.code,
        name: a.name,
        city: a.city || undefined,
        country: a.countryName || undefined,
        lat: a.latitude!,
        lon: a.longitude!,
      })),
    [filteredAirports]
  );

  const baseCount = airports.filter((airport) => airport.base).length;
  const alternateCount = airports.filter((airport) => airport.suitableAlternate).length;

  const handleMapMarkerClick = (code: string) => {
    const airport = airports.find((a) => (a.icao || a.code) === code || a.code === code);
    if (airport) setSelectedAirportId(airport.id);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1d1d1f]">{t("dashboard.airports.title")}</h1>
          <p className="text-sm text-gray-500">{t("dashboard.airports.subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
          <span>{airports.length} {t("dashboard.airports.stats.airports") || "аэропортов"}</span>
          <span>·</span>
          <span>{baseCount} {t("dashboard.airports.stats.base") || "баз"}</span>
          <span>·</span>
          <span>{countryOptions.length} {t("dashboard.airports.stats.countries") || "стран"}</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("dashboard.airports.searchPlaceholder")} className="pl-9 w-56" />
        </div>
        <Select value={countryFilter} onValueChange={setCountryFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder={t("dashboard.airports.country")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("dashboard.airports.allCountries")}</SelectItem>
            {countryOptions.map((country) => <SelectItem key={country} value={country}>{country}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={baseFilter} onValueChange={setBaseFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("dashboard.airports.allAirports")}</SelectItem>
            <SelectItem value="base">{t("dashboard.airports.baseOnly")}</SelectItem>
            <SelectItem value="alternate">{t("dashboard.airports.alternates")}</SelectItem>
            <SelectItem value="regular">{t("dashboard.airports.regular")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <Card className="border-none shadow-sm"><CardContent className="p-8 text-center text-gray-500">{t("dashboard.airports.loading")}</CardContent></Card>
      ) : hasError ? (
        <Card className="border-none shadow-sm"><CardContent className="p-8 text-center text-red-600">{t("dashboard.airports.error")}</CardContent></Card>
      ) : (
        <>
          {/* Big interactive map */}
          <div className="overflow-hidden rounded-2xl border border-gray-200 shadow-sm" style={{ height: 520 }}>
            <FlightMap
              route={null}
              airports={mapAirports}
              selectedAirportCode={selectedAirport ? (selectedAirport.icao || selectedAirport.code) : null}
              onAirportSelect={handleMapMarkerClick}
            />
          </div>

          {/* Selected airport detail panel */}
          {selectedAirport ? (
            <Card className="border-none shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 min-w-0">
                    <CountryFlag iso2={selectedAirport.countryIso2} countryName={selectedAirport.countryName} className="h-8 w-12 mt-1 shrink-0" fallbackText={selectedAirport.code.slice(0, 2)} />
                    <div className="min-w-0">
                      <h2 className="text-xl font-semibold text-gray-900">{selectedAirport.city || selectedAirport.name}</h2>
                      <div className="text-sm text-gray-500">{selectedAirport.name}</div>
                      <div className="text-xs text-gray-400">{selectedAirport.countryName}</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge variant="outline" className="border-gray-200 bg-gray-50 text-gray-700 font-mono">ICAO: {selectedAirport.icao || selectedAirport.code}</Badge>
                        {selectedAirport.iata ? <Badge variant="outline" className="border-gray-200 bg-gray-50 text-gray-700 font-mono">IATA: {selectedAirport.iata}</Badge> : null}
                        {selectedAirport.base ? <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">{t("dashboard.airports.base")}</Badge> : null}
                        {selectedAirport.suitableAlternate ? <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">{t("dashboard.airports.alternate")}</Badge> : null}
                        {selectedAirport.category ? <Badge variant="outline" className="border-gray-200 bg-gray-50 text-gray-700">{selectedAirport.category}</Badge> : null}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {selectedAirport.airportBriefingUrl ? (
                      <a href={selectedAirport.airportBriefingUrl} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100">
                        <ExternalLink className="h-4 w-4" />
                        {t("dashboard.airports.openBriefing")}
                      </a>
                    ) : null}
                    <Button variant="ghost" size="sm" onClick={() => setSelectedAirportId(null)}><X className="h-4 w-4" /></Button>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-4 text-sm">
                  {selectedAirport.taxiOutMinutes ? (
                    <div className="flex items-center gap-1 text-gray-500">
                      <MapPin className="h-3.5 w-3.5" />
                      {t("dashboard.airports.taxiOut")}: <span className="font-medium text-gray-900">{selectedAirport.taxiOutMinutes} min</span>
                    </div>
                  ) : null}
                  {selectedAirport.taxiInMinutes ? (
                    <div className="flex items-center gap-1 text-gray-500">
                      <MapPin className="h-3.5 w-3.5" />
                      {t("dashboard.airports.taxiIn")}: <span className="font-medium text-gray-900">{selectedAirport.taxiInMinutes} min</span>
                    </div>
                  ) : null}
                  {(selectedAirport.preferredAlternates || []).length > 0 ? (
                    <div className="flex items-center gap-2 text-gray-500">
                      {t("dashboard.airports.preferredAlternates")}:
                      {selectedAirport.preferredAlternates?.map((alt) => (
                        <Badge key={alt} variant="outline" className="border-gray-200 bg-gray-50 text-gray-700 font-mono">{alt}</Badge>
                      ))}
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-400">
              {t("dashboard.airports.selectAirport") || "Нажмите на маркер на карте для просмотра информации об аэропорте"}
            </div>
          )}
        </>
      )}
    </div>
  );
}
