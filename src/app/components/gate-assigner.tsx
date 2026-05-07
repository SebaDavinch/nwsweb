import { useCallback, useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Building2, Loader2, Plane, RefreshCw } from "lucide-react";
import { useLanguage } from "../context/language-context";

interface AirportInfo {
  icao: string;
  name: string;
  lat: number;
  lng: number;
  city: string;
}

interface GateInfo {
  id: string;
  lat: number;
  lng: number;
  ref: string;
  name: string;
  type: string;
  occupants: PilotInfo[];
}

interface PilotInfo {
  callsign: string;
  cid: number;
  lat: number;
  lng: number;
  groundspeed: number;
  aircraft: string | null;
  departure: string | null;
  arrival: string | null;
  airline: { code: string; label: string; color: string } | null;
  nearestGate: { id: string; ref: string; name: string } | null;
  nearestGateDist: number | null;
}

interface GatesPayload {
  icao: string;
  airport: { name: string; lat: number; lng: number; city: string };
  gates: GateInfo[];
  groundPilots: PilotInfo[];
  stats: { total: number; byAirline: Record<string, number> };
  fetchedAt: number;
}

const AIRLINE_COLORS: Record<string, string> = {
  NWS: "#E31E24",
  IKS: "#FF6B35",
  SWV: "#2563EB",
};

const AIRLINE_LABELS: Record<string, string> = {
  NWS: "Nordwind",
  IKS: "Ikar",
  SWV: "Southwind",
};

export function GateAssigner() {
  const { language } = useLanguage();
  const isRu = language === "ru";
  const tr = (ru: string, en: string) => (isRu ? ru : en);

  const [airports, setAirports] = useState<AirportInfo[]>([]);
  const [selectedIcao, setSelectedIcao] = useState<string>("");
  const [data, setData] = useState<GatesPayload | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingAirports, setIsLoadingAirports] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "NWS" | "IKS" | "SWV">("all");
  const [autoRefresh, setAutoRefresh] = useState(true);

  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.Layer[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const resp = await fetch("/api/public/gates");
        const payload = resp.ok ? await resp.json() : null;
        const list: AirportInfo[] = Array.isArray(payload?.airports) ? payload.airports : [];
        setAirports(list);
        if (list.length > 0) setSelectedIcao(list[0].icao);
      } catch { /* ignore */ } finally {
        setIsLoadingAirports(false);
      }
    };
    void load();
  }, []);

  const fetchData = useCallback(async (icao: string) => {
    if (!icao) return;
    setIsLoading(true);
    setError(null);
    try {
      const resp = await fetch(`/api/public/gates/${icao}`);
      const payload = await resp.json().catch(() => null);
      if (!resp.ok) throw new Error(String(payload?.error || "Failed to load"));
      setData(payload);
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedIcao) void fetchData(selectedIcao);
  }, [selectedIcao, fetchData]);

  // Auto-refresh every 30s
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (autoRefresh && selectedIcao) {
      intervalRef.current = setInterval(() => {
        void fetchData(selectedIcao);
      }, 30_000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoRefresh, selectedIcao, fetchData]);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    mapRef.current = L.map(mapContainerRef.current, {
      center: [55.97, 37.41],
      zoom: 14,
      zoomControl: true,
      attributionControl: false,
    });
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      subdomains: "abcd",
      maxZoom: 19,
    }).addTo(mapRef.current);
    return () => {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, []);

  // Update markers when data or filter changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !data) return;

    markersRef.current.forEach((l) => map.removeLayer(l));
    markersRef.current = [];

    // Center map on airport
    map.setView([data.airport.lat, data.airport.lng], 14);

    const filteredPilots = filter === "all"
      ? data.groundPilots
      : data.groundPilots.filter((p) => p.airline?.code === filter);

    const labelFree = isRu ? "Свободно" : "Free";
    const labelStand = isRu ? "Стоянка" : "Stand";
    const labelUnknown = isRu ? "Тип неизвестен" : "Unknown type";

    // Draw gate markers (small grey dots)
    for (const gate of data.gates) {
      const hasFilteredOccupant = filter === "all"
        ? gate.occupants.length > 0
        : gate.occupants.some((o) => o.airline?.code === filter);

      const color = hasFilteredOccupant
        ? (gate.occupants.find((o) => filter === "all" ? true : o.airline?.code === filter)?.airline?.color || "#6B7280")
        : "#D1D5DB";

      const gateIcon = L.divIcon({
        className: "",
        html: `<div style="width:10px;height:10px;border-radius:50%;background:${color};border:1.5px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3)"></div>`,
        iconSize: [10, 10],
        iconAnchor: [5, 5],
      });

      const gateMarker = L.marker([gate.lat, gate.lng], { icon: gateIcon });
      const occupantHtml = gate.occupants.length > 0
        ? gate.occupants.map((o) =>
            `<div class="flex items-center gap-1"><span style="color:${o.airline?.color || '#374151'}" class="font-bold">${o.callsign}</span><span class="text-gray-500 text-xs">${o.aircraft || ""}</span></div>`
          ).join("")
        : `<span class="text-gray-400 text-xs">${labelFree}</span>`;

      gateMarker.bindPopup(
        `<div style="font-family:system-ui;min-width:140px"><div class="font-semibold text-sm mb-1">${labelStand} ${gate.ref || gate.name}</div>${occupantHtml}</div>`,
        { closeButton: false }
      );
      gateMarker.addTo(map);
      markersRef.current.push(gateMarker);
    }

    // Draw aircraft markers for pilots without a matched gate
    for (const pilot of filteredPilots) {
      const color = pilot.airline?.color || "#6B7280";
      const size = 28;
      const planeIcon = L.divIcon({
        className: "",
        html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.35)"><svg width="14" height="14" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg"><path d="M21 16v-2l-8-5V3.5A1.5 1.5 0 0 0 11.5 2A1.5 1.5 0 0 0 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1l3.5 1v-1.5L13 19v-5.5z"/></svg></div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });

      const gateLabel = pilot.nearestGate
        ? `<div class="text-xs text-gray-500 mt-0.5">${labelStand}: ${pilot.nearestGate.ref || pilot.nearestGate.name} (~${pilot.nearestGateDist}m)</div>`
        : "";

      const routeLabel = (pilot.departure || pilot.arrival)
        ? `<div class="text-xs text-gray-500">${pilot.departure || "?"} → ${pilot.arrival || "?"}</div>`
        : "";

      const marker = L.marker([pilot.lat, pilot.lng], { icon: planeIcon, zIndexOffset: 1000 });
      marker.bindPopup(
        `<div style="font-family:system-ui;min-width:160px"><div style="color:${color}" class="font-bold text-sm">${pilot.callsign}</div><div class="text-xs text-gray-600">${pilot.aircraft || labelUnknown}</div>${routeLabel}${gateLabel}</div>`,
        { closeButton: false }
      );
      marker.addTo(map);
      markersRef.current.push(marker);
    }
  }, [data, filter, isRu]);

  const filteredPilots = filter === "all"
    ? (data?.groundPilots ?? [])
    : (data?.groundPilots ?? []).filter((p) => p.airline?.code === filter);

  return (
    <div className="flex flex-col h-full min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 mr-2">
          <Building2 className="h-5 w-5 text-[#E31E24]" />
          <span className="font-semibold text-gray-900 text-sm">{tr("Gate Assigner", "Gate Assigner")}</span>
        </div>

        {/* Airport selector */}
        {isLoadingAirports ? (
          <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
        ) : (
          <select
            value={selectedIcao}
            onChange={(e) => setSelectedIcao(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#E31E24]/20"
          >
            {airports.map((a) => (
              <option key={a.icao} value={a.icao}>{a.icao} — {a.name}</option>
            ))}
          </select>
        )}

        {/* Filter chips */}
        <div className="flex gap-1">
          {(["all", "NWS", "IKS", "SWV"] as const).map((key) => {
            const label = key === "all" ? tr("Все", "All") : AIRLINE_LABELS[key];
            const color = key === "all" ? "#6B7280" : AIRLINE_COLORS[key];
            const active = filter === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                style={active ? { background: color, color: "#fff" } : {}}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${active ? "shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
              >
                {label}
                {key !== "all" && data?.stats.byAirline[key] ? ` · ${data.stats.byAirline[key]}` : ""}
              </button>
            );
          })}
        </div>

        {/* Stats pill */}
        {data && (
          <span className="ml-1 rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-500">
            {tr("На земле", "On ground")}: <strong>{data.stats.total}</strong>
          </span>
        )}

        {/* Refresh */}
        <div className="ml-auto flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            {tr("Авто-обновление 30с", "Auto-refresh 30s")}
          </label>
          <button
            type="button"
            onClick={() => void fetchData(selectedIcao)}
            disabled={isLoading}
            className="flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-200 transition-colors"
          >
            {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            {tr("Обновить", "Refresh")}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Map */}
        <div className="relative flex-1">
          <div ref={mapContainerRef} className="absolute inset-0" />
          {isLoading && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 shadow-lg text-sm text-gray-600">
              <Loader2 className="h-4 w-4 animate-spin text-[#E31E24]" />
              {tr("Загрузка VATSIM...", "Loading VATSIM...")}
            </div>
          )}
          {error && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] rounded-full bg-red-50 px-4 py-2 shadow text-sm text-red-600">
              {error}
            </div>
          )}
          {/* Legend */}
          <div className="absolute bottom-4 left-4 z-[1000] rounded-xl bg-white/95 shadow-lg p-3 text-xs space-y-1.5">
            {Object.entries(AIRLINE_LABELS).map(([code, label]) => (
              <div key={code} className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full flex-shrink-0" style={{ background: AIRLINE_COLORS[code] }} />
                <span className="text-gray-700">{label}</span>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-gray-300 flex-shrink-0" />
              <span className="text-gray-500">{tr("Свободно / Другие", "Free / Other")}</span>
            </div>
          </div>
          {/* Timestamp */}
          {data && (
            <div className="absolute bottom-4 right-4 z-[1000] rounded-lg bg-white/90 px-2 py-1 text-[10px] text-gray-400 shadow">
              {tr("Обновлено", "Updated")} {new Date(data.fetchedAt).toLocaleTimeString()}
            </div>
          )}
        </div>

        {/* Sidebar — aircraft list */}
        <div className="w-72 bg-white border-l border-gray-200 overflow-y-auto flex-shrink-0">
          <div className="p-3 border-b border-gray-100">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              {tr("На земле", "On ground")} ({filteredPilots.length})
            </span>
          </div>
          {filteredPilots.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-400">
              {isLoading ? tr("Загрузка...", "Loading...") : tr("Нет воздушных судов", "No aircraft")}
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {filteredPilots.map((p) => {
                const color = p.airline?.color || "#6B7280";
                return (
                  <div key={p.callsign} className="px-3 py-2.5 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Plane className="h-3.5 w-3.5 flex-shrink-0" style={{ color }} />
                        <span className="text-sm font-semibold" style={{ color }}>{p.callsign}</span>
                      </div>
                      {p.nearestGate && (
                        <span className="text-[10px] font-medium rounded-full px-1.5 py-0.5 bg-gray-100 text-gray-600">
                          {p.nearestGate.ref || p.nearestGate.name}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-gray-500 pl-5">
                      {p.aircraft || "—"}
                      {(p.departure || p.arrival) && (
                        <span className="ml-1.5 text-gray-400">{p.departure || "?"} → {p.arrival || "?"}</span>
                      )}
                    </div>
                    {p.airline && (
                      <div className="mt-0.5 pl-5 text-[10px]" style={{ color }}>{p.airline.label}</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
