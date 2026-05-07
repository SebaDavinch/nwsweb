import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Filter, Globe, Loader2, Search } from "lucide-react";

import { useLanguage } from "../../context/language-context";
import { fetchDashboardBootstrap } from "./dashboard-bootstrap-cache";
import { CountryFlag } from "./country-flag";
import { PilotPassportMap } from "./pilot-passport-map";
import { Button } from "../ui/button";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "../ui/hover-card";
import { Input } from "../ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";

interface AirportVisit {
  icao: string;
  name: string;
  city?: string | null;
  country: string | null;
  countryIso2?: string | null;
  visits: number;
}

interface TopRoute {
  route: string;
  count: number;
  from: string;
  to: string;
}

interface PassportPayload {
  totalFlights: number;
  airports: AirportVisit[];
  countries: string[];
  countryCount: number;
  topRoutes: TopRoute[];
  rarestAirports: AirportVisit[];
  uniqueAirports: number;
  countriesByYear?: Record<string, string[]>;
}

interface NetworkAirport {
  icao?: string | null;
  code?: string;
  name?: string;
  city?: string | null;
  countryName?: string | null;
  countryIso2?: string | null;
}

interface CountryPassportSummary {
  iso2: string;
  name: string;
  visitedAirports: number;
  totalAirports: number;
}

interface CityGroup {
  key: string;
  city: string;
  countryName: string;
  airportCodes: string[];
  airports: Array<{ icao: string; name: string }>;
  totalVisits: number;
  totalAirports: number;
}

type CountryFilter = "all" | "visited" | "not-visited";

const EMPTY_PASSPORT_PAYLOAD: PassportPayload = {
  totalFlights: 0,
  airports: [],
  countries: [],
  countryCount: 0,
  topRoutes: [],
  rarestAirports: [],
  uniqueAirports: 0,
  countriesByYear: {},
};

const normalizeIso2 = (value: string | null | undefined) => {
  const iso2 = String(value || "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(iso2) ? iso2 : null;
};

const normalizeIcao = (value: string | null | undefined) => {
  const icao = String(value || "").trim().toUpperCase();
  return icao.length >= 4 ? icao : null;
};

const resolveCityLabel = (city: string | null | undefined, fallbackName: string | null | undefined, icao: string | null) => {
  const normalizedCity = String(city || "").trim();
  if (normalizedCity) {
    return normalizedCity;
  }

  const normalizedName = String(fallbackName || "").trim();
  if (normalizedName) {
    return normalizedName;
  }

  return icao || "Unknown city";
};

const matchesText = (value: string, query: string) => value.toLowerCase().includes(query);

function PassportCityCard({
  group,
  title,
  description,
  accentClassName,
}: {
  group: CityGroup;
  title: string;
  description: string;
  accentClassName: string;
}) {
  return (
    <HoverCard openDelay={100} closeDelay={80}>
      <HoverCardTrigger asChild>
        <div className={`rounded-[24px] border bg-white px-4 py-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${accentClassName}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-900">
                {group.city}, {group.countryName} ({group.airportCodes.join(", ")})
              </div>
              <div className="mt-1 text-xs text-slate-500">{description}</div>
            </div>
            <div className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
              {title}
            </div>
          </div>
        </div>
      </HoverCardTrigger>
      <HoverCardContent align="start" className="w-[320px] rounded-[24px] border-slate-200 p-4">
        <div className="text-sm font-semibold text-slate-900">{group.city}, {group.countryName}</div>
        <div className="mt-1 text-xs text-slate-500">{group.airportCodes.join(", ")}</div>
        <div className="mt-3 space-y-2">
          {group.airports.map((airport) => (
            <div key={airport.icao} className="rounded-2xl bg-slate-50 px-3 py-2">
              <div className="text-xs font-semibold text-slate-900">{airport.icao}</div>
              <div className="text-xs text-slate-500">{airport.name}</div>
            </div>
          ))}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

export function PilotPassport({ countryRouteIso2 = null, onOpenCountry, onBackToPassport }: {
  countryRouteIso2?: string | null;
  onOpenCountry?: (countryIso2: string) => void;
  onBackToPassport?: () => void;
}) {
  const { language } = useLanguage();
  const isRu = language === "ru";
  const tr = (ru: string, en: string) => (isRu ? ru : en);

  const [data, setData] = useState<PassportPayload | null>(null);
  const [networkAirports, setNetworkAirports] = useState<NetworkAirport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCountryMenuOpen, setIsCountryMenuOpen] = useState(true);
  const [countryFilter, setCountryFilter] = useState<CountryFilter>("all");
  const [countryQuery, setCountryQuery] = useState("");
  const [cityQuery, setCityQuery] = useState("");
  const passportData = data ?? EMPTY_PASSPORT_PAYLOAD;

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [passportRes, bootstrap] = await Promise.all([
          fetch("/api/pilot/passport", { credentials: "include" }),
          fetchDashboardBootstrap().catch(() => null),
        ]);
        const payload = await passportRes.json().catch(() => null);
        if (!passportRes.ok) throw new Error(payload?.error || "Failed to load passport");
        setData(payload);
        if (bootstrap?.airports && Array.isArray(bootstrap.airports)) {
          setNetworkAirports(bootstrap.airports as NetworkAirport[]);
        }
      } catch (e) {
        setError(String(e instanceof Error ? e.message : e));
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, []);

  const visitedIcaos = useMemo(
    () => new Set(passportData.airports.map((airport) => normalizeIcao(airport.icao)).filter(Boolean) as string[]),
    [passportData.airports]
  );

  const countryNameByIso2 = useMemo(() => {
    const entries: Record<string, string> = {};

    passportData.airports.forEach((airport) => {
      const iso2 = normalizeIso2(airport.countryIso2);
      if (iso2 && airport.country) {
        entries[iso2] = airport.country;
      }
    });

    networkAirports.forEach((airport) => {
      const iso2 = normalizeIso2(airport.countryIso2);
      if (iso2 && airport.countryName) {
        entries[iso2] = airport.countryName;
      }
    });

    return entries;
  }, [passportData.airports, networkAirports]);

  const countrySummaries = useMemo(() => {
    const summary = new Map<string, CountryPassportSummary>();

    const ensureCountry = (iso2Value: string | null | undefined, countryNameValue: string | null | undefined) => {
      const iso2 = normalizeIso2(iso2Value);
      const countryName = String(countryNameValue || "").trim();
      if (!iso2 || !countryName) {
        return null;
      }

      if (!summary.has(iso2)) {
        summary.set(iso2, {
          iso2,
          name: countryName,
          visitedAirports: 0,
          totalAirports: 0,
        });
      }

      return summary.get(iso2) || null;
    };

    networkAirports.forEach((airport) => {
      const entry = ensureCountry(airport.countryIso2, airport.countryName);
      if (entry) {
        entry.totalAirports += 1;
      }
    });

    passportData.airports.forEach((airport) => {
      const entry = ensureCountry(airport.countryIso2, airport.country);
      if (entry) {
        entry.visitedAirports += 1;
      }
    });

    return Array.from(summary.values()).sort((left, right) => {
      const visitedDiff = right.visitedAirports - left.visitedAirports;
      if (visitedDiff !== 0) return visitedDiff;
      const totalDiff = right.totalAirports - left.totalAirports;
      if (totalDiff !== 0) return totalDiff;
      return left.name.localeCompare(right.name);
    });
  }, [passportData.airports, networkAirports]);

  const selectedCountryIso2 = normalizeIso2(countryRouteIso2);
  const isCountryRoute = Boolean(selectedCountryIso2);

  const selectedCountry = useMemo(
    () => countrySummaries.find((item) => item.iso2 === selectedCountryIso2) || null,
    [countrySummaries, selectedCountryIso2]
  );

  const selectedVisitedAirports = useMemo(
    () => passportData.airports
      .filter((airport) => normalizeIso2(airport.countryIso2) === selectedCountryIso2)
      .sort((left, right) => right.visits - left.visits),
    [passportData.airports, selectedCountryIso2]
  );

  const selectedCountryNetworkAirports = useMemo(
    () => networkAirports.filter((airport) => normalizeIso2(airport.countryIso2) === selectedCountryIso2),
    [networkAirports, selectedCountryIso2]
  );

  const selectedNotVisitedAirports = useMemo(
    () => selectedCountryNetworkAirports.filter((airport) => {
      const icao = normalizeIcao(String(airport.icao || airport.code || ""));
      return Boolean(icao && !visitedIcaos.has(icao));
    }),
    [selectedCountryNetworkAirports, visitedIcaos]
  );

  const buildVisitedCityGroups = (airports: AirportVisit[], countryNameFallback: string): CityGroup[] => {
    const groups = new Map<string, CityGroup>();

    airports.forEach((airport) => {
      const icao = normalizeIcao(airport.icao);
      if (!icao) {
        return;
      }

      const city = resolveCityLabel(airport.city, airport.name, icao);
      const countryName = String(airport.country || countryNameFallback || "").trim() || countryNameFallback;
      const key = `${city.toLowerCase()}::${countryName.toLowerCase()}`;
      const existing = groups.get(key) || {
        key,
        city,
        countryName,
        airportCodes: [],
        airports: [],
        totalVisits: 0,
        totalAirports: 0,
      };

      if (!existing.airportCodes.includes(icao)) {
        existing.airportCodes.push(icao);
        existing.airports.push({ icao, name: String(airport.name || icao).trim() || icao });
        existing.totalAirports += 1;
      }
      existing.totalVisits += Number(airport.visits || 0);
      groups.set(key, existing);
    });

    return Array.from(groups.values()).sort((left, right) => {
      const visitsDiff = right.totalVisits - left.totalVisits;
      if (visitsDiff !== 0) return visitsDiff;
      return left.city.localeCompare(right.city);
    });
  };

  const buildNetworkCityGroups = (airports: NetworkAirport[], countryNameFallback: string): CityGroup[] => {
    const groups = new Map<string, CityGroup>();

    airports.forEach((airport) => {
      const icao = normalizeIcao(String(airport.icao || airport.code || ""));
      if (!icao) {
        return;
      }

      const city = resolveCityLabel(airport.city, airport.name, icao);
      const countryName = String(airport.countryName || countryNameFallback || "").trim() || countryNameFallback;
      const key = `${city.toLowerCase()}::${countryName.toLowerCase()}`;
      const existing = groups.get(key) || {
        key,
        city,
        countryName,
        airportCodes: [],
        airports: [],
        totalVisits: 0,
        totalAirports: 0,
      };

      if (!existing.airportCodes.includes(icao)) {
        existing.airportCodes.push(icao);
        existing.airports.push({ icao, name: String(airport.name || icao).trim() || icao });
        existing.totalAirports += 1;
      }
      groups.set(key, existing);
    });

    return Array.from(groups.values()).sort((left, right) => left.city.localeCompare(right.city));
  };

  const selectedVisitedCities = useMemo(
    () => buildVisitedCityGroups(selectedVisitedAirports, selectedCountry?.name || ""),
    [selectedCountry?.name, selectedVisitedAirports]
  );

  const selectedNotVisitedCities = useMemo(
    () => buildNetworkCityGroups(selectedNotVisitedAirports, selectedCountry?.name || ""),
    [selectedCountry?.name, selectedNotVisitedAirports]
  );

  useEffect(() => {
    setCityQuery("");
  }, [selectedCountryIso2]);

  const visitedCountries = useMemo(
    () => countrySummaries.filter((country) => country.visitedAirports > 0),
    [countrySummaries]
  );

  const notVisitedCountries = useMemo(
    () => countrySummaries.filter((country) => country.totalAirports > 0 && country.visitedAirports === 0),
    [countrySummaries]
  );

  const filteredVisitedCountries = useMemo(() => {
    if (countryFilter === "not-visited") {
      return [];
    }

    const query = countryQuery.trim().toLowerCase();
    return visitedCountries.filter((country) => {
      if (!query) {
        return true;
      }
      return matchesText(country.name, query) || matchesText(country.iso2, query);
    });
  }, [countryFilter, countryQuery, visitedCountries]);

  const filteredNotVisitedCountries = useMemo(() => {
    if (countryFilter === "visited") {
      return [];
    }

    const query = countryQuery.trim().toLowerCase();
    return notVisitedCountries.filter((country) => {
      if (!query) {
        return true;
      }
      return matchesText(country.name, query) || matchesText(country.iso2, query);
    });
  }, [countryFilter, countryQuery, notVisitedCountries]);

  const filteredVisitedCities = useMemo(() => {
    const query = cityQuery.trim().toLowerCase();
    return selectedVisitedCities.filter((group) => {
      if (!query) {
        return true;
      }
      return (
        matchesText(group.city, query) ||
        matchesText(group.countryName, query) ||
        group.airportCodes.some((code) => matchesText(code, query)) ||
        group.airports.some((airport) => matchesText(airport.name, query))
      );
    });
  }, [cityQuery, selectedVisitedCities]);

  const filteredNotVisitedCities = useMemo(() => {
    const query = cityQuery.trim().toLowerCase();
    return selectedNotVisitedCities.filter((group) => {
      if (!query) {
        return true;
      }
      return (
        matchesText(group.city, query) ||
        matchesText(group.countryName, query) ||
        group.airportCodes.some((code) => matchesText(code, query)) ||
        group.airports.some((airport) => matchesText(airport.name, query))
      );
    });
  }, [cityQuery, selectedNotVisitedCities]);

  const openCountryPage = (countryIso2: string) => {
    onOpenCountry?.(countryIso2);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-gray-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        {tr("Анализируем ваши рейсы...", "Analysing your flights...")}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-red-900/40 bg-red-950/30 p-8 text-center text-sm text-red-400">
        {error || tr("Данные недоступны", "Data unavailable")}
      </div>
    );
  }

  if (isCountryRoute && !selectedCountry) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[#1d1d1f]">{tr("Страна не найдена", "Country not found")}</h1>
            <p className="text-sm text-gray-500">{tr("Для этого кода страны пока нет данных в паспорте пилота.", "There is no passport data for this country code yet.")}</p>
          </div>
          {onBackToPassport ? (
            <Button variant="outline" onClick={onBackToPassport}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {tr("Назад к паспорту", "Back to passport")}
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  if (isCountryRoute && selectedCountry) {
    return (
      <div className="space-y-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex items-center gap-4">
            <CountryFlag iso2={selectedCountry.iso2} countryName={selectedCountry.name} className="h-12 w-16" fallbackText={selectedCountry.iso2} />
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{tr("Страница страны", "Country page")}</div>
              <h1 className="mt-1 text-3xl font-bold text-[#1d1d1f]">{selectedCountry.name}</h1>
              <p className="mt-1 text-sm text-slate-500">
                {tr(
                  "Список посещённых и не посещённых городов. Наведите на карточку, чтобы увидеть аэропорты.",
                  "Visited and not visited cities. Hover a card to see the airports."
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative min-w-[280px] flex-1 sm:flex-none">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={cityQuery}
                onChange={(event) => setCityQuery(event.target.value)}
                placeholder={tr("Поиск по городу, стране или ICAO", "Search by city, country or ICAO")}
                className="h-11 rounded-full border-slate-200 bg-white pl-10"
              />
            </div>
            {onBackToPassport ? (
              <Button variant="outline" onClick={onBackToPassport} className="h-11 rounded-full px-5">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {tr("Назад к карте", "Back to map")}
              </Button>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-400">{tr("Посещено городов", "Visited cities")}</div>
            <div className="mt-2 text-3xl font-bold text-slate-900">{selectedVisitedCities.length}</div>
          </div>
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-400">{tr("Городов в сети", "Cities in network")}</div>
            <div className="mt-2 text-3xl font-bold text-slate-900">{selectedVisitedCities.length + selectedNotVisitedCities.length}</div>
          </div>
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-400">{tr("Ещё не посетил", "Not visited yet")}</div>
            <div className="mt-2 text-3xl font-bold text-slate-900">{selectedNotVisitedCities.length}</div>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          <div className="rounded-[32px] border border-emerald-100 bg-[linear-gradient(180deg,#ffffff_0%,#f1fbf7_100%)] p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{tr("Посещённые города", "Visited cities")}</h2>
                <p className="text-xs text-slate-500">{tr("Города, в которых уже были отмечены PIREP", "Cities where you already have PIREPs")}</p>
              </div>
              <div className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">{filteredVisitedCities.length}</div>
            </div>

            <div className="space-y-3">
              {filteredVisitedCities.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-emerald-200 bg-white/70 px-4 py-6 text-sm text-slate-500">
                  {tr("Под выбранный поиск посещённых городов не найдено.", "No visited cities match your search.")}
                </div>
              ) : (
                filteredVisitedCities.map((group) => (
                  <PassportCityCard
                    key={group.key}
                    group={group}
                    title={`${group.totalVisits}×`}
                    description={tr(`Посещений: ${group.totalVisits}`, `Visits: ${group.totalVisits}`)}
                    accentClassName="border-emerald-200"
                  />
                ))
              )}
            </div>
          </div>

          <div className="rounded-[32px] border border-amber-100 bg-[linear-gradient(180deg,#ffffff_0%,#fff8ec_100%)] p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{tr("Ещё не посещены", "Not visited yet")}</h2>
                <p className="text-xs text-slate-500">{tr("Города сети, куда ещё можно слетать", "Network cities you can still visit")}</p>
              </div>
              <div className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">{filteredNotVisitedCities.length}</div>
            </div>

            <div className="space-y-3">
              {filteredNotVisitedCities.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-amber-200 bg-white/70 px-4 py-6 text-sm text-slate-500">
                  {tr("Под выбранный поиск не осталось новых городов.", "No unvisited cities match your search.")}
                </div>
              ) : (
                filteredNotVisitedCities.map((group) => (
                  <PassportCityCard
                    key={group.key}
                    group={group}
                    title={`${group.totalAirports} ICAO`}
                    description={tr("Доступно для следующего перелёта", "Available for your next flight")}
                    accentClassName="border-amber-200"
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-[#1d1d1f]">{tr("Паспорт пилота", "Pilot passport")}</h1>
        <p className="text-sm text-slate-500">
          {tr(
            "Один рабочий модуль карты: слева список стран, справа карта с переходом на отдельные страницы стран.",
            "One working map module: country list on the left, Leaflet map on the right, with dedicated country pages."
          )}
        </p>
      </div>

      <div className="overflow-hidden rounded-[36px] border border-[#d7e3f0] bg-white shadow-[0_32px_120px_rgba(15,23,42,0.10)]">
        <div className="flex min-h-[720px] flex-col md:flex-row">
          <aside
            className={`relative shrink-0 overflow-hidden border-b border-[#0f1e31] bg-[linear-gradient(180deg,#071321_0%,#09192d_100%)] text-white transition-all duration-300 md:border-r md:border-b-0 ${
              isCountryMenuOpen ? "md:w-[360px]" : "md:w-[76px]"
            } ${isCountryMenuOpen ? "max-md:max-h-[420px]" : "max-md:max-h-[76px]"}`}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
              <div className={`min-w-0 ${isCountryMenuOpen ? "opacity-100" : "opacity-0 md:hidden"}`}>
                <div className="text-[11px] uppercase tracking-[0.28em] text-white/45">{tr("Навигация", "Navigation")}</div>
                <div className="mt-1 text-base font-semibold">{tr("Страны и прогресс", "Countries and progress")}</div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setIsCountryMenuOpen((value) => !value)}
                className="h-10 w-10 rounded-full border border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white"
              >
                {isCountryMenuOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>
            </div>

            {isCountryMenuOpen ? (
              <div className="flex h-full flex-col">
                <div className="border-b border-white/10 px-4 py-4">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45" />
                    <Input
                      value={countryQuery}
                      onChange={(event) => setCountryQuery(event.target.value)}
                      placeholder={tr("Поиск страны или ISO", "Search country or ISO")}
                      className="h-11 rounded-full border-white/10 bg-white/5 pl-10 text-white placeholder:text-white/45"
                    />
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-[20px] border border-white/10 bg-white/5 px-3 py-3">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">{tr("Стран", "Countries")}</div>
                      <div className="mt-2 text-xl font-semibold">{countrySummaries.length}</div>
                    </div>
                    <div className="rounded-[20px] border border-white/10 bg-white/5 px-3 py-3">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">{tr("Посещено", "Visited")}</div>
                      <div className="mt-2 text-xl font-semibold text-emerald-300">{visitedCountries.length}</div>
                    </div>
                    <div className="rounded-[20px] border border-white/10 bg-white/5 px-3 py-3">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">{tr("Новых", "To visit")}</div>
                      <div className="mt-2 text-xl font-semibold text-amber-300">{notVisitedCountries.length}</div>
                    </div>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-auto px-3 py-4">
                  {filteredVisitedCountries.length > 0 ? (
                    <div className="mb-5">
                      <div className="mb-3 flex items-center justify-between px-2">
                        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300/80">{tr("Посещённые", "Visited")}</div>
                        <div className="text-[11px] text-white/40">{filteredVisitedCountries.length}</div>
                      </div>
                      <div className="space-y-2">
                        {filteredVisitedCountries.map((country) => (
                          <button
                            key={country.iso2}
                            type="button"
                            onClick={() => openCountryPage(country.iso2)}
                            className="flex w-full items-center gap-3 rounded-[24px] border border-emerald-500/20 bg-emerald-400/10 px-3 py-3 text-left transition hover:border-emerald-400/40 hover:bg-emerald-400/15"
                          >
                            <CountryFlag iso2={country.iso2} countryName={country.name} className="h-8 w-11 shrink-0 rounded-md" fallbackText={country.iso2} />
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-semibold text-white">{country.name}</div>
                              <div className="mt-0.5 text-xs text-white/60">
                                {country.visitedAirports} / {country.totalAirports} {tr("аэропортов", "airports")}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {filteredNotVisitedCountries.length > 0 ? (
                    <div>
                      <div className="mb-3 flex items-center justify-between px-2">
                        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-300/90">{tr("Ещё не посещены", "Not visited")}</div>
                        <div className="text-[11px] text-white/40">{filteredNotVisitedCountries.length}</div>
                      </div>
                      <div className="space-y-2">
                        {filteredNotVisitedCountries.map((country) => (
                          <button
                            key={country.iso2}
                            type="button"
                            onClick={() => openCountryPage(country.iso2)}
                            className="flex w-full items-center gap-3 rounded-[24px] border border-amber-400/20 bg-amber-300/10 px-3 py-3 text-left transition hover:border-amber-300/40 hover:bg-amber-300/15"
                          >
                            <CountryFlag iso2={country.iso2} countryName={country.name} className="h-8 w-11 shrink-0 rounded-md" fallbackText={country.iso2} />
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-semibold text-white">{country.name}</div>
                              <div className="mt-0.5 text-xs text-white/60">
                                {country.totalAirports} {tr("аэропортов сети", "network airports")}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : filteredVisitedCountries.length === 0 ? (
                    <div className="rounded-[24px] border border-dashed border-white/10 bg-white/5 px-4 py-6 text-sm text-white/55">
                      {tr("По текущему фильтру стран не найдено.", "No countries match the current filter.")}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="flex h-full min-h-[644px] flex-col items-center gap-5 px-3 py-6 max-md:hidden">
                <div className="rounded-full border border-white/10 bg-white/5 p-3">
                  <Globe className="h-5 w-5 text-white/70" />
                </div>
                <div className="rounded-[20px] border border-white/10 bg-white/5 px-3 py-3 text-center">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-white/40">{tr("Всего", "All")}</div>
                  <div className="mt-2 text-lg font-semibold text-white">{countrySummaries.length}</div>
                </div>
                <div className="rounded-[20px] border border-emerald-500/20 bg-emerald-400/10 px-3 py-3 text-center">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-emerald-200/70">{tr("Есть", "Done")}</div>
                  <div className="mt-2 text-lg font-semibold text-emerald-200">{visitedCountries.length}</div>
                </div>
                <div className="rounded-[20px] border border-amber-400/20 bg-amber-300/10 px-3 py-3 text-center">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-amber-200/70">{tr("План", "Next")}</div>
                  <div className="mt-2 text-lg font-semibold text-amber-200">{notVisitedCountries.length}</div>
                </div>
              </div>
            )}
          </aside>

          <div className="relative flex-1 bg-[linear-gradient(180deg,#eef5ff_0%,#d8e7ff_100%)]">
            <div className="absolute left-4 top-4 z-[500] flex flex-wrap gap-2">
              <div className="rounded-full border border-white/60 bg-white/80 px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur">
                {passportData.countryCount} {tr("стран посещено", "countries visited")}
              </div>
              <div className="rounded-full border border-white/60 bg-white/80 px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur">
                {passportData.uniqueAirports} {tr("аэропортов", "airports")}
              </div>
              <div className="rounded-full border border-white/60 bg-white/80 px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur">
                {passportData.totalFlights} {tr("рейсов", "flights")}
              </div>
            </div>

            <div className="absolute right-4 top-4 z-[500]">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="h-11 rounded-full border-white/70 bg-white/85 px-5 shadow-sm backdrop-blur hover:bg-white">
                    <Filter className="mr-2 h-4 w-4" />
                    {tr("Фильтры", "Filters")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-[240px] rounded-[24px] border-slate-200 p-3">
                  <div className="mb-2 px-1 text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{tr("Показать", "Show")}</div>
                  <div className="space-y-2">
                    {([
                      { value: "all", label: tr("Все страны", "All countries") },
                      { value: "visited", label: tr("Только посещённые", "Visited only") },
                      { value: "not-visited", label: tr("Только не посещённые", "Not visited only") },
                    ] as Array<{ value: CountryFilter; label: string }>).map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setCountryFilter(option.value)}
                        className={`flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left text-sm transition ${
                          countryFilter === option.value
                            ? "bg-[#081322] text-white"
                            : "bg-slate-50 text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        <span>{option.label}</span>
                        {countryFilter === option.value ? <span className="text-xs text-white/70">{tr("активен", "active")}</span> : null}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div className="h-full min-h-[720px] p-4">
              <PilotPassportMap
                countries={countrySummaries}
                selectedCountryIso2={null}
                countryNameByIso2={countryNameByIso2}
                onSelectCountry={openCountryPage}
                visibilityFilter={countryFilter}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}