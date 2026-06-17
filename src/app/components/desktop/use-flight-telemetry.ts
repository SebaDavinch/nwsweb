import { useEffect, useState } from "react";
import { useAuth } from "../../context/auth-context";
import { normalizeFlightPhase, type FlightPhase } from "../dashboard/flight-phase";

export interface FlightTelemetry {
  found: boolean;
  callsign: string;
  flightNumber: string;
  status: string;
  phase: FlightPhase | null;
  altitude: number | null;
  speed: number | null;
  heading: number | null;
  progress: number | null;
  currentLat: number | null;
  currentLon: number | null;
  departureLat: number | null;
  departureLon: number | null;
  arrivalLat: number | null;
  arrivalLon: number | null;
}

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

const EMPTY: FlightTelemetry = {
  found: false,
  callsign: "",
  flightNumber: "",
  status: "",
  phase: null,
  altitude: null,
  speed: null,
  heading: null,
  progress: null,
  currentLat: null,
  currentLon: null,
  departureLat: null,
  departureLon: null,
  arrivalLat: null,
  arrivalLon: null,
};

/** Live-телеметрия активного рейса пилота из /api/vamsys/flight-map. */
export function useFlightTelemetry(pollMs = 8000): FlightTelemetry {
  const { pilot } = useAuth();
  const [data, setData] = useState<FlightTelemetry>(EMPTY);

  useEffect(() => {
    if (!pilot) return;
    let active = true;
    const tick = async () => {
      try {
        const res = await fetch("/api/vamsys/flight-map", { credentials: "include" });
        if (!res.ok) return;
        const payload = (await res.json().catch(() => null)) as { flights?: Record<string, unknown>[] } | null;
        const mine = (payload?.flights || []).find((f) => String(f.pilotId ?? "") === String(pilot.id));
        if (!active) return;
        if (!mine) {
          setData(EMPTY);
          return;
        }
        const t: FlightTelemetry = {
          found: true,
          callsign: String(mine.callsign || mine.flightNumber || "").trim(),
          flightNumber: String(mine.flightNumber || mine.callsign || "").trim(),
          status: String(mine.status || "").trim(),
          phase: null,
          altitude: num(mine.altitude),
          speed: num(mine.speed),
          heading: num(mine.heading),
          progress: num(mine.progress),
          currentLat: num(mine.currentLat ?? mine.latitude ?? mine.lat),
          currentLon: num(mine.currentLon ?? mine.longitude ?? mine.lon),
          departureLat: num(mine.departureLat),
          departureLon: num(mine.departureLon),
          arrivalLat: num(mine.arrivalLat),
          arrivalLon: num(mine.arrivalLon),
        };
        t.phase = normalizeFlightPhase(t.status, t);
        setData(t);
      } catch {
        /* ignore */
      }
    };
    void tick();
    const id = window.setInterval(tick, pollMs);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, [pilot, pollMs]);

  return data;
}
