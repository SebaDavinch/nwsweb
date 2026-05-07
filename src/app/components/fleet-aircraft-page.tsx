import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft, Gauge, Plane, Users } from "lucide-react";
import { useLanguage } from "../context/language-context";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";

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

const normalizeFleetPayload = (payload: unknown): AirlineFleet[] => {
  const source = Array.isArray((payload as { fleets?: FleetApiFleet[] } | null)?.fleets)
    ? ((payload as { fleets?: FleetApiFleet[] }).fleets || [])
    : [];

  return source.map((fleet: FleetApiFleet) => ({
    id: String(fleet?.id || "").trim() || undefined,
    name: pickText(fleet?.name, fleet?.code, `Fleet ${fleet?.id || ""}`) || "Fleet",
    code: normalizeAircraftTypeCode(fleet?.name, fleet?.code),
    color: pickText(fleet?.color, "") || "#E31E24",
    aircraft: (Array.isArray(fleet?.aircraft) ? fleet.aircraft : []).map((item: FleetApiAircraft) => ({
      id: String(item?.id || "").trim() || undefined,
      model: pickText(item?.model, item?.name, item?.type, "Aircraft") || "Aircraft",
      registration: pickText(item?.registration, item?.tail, item?.ident, "—") || "—",
      seats: toFinite(item?.seats ?? item?.passengers ?? item?.max_pax) || 0,
      range: formatRange(item),
      speed: formatSpeed(item),
    })),
  }));
};

export function FleetAircraftPage() {
  const { fleetId, aircraftId } = useParams();
  const { language, t } = useLanguage();
  const isRu = language === "ru";
  const tr = (ru: string, en: string) => (isRu ? ru : en);

  const [fleetData, setFleetData] = useState<AirlineFleet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let mounted = true;

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
        if (!mounted) return;
        setFleetData(normalizeFleetPayload(payload));
      } catch {
        if (!mounted) return;
        setFleetData([]);
        setHasError(true);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    void loadFleet();
    return () => {
      mounted = false;
    };
  }, []);

  const fleet = useMemo(
    () => fleetData.find((item) => String(item.id || "") === String(fleetId || "")) || null,
    [fleetData, fleetId]
  );

  const aircraft = useMemo(
    () => fleet?.aircraft.find((item) => String(item.id || "") === String(aircraftId || "")) || null,
    [fleet, aircraftId]
  );

  if (isLoading) {
    return <div className="mx-auto max-w-5xl px-4 py-20 text-center text-gray-500">{tr("Загружаем самолёт...", "Loading aircraft...")}</div>;
  }

  if (hasError) {
    return <div className="mx-auto max-w-5xl px-4 py-20 text-center text-red-600">{tr("Не удалось загрузить страницу самолёта.", "Failed to load aircraft page.")}</div>;
  }

  if (!fleet || !aircraft) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-20 text-center">
        <div className="text-lg font-semibold text-gray-900">{tr("Самолёт не найден", "Aircraft not found")}</div>
        <div className="mt-2 text-sm text-gray-500">{tr("Проверьте ссылку или вернитесь к списку флота.", "Check the link or return to the fleet list.")}</div>
        <div className="mt-6">
          <Button asChild>
            <Link to="/fleet">{tr("Назад к флоту", "Back to fleet")}</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 py-10">
      <div className="mx-auto max-w-5xl space-y-6 px-4 sm:px-6 lg:px-8">
        <Button asChild variant="outline" className="bg-white">
          <Link to="/fleet">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {tr("К списку флота", "Back to fleet")}
          </Link>
        </Button>

        <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#111111] to-[#2b2b2f] p-8 text-white shadow-xl">
          <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm uppercase tracking-[0.28em] text-white/50">{fleet.name}</div>
              <h1 className="mt-3 text-4xl font-bold">{aircraft.model}</h1>
              <p className="mt-3 text-lg text-white/70">{tr("Регистрация", "Registration")}: {aircraft.registration}</p>
            </div>
            <div
              className="flex h-24 w-24 items-center justify-center rounded-3xl shadow-lg"
              style={{ backgroundColor: fleet.color || "#E31E24" }}
            >
              <Plane className="h-12 w-12 text-white" />
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-none shadow-sm">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="rounded-2xl bg-[#E31E24]/10 p-3 text-[#E31E24]"><Users className="h-5 w-5" /></div>
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-500">{t("fleet.info.seats")}</div>
                <div className="text-2xl font-bold text-gray-900">{aircraft.seats || "—"}</div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="rounded-2xl bg-[#E31E24]/10 p-3 text-[#E31E24]"><Plane className="h-5 w-5" /></div>
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-500">{t("fleet.info.range")}</div>
                <div className="text-2xl font-bold text-gray-900">{aircraft.range || "—"}</div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="rounded-2xl bg-[#E31E24]/10 p-3 text-[#E31E24]"><Gauge className="h-5 w-5" /></div>
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-500">{t("fleet.info.speed")}</div>
                <div className="text-2xl font-bold text-gray-900">{aircraft.speed || "—"}</div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-none shadow-sm">
          <CardContent className="space-y-4 p-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{tr("Информация о самолёте", "Aircraft information")}</h2>
              <p className="mt-1 text-sm text-gray-500">
                {tr(
                  "Отдельная страница самолёта позволяет быстро открыть конкретный борт из общего списка флота.",
                  "This dedicated page lets you open a specific aircraft directly from the public fleet list."
                )}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-gray-50 p-4">
                <div className="text-xs uppercase tracking-wide text-gray-500">{tr("Флот", "Fleet")}</div>
                <div className="mt-1 text-base font-semibold text-gray-900">{fleet.name}</div>
              </div>
              <div className="rounded-2xl bg-gray-50 p-4">
                <div className="text-xs uppercase tracking-wide text-gray-500">{tr("Код", "Code")}</div>
                <div className="mt-1 text-base font-semibold text-gray-900">{fleet.code}</div>
              </div>
              <div className="rounded-2xl bg-gray-50 p-4">
                <div className="text-xs uppercase tracking-wide text-gray-500">{tr("Модель", "Model")}</div>
                <div className="mt-1 text-base font-semibold text-gray-900">{aircraft.model}</div>
              </div>
              <div className="rounded-2xl bg-gray-50 p-4">
                <div className="text-xs uppercase tracking-wide text-gray-500">{tr("Регистрация", "Registration")}</div>
                <div className="mt-1 text-base font-semibold text-gray-900">{aircraft.registration}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}