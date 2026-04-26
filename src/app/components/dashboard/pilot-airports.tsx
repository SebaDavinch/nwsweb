import { useEffect, useMemo, useState } from "react";
import { ExternalLink, MapPin, Search } from "lucide-react";
import { useLanguage } from "../../context/language-context";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
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

export function PilotAirports() {
  const { t } = useLanguage();
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
          const response = await fetch("/api/vamsys/dashboard/airports", {
            credentials: "include",
          });
          const payload = (await response.json().catch(() => null)) as AirportsResponse | null;
          if (!response.ok) {
            throw new Error(String(payload?.error || "Failed to load airports"));
          }
          return Array.isArray(payload?.airports) ? payload.airports : [];
        });
        if (!active) {
          return;
        }
        setAirports(nextAirports);
        setSelectedAirportId(nextAirports[0]?.id || null);
      } catch (error) {
        console.error("Failed to load dashboard airports", error);
        if (active) {
          const cached = getDashboardSessionCache(pilotAirportsCache);
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

  const mapAirports = useMemo(() => {
    if (!selectedAirport || !selectedAirport.latitude || !selectedAirport.longitude) {
      return [];
    }

    return [
      {
        icao: selectedAirport.icao || selectedAirport.code,
        code: selectedAirport.code,
        name: selectedAirport.name,
        lat: selectedAirport.latitude,
        lon: selectedAirport.longitude,
      },
    ];
  }, [selectedAirport]);

  const baseCount = airports.filter((airport) => airport.base).length;
  const alternateCount = airports.filter((airport) => airport.suitableAlternate).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1d1d1f]">{t("dashboard.airports.title")}</h1>
          <p className="text-sm text-gray-500">{t("dashboard.airports.subtitle")}</p>
        </div>
        <div className="grid gap-3 md:grid-cols-3 xl:min-w-[760px]">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-3.5 h-4 w-4 text-gray-400" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("dashboard.airports.searchPlaceholder")} className="pl-9" />
          </div>
          <Select value={countryFilter} onValueChange={setCountryFilter}>
            <SelectTrigger><SelectValue placeholder={t("dashboard.airports.country")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("dashboard.airports.allCountries")}</SelectItem>
              {countryOptions.map((country) => <SelectItem key={country} value={country}>{country}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={baseFilter} onValueChange={setBaseFilter}>
            <SelectTrigger><SelectValue placeholder={t("dashboard.airports.airportType")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("dashboard.airports.allAirports")}</SelectItem>
              <SelectItem value="base">{t("dashboard.airports.baseOnly")}</SelectItem>
              <SelectItem value="alternate">{t("dashboard.airports.alternates")}</SelectItem>
              <SelectItem value="regular">{t("dashboard.airports.regular")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-none shadow-sm"><CardContent className="p-5"><div className="text-sm text-gray-500">{t("dashboard.airports.stats.airports")}</div><div className="mt-2 text-2xl font-semibold text-gray-900">{airports.length}</div></CardContent></Card>
        <Card className="border-none shadow-sm"><CardContent className="p-5"><div className="text-sm text-gray-500">{t("dashboard.airports.stats.base")}</div><div className="mt-2 text-2xl font-semibold text-gray-900">{baseCount}</div></CardContent></Card>
        <Card className="border-none shadow-sm"><CardContent className="p-5"><div className="text-sm text-gray-500">{t("dashboard.airports.stats.alternates")}</div><div className="mt-2 text-2xl font-semibold text-gray-900">{alternateCount}</div></CardContent></Card>
        <Card className="border-none shadow-sm"><CardContent className="p-5"><div className="text-sm text-gray-500">{t("dashboard.airports.stats.countries")}</div><div className="mt-2 text-2xl font-semibold text-gray-900">{countryOptions.length}</div></CardContent></Card>
      </div>

      {isLoading ? (
        <Card className="border-none shadow-sm"><CardContent className="p-8 text-center text-gray-500">{t("dashboard.airports.loading")}</CardContent></Card>
      ) : hasError ? (
        <Card className="border-none shadow-sm"><CardContent className="p-8 text-center text-red-600">{t("dashboard.airports.error")}</CardContent></Card>
      ) : filteredAirports.length === 0 ? (
        <Card className="border-none shadow-sm"><CardContent className="p-8 text-center text-gray-500">{t("dashboard.airports.empty")}</CardContent></Card>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <Card className="border-none shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t("dashboard.airports.listTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 max-h-[720px] overflow-y-auto pr-2">
              {filteredAirports.map((airport) => {
                const active = selectedAirport?.id === airport.id;
                const cityLabel = String(airport.city || airport.name || airport.code || "").trim();
                return (
                  <button
                    key={airport.id}
                    type="button"
                    onClick={() => setSelectedAirportId(airport.id)}
                    className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${active ? "border-red-200 bg-red-50" : "border-gray-200 bg-white hover:border-red-100 hover:bg-gray-50"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 font-medium text-gray-900">
                          <CountryFlag iso2={airport.countryIso2} countryName={airport.countryName} className="h-4 w-6" fallbackText={airport.code.slice(0, 2)} />
                          <span className="truncate">{cityLabel}</span>
                        </div>
                        <div className="mt-1 text-sm text-gray-600">{airport.name} ({airport.icao || airport.code})</div>
                        <div className="mt-1 text-xs text-gray-500">{airport.countryName || t("dashboard.airports.countryUnknown")}</div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {airport.base ? <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">{t("dashboard.airports.base")}</Badge> : null}
                        {airport.suitableAlternate ? <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">{t("dashboard.airports.alternate")}</Badge> : null}
                      </div>
                    </div>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="border-none shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t("dashboard.airports.detailsTitle")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {selectedAirport ? (
                  <>
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex items-center gap-3">
                          <CountryFlag iso2={selectedAirport.countryIso2} countryName={selectedAirport.countryName} className="h-6 w-9" fallbackText={selectedAirport.code.slice(0, 2)} />
                          <h2 className="text-2xl font-semibold text-gray-900">{selectedAirport.city || selectedAirport.name}</h2>
                        </div>
                        <div className="mt-1 text-sm text-gray-500">{selectedAirport.name} ({selectedAirport.icao || selectedAirport.code})</div>
                        <div className="mt-1 text-xs text-gray-500">{selectedAirport.countryName || t("dashboard.airports.countryUnknown")}</div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {selectedAirport.category ? <Badge variant="outline" className="border-gray-200 bg-gray-50 text-gray-700">{selectedAirport.category}</Badge> : null}
                        {selectedAirport.base ? <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">{t("dashboard.airports.base")}</Badge> : null}
                        {selectedAirport.suitableAlternate ? <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">{t("dashboard.airports.suitableAlternate")}</Badge> : null}
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-4">
                      <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3"><div className="text-xs uppercase tracking-wide text-gray-500">ICAO</div><div className="mt-1 text-lg font-semibold text-gray-900">{selectedAirport.icao || "-"}</div></div>
                      <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3"><div className="text-xs uppercase tracking-wide text-gray-500">IATA</div><div className="mt-1 text-lg font-semibold text-gray-900">{selectedAirport.iata || "-"}</div></div>
                      <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3"><div className="text-xs uppercase tracking-wide text-gray-500">{t("dashboard.airports.taxiOut")}</div><div className="mt-1 text-lg font-semibold text-gray-900">{selectedAirport.taxiOutMinutes || 0} min</div></div>
                      <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3"><div className="text-xs uppercase tracking-wide text-gray-500">{t("dashboard.airports.taxiIn")}</div><div className="mt-1 text-lg font-semibold text-gray-900">{selectedAirport.taxiInMinutes || 0} min</div></div>
                    </div>

                    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
                      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
                        {mapAirports.length > 0 ? (
                          <FlightMap route={null} airports={mapAirports} />
                        ) : (
                          <div className="flex h-[400px] items-center justify-center text-sm text-gray-500">{t("dashboard.airports.coordinatesUnavailable")}</div>
                        )}
                      </div>

                      <div className="space-y-4">
                        <div className="rounded-2xl border border-gray-200 bg-white p-4">
                          <div className="flex items-center gap-2 text-sm font-medium text-gray-900"><MapPin className="h-4 w-4 text-red-600" />{t("dashboard.airports.location")}</div>
                          <div className="mt-2 text-sm text-gray-600">{selectedAirport.countryName || t("dashboard.airports.countryUnknown")}</div>
                          <div className="mt-1 text-xs text-gray-500">{selectedAirport.latitude || "-"}, {selectedAirport.longitude || "-"}</div>
                        </div>

                        {selectedAirport.airportBriefingUrl ? (
                          <a
                            href={selectedAirport.airportBriefingUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 transition-colors hover:bg-red-100"
                          >
                            <ExternalLink className="h-4 w-4" />
                            {t("dashboard.airports.openBriefing")}
                          </a>
                        ) : null}

                        <div className="rounded-2xl border border-gray-200 bg-white p-4">
                          <div className="text-sm font-medium text-gray-900">{t("dashboard.airports.preferredAlternates")}</div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {(Array.isArray(selectedAirport.preferredAlternates) ? selectedAirport.preferredAlternates : []).length > 0 ? (
                              selectedAirport.preferredAlternates?.map((item) => (
                                <Badge key={item} variant="outline" className="border-gray-200 bg-gray-50 text-gray-700">{item}</Badge>
                              ))
                            ) : (
                              <div className="text-sm text-gray-500">{t("dashboard.airports.noAlternates")}</div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="rounded-lg border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-500">{t("dashboard.airports.selectAirport")}</div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}