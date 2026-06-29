import { Gauge, Plane, Users, Wind } from "lucide-react";
import { useLanguage } from "../context/language-context";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";

interface Aircraft {
  id?: number | string;
  model: string;
  registration: string;
  seats: number;
  range?: string;
  speed?: string;
}

interface AirlineFleet {
  id?: number | string;
  name: string;
  code: string;
  color: string;
  aircraft: Aircraft[];
}

type FleetApiAircraft = Record<string, unknown>;
type FleetApiFleet = Record<string, unknown> & {
  aircraft?: FleetApiAircraft[];
};

export function Fleet() {
  const { t, language } = useLanguage();
  const isRu = language === "ru";
  const tr = (ru: string, en: string) => (isRu ? ru : en);

  const [selectedAirline, setSelectedAirline] = useState<string>("");
  const [fleetData, setFleetData] = useState<AirlineFleet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const tabsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;

    const toFinite = (value: unknown) => {
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric : null;
    };

    const pickText = (...values: unknown[]) => {
      for (const value of values) {
        const text = String(value || "").trim();
        if (text) return text;
      }
      return "";
    };

    const normalizeAircraftTypeCode = (fleetName: unknown, fleetCode: unknown) => {
      const rawName = String(fleetName || "").toUpperCase();
      const compactName = rawName.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
      const compactCode = String(fleetCode || "").toUpperCase().replace(/[^A-Z0-9]/g, "").trim();

      const detectFromName = () => {
        if (/A321\s*NEO|A21N/.test(compactName)) return "A21N";
        if (/A321\s*-?\s*2?00|A321/.test(compactName)) return "A321";
        if (/A330\s*-?\s*200|A332/.test(compactName)) return "A332";
        if (/A330\s*-?\s*300|A333/.test(compactName)) return "A333";
        if (/737\s*MAX\s*8|B38M/.test(compactName)) return "B38M";
        if (/737\s*-?\s*900\s*ER|B739/.test(compactName)) return "B739";
        if (/737\s*-?\s*800|B738/.test(compactName)) return "B738";
        if (/777\s*-?\s*300\s*ER|B77W/.test(compactName)) return "B77W";
        if (/777\s*-?\s*200\s*ER|777\s*-?\s*200|B772/.test(compactName)) return "B772";
        if (/ERJ\s*-?\s*190|E190|E19\b/.test(compactName)) return "E190";
        return "";
      };

      const nameMatch = detectFromName();
      if (nameMatch) return nameMatch;
      if (/^[A-Z]\d{2,4}[A-Z]?$/.test(compactCode)) return compactCode;
      const fallback = (compactCode || compactName.replace(/[^A-Z0-9]/g, "")).slice(0, 4);
      return fallback || "NWS";
    };

    const formatRange = (item: FleetApiAircraft) => {
      const raw = toFinite(item?.range_nm ?? item?.range ?? item?.max_range ?? item?.flight_range);
      if (!raw) return "—";
      return `${Math.round(raw)} nm`;
    };

    const formatSpeed = (item: FleetApiAircraft) => {
      const raw = toFinite(item?.cruise_speed ?? item?.speed ?? item?.cruise ?? item?.max_speed);
      if (!raw) return "—";
      return `${Math.round(raw)} kt`;
    };

    const loadFleet = async () => {
      if (mounted) { setIsLoading(true); setHasError(false); }
      try {
        const response = await fetch("/api/vamsys/fleet", { credentials: "include" });
        if (!response.ok) throw new Error("fleet_fetch_failed");

        const payload = await response.json();
        const source = Array.isArray(payload?.fleets) ? payload.fleets : [];

        const normalized: AirlineFleet[] = source.map((fleet: FleetApiFleet) => ({
          id: fleet?.id,
          name: pickText(fleet?.name, fleet?.code, `Fleet ${fleet?.id || ""}`) || "Fleet",
          code: normalizeAircraftTypeCode(fleet?.name, fleet?.code),
          color: pickText(fleet?.color, "") || "#E31E24",
          aircraft: (Array.isArray(fleet?.aircraft) ? fleet.aircraft : []).map((item: FleetApiAircraft) => ({
            id: item?.id,
            model: pickText(item?.model, item?.name, item?.type, "Aircraft") || "Aircraft",
            registration: pickText(item?.registration, item?.tail, item?.ident, "—") || "—",
            seats: toFinite(item?.seats ?? item?.passengers ?? item?.max_pax) || 0,
            range: formatRange(item),
            speed: formatSpeed(item),
          })),
        }));

        if (!mounted) return;
        setFleetData(normalized);
        setSelectedAirline((prev) => prev || normalized[0]?.code || "");
      } catch {
        if (!mounted) return;
        setFleetData([]);
        setHasError(true);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    loadFleet();
    return () => { mounted = false; };
  }, []);

  const currentFleet = useMemo(
    () => fleetData.find((a) => a.code === selectedAirline) || fleetData[0] || null,
    [fleetData, selectedAirline]
  );

  const totalAircraft = currentFleet?.aircraft.length || 0;
  const uniqueTypes = currentFleet ? [...new Set(currentFleet.aircraft.map((a) => a.model))].length : 0;
  const totalSeats = currentFleet ? currentFleet.aircraft.reduce((sum, a) => sum + a.seats, 0) : 0;

  // Group aircraft by model for sectioned display
  const groupedAircraft = useMemo(() => {
    const groups: Record<string, Aircraft[]> = {};
    for (const ac of currentFleet?.aircraft || []) {
      if (!groups[ac.model]) groups[ac.model] = [];
      groups[ac.model].push(ac);
    }
    return Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
  }, [currentFleet]);

  const accentColor = currentFleet?.color || "#E31E24";

  return (
    <div className="bg-white dark:bg-gray-950">
      {/* ── Hero ── */}
      <section className="relative h-[480px] flex flex-col items-center justify-center text-white overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1650502541642-0e83887eb4c2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxib2VpbmclMjBhaXJjcmFmdCUyMHJ1bndheXxlbnwxfHx8fDE3NzExODg0MTJ8MA&ixlib=rb-4.1.0&q=80&w=1080')`,
          }}
        />
        {/* layered gradient: dark bottom + brand tint */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/40 to-black/80" />
        <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at 60% 40%, ${accentColor}22 0%, transparent 70%)` }} />

        <div className="relative z-10 max-w-3xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-sm text-white/80 mb-5">
            <Plane size={14} />
            <span>{tr("Nordwind Virtual • Флот", "Nordwind Virtual • Fleet")}</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-4">{t("fleet.hero.title")}</h1>
          <p className="text-lg text-white/70 max-w-xl mx-auto">{t("fleet.hero.subtitle")}</p>
        </div>

        {/* wave bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-16 overflow-hidden">
          <svg viewBox="0 0 1440 64" className="w-full h-full" preserveAspectRatio="none">
            <path d="M0,64 C360,0 1080,64 1440,0 L1440,64 Z" className="fill-white dark:fill-gray-950" />
          </svg>
        </div>
      </section>

      {/* ── Airline Tabs ── */}
      {fleetData.length > 1 && (
        <section className="sticky top-0 z-30 bg-white/95 dark:bg-gray-950/95 backdrop-blur border-b border-gray-100 dark:border-gray-800 shadow-sm">
          <div ref={tabsRef} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 overflow-x-auto scrollbar-none">
            <div className="flex items-center gap-1 py-3 min-w-max">
              {fleetData.map((airline) => {
                const active = selectedAirline === airline.code;
                return (
                  <button
                    key={airline.code}
                    onClick={() => setSelectedAirline(airline.code)}
                    className={`relative flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                      active
                        ? "text-white shadow-md"
                        : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800"
                    }`}
                    style={active ? { backgroundColor: airline.color } : undefined}
                  >
                    <span
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${active ? "bg-white/60" : ""}`}
                      style={!active ? { backgroundColor: airline.color } : undefined}
                    />
                    <span>{airline.name}</span>
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded-md ${
                        active ? "bg-white/20 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                      }`}
                    >
                      {airline.aircraft.length}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── Stats Strip ── */}
      <section className="py-10 border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {isLoading && (
            <div className="flex items-center justify-center gap-3 py-6 text-gray-400">
              <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-400 rounded-full animate-spin" />
              <span className="text-sm">{tr("Загрузка флота...", "Loading fleet...")}</span>
            </div>
          )}
          {hasError && (
            <div className="text-center py-4 text-red-500 text-sm">{tr("Не удалось загрузить данные флота.", "Failed to load fleet data.")}</div>
          )}
          {!isLoading && !hasError && currentFleet && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { icon: Plane, value: totalAircraft, label: t("fleet.stats.aircraft") },
                { icon: Wind, value: uniqueTypes, label: t("fleet.stats.types") },
                { icon: Users, value: totalSeats.toLocaleString(), label: t("fleet.stats.seats") },
                { icon: Gauge, value: "—", label: t("fleet.stats.availability") },
              ].map(({ icon: Icon, value, label }) => (
                <div
                  key={label}
                  className="relative group flex flex-col gap-2 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 overflow-hidden hover:border-gray-200 dark:hover:border-gray-700 transition-colors"
                >
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ background: `linear-gradient(135deg, ${accentColor}08, transparent)` }}
                  />
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: `${accentColor}18`, color: accentColor }}
                  >
                    <Icon size={18} />
                  </div>
                  <div className="text-3xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">{value}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Aircraft List ── */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-14">
          {groupedAircraft.map(([model, planes]) => (
            <div key={model}>
              {/* Model group header */}
              <div className="flex items-center gap-4 mb-6">
                <div
                  className="h-px flex-1"
                  style={{ background: `linear-gradient(to right, ${accentColor}60, transparent)` }}
                />
                <div className="flex items-center gap-2 px-4 py-1.5 rounded-full border text-sm font-semibold"
                  style={{ borderColor: `${accentColor}40`, color: accentColor, backgroundColor: `${accentColor}0d` }}
                >
                  <Plane size={13} />
                  <span>{model}</span>
                  <span className="ml-1 opacity-60">× {planes.length}</span>
                </div>
                <div className="h-px flex-1 bg-gray-100 dark:bg-gray-800" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {planes.map((plane, index) => {
                  const card = (
                    <div
                      className="group relative flex flex-col bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden hover:shadow-lg dark:hover:shadow-gray-900/60 transition-all duration-200 hover:-translate-y-0.5"
                    >
                      {/* top accent bar */}
                      <div className="h-1 w-full" style={{ backgroundColor: accentColor }} />

                      <div className="p-5 flex flex-col gap-4 flex-1">
                        {/* header */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div
                              className="text-xs font-semibold uppercase tracking-widest mb-1"
                              style={{ color: accentColor }}
                            >
                              {currentFleet?.name}
                            </div>
                            <div className="text-base font-bold text-gray-900 dark:text-gray-100 leading-tight truncate">
                              {plane.model}
                            </div>
                          </div>
                          <div
                            className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center"
                            style={{ backgroundColor: `${accentColor}18`, color: accentColor }}
                          >
                            <Plane size={16} />
                          </div>
                        </div>

                        {/* registration badge */}
                        <div className="inline-flex self-start items-center gap-1.5 px-2.5 py-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
                          <span className="text-xs text-gray-400 dark:text-gray-500">{tr("Рег.", "Reg.")}</span>
                          <span className="text-xs font-mono font-semibold text-gray-700 dark:text-gray-300 tracking-wider">
                            {plane.registration}
                          </span>
                        </div>

                        {/* specs */}
                        <div className="mt-auto grid grid-cols-3 gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
                          <div className="flex flex-col items-center gap-1">
                            <Users size={12} className="text-gray-400" />
                            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 tabular-nums">{plane.seats || "—"}</span>
                            <span className="text-[10px] text-gray-400 uppercase tracking-wide leading-none">{tr("Мест", "Seats")}</span>
                          </div>
                          <div className="flex flex-col items-center gap-1">
                            <Wind size={12} className="text-gray-400" />
                            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 tabular-nums">{plane.range || "—"}</span>
                            <span className="text-[10px] text-gray-400 uppercase tracking-wide leading-none">{tr("Дальн.", "Range")}</span>
                          </div>
                          <div className="flex flex-col items-center gap-1">
                            <Gauge size={12} className="text-gray-400" />
                            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 tabular-nums">{plane.speed || "—"}</span>
                            <span className="text-[10px] text-gray-400 uppercase tracking-wide leading-none">{tr("Скор.", "Speed")}</span>
                          </div>
                        </div>
                      </div>

                      {/* link hint */}
                      {currentFleet?.id && plane.id && (
                        <div
                          className="px-5 py-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs font-medium"
                          style={{ color: accentColor }}
                        >
                          <span>{tr("Открыть страницу борта", "View aircraft page")}</span>
                          <span className="group-hover:translate-x-0.5 transition-transform">→</span>
                        </div>
                      )}
                    </div>
                  );

                  if (currentFleet?.id && plane.id) {
                    return (
                      <Link
                        key={String(plane.id || `${plane.registration}-${index}`)}
                        to={`/fleet/${currentFleet.id}/aircraft/${plane.id}`}
                        className="block"
                      >
                        {card}
                      </Link>
                    );
                  }

                  return <div key={String(plane.id || `${plane.registration}-${index}`)}>{card}</div>;
                })}
              </div>
            </div>
          ))}

          {!isLoading && !hasError && !currentFleet?.aircraft?.length && (
            <div className="text-center py-20 text-gray-400">
              {tr("Воздушные суда не найдены.", "No aircraft found.")}
            </div>
          )}
        </div>
      </section>

      {/* ── About ── */}
      <section className="py-20 bg-gray-50 dark:bg-gray-900/50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium mb-6"
            style={{ backgroundColor: `${accentColor}15`, color: accentColor }}
          >
            <Plane size={13} />
            <span>{t("fleet.about.title")}</span>
          </div>
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-5 leading-relaxed">{t("fleet.about.p1")}</p>
          <p className="text-lg text-gray-600 dark:text-gray-400 leading-relaxed">{t("fleet.about.p2")}</p>
        </div>
      </section>
    </div>
  );
}
