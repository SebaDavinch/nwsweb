import { Card, CardContent } from "./ui/card";
import { Plane } from "lucide-react";
import { useLanguage } from "../context/language-context";
import { useEffect, useMemo, useState } from "react";
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
  const { t } = useLanguage();
  const [selectedAirline, setSelectedAirline] = useState<string>("");
  const [fleetData, setFleetData] = useState<AirlineFleet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

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
      if (nameMatch) {
        return nameMatch;
      }

      if (/^[A-Z]\d{2,4}[A-Z]?$/.test(compactCode)) {
        return compactCode;
      }

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
      if (mounted) {
        setIsLoading(true);
        setHasError(false);
      }

      try {
        const response = await fetch("/api/vamsys/fleet", { credentials: "include" });
        if (!response.ok) {
          throw new Error("fleet_fetch_failed");
        }

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
    return () => {
      mounted = false;
    };
  }, []);

  const currentFleet = useMemo(() => {
    return fleetData.find((airline) => airline.code === selectedAirline) || fleetData[0] || null;
  }, [fleetData, selectedAirline]);

  // Calculate statistics
  const totalAircraft = currentFleet?.aircraft.length || 0;
  const uniqueTypes = currentFleet ? [...new Set(currentFleet.aircraft.map((a) => a.model))].length : 0;
  const totalSeats = currentFleet ? currentFleet.aircraft.reduce((sum, a) => sum + a.seats, 0) : 0;

  return (
    <div>
      {/* Hero Section */}
      <section
        className="relative h-[400px] flex items-center justify-center text-white"
        style={{
          backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0.6)), url('https://images.unsplash.com/photo-1650502541642-0e83887eb4c2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxib2VpbmclMjBhaXJjcmFmdCUyMHJ1bndheXxlbnwxfHx8fDE3NzExODg0MTJ8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl mb-4">{t("fleet.hero.title")}</h1>
          <p className="text-xl text-gray-200">{t("fleet.hero.subtitle")}</p>
        </div>
      </section>

      {/* Airline Tabs */}
      <section className="py-8 bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {isLoading ? (
            <div className="text-center text-gray-500">Loading fleet data...</div>
          ) : null}
          {hasError ? (
            <div className="text-center text-red-600">Failed to load fleet from API.</div>
          ) : null}
          <div className="flex justify-center gap-4 flex-wrap">
            {fleetData.map((airline) => (
              <button
                key={airline.code}
                onClick={() => setSelectedAirline(airline.code)}
                className={`px-6 py-3 rounded-lg transition-all ${
                  selectedAirline === airline.code
                    ? "text-white shadow-lg"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
                style={{
                  backgroundColor: selectedAirline === airline.code ? airline.color : undefined,
                }}
              >
                <div className="font-medium">{airline.name}</div>
                <div className="text-sm opacity-90">{airline.code}</div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Fleet Stats */}
      <section className="py-12 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl text-center mb-6" style={{ color: currentFleet?.color || "#E31E24" }}>
            {currentFleet?.name || "Fleet"} {t("fleet.stats.title")}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <div className="text-3xl mb-2" style={{ color: currentFleet?.color || "#E31E24" }}>
                {totalAircraft}
              </div>
              <div className="text-gray-600">{t("fleet.stats.aircraft")}</div>
            </div>
            <div>
              <div className="text-3xl mb-2" style={{ color: currentFleet?.color || "#E31E24" }}>
                {uniqueTypes}
              </div>
              <div className="text-gray-600">{t("fleet.stats.types")}</div>
            </div>
            <div>
              <div className="text-3xl mb-2" style={{ color: currentFleet?.color || "#E31E24" }}>
                {totalSeats.toLocaleString()}
              </div>
              <div className="text-gray-600">{t("fleet.stats.seats")}</div>
            </div>
            <div>
              <div className="text-3xl mb-2" style={{ color: currentFleet?.color || "#E31E24" }}>
                —
              </div>
              <div className="text-gray-600">{t("fleet.stats.availability")}</div>
            </div>
          </div>
        </div>
      </section>

      {/* Aircraft List */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl mb-8 text-center">{t("fleet.list.title")}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(currentFleet?.aircraft || []).map((plane, index) => {
              const cardContent = (
                <Card className="h-full hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-xl mb-1">{plane.model}</h3>
                        <p className="text-gray-500">{plane.registration}</p>
                      </div>
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: currentFleet?.color || "#E31E24" }}
                      >
                        <Plane className="text-white" size={24} />
                      </div>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">{t("fleet.info.seats")}</span>
                        <span>{plane.seats}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">{t("fleet.info.range")}</span>
                        <span>{plane.range || "—"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">{t("fleet.info.speed")}</span>
                        <span>{plane.speed || "—"}</span>
                      </div>
                    </div>
                    {currentFleet?.id && plane.id ? (
                      <div className="mt-4 text-sm font-medium text-[#E31E24]">Open aircraft page →</div>
                    ) : null}
                  </CardContent>
                </Card>
              );

              if (currentFleet?.id && plane.id) {
                return (
                  <Link
                    key={String(plane.id || `${plane.registration}-${index}`)}
                    to={`/fleet/${currentFleet.id}/aircraft/${plane.id}`}
                    className="block"
                  >
                    {cardContent}
                  </Link>
                );
              }

              return <div key={String(plane.id || `${plane.registration}-${index}`)}>{cardContent}</div>;
            })}
          </div>
          {!isLoading && !hasError && !currentFleet?.aircraft?.length ? (
            <div className="text-center text-gray-500 mt-8">No fleet aircraft found.</div>
          ) : null}
        </div>
      </section>

      {/* Fleet Info */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl mb-6 text-center">{t("fleet.about.title")}</h2>
          <div className="prose max-w-none text-center">
            <p className="text-lg text-gray-700 mb-6">
              {t("fleet.about.p1")}
            </p>
            <p className="text-lg text-gray-700">
              {t("fleet.about.p2")}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
