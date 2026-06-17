import { useEffect, useRef, useState } from "react";

export interface CompanyAirport {
  code: string;
  icao: string;
  iata: string;
  name: string;
  city: string;
  base: boolean;
  latitude: number | null;
  longitude: number | null;
}

/** Расстояние между двумя точками в морских милях (haversine). */
export function distanceNm(
  lat1?: number | null,
  lon1?: number | null,
  lat2?: number | null,
  lon2?: number | null
): number | null {
  const a1 = Number(lat1);
  const o1 = Number(lon1);
  const a2 = Number(lat2);
  const o2 = Number(lon2);
  if (![a1, o1, a2, o2].every(Number.isFinite)) return null;
  const R = 3440.065; // радиус Земли в nm
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(a2 - a1);
  const dLon = toRad(o2 - o1);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a1)) * Math.cos(toRad(a2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

let cache: CompanyAirport[] | null = null;

/** Каталог аэропортов компании (vAMSYS network) с координатами. Кэшируется на сессию. */
export function useCompanyAirports(): CompanyAirport[] {
  const [airports, setAirports] = useState<CompanyAirport[]>(cache || []);
  const loaded = useRef(Boolean(cache));

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    let active = true;
    fetch("/api/vamsys/dashboard/airports", { credentials: "include" })
      .then((r) => r.json().catch(() => null))
      .then((p) => {
        if (!active || !Array.isArray(p?.airports)) return;
        const list: CompanyAirport[] = p.airports
          .map((a: Record<string, unknown>) => ({
            code: String(a.code || a.icao || "").trim(),
            icao: String(a.icao || "").trim(),
            iata: String(a.iata || "").trim(),
            name: String(a.name || "").trim(),
            city: String(a.city || "").trim(),
            base: Boolean(a.base),
            latitude: a.latitude != null ? Number(a.latitude) : null,
            longitude: a.longitude != null ? Number(a.longitude) : null,
          }))
          .filter((a: CompanyAirport) => a.latitude != null && a.longitude != null);
        cache = list;
        setAirports(list);
      })
      .catch(() => null);
    return () => {
      active = false;
    };
  }, []);

  return airports;
}

export interface NearestAirport {
  airport: CompanyAirport;
  distanceNm: number;
}

export interface NearestAirportInfo {
  icao: string;
  iata: string | null;
  name: string;
  city: string | null;
  country: string | null;
  base: boolean;
  isCompany: boolean;
  distanceNm: number;
  lat: number;
  lon: number;
}

/** Поиск аэропорта по ICAO (мировая база, приоритет компании). Для ручного выбора диверта. */
export async function lookupAirport(icao: string): Promise<NearestAirportInfo | null> {
  const code = String(icao || "").trim().toUpperCase();
  if (!/^[A-Z]{4}$/.test(code)) return null;
  try {
    const r = await fetch(`/api/airports/lookup?icao=${code}`, { credentials: "include" });
    if (!r.ok) return null;
    const p = await r.json();
    return p?.airport ? { ...p.airport, distanceNm: 0 } : null;
  } catch {
    return null;
  }
}

/**
 * Ближайший аэропорт к точке через серверный поиск по мировой базе (OurAirports),
 * с приоритетом базы компании. Для диверта: точный пункт из всей базы мира.
 */
export async function fetchNearestAirport(
  lat: number | null,
  lon: number | null,
  exclude: string[] = []
): Promise<NearestAirportInfo | null> {
  if (lat == null || lon == null) return null;
  try {
    const params = new URLSearchParams({ lat: String(lat), lon: String(lon) });
    if (exclude.length) params.set("exclude", exclude.filter(Boolean).join(","));
    const r = await fetch(`/api/airports/nearest?${params.toString()}`, { credentials: "include" });
    if (!r.ok) return null;
    const p = await r.json();
    return p?.nearest || null;
  } catch {
    return null;
  }
}

/** Ближайший аэропорт компании к точке (опц. исключая некоторые ICAO — напр., вылет/прилёт). */
export function findNearestAirport(
  airports: CompanyAirport[],
  lat?: number | null,
  lon?: number | null,
  excludeIcao: string[] = []
): NearestAirport | null {
  if (lat == null || lon == null) return null;
  const exclude = new Set(excludeIcao.map((c) => String(c || "").trim().toUpperCase()).filter(Boolean));
  let best: NearestAirport | null = null;
  for (const a of airports) {
    const code = (a.icao || a.code).toUpperCase();
    if (exclude.has(code)) continue;
    const d = distanceNm(lat, lon, a.latitude, a.longitude);
    if (d == null) continue;
    if (!best || d < best.distanceNm) best = { airport: a, distanceNm: d };
  }
  return best;
}
