import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { geoNaturalEarth1, geoPath, geoGraticule10, geoInterpolate } from "d3-geo";
import { feature } from "topojson-client";
import type { Topology, Objects } from "topojson-specification";
import worldLandAtlas from "world-atlas/land-110m.json";
import logo from "@/assets/99be6a8339eae76151119a13613864930c8bf6e7.png";

// ── Types ─────────────────────────────────────────────────────────────────────

type LL = [number, number]; // [lon, lat] — D3 convention

interface FlightData {
  callsign: string;
  departure: string;
  arrival: string;
  departureName: string;
  arrivalName: string;
  departureLat: number | null;
  departureLon: number | null;
  arrivalLat: number | null;
  arrivalLon: number | null;
  currentLat: number | null;
  currentLon: number | null;
  heading: number;
  altitude: number;
  speed: number;
  progress: number;
  telemetryTrack: Array<LL | { lat: number; lon: number; altitude?: number | null }>;
  eta: string | null;
  aircraft: string;
  network: string;
}

// ── Altitude colour (FR24-style) ───────────────────────────────────────────────

function altColor(ft: number): string {
  if (ft <= 0)     return "#9ca3af"; // ground / unknown
  if (ft < 5000)   return "#818cf8"; // low — purple
  if (ft < 15000)  return "#4ade80"; // climb — green
  if (ft < 28000)  return "#facc15"; // mid — yellow
  if (ft < 38000)  return "#f97316"; // high — orange
  return "#ef4444";                  // cruise — red
}

// ── Localisation (no app context — runs as standalone OBS source) ─────────────

const isBrowserRu = () => navigator.language.toLowerCase().startsWith("ru");

const i18n = {
  noFlight: () => isBrowserRu()
    ? "Нет активного полёта. Забронируй рейс в личном кабинете."
    : "No active flight. Book a flight in your pilot dashboard.",
  loading: () => isBrowserRu() ? "Загружаем данные…" : "Loading flight data…",
  noToken: () => isBrowserRu()
    ? "Добавь ?token= в URL. Получи ссылку в личном кабинете → Виджеты."
    : "Add ?token= to the URL. Get your link in Dashboard → Widgets.",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const toLL = (pt: LL | { lat: number; lon: number }): LL =>
  Array.isArray(pt) ? [pt[1], pt[0]] : [pt.lon, pt.lat];

const fmtAlt = (ft: number) => {
  if (!ft || ft <= 0) return "—";
  return ft >= 1000 ? `FL${Math.round(ft / 100)}` : `${Math.round(ft)} ft`;
};

const fmtSpd = (kts: number) => (kts > 0 ? `${Math.round(kts)} kts` : "—");

const fmtETA = (eta: string | null) => {
  if (!eta) return "—";
  try {
    const d = new Date(eta);
    if (isNaN(d.getTime())) return eta;
    return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")} UTC`;
  } catch { return eta; }
};

const gcPoints = (dep: LL, arr: LL, n = 120): LL[] => {
  const interp = geoInterpolate(dep, arr);
  return Array.from({ length: n + 1 }, (_, i) => interp(i / n) as LL);
};

const ptsToPath = (pts: LL[], proj: (ll: LL) => [number, number] | null): string =>
  pts.reduce((d, pt, i) => {
    const xy = proj(pt);
    if (!xy) return d;
    return d + (i === 0 ? `M${xy[0].toFixed(1)},${xy[1].toFixed(1)}` : `L${xy[0].toFixed(1)},${xy[1].toFixed(1)}`);
  }, "");

// ── World land (lazy — computed inside component, not at module level) ─────────

type WorldAtlas = Topology<Objects> & { objects: { land: Parameters<typeof feature>[1] } };

function getLandFeature() {
  try {
    return feature(
      worldLandAtlas as unknown as WorldAtlas,
      (worldLandAtlas as unknown as WorldAtlas).objects.land,
    );
  } catch {
    return null;
  }
}

const landFeature = getLandFeature();

// ── Sub-components ────────────────────────────────────────────────────────────

function Cell({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 min-w-[72px]">
      <div className="text-white/35 text-[10px] uppercase tracking-[0.15em]">{label}</div>
      <div
        className="font-semibold text-base tabular-nums"
        style={{ fontFamily: "var(--font-display)", color: color ?? "white" }}
      >
        {value}
      </div>
    </div>
  );
}

function NoFlight({ transparent }: { transparent: boolean }) {
  const bg = transparent ? "transparent" : "#04111e";
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-4" style={{ background: bg }}>
      <img src={logo} alt="Nordwind Virtual" className="h-10 opacity-30" />
      <div className="text-white/20 text-[11px] uppercase tracking-[0.2em]">Nordwind Virtual</div>
      <div className="text-white/40 text-sm text-center max-w-xs leading-relaxed px-4">
        {i18n.noFlight()}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function StreamFlightMap() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const callsign = params.get("callsign") ?? ""; // fallback
  const transparent = params.get("bg") === "transparent";
  const mapOnly = params.get("hud") === "0";

  const [flight, setFlight] = useState<FlightData | null>(null);
  const [noFlight, setNoFlight] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [size, setSize] = useState({ w: 1280, h: 720 });
  const containerRef = useRef<HTMLDivElement>(null);
  const trailRef = useRef<LL[]>([]);
  const [trailVersion, setTrailVersion] = useState(0);

  // Responsive sizing
  useEffect(() => {
    const update = () => {
      if (containerRef.current)
        setSize({ w: containerRef.current.clientWidth, h: containerRef.current.clientHeight });
    };
    update();
    const ro = new ResizeObserver(update);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Poll — 10 s (FR24-like)
  useEffect(() => {
    if (!token && !callsign) return;
    let alive = true;

    const poll = async () => {
      try {
        const url = token
          ? `/api/public/stream/flight-by-token?token=${encodeURIComponent(token)}`
          : `/api/public/stream/flight?callsign=${encodeURIComponent(callsign)}`;

        const res = await fetch(url);
        if (!res.ok) {
          const body = await res.json().catch(() => ({})) as { error?: string };
          if (alive) { setError(body.error ?? "Error"); setFlight(null); setNoFlight(false); }
          return;
        }
        const data = await res.json() as FlightData & { noFlight?: boolean };

        if (!alive) return;

        if (data.noFlight) { setNoFlight(true); setFlight(null); setError(null); return; }
        setNoFlight(false); setError(null);

        // Accumulate trail
        const fromApi: LL[] = data.telemetryTrack.map(toLL);
        if (fromApi.length > 0) {
          const last = trailRef.current[trailRef.current.length - 1];
          const fresh = fromApi.filter((p) => !last || p[0] !== last[0] || p[1] !== last[1]);
          if (fresh.length > 0) {
            trailRef.current = [...trailRef.current, ...fresh].slice(-600);
            setTrailVersion((v) => v + 1);
          }
        } else if (data.currentLat && data.currentLon) {
          const pt: LL = [data.currentLon, data.currentLat];
          const last = trailRef.current[trailRef.current.length - 1];
          if (!last || pt[0] !== last[0] || pt[1] !== last[1]) {
            trailRef.current = [...trailRef.current, pt].slice(-600);
            setTrailVersion((v) => v + 1);
          }
        }

        setFlight(data);
      } catch {
        if (alive) setError("Connection error");
      }
    };

    poll();
    const id = setInterval(poll, 10_000); // 10 s — FR24-like
    return () => { alive = false; clearInterval(id); };
  }, [token, callsign]);

  // ── Projection ───────────────────────────────────────────────────────────────

  const computed = useMemo(() => {
    if (!flight) return null;
    const { departureLon: dLon, departureLat: dLat, arrivalLon: aLon, arrivalLat: aLat, currentLon: cLon, currentLat: cLat } = flight;
    const depLL: LL | null = dLon != null && dLat != null ? [dLon, dLat] : null;
    const arrLL: LL | null = aLon != null && aLat != null ? [aLon, aLat] : null;
    const curLL: LL | null = cLon != null && cLat != null ? [cLon, cLat] : null;

    const keyLons = [depLL?.[0], arrLL?.[0]].filter((v): v is number => v != null);
    const keyLats = [depLL?.[1], arrLL?.[1]].filter((v): v is number => v != null);
    if (keyLons.length < 2) return null;

    const lonSpan = Math.max(...keyLons) - Math.min(...keyLons);
    const latSpan = Math.max(...keyLats) - Math.min(...keyLats);
    const padLon = Math.max(10, lonSpan * 0.38);
    const padLat = Math.max(10, latSpan * 0.38);
    const HUD = mapOnly ? 0 : 148;

    const proj = geoNaturalEarth1().fitExtent(
      [[24, 24], [size.w - 24, size.h - HUD - 12]],
      {
        type: "Polygon" as const,
        coordinates: [[[Math.min(...keyLons) - padLon, Math.min(...keyLats) - padLat], [Math.max(...keyLons) + padLon, Math.min(...keyLats) - padLat], [Math.max(...keyLons) + padLon, Math.max(...keyLats) + padLat], [Math.min(...keyLons) - padLon, Math.max(...keyLats) + padLat], [Math.min(...keyLons) - padLon, Math.min(...keyLats) - padLat]]],
      }
    );

    const projFn = (ll: LL) => proj(ll) as [number, number] | null;
    const pg = geoPath(proj);

    const fullArc = depLL && arrLL ? gcPoints(depLL, arrLL) : [];
    const split = Math.floor(fullArc.length * Math.min(1, flight.progress / 100));
    const remainArc = fullArc.slice(Math.max(0, split - 1));

    const trail = trailRef.current;
    const trailPath = ptsToPath(trail, projFn);
    const remainPath = ptsToPath(remainArc, projFn);

    return {
      depXY: depLL ? proj(depLL) : null,
      arrXY: arrLL ? proj(arrLL) : null,
      curXY: curLL ? proj(curLL) : null,
      trailPath,
      remainPath,
      landPath: landFeature ? (pg(landFeature) ?? "") : "",
      gratPath: pg(geoGraticule10()) ?? "",
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flight, size, mapOnly, trailVersion]);

  // ── Render ────────────────────────────────────────────────────────────────────

  const bg = transparent ? "transparent" : "#04111e";
  const { w, h } = size;
  const HUD = mapOnly ? 0 : 148;

  if (!token && !callsign) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-center px-6" style={{ background: bg }}>
        <img src={logo} alt="" className="h-8 opacity-30" />
        <div className="text-white/40 text-sm leading-relaxed">{i18n.noToken()}</div>
      </div>
    );
  }

  if (noFlight) return <NoFlight transparent={transparent} />;

  if (error && !flight) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-3" style={{ background: bg }}>
        <img src={logo} alt="" className="h-8 opacity-25" />
        <div className="text-white/35 text-sm">{error}</div>
      </div>
    );
  }

  if (!flight || !computed) {
    return (
      <div className="w-full h-full flex items-center justify-center" style={{ background: bg }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#E31E24] border-t-transparent rounded-full animate-spin" />
          <div className="text-white/30 text-[11px] uppercase tracking-widest">{i18n.loading()}</div>
        </div>
      </div>
    );
  }

  const { depXY, arrXY, curXY, trailPath, remainPath, landPath, gratPath } = computed;
  const heading = flight.heading ?? 0;
  const color = altColor(flight.altitude);

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden select-none" style={{ background: bg }}>

      {/* ── Map SVG ── */}
      <svg width={w} height={h - HUD} style={{ display: "block", position: "absolute", top: 0, left: 0 }}>
        <rect width={w} height={h} fill="#04111e" />
        <path d={gratPath} fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth={0.5} />
        <path d={landPath} fill="#0a2540" stroke="#163555" strokeWidth={0.7} />

        {/* Planned route */}
        {remainPath && (
          <path d={remainPath} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth={1.5} strokeDasharray="7 5" />
        )}

        {/* Flown trail — altitude colour */}
        {trailPath && (
          <path d={trailPath} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.85} />
        )}

        {/* Departure */}
        {depXY && (
          <g transform={`translate(${depXY[0]},${depXY[1]})`}>
            <circle r={5} fill={color} stroke="white" strokeWidth={1.5} />
            <text x={9} y={4} fill="white" fontSize={11} fontWeight={700} fontFamily="Oswald, sans-serif" letterSpacing={1.5}>
              {flight.departure}
            </text>
          </g>
        )}

        {/* Arrival — pulsing */}
        {arrXY && (
          <g transform={`translate(${arrXY[0]},${arrXY[1]})`}>
            <circle r={10} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth={1.5}>
              <animate attributeName="r" values="6;13;6" dur="2.4s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.7;0;0.7" dur="2.4s" repeatCount="indefinite" />
            </circle>
            <circle r={5} fill="white" stroke={color} strokeWidth={1.5} />
            <text x={9} y={4} fill="white" fontSize={11} fontWeight={700} fontFamily="Oswald, sans-serif" letterSpacing={1.5}>
              {flight.arrival}
            </text>
          </g>
        )}

        {/* Airplane — coloured by altitude */}
        {curXY && (
          <g transform={`translate(${curXY[0]},${curXY[1]}) rotate(${heading})`}>
            <circle r={18} fill={`${color}18`} />
            <path
              d="M0,-13 L3.5,-4 L13,1.5 L3.5,-0.5 L2,7 L4.5,9 L0,8 L-4.5,9 L-2,7 L-3.5,-0.5 L-13,1.5 L-3.5,-4 Z"
              fill={color}
              style={{ filter: `drop-shadow(0 0 6px ${color})` }}
            />
          </g>
        )}
      </svg>

      {/* ── HUD ── */}
      {!mapOnly && (
        <div
          className="absolute left-0 right-0 bottom-0 flex items-stretch border-t border-white/8"
          style={{
            height: HUD,
            background: "linear-gradient(to top, rgba(4,17,30,0.98) 60%, rgba(4,17,30,0.82))",
            backdropFilter: "blur(8px)",
          }}
        >
          {/* Route */}
          <div className="flex flex-col justify-center px-6 border-r border-white/8 min-w-[230px]">
            <div className="text-white/30 text-[10px] uppercase tracking-[0.2em] mb-1">Route</div>
            <div className="flex items-center gap-2">
              <span className="text-white font-bold text-xl" style={{ fontFamily: "var(--font-display)" }}>{flight.departure}</span>
              <svg width={28} height={10} viewBox="0 0 28 10" fill="none">
                <line x1="0" y1="5" x2="22" y2="5" stroke={color} strokeWidth={1.5} />
                <path d="M18 2L22 5L18 8" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-white font-bold text-xl" style={{ fontFamily: "var(--font-display)" }}>{flight.arrival}</span>
            </div>
            {(flight.departureName || flight.arrivalName) && (
              <div className="text-white/35 text-[11px] mt-0.5 truncate max-w-[210px]">
                {[flight.departureName, flight.arrivalName].filter(Boolean).join(" → ")}
              </div>
            )}
          </div>

          {/* Callsign + progress */}
          <div className="flex-1 flex flex-col justify-center items-center px-4 border-r border-white/8">
            <div className="text-white/30 text-[10px] uppercase tracking-[0.2em] mb-1">Flight</div>
            <div className="font-bold text-2xl tracking-[0.15em]" style={{ fontFamily: "var(--font-display)", color }}>
              {flight.callsign}
            </div>
            {flight.aircraft && <div className="text-white/30 text-[11px] mt-0.5">{flight.aircraft}</div>}
            <div className="mt-2.5 w-44 h-1 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{ width: `${Math.min(100, Math.max(0, flight.progress))}%`, backgroundColor: color }}
              />
            </div>
            <div className="text-white/20 text-[10px] mt-1">{Math.round(flight.progress)}%</div>
          </div>

          {/* Telemetry */}
          <div className="flex items-center gap-5 px-6 border-r border-white/8">
            <Cell label="Altitude" value={fmtAlt(flight.altitude)} color={color} />
            <Cell label="Speed" value={fmtSpd(flight.speed)} />
            <Cell label="HDG" value={heading > 0 ? `${Math.round(heading)}°` : "—"} />
            <Cell label="ETA" value={fmtETA(flight.eta)} />
          </div>

          {/* Logo */}
          <div className="flex items-center px-5">
            <img src={logo} alt="Nordwind Virtual" className="h-8 opacity-55" />
          </div>
        </div>
      )}

      {/* Network badge */}
      {flight.network && (
        <div className="absolute top-3 right-3 text-[10px] font-bold uppercase tracking-widest text-white/30 border border-white/8 px-2 py-0.5 rounded backdrop-blur-sm">
          {flight.network}
        </div>
      )}

      {/* Altitude legend dot */}
      {!mapOnly && (
        <div className="absolute top-3 left-3 flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }} />
          <span className="text-white/30 text-[10px]">{fmtAlt(flight.altitude)}</span>
        </div>
      )}
    </div>
  );
}
