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

const ruCountryNameFallbackMap: Record<string, string> = {
  Belarus: "Беларусь",
  Cuba: "Куба",
  Egypt: "Египет",
  Georgia: "Грузия",
  Iran: "Иран",
  Kyrgyzstan: "Киргизия",
  "North Korea": "Северная Корея",
  Russia: "Россия",
  Tajikistan: "Таджикистан",
  Thailand: "Таиланд",
  Turkey: "Турция",
  Venezuela: "Венесуэла",
  Vietnam: "Вьетнам",
};

const getLocalizedCountryName = (
  countryName?: string | null,
  countryIso2?: string | null,
  language: string = "en"
) => {
  const rawName = String(countryName || "").trim();
  if (!rawName || language !== "ru") {
    return rawName;
  }

  const iso2 = String(countryIso2 || "").trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(iso2)) {
    try {
      const translated = new Intl.DisplayNames(["ru"], { type: "region" }).of(iso2);
      if (translated) {
        return translated;
      }
    } catch {
    }
  }

  return ruCountryNameFallbackMap[rawName] || rawName;
};

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
  const { t, language } = useLanguage();
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

  const countryOptions = useMemo(() => {
    const countryIsoByName = new Map<string, string>();

    airports.forEach((airport) => {
      const countryName = String(airport.countryName || "").trim();
      if (!countryName) {
        return;
      }

      if (!countryIsoByName.has(countryName)) {
        countryIsoByName.set(countryName, String(airport.countryIso2 || "").trim());
      }
    });

    return Array.from(countryIsoByName.entries())
      .map(([value, iso2]) => ({
        value,
        label: getLocalizedCountryName(value, iso2, language),
      }))
      .sort((left, right) => left.label.localeCompare(right.label, language === "ru" ? "ru" : "en"));
  }, [airports, language]);

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
            {countryOptions.map((country) => (
              <SelectItem key={country.value} value={country.value}>{country.label}</SelectItem>
            ))}
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
          {/* Map with overlay sidebar */}
          <div className="relative overflow-hidden rounded-2xl border border-gray-200 shadow-sm" style={{ height: 520 }}>
            <FlightMap
              route={null}
              airports={mapAirports}
              selectedAirportCode={selectedAirport ? (selectedAirport.icao || selectedAirport.code) : null}
              onAirportSelect={handleMapMarkerClick}
            />

            {/* Airport info sidebar — slides in from the right over the map */}
            <div
              className={`absolute top-0 right-0 h-full w-72 bg-white/95 backdrop-blur-sm shadow-xl transition-transform duration-300 flex flex-col z-[500] ${
                selectedAirport ? "translate-x-0" : "translate-x-full"
              }`}
            >
              {selectedAirport && (
                <>
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2 border-b border-gray-100 p-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <CountryFlag iso2={selectedAirport.countryIso2} countryName={selectedAirport.countryName} className="h-6 w-9 mt-0.5 shrink-0" fallbackText={selectedAirport.code.slice(0, 2)} />
                      <div className="min-w-0">
                        <div className="font-semibold text-gray-900 leading-tight truncate">{selectedAirport.city || selectedAirport.name}</div>
                        <div className="text-xs text-gray-500 truncate">{selectedAirport.name}</div>
                        <div className="text-[11px] text-gray-400">{selectedAirport.countryName}</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedAirportId(null)}
                      className="shrink-0 rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Body */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {/* Codes */}
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="outline" className="border-gray-200 bg-gray-50 text-gray-700 font-mono text-xs">ICAO: {selectedAirport.icao || selectedAirport.code}</Badge>
                      {selectedAirport.iata ? <Badge variant="outline" className="border-gray-200 bg-gray-50 text-gray-700 font-mono text-xs">IATA: {selectedAirport.iata}</Badge> : null}
                    </div>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1.5">
                      {selectedAirport.base ? <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700 text-xs">{t("dashboard.airports.base")}</Badge> : null}
                      {selectedAirport.suitableAlternate ? <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 text-xs">{t("dashboard.airports.alternate")}</Badge> : null}
                      {selectedAirport.category ? <Badge variant="outline" className="border-gray-200 bg-gray-50 text-gray-700 text-xs">{selectedAirport.category}</Badge> : null}
                    </div>

                    {/* Taxi times */}
                    {(selectedAirport.taxiOutMinutes || selectedAirport.taxiInMinutes) ? (
                      <div className="rounded-lg bg-gray-50 p-3 space-y-1 text-xs text-gray-600">
                        {selectedAirport.taxiOutMinutes ? (
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {t("dashboard.airports.taxiOut")}</span>
                            <span className="font-medium text-gray-900">{selectedAirport.taxiOutMinutes} min</span>
                          </div>
                        ) : null}
                        {selectedAirport.taxiInMinutes ? (
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {t("dashboard.airports.taxiIn")}</span>
                            <span className="font-medium text-gray-900">{selectedAirport.taxiInMinutes} min</span>
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {/* Preferred alternates */}
                    {(selectedAirport.preferredAlternates || []).length > 0 ? (
                      <div>
                        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">{t("dashboard.airports.preferredAlternates")}</div>
                        <div className="flex flex-wrap gap-1">
                          {selectedAirport.preferredAlternates?.map((alt) => (
                            <Badge key={alt} variant="outline" className="border-gray-200 bg-gray-50 text-gray-700 font-mono text-xs">{alt}</Badge>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {/* Footer */}
                  {selectedAirport.airportBriefingUrl ? (
                    <div className="border-t border-gray-100 p-3">
                      <a
                        href={selectedAirport.airportBriefingUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#E31E24] px-3 py-2 text-sm font-medium text-white hover:bg-[#c41a20]"
                      >
                        <ExternalLink className="h-4 w-4" />
                        {t("dashboard.airports.openBriefing")}
                      </a>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
