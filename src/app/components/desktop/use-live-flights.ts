import { useEffect, useState } from "react";

export interface LiveFlightRow {
  id?: number | null;
  flightNumber?: string;
  callsign?: string;
  status?: string;
  pilot?: string;
  pilotId?: string | number | null;
  departure?: string;
  destination?: string;
  arrival?: string;
  airline?: string;
  pilotVaId?: string;
  altitude?: number | null;
  progress?: number | null;
}

export interface LiveFlightsSummary {
  flights: LiveFlightRow[];
  count: number;
  byVac: { NWS: number; KAR: number; STW: number; OTHER: number };
  loading: boolean;
}

function vacOf(row: LiveFlightRow): keyof LiveFlightsSummary["byVac"] {
  const hay = `${row.flightNumber || ""} ${row.callsign || ""} ${row.airline || ""} ${row.pilotVaId || ""}`.toUpperCase();
  if (hay.includes("KAR")) return "KAR";
  if (hay.includes("STW")) return "STW";
  if (hay.includes("NWS") || hay.includes("VNWS")) return "NWS";
  return "OTHER";
}

/** Лёгкий опрос всех активных рейсов для статус-бара (по умолчанию каждые 5с). */
export function useLiveFlights(pollMs = 5000): LiveFlightsSummary {
  const [flights, setFlights] = useState<LiveFlightRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await fetch("/api/vamsys/flight-map", { credentials: "include" });
        if (!res.ok) return;
        const payload = (await res.json().catch(() => null)) as { flights?: LiveFlightRow[] } | null;
        if (active && Array.isArray(payload?.flights)) setFlights(payload!.flights!);
      } catch {
        /* ignore */
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    const id = window.setInterval(load, pollMs);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, [pollMs]);

  const byVac = { NWS: 0, KAR: 0, STW: 0, OTHER: 0 };
  for (const f of flights) byVac[vacOf(f)] += 1;

  return { flights, count: flights.length, byVac, loading };
}
