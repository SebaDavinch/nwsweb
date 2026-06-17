import { useEffect, useMemo, useState } from "react";
import { Globe, Plane, MapPin, Route, Loader2, BookMarked } from "lucide-react";
import { useLanguage } from "../../context/language-context";
import { getFlagUri, icaoToCountry } from "../dashboard/flag-data";

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
  uniqueAirports: number;
  countriesByYear?: Record<string, string[]>;
}

function Stat({ icon, value, label, accent }: { icon: React.ReactNode; value: string | number; label: string; accent: string }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
      <div className={`mb-2 inline-flex h-9 w-9 items-center justify-center rounded-xl ${accent}`}>{icon}</div>
      <div className="text-2xl font-black tracking-tight text-white">{value}</div>
      <div className="mt-0.5 text-[11px] uppercase tracking-wider text-slate-400">{label}</div>
    </div>
  );
}

export function AppPassport() {
  const { language } = useLanguage();
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);
  const [data, setData] = useState<PassportPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/pilot/passport", { credentials: "include" })
      .then((r) => r.json().catch(() => null))
      .then((p) => {
        if (active && p) setData(p as PassportPayload);
      })
      .catch(() => null)
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // name -> iso2 из аэропортов (для флагов), и счётчик аэропортов по стране
  const { iso2ByName, airportsByCountry } = useMemo(() => {
    const iso2ByName: Record<string, string> = {};
    const airportsByCountry: Record<string, number> = {};
    for (const a of data?.airports || []) {
      const name = String(a.country || "").trim();
      if (!name) continue;
      const iso2 = String(a.countryIso2 || "").trim().toLowerCase() || icaoToCountry(a.icao) || "";
      if (iso2) iso2ByName[name] = iso2;
      airportsByCountry[name] = (airportsByCountry[name] || 0) + 1;
    }
    return { iso2ByName, airportsByCountry };
  }, [data]);

  const flagFor = (name: string) => {
    const iso2 = iso2ByName[name];
    return iso2 ? getFlagUri(iso2) : "";
  };

  const topAirports = useMemo(
    () => [...(data?.airports || [])].sort((a, b) => b.visits - a.visits).slice(0, 8),
    [data]
  );

  const years = useMemo(() => {
    const byYear = data?.countriesByYear || {};
    return Object.keys(byYear).sort((a, b) => Number(b) - Number(a));
  }, [data]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      {/* Буклет паспорта — тёмная гамма Volanta (navy + фиолет/бирюза) */}
      <div className="overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-[#0f1530] via-[#141a38] to-[#1a1340] shadow-2xl">
        {/* Шапка */}
        <div className="relative flex items-center justify-between gap-4 border-b border-white/10 px-7 py-6">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-violet-500/20 blur-3xl" />
          <div className="pointer-events-none absolute -left-10 bottom-0 h-32 w-32 rounded-full bg-sky-500/15 blur-3xl" />
          <div className="relative flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-900/40">
              <BookMarked className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-violet-300/80">Nordwind Virtual</div>
              <h1 className="text-xl font-black tracking-tight text-white">{tr("Паспорт пилота", "Pilot Passport")}</h1>
            </div>
          </div>
          <div className="relative text-right">
            <div className="text-3xl font-black text-white">{data?.countryCount ?? 0}</div>
            <div className="text-[11px] uppercase tracking-wider text-slate-400">{tr("стран посещено", "countries visited")}</div>
          </div>
        </div>

        {/* Метрики */}
        <div className="grid grid-cols-2 gap-3 px-7 py-6 sm:grid-cols-4">
          <Stat icon={<Globe className="h-5 w-5 text-white" />} value={data?.countryCount ?? 0} label={tr("Страны", "Countries")} accent="bg-sky-500/30" />
          <Stat icon={<MapPin className="h-5 w-5 text-white" />} value={data?.uniqueAirports ?? 0} label={tr("Аэропорты", "Airports")} accent="bg-violet-500/30" />
          <Stat icon={<Plane className="h-5 w-5 text-white" />} value={data?.totalFlights ?? 0} label={tr("Рейсы", "Flights")} accent="bg-emerald-500/30" />
          <Stat icon={<Route className="h-5 w-5 text-white" />} value={data?.topRoutes?.length ?? 0} label={tr("Маршруты", "Routes")} accent="bg-amber-500/30" />
        </div>

        {/* Страны по годам */}
        {years.length > 0 ? (
          <div className="border-t border-white/10 px-7 py-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-300">{tr("Хроника посещений", "Travel chronicle")}</h2>
            <div className="space-y-5">
              {years.map((year) => {
                const list = data?.countriesByYear?.[year] || [];
                return (
                  <div key={year} className="flex gap-4">
                    <div className="w-12 shrink-0 pt-1 text-right text-lg font-black text-violet-300/70">{year}</div>
                    <div className="flex flex-1 flex-wrap gap-2">
                      {list.map((name) => {
                        const flag = flagFor(name);
                        return (
                          <div
                            key={`${year}-${name}`}
                            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2"
                          >
                            {flag ? (
                              <img src={flag} alt="" className="h-4 w-6 rounded-[2px] border border-black/20 object-cover" />
                            ) : (
                              <span className="h-4 w-6 rounded-[2px] bg-white/10" />
                            )}
                            <span className="text-sm font-medium text-white">{name}</span>
                            {airportsByCountry[name] ? (
                              <span className="rounded-full bg-white/10 px-1.5 text-[10px] font-semibold text-slate-300">
                                {airportsByCountry[name]}
                              </span>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* Любимые аэропорты + топ-маршруты */}
        <div className="grid grid-cols-1 gap-6 border-t border-white/10 px-7 py-6 lg:grid-cols-2">
          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-300">{tr("Частые аэропорты", "Frequent airports")}</h2>
            <div className="space-y-1.5">
              {topAirports.map((a) => (
                <div key={a.icao} className="flex items-center gap-2.5 rounded-xl bg-white/[0.03] px-3 py-2">
                  {flagFor(String(a.country || "")) ? (
                    <img src={flagFor(String(a.country || ""))} alt="" className="h-4 w-6 rounded-[2px] border border-black/20 object-cover" />
                  ) : (
                    <span className="h-4 w-6 rounded-[2px] bg-white/10" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-sm font-bold text-white">{a.icao}</div>
                    <div className="truncate text-xs text-slate-400">{a.city || a.name}</div>
                  </div>
                  <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-xs font-semibold text-violet-200">
                    {a.visits}
                  </span>
                </div>
              ))}
              {topAirports.length === 0 ? (
                <div className="text-sm text-slate-500">{tr("Нет данных", "No data")}</div>
              ) : null}
            </div>
          </div>

          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-300">{tr("Топ маршрутов", "Top routes")}</h2>
            <div className="space-y-1.5">
              {(data?.topRoutes || []).slice(0, 8).map((r) => (
                <div key={r.route} className="flex items-center gap-2 rounded-xl bg-white/[0.03] px-3 py-2">
                  <span className="font-mono text-sm font-bold text-white">{r.from}</span>
                  <Plane className="h-3.5 w-3.5 rotate-90 text-violet-400" />
                  <span className="font-mono text-sm font-bold text-white">{r.to}</span>
                  <span className="ml-auto rounded-full bg-sky-500/20 px-2 py-0.5 text-xs font-semibold text-sky-200">
                    {r.count}×
                  </span>
                </div>
              ))}
              {(data?.topRoutes || []).length === 0 ? (
                <div className="text-sm text-slate-500">{tr("Нет данных", "No data")}</div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
