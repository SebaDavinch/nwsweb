import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useLanguage } from "../context/language-context";
import { FlightDetailSidebar } from "./flight-detail-sidebar";
import { RouteGeneratorModal } from "./route-generator-modal";

interface Flight {
  id?: number | null;
  flightNumber: string;
  departure: string;
  departureCity: string;
  destination: string;
  destinationCity: string;
  status: string;
  pilot: string;
  pilotId: string | number | null;
  aircraft: string;
  progress: number;
  vac: "NWS" | "KAR" | "STW";
  etd?: string;
  ete?: string;
  eta?: string;
  heading?: number | null;
  speed?: number | null;
  altitude?: number | null;
  currentLat?: number | null;
  currentLon?: number | null;
  passengers?: number | null;
  aircraftRegistration?: string;
  network?: string;
  hasLiveTelemetry?: boolean;
  telemetryTrack?: Array<
    [number, number] |
    {
      lat: number;
      lon: number;
      altitude?: number | null;
      heading?: number | null;
      ts?: number | null;
    }
  >;
  departureLat?: number | null;
  departureLon?: number | null;
  arrivalLat?: number | null;
  arrivalLon?: number | null;
}

interface Airport {
  icao: string;
  name: string;
  lat: number;
  lon: number;
}

// Airport coordinates database
const airports: Record<string, Airport> = {
  UUEE: { icao: "UUEE", name: "Moscow Sheremetyevo", lat: 55.9726, lon: 37.4146 },
  UUDD: { icao: "UUDD", name: "Moscow Domodedovo", lat: 55.4088, lon: 37.9063 },
  UUWW: { icao: "UUWW", name: "Moscow Vnukovo", lat: 55.5914, lon: 37.2615 },
  ULLI: { icao: "ULLI", name: "St. Petersburg Pulkovo", lat: 59.8003, lon: 30.2625 },
  LEBL: { icao: "LEBL", name: "Barcelona El Prat", lat: 41.2971, lon: 2.0785 },
  LTAI: { icao: "LTAI", name: "Antalya", lat: 36.8987, lon: 30.8005 },
  OMDB: { icao: "OMDB", name: "Dubai Intl", lat: 25.2528, lon: 55.3644 },
  LTFM: { icao: "LTFM", name: "Istanbul", lat: 41.2753, lon: 28.7519 },
  URSS: { icao: "URSS", name: "Sochi", lat: 43.4499, lon: 39.9566 },
  LTBS: { icao: "LTBS", name: "Bodrum", lat: 37.2506, lon: 27.6643 },
  LEMD: { icao: "LEMD", name: "Madrid Barajas", lat: 40.4936, lon: -3.5668 },
};

interface LiveMapProps {
  flights: Flight[];
  selectedFlight?: Flight | null;
  onFlightSelect?: (flight: Flight) => void;
  onCloseDetail?: () => void;
  className?: string;
}

const getVACColor = (vac: string) => {
  switch (vac) {
    case "NWS": return "#E31E24";
    case "KAR": return "#2563eb";
    case "STW": return "#ea580c";
    default: return "#6b7280";
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case "Boarding": return "#3b82f6";
    case "Climbing": return "#10b981";
    case "En Route": return "#eab308";
    case "Approach": return "#f97316";
    default: return "#6b7280";
  }
};

const TELEMETRY_DEFAULT_COLOR = "#22c55e";
const ROUTE_BASE_COLOR = "#334155";

type TelemetryPoint = {
  lat: number;
  lon: number;
  altitude: number | null;
  heading: number | null;
  ts: number | null;
};

const MARKER_SMOOTHING_FACTOR = 0.42;
const MARKER_DEADZONE_METERS = 6;
const MIN_TRACK_SEGMENT_METERS = 0;
const MAX_MARKER_STEP_METERS = 120;
const MAX_SELECTED_TRACK_RENDER_POINTS = 700;

const distanceMeters = (from: { lat: number; lon: number }, to: { lat: number; lon: number }) => {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(to.lat - from.lat);
  const dLon = toRad(to.lon - from.lon);
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return 6371000 * c;
};

const bearingDegrees = (from: { lat: number; lon: number }, to: { lat: number; lon: number }) => {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const toDeg = (value: number) => (value * 180) / Math.PI;

  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);
  const dLon = toRad(to.lon - from.lon);

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  const brng = toDeg(Math.atan2(y, x));
  return (brng + 360) % 360;
};

const resolveMarkerHeading = (
  previousPoint: TelemetryPoint | null,
  currentPoint: TelemetryPoint | null,
  fallbackHeading: unknown
) => {
  if (previousPoint && currentPoint) {
    const movement = distanceMeters(previousPoint, currentPoint);
    if (movement >= 20) {
      return normalizeHeading(bearingDegrees(previousPoint, currentPoint)) ?? 0;
    }
  }

  return normalizeHeading(fallbackHeading) ?? 0;
};

const altitudeToColor = (altitude: number | null) => {
  const value = Number(altitude);
  if (!Number.isFinite(value)) return TELEMETRY_DEFAULT_COLOR;
  if (value < 5000) return "#22c55e";
  if (value < 15000) return "#84cc16";
  if (value < 25000) return "#eab308";
  if (value < 35000) return "#f59e0b";
  return "#ef4444";
};

const drawTelemetryAltitudePolyline = (
  layer: L.LayerGroup,
  points: TelemetryPoint[],
  { weight = 4, opacity = 0.9 }: { weight?: number; opacity?: number } = {}
) => {
  if (!points || points.length < 2) {
    return;
  }

  for (let i = 1; i < points.length; i += 1) {
    const from = points[i - 1];
    const to = points[i];
    const segmentLength = distanceMeters(from, to);
    if (segmentLength < MIN_TRACK_SEGMENT_METERS) {
      continue;
    }
    L.polyline(
      [
        [from.lat, from.lon],
        [to.lat, to.lon],
      ],
      {
      color: altitudeToColor(to.altitude),
      weight,
      opacity,
      smoothFactor: 1,
      lineCap: "round",
      lineJoin: "round",
    }
    ).addTo(layer);
  }
};

const normalizeTelemetryTrack = (track: unknown): TelemetryPoint[] => {
  if (!Array.isArray(track)) {
    return [];
  }

  const normalized = track
    .map((point) => {
      if (Array.isArray(point) && point.length >= 2) {
        const lat = Number(point[0]);
        const lon = Number(point[1]);
        if (Number.isFinite(lat) && Number.isFinite(lon)) {
          return {
            lat,
            lon,
            altitude: null,
            heading: null,
            ts: null,
          };
        }
      }

      if (point && typeof point === "object") {
        const record = point as Record<string, unknown>;
        const lat = Number(record.lat ?? record.latitude ?? record.currentLat);
        const lon = Number(record.lon ?? record.lng ?? record.longitude ?? record.currentLon);
        if (Number.isFinite(lat) && Number.isFinite(lon)) {
          return {
            lat,
            lon,
            altitude: Number.isFinite(Number(record.altitude ?? record.altitudeFt ?? record.altitude_ft ?? record.flightLevel))
              ? Number(record.altitude ?? record.altitudeFt ?? record.altitude_ft ?? record.flightLevel)
              : null,
            heading: Number.isFinite(Number(record.heading ?? record.magneticHeading ?? record.magnetic_heading ?? record.track ?? record.course))
              ? Number(record.heading ?? record.magneticHeading ?? record.magnetic_heading ?? record.track ?? record.course)
              : null,
            ts: Number.isFinite(Number(record.ts ?? record.timestamp ?? record.time ?? record.created_at ?? record.createdAt))
              ? Number(record.ts ?? record.timestamp ?? record.time ?? record.created_at ?? record.createdAt)
              : null,
          };
        }
      }

      return null;
    })
    .filter(Boolean) as TelemetryPoint[];

  const hasAnyTimestamp = normalized.some((point) => Number.isFinite(Number(point.ts)));
  const sorted = normalized
    .slice()
    .sort((a, b) => {
      if (hasAnyTimestamp) {
        return Number(a.ts || 0) - Number(b.ts || 0);
      }
      return 0;
    });

  const deduped: TelemetryPoint[] = [];
  for (const point of sorted) {
    const last = deduped[deduped.length - 1];
    if (
      last &&
      Math.abs(last.lat - point.lat) < 0.000001 &&
      Math.abs(last.lon - point.lon) < 0.000001
    ) {
      continue;
    }
    deduped.push(point);
  }

  return deduped;
};

const normalizeHeading = (value: unknown) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const modulo = numeric % 360;
  return modulo < 0 ? modulo + 360 : modulo;
};

const getSmoothedMarkerPoint = (points: TelemetryPoint[]): TelemetryPoint | null => {
  if (!Array.isArray(points) || points.length === 0) {
    return null;
  }

  const latest = points[points.length - 1];
  if (!latest) {
    return null;
  }

  const recent = points.slice(-3);
  const weights = recent.length === 1 ? [1] : recent.length === 2 ? [0.3, 0.7] : [0.2, 0.3, 0.5];

  let lat = 0;
  let lon = 0;
  let weightSum = 0;

  recent.forEach((point, index) => {
    const w = Number(weights[index] || 0);
    lat += point.lat * w;
    lon += point.lon * w;
    weightSum += w;
  });

  const normalizedWeight = weightSum > 0 ? weightSum : 1;

  return {
    lat: lat / normalizedWeight,
    lon: lon / normalizedWeight,
    altitude: Number.isFinite(Number(latest.altitude)) ? Number(latest.altitude) : null,
    heading: normalizeHeading(latest.heading),
    ts: latest.ts,
  };
};

const downsampleTrackForRender = (points: TelemetryPoint[], maxPoints: number): TelemetryPoint[] => {
  if (!Array.isArray(points) || points.length <= maxPoints) {
    return points;
  }

  const safeMax = Math.max(10, Number(maxPoints) || MAX_SELECTED_TRACK_RENDER_POINTS);
  const keep = [points[0]];
  const middleCount = safeMax - 2;
  const sourceMiddle = points.slice(1, -1);

  if (middleCount > 0 && sourceMiddle.length > 0) {
    const step = sourceMiddle.length / middleCount;
    for (let index = 0; index < middleCount; index += 1) {
      const sourceIndex = Math.min(sourceMiddle.length - 1, Math.floor(index * step));
      keep.push(sourceMiddle[sourceIndex]);
    }
  }

  keep.push(points[points.length - 1]);

  const deduped: TelemetryPoint[] = [];
  for (const point of keep) {
    const last = deduped[deduped.length - 1];
    if (
      last &&
      Math.abs(last.lat - point.lat) < 0.000001 &&
      Math.abs(last.lon - point.lon) < 0.000001
    ) {
      continue;
    }
    deduped.push(point);
  }

  return deduped;
};

const resolveFallbackMarkerPoint = (
  flight: Flight,
  routeCoords: { departureLat: number; departureLon: number; arrivalLat: number; arrivalLon: number } | null,
  renderTrack: TelemetryPoint[]
): TelemetryPoint | null => {
  const currentLat = Number(flight.currentLat);
  const currentLon = Number(flight.currentLon);
  if (Number.isFinite(currentLat) && Number.isFinite(currentLon)) {
    return {
      lat: currentLat,
      lon: currentLon,
      altitude: Number.isFinite(Number(flight.altitude)) ? Number(flight.altitude) : null,
      heading: normalizeHeading(flight.heading),
      ts: Date.now(),
    };
  }

  const lastTrackPoint = renderTrack[renderTrack.length - 1];
  if (lastTrackPoint) {
    return lastTrackPoint;
  }

  if (routeCoords) {
    const progress = Math.max(0, Math.min(100, Number(flight.progress) || 0));
    const factor = progress / 100;
    return {
      lat: routeCoords.departureLat + (routeCoords.arrivalLat - routeCoords.departureLat) * factor,
      lon: routeCoords.departureLon + (routeCoords.arrivalLon - routeCoords.departureLon) * factor,
      altitude: Number.isFinite(Number(flight.altitude)) ? Number(flight.altitude) : null,
      heading: normalizeHeading(flight.heading),
      ts: Date.now(),
    };
  }

  return null;
};

// FR24-style airplane marker: clean silhouette, VAC colour, altitude glow
const createAirplaneMarker = (angle = 0, color = "#E31E24", selected = false, altitude: number | null = null) => {
  const size = selected ? 44 : 34;
  const half = size / 2;
  const glow = selected ? `drop-shadow(0 0 6px ${color}) drop-shadow(0 0 2px white)` : `drop-shadow(0 0 4px ${color}80)`;
  // altitude colour ring for selected
  const altColor = altitude != null ? altitudeToColor(altitude) : color;
  const ring = selected
    ? `<circle cx="16" cy="16" r="14" fill="none" stroke="${altColor}" stroke-width="1.5" opacity="0.7"/>`
    : "";
  return L.divIcon({
    html: `<div style="transform:rotate(${angle}deg);width:${size}px;height:${size}px;filter:${glow}">
      <svg width="${size}" height="${size}" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        ${ring}
        <path d="M16 3 L19.5 13 L28 15.5 L19.5 18 L20.5 27 L16 24.5 L11.5 27 L12.5 18 L4 15.5 L12.5 13 Z"
          fill="${color}" stroke="rgba(255,255,255,0.9)" stroke-width="${selected ? 1.5 : 1}" stroke-linejoin="round"/>
      </svg>
    </div>`,
    className: "airplane-marker",
    iconSize: [size, size],
    iconAnchor: [half, half],
  });
};

const createAirportDot = (color: string, label: string) => L.divIcon({
  html: `<div style="position:relative;display:flex;flex-direction:column;align-items:center;gap:2px;">
    <div style="width:10px;height:10px;border-radius:50%;background:${color};border:2px solid rgba(255,255,255,0.85);box-shadow:0 0 6px ${color}80;"></div>
    <div style="font-size:9px;font-weight:700;letter-spacing:0.1em;color:rgba(255,255,255,0.75);text-shadow:0 1px 3px #000;font-family:Oswald,sans-serif;white-space:nowrap;">${label}</div>
  </div>`,
  className: "airport-marker",
  iconSize: [10, 28],
  iconAnchor: [5, 5],
});

export function LiveMap({ flights, selectedFlight, onFlightSelect, onCloseDetail, className }: LiveMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const { t } = useLanguage();
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const smoothedMarkerRef = useRef<Map<string, TelemetryPoint>>(new Map());

  const getFlightRenderKey = (flight: Flight) =>
    [String(flight.id || "").trim(), String(flight.flightNumber || "").trim().toUpperCase(), String(flight.pilotId || "").trim()]
      .filter(Boolean)
      .join(":");

  const smoothHeading = (prev: number | null, next: number | null) => {
    if (prev === null) return next;
    if (next === null) return prev;
    let delta = next - prev;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    let value = prev + delta * MARKER_SMOOTHING_FACTOR;
    if (value < 0) value += 360;
    if (value >= 360) value -= 360;
    return value;
  };

  const getStableMarkerPoint = (flight: Flight, nextPoint: TelemetryPoint | null) => {
    if (!nextPoint) {
      return null;
    }

    const key = getFlightRenderKey(flight);
    if (!key) {
      return nextPoint;
    }

    const previous = smoothedMarkerRef.current.get(key);
    if (!previous) {
      smoothedMarkerRef.current.set(key, nextPoint);
      return nextPoint;
    }

    const moveMeters = distanceMeters(previous, nextPoint);
    let blendFactor = MARKER_SMOOTHING_FACTOR;
    if (moveMeters <= MARKER_DEADZONE_METERS) {
      blendFactor = 0.18;
    } else if (moveMeters >= 1200) {
      blendFactor = 0.8;
    } else if (moveMeters >= 300) {
      blendFactor = 0.55;
    }

    if (moveMeters > MAX_MARKER_STEP_METERS) {
      blendFactor = Math.min(blendFactor, MAX_MARKER_STEP_METERS / moveMeters);
    }

    const blended = {
      lat: previous.lat + (nextPoint.lat - previous.lat) * blendFactor,
      lon: previous.lon + (nextPoint.lon - previous.lon) * blendFactor,
      heading: smoothHeading(
        Number.isFinite(Number(previous.heading)) ? Number(previous.heading) : null,
        Number.isFinite(Number(nextPoint.heading)) ? Number(nextPoint.heading) : null
      ),
      altitude: Number.isFinite(Number(nextPoint.altitude)) ? Number(nextPoint.altitude) : previous.altitude,
      ts: nextPoint.ts,
    } as TelemetryPoint;

    smoothedMarkerRef.current.set(key, blended);
    return blended;
  };

  const resolveRouteCoordinates = (flight: Flight) => {
    const fallbackDeparture = airports[flight.departure];
    const fallbackArrival = airports[flight.destination];

    const departureLat = Number.isFinite(Number(flight.departureLat))
      ? Number(flight.departureLat)
      : fallbackDeparture?.lat;
    const departureLon = Number.isFinite(Number(flight.departureLon))
      ? Number(flight.departureLon)
      : fallbackDeparture?.lon;
    const arrivalLat = Number.isFinite(Number(flight.arrivalLat))
      ? Number(flight.arrivalLat)
      : fallbackArrival?.lat;
    const arrivalLon = Number.isFinite(Number(flight.arrivalLon))
      ? Number(flight.arrivalLon)
      : fallbackArrival?.lon;

    if (
      !Number.isFinite(Number(departureLat)) ||
      !Number.isFinite(Number(departureLon)) ||
      !Number.isFinite(Number(arrivalLat)) ||
      !Number.isFinite(Number(arrivalLon))
    ) {
      return null;
    }

    return {
      departureLat: Number(departureLat),
      departureLon: Number(departureLon),
      arrivalLat: Number(arrivalLat),
      arrivalLon: Number(arrivalLon),
    };
  };

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
        zoomControl: false,
        attributionControl: false
    }).setView([55.7558, 37.6173], 4);

    // Dark theme tile layer
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
    }).addTo(map);
    
    L.control.attribution({
        position: 'bottomright',
        prefix: false
    }).addTo(map);

    mapInstanceRef.current = map;
    layerGroupRef.current = L.layerGroup().addTo(map);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update flight layers when flights change or selection changes
  useEffect(() => {
    if (!mapInstanceRef.current || !layerGroupRef.current) return;

    // Clear existing layers
    layerGroupRef.current.clearLayers();

    const activeKeys = new Set(
      (selectedFlight ? [selectedFlight] : flights)
        .map((flight) => getFlightRenderKey(flight))
        .filter(Boolean)
    );
    for (const key of smoothedMarkerRef.current.keys()) {
      if (!activeKeys.has(key)) {
        smoothedMarkerRef.current.delete(key);
      }
    }

    if (selectedFlight) {
        // DETAILED SINGLE FLIGHT VIEW
        const routeCoords = resolveRouteCoordinates(selectedFlight);

        const hasCurrentTelemetry = Number.isFinite(Number(selectedFlight.currentLat)) && Number.isFinite(Number(selectedFlight.currentLon));
        const liveTrack = normalizeTelemetryTrack(selectedFlight.telemetryTrack);
        const currentPoint: TelemetryPoint | null = hasCurrentTelemetry
          ? {
              lat: Number(selectedFlight.currentLat),
              lon: Number(selectedFlight.currentLon),
              altitude: Number.isFinite(Number(selectedFlight.altitude)) ? Number(selectedFlight.altitude) : null,
              heading: normalizeHeading(selectedFlight.heading),
              ts: Date.now(),
            }
          : null;

        let renderTrack = liveTrack;
        if (currentPoint) {
          const last = renderTrack[renderTrack.length - 1];
          const isDuplicate =
            last &&
            Math.abs(last.lat - currentPoint.lat) < 0.000001 &&
            Math.abs(last.lon - currentPoint.lon) < 0.000001;
          if (!isDuplicate) {
            renderTrack = [...renderTrack, currentPoint];
          }
        }

        const fallbackMarkerPoint = resolveFallbackMarkerPoint(selectedFlight, routeCoords, renderTrack);

        if (routeCoords) {
            const routePath: [number, number][] = [
              [routeCoords.departureLat, routeCoords.departureLon],
              [routeCoords.arrivalLat, routeCoords.arrivalLon],
            ];

            L.polyline(routePath, {
              color: ROUTE_BASE_COLOR,
              weight: 3,
              opacity: 0.28,
              dashArray: "6 10",
              smoothFactor: 1,
              lineCap: "round",
              lineJoin: "round",
            }).addTo(layerGroupRef.current);

            L.marker([routeCoords.departureLat, routeCoords.departureLon], { icon: createAirportDot('#60a5fa', selectedFlight.departure) }).addTo(layerGroupRef.current);
            L.marker([routeCoords.arrivalLat, routeCoords.arrivalLon], { icon: createAirportDot('#34d399', selectedFlight.destination) }).addTo(layerGroupRef.current);
        }

        const renderTrackForPolyline = downsampleTrackForRender(renderTrack, MAX_SELECTED_TRACK_RENDER_POINTS);

        if (renderTrackForPolyline.length >= 2) {
          drawTelemetryAltitudePolyline(layerGroupRef.current, renderTrackForPolyline, {
            weight: 4,
            opacity: 0.92,
          });
        }

        const lastPoint = renderTrack[renderTrack.length - 1] || fallbackMarkerPoint;
        const markerPointRaw = getSmoothedMarkerPoint(lastPoint ? [...renderTrack, lastPoint].slice(-3) : renderTrack) || lastPoint;
        const markerPoint = getStableMarkerPoint(selectedFlight, markerPointRaw);

        const previousPointForHeading = renderTrack.length >= 2 ? renderTrack[renderTrack.length - 2] : null;
        const markerHeading = resolveMarkerHeading(
          previousPointForHeading,
          markerPoint,
          markerPoint?.heading ?? selectedFlight.heading
        );

        if (markerPoint) {
          const vacColor = getVACColor(selectedFlight.vac);
          L.marker([markerPoint.lat, markerPoint.lon], {
            icon: createAirplaneMarker(markerHeading, vacColor, true, markerPoint.altitude),
          }).addTo(layerGroupRef.current);
        }

    } else {
        // ALL FLIGHTS VIEW
        flights.forEach((flight) => {
            const routeCoords = resolveRouteCoordinates(flight);

            const vacColor = getVACColor(flight.vac);
            const statusColor = getStatusColor(flight.status);

            if (routeCoords) {
              const routePath: [number, number][] = [
                [routeCoords.departureLat, routeCoords.departureLon],
                [routeCoords.arrivalLat, routeCoords.arrivalLon],
              ];

              L.polyline(routePath, {
                  color: ROUTE_BASE_COLOR,
                  weight: 2,
                  opacity: 0.28,
                  dashArray: "6 10",
                  smoothFactor: 1,
                  lineCap: "round",
                  lineJoin: "round",
              }).addTo(layerGroupRef.current!);

              L.marker([routeCoords.departureLat, routeCoords.departureLon], { icon: createAirportDot(vacColor, flight.departure) }).addTo(layerGroupRef.current!);
              L.marker([routeCoords.arrivalLat, routeCoords.arrivalLon], { icon: createAirportDot(vacColor, flight.destination) }).addTo(layerGroupRef.current!);
            }

            const hasCurrentTelemetry = Number.isFinite(Number(flight.currentLat)) && Number.isFinite(Number(flight.currentLon));
            const liveTrack = normalizeTelemetryTrack(flight.telemetryTrack);
            const currentPoint: TelemetryPoint | null = hasCurrentTelemetry
              ? {
                  lat: Number(flight.currentLat),
                  lon: Number(flight.currentLon),
                  altitude: Number.isFinite(Number(flight.altitude)) ? Number(flight.altitude) : null,
                  heading: normalizeHeading(flight.heading),
                  ts: Date.now(),
                }
              : null;

            let renderTrack = liveTrack;
            if (currentPoint) {
              const last = renderTrack[renderTrack.length - 1];
              const isDuplicate =
                last &&
                Math.abs(last.lat - currentPoint.lat) < 0.000001 &&
                Math.abs(last.lon - currentPoint.lon) < 0.000001;
              if (!isDuplicate) {
                renderTrack = [...renderTrack, currentPoint];
              }
            }


            const fallbackMarkerPoint = resolveFallbackMarkerPoint(flight, routeCoords, renderTrack);

            const lastPoint = renderTrack[renderTrack.length - 1] || fallbackMarkerPoint;
            const markerPointRaw = getSmoothedMarkerPoint(lastPoint ? [...renderTrack, lastPoint].slice(-3) : renderTrack) || lastPoint;
            const markerPoint = getStableMarkerPoint(flight, markerPointRaw);

            const previousPointForHeading = renderTrack.length >= 2 ? renderTrack[renderTrack.length - 2] : null;
            const markerHeading = resolveMarkerHeading(
              previousPointForHeading,
              markerPoint,
              markerPoint?.heading ?? flight.heading
            );

            const airplaneIcon = createAirplaneMarker(markerHeading, vacColor, false, markerPoint?.altitude ?? null);

            if (!markerPoint) {
              return;
            }

            const planeMarker = L.marker([markerPoint.lat, markerPoint.lon], { icon: airplaneIcon });
            
            if (onFlightSelect) {
                planeMarker.on('click', () => onFlightSelect(flight));
            }
            
            planeMarker.addTo(layerGroupRef.current!);
        });
    }
  }, [flights, selectedFlight, t, onFlightSelect]);

  return (
    <div className={className ?? "w-full h-[800px] relative bg-[#0d1117]"}>
      {selectedFlight && onCloseDetail && (
        <FlightDetailSidebar 
            flight={{ ...selectedFlight, pilotId: String(selectedFlight.pilotId || "") }} 
            onClose={onCloseDetail}
        />
      )}
      <div ref={mapRef} className="w-full h-full" />
      
      <RouteGeneratorModal 
        open={isGeneratorOpen} 
        onOpenChange={setIsGeneratorOpen} 
        defaultAirline={selectedFlight?.vac || "NWS"}
        defaultAircraft={selectedFlight?.aircraft || "B737-800"}
      />
    </div>
  );
}
