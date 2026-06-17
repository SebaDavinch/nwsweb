import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plane, User, Heart, X } from "lucide-react";
import { LiveMap, type Flight, type ScreenshotPin } from "../live-map";
import { useLanguage } from "../../context/language-context";
import { useAuth } from "../../context/auth-context";

function num(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function str(value: unknown, fallback = "—"): string {
  const s = String(value ?? "").trim();
  return s || fallback;
}

/** Грубое определение ВАК по номеру рейса/авиакомпании (только для цвета маркера). */
function deriveVac(row: Record<string, unknown>): Flight["vac"] {
  const hay = `${row.flightNumber || ""} ${row.callsign || ""} ${row.airline || ""} ${row.pilotVaId || ""}`.toUpperCase();
  if (hay.includes("KAR")) return "KAR";
  if (hay.includes("STW")) return "STW";
  return "NWS";
}

const VAC_COLOR: Record<string, string> = { NWS: "#E31E24", KAR: "#2563eb", STW: "#ea580c" };

function mapFlight(item: unknown): Flight {
  const row = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
  const rawTrack = Array.isArray(row.telemetryTrack) ? row.telemetryTrack : [];
  return {
    id: num(row.id),
    flightNumber: str(row.flightNumber || row.callsign),
    departure: str(row.departure),
    departureCity: str(row.departureCity || row.departure_city || row.departure),
    destination: str(row.destination || row.arrival),
    destinationCity: str(row.destinationCity || row.arrivalCity || row.destination || row.arrival),
    status: str(row.status, "En Route"),
    pilot: str(row.pilot),
    pilotId: str(row.pilotId, "—"),
    aircraft: str(row.aircraft),
    progress: Math.max(0, Math.min(100, num(row.progress) ?? 0)),
    vac: deriveVac(row),
    heading: num(row.heading),
    speed: num(row.speed),
    altitude: num(row.altitude),
    currentLat: num(row.currentLat ?? row.latitude ?? row.lat),
    currentLon: num(row.currentLon ?? row.longitude ?? row.lon),
    passengers: num(row.passengers),
    aircraftRegistration: str(row.aircraftRegistration || row.registration || row.tail, "") || undefined,
    network: str(row.network, "") || undefined,
    hasLiveTelemetry: Boolean(row.hasLiveTelemetry),
    telemetryTrack: rawTrack as Flight["telemetryTrack"],
    departureLat: num(row.departureLat),
    departureLon: num(row.departureLon),
    arrivalLat: num(row.arrivalLat),
    arrivalLon: num(row.arrivalLon),
  };
}

const flightKey = (f: Flight) => `${f.flightNumber}|${f.pilotId}`;

function fmtAlt(alt?: number | null) {
  if (!Number.isFinite(Number(alt))) return null;
  const a = Number(alt);
  return a >= 1000 ? `FL${Math.round(a / 100)}` : `${Math.round(a)} ft`;
}

export function HubMap() {
  const { language } = useLanguage();
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);
  const { pilot } = useAuth();
  const [flights, setFlights] = useState<Flight[]>([]);
  const [selected, setSelected] = useState<Flight | null>(null);
  const [pins, setPins] = useState<ScreenshotPin[]>([]);
  const [lightbox, setLightbox] = useState<ScreenshotPin | null>(null);
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const selectedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await fetch("/api/vamsys/flight-map", { credentials: "include" });
        if (!res.ok) return;
        const payload = (await res.json().catch(() => null)) as { flights?: unknown[] } | null;
        if (!active || !Array.isArray(payload?.flights)) return;
        const mapped = payload!.flights!.map(mapFlight);
        setFlights(mapped);
        if (selectedKeyRef.current) {
          const next = mapped.find((f) => flightKey(f) === selectedKeyRef.current);
          if (next) setSelected(next);
        }
      } catch {
        /* ignore */
      }
    };
    void load();
    const id = window.setInterval(load, 2000);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, []);

  // Гео-метки скриншотов (живут 30 мин на сервере)
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await fetch("/api/pilot/screenshot-pins", { credentials: "include" });
        if (!res.ok) return;
        const payload = (await res.json().catch(() => null)) as { pins?: ScreenshotPin[] } | null;
        if (active && Array.isArray(payload?.pins)) setPins(payload!.pins!);
      } catch {
        /* ignore */
      }
    };
    void load();
    const id = window.setInterval(load, 10000);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, []);

  const likePin = async (pin: ScreenshotPin) => {
    if (!pin.id || liked.has(pin.id) || !pin.mediaId) return;
    setLiked((prev) => new Set(prev).add(pin.id));
    await fetch(`/api/pilot/social-gallery/media/${encodeURIComponent(pin.mediaId)}/like`, {
      method: "POST",
      credentials: "include",
    }).catch(() => null);
  };

  const ageLabel = (ms?: number) => {
    const m = Math.max(0, Math.round((Number(ms) || 0) / 60000));
    return m < 1 ? tr("только что", "just now") : tr(`${m} мин назад`, `${m} min ago`);
  };

  // мемоизация: без неё новая ссылка на каждый рендер → marker-эффект LiveMap
  // пересоздаёт все маркеры каждые 2с и клик не успевает сработать.
  const handleSelect = useCallback((flight: Flight) => {
    selectedKeyRef.current = flightKey(flight);
    setSelected(flight);
  }, []);
  const handleClose = useCallback(() => {
    selectedKeyRef.current = null;
    setSelected(null);
  }, []);

  const sorted = useMemo(
    () =>
      [...flights].sort((a, b) => {
        // мои рейсы — наверх, затем по номеру
        const am = String(a.pilotId) === String(pilot?.id) ? 0 : 1;
        const bm = String(b.pilotId) === String(pilot?.id) ? 0 : 1;
        if (am !== bm) return am - bm;
        return a.flightNumber.localeCompare(b.flightNumber);
      }),
    [flights, pilot?.id]
  );

  return (
    <div className="flex h-full">
      {/* Список участников в воздухе */}
      <aside className="nws-scroll-hover flex w-72 shrink-0 flex-col overflow-hidden border-r border-zinc-200 bg-zinc-50 dark:border-white/5 dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2.5 dark:border-white/5">
          <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
            {tr("В воздухе сейчас", "Airborne now")}
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            {flights.length}
          </span>
        </div>

        <div className="nws-scroll-hover flex-1 overflow-y-auto">
          {flights.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <Plane className="h-7 w-7 text-zinc-300 dark:text-zinc-600" />
              <span className="text-xs text-zinc-400 dark:text-zinc-500">{tr("Нет активных рейсов", "No active flights")}</span>
            </div>
          ) : (
            sorted.map((f) => {
              const isSel = selectedKeyRef.current === flightKey(f);
              const isMine = String(f.pilotId) === String(pilot?.id);
              const color = VAC_COLOR[f.vac] || "#6b7280";
              return (
                <button
                  key={flightKey(f)}
                  type="button"
                  onClick={() => handleSelect(f)}
                  className={[
                    "flex w-full items-stretch gap-2.5 border-b border-zinc-100 px-3 py-2.5 text-left transition-colors dark:border-white/5",
                    isSel
                      ? "bg-red-50 dark:bg-red-500/10"
                      : "hover:bg-zinc-100 dark:hover:bg-white/5",
                  ].join(" ")}
                >
                  <span className="mt-0.5 w-1 shrink-0 rounded-full" style={{ background: color }} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                        {f.flightNumber}
                      </span>
                      {isMine ? (
                        <span className="rounded bg-red-500 px-1 py-0.5 text-[9px] font-bold uppercase text-white">
                          {tr("вы", "you")}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                      <User className="h-3 w-3 shrink-0" />
                      <span className="truncate">{f.pilot}</span>
                    </div>
                    <div className="mt-0.5 truncate font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                      {f.departure} → {f.destination}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end justify-between text-right">
                    <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">{f.status}</span>
                    {fmtAlt(f.altitude) ? (
                      <span className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-300">{fmtAlt(f.altitude)}</span>
                    ) : null}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* Карта */}
      <div className="relative min-w-0 flex-1">
        <LiveMap
          flights={flights}
          selectedFlight={selected}
          onFlightSelect={handleSelect}
          onCloseDetail={handleClose}
          screenshotPins={pins}
          onPinClick={(p) => setLightbox(p)}
          className="relative h-full w-full bg-[#0d1117]"
        />

        {/* Лайтбокс гео-скриншота с лайком */}
        {lightbox ? (
          <div
            className="absolute inset-0 z-[1000] flex items-center justify-center bg-black/70 p-6"
            onClick={() => setLightbox(null)}
          >
            <div
              className="relative max-h-full w-full max-w-2xl overflow-hidden rounded-2xl bg-zinc-900 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setLightbox(null)}
                className="absolute right-2 top-2 z-10 rounded-full bg-black/50 p-1.5 text-white hover:bg-black/70"
              >
                <X className="h-4 w-4" />
              </button>
              {lightbox.assetUrl ? (
                <img src={lightbox.assetUrl} alt={lightbox.title || ""} className="max-h-[70vh] w-full object-contain" />
              ) : null}
              <div className="flex items-center justify-between gap-3 p-4">
                <div>
                  <div className="text-sm font-semibold text-zinc-100">
                    {lightbox.pilotName}
                    {lightbox.callsign ? <span className="ml-1 text-zinc-400">· {lightbox.callsign}</span> : null}
                  </div>
                  <div className="text-xs text-zinc-400">{ageLabel(lightbox.ageMs)}</div>
                </div>
                <button
                  type="button"
                  onClick={() => void likePin(lightbox)}
                  disabled={liked.has(lightbox.id) || !lightbox.mediaId}
                  className={[
                    "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                    liked.has(lightbox.id)
                      ? "bg-red-500 text-white"
                      : "bg-white/10 text-zinc-200 hover:bg-white/20",
                  ].join(" ")}
                >
                  <Heart className={`h-4 w-4 ${liked.has(lightbox.id) ? "fill-current" : ""}`} />
                  {liked.has(lightbox.id) ? tr("Нравится", "Liked") : tr("Лайк", "Like")}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
