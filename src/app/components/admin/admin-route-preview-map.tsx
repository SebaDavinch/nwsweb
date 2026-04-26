import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface RoutePreviewAirport {
  id: number;
  name: string;
  icao?: string;
  iata?: string;
  latitude?: number | null;
  longitude?: number | null;
}

interface AdminRoutePreviewMapProps {
  departureCode?: string;
  arrivalCode?: string;
  routeText?: string;
  airports: RoutePreviewAirport[];
  heightClassName?: string;
}

interface PreviewPoint {
  id: string;
  code: string;
  name: string;
  lat: number;
  lon: number;
  kind: "departure" | "arrival" | "route";
}

interface PreviewSegment {
  id: string;
  from: PreviewPoint;
  to: PreviewPoint;
  label: string;
}

const normalizeToken = (value?: string | null) => String(value || "").trim().toUpperCase();

const buildRouteTextTokens = (value?: string | null) =>
  String(value || "")
    .replace(/[\r\n,;]+/g, " ")
    .split(/\s+/)
    .map((token) => normalizeToken(token))
    .filter(Boolean);

const hasCoordinates = (airport?: RoutePreviewAirport | null): airport is RoutePreviewAirport & { latitude: number; longitude: number } => {
  return Boolean(airport && Number.isFinite(Number(airport.latitude)) && Number.isFinite(Number(airport.longitude)));
};

const createPointMarker = (color: string) =>
  L.divIcon({
    html: `<span style="display:block;width:12px;height:12px;border-radius:9999px;background:${color};border:2px solid white;box-shadow:0 0 0 2px ${color}55;"></span>`,
    className: "admin-route-preview-marker",
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });

export function AdminRoutePreviewMap({
  departureCode,
  arrivalCode,
  routeText,
  airports,
  heightClassName = "h-72",
}: AdminRoutePreviewMapProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  const preview = useMemo(() => {
    const lookup = new Map<string, RoutePreviewAirport>();
    airports.forEach((airport) => {
      const icao = normalizeToken(airport.icao);
      const iata = normalizeToken(airport.iata);
      if (icao) {
        lookup.set(icao, airport);
      }
      if (iata) {
        lookup.set(iata, airport);
      }
    });

    const departureAirport = lookup.get(normalizeToken(departureCode)) || null;
    const arrivalAirport = lookup.get(normalizeToken(arrivalCode)) || null;
    const points: PreviewPoint[] = [];
    const segments: PreviewSegment[] = [];
    const unresolvedTokens: string[] = [];
    const tokens = buildRouteTextTokens(routeText);

    const appendPoint = (airport: RoutePreviewAirport & { latitude: number; longitude: number }, kind: PreviewPoint["kind"], fallbackCode: string) => {
      const code = normalizeToken(airport.icao) || normalizeToken(airport.iata) || fallbackCode;
      const lastPoint = points[points.length - 1];
      if (lastPoint && lastPoint.code === code) {
        return lastPoint;
      }

      const point: PreviewPoint = {
        id: `${kind}-${code}-${points.length}`,
        code,
        name: String(airport.name || code).trim() || code,
        lat: Number(airport.latitude),
        lon: Number(airport.longitude),
        kind,
      };
      points.push(point);
      return point;
    };

    let lastResolvedPoint: PreviewPoint | null = hasCoordinates(departureAirport)
      ? appendPoint(departureAirport, "departure", normalizeToken(departureCode) || "DEP")
      : null;
    let pendingSegmentTokens: string[] = [];

    tokens.forEach((token) => {
      if (token === "DCT") {
        return;
      }

      const airport = lookup.get(token);
      if (hasCoordinates(airport)) {
        const point = appendPoint(airport, "route", token);
        if (lastResolvedPoint && point.id !== lastResolvedPoint.id) {
          segments.push({
            id: `${lastResolvedPoint.id}-${point.id}`,
            from: lastResolvedPoint,
            to: point,
            label: pendingSegmentTokens.join(" ").trim() || "DCT",
          });
        }
        lastResolvedPoint = point;
        pendingSegmentTokens = [];
        return;
      }

      pendingSegmentTokens.push(token);
      if (!unresolvedTokens.includes(token)) {
        unresolvedTokens.push(token);
      }
    });

    if (hasCoordinates(arrivalAirport)) {
      const arrivalPoint = appendPoint(arrivalAirport, "arrival", normalizeToken(arrivalCode) || "ARR");
      if (lastResolvedPoint && arrivalPoint.id !== lastResolvedPoint.id) {
        segments.push({
          id: `${lastResolvedPoint.id}-${arrivalPoint.id}`,
          from: lastResolvedPoint,
          to: arrivalPoint,
          label: pendingSegmentTokens.join(" ").trim() || "DCT",
        });
      }
    }

    return {
      points,
      segments,
      unresolvedTokens,
      hasDepartureCoordinates: hasCoordinates(departureAirport),
      hasArrivalCoordinates: hasCoordinates(arrivalAirport),
      routeIsEmpty: tokens.length === 0,
    };
  }, [airports, arrivalCode, departureCode, routeText]);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) {
      return;
    }

    const map = L.map(mapRef.current, {
      zoomControl: true,
      attributionControl: true,
      scrollWheelZoom: true,
    }).setView([55.75, 37.62], 4);

    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://carto.com/attributions">CARTO</a>',
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

  useEffect(() => {
    const map = mapInstanceRef.current;
    const layerGroup = layerGroupRef.current;
    if (!map || !layerGroup) {
      return;
    }

    layerGroup.clearLayers();
    const boundsPoints: L.LatLngExpression[] = [];

    preview.segments.forEach((segment) => {
      const latLngs: L.LatLngExpression[] = [
        [segment.from.lat, segment.from.lon],
        [segment.to.lat, segment.to.lon],
      ];
      boundsPoints.push(...latLngs);

      const polyline = L.polyline(latLngs, {
        color: segment.label === "DCT" ? "#2563eb" : "#e31e24",
        weight: 4,
        opacity: 0.85,
        dashArray: segment.label === "DCT" ? "8 8" : undefined,
      }).addTo(layerGroup);

      polyline.bindTooltip(
        `${segment.from.code} -> ${segment.to.code}${segment.label && segment.label !== "DCT" ? ` | ${segment.label}` : " | DCT"}`,
        { sticky: true, direction: "top" }
      );

      polyline.on("mouseover", () => {
        polyline.setStyle({ weight: 6, opacity: 1 });
      });
      polyline.on("mouseout", () => {
        polyline.setStyle({ weight: 4, opacity: 0.85 });
      });
    });

    preview.points.forEach((point) => {
      boundsPoints.push([point.lat, point.lon]);
      const color = point.kind === "departure" ? "#16a34a" : point.kind === "arrival" ? "#dc2626" : "#0f172a";
      const marker = L.marker([point.lat, point.lon], {
        icon: createPointMarker(color),
      }).addTo(layerGroup);
      marker.bindTooltip(`${point.code} | ${point.name}`, { sticky: true, direction: "top" });
    });

    if (boundsPoints.length >= 2) {
      map.fitBounds(L.latLngBounds(boundsPoints), { padding: [24, 24] });
    } else if (boundsPoints.length === 1) {
      map.setView(boundsPoints[0] as L.LatLngExpression, 6);
    } else {
      map.setView([55.75, 37.62], 4);
    }
  }, [preview]);

  return (
    <div className="space-y-3">
      <div className={`overflow-hidden rounded-2xl border border-gray-200 bg-white ${heightClassName}`}>
        <div ref={mapRef} className="h-full w-full" />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
          {preview.routeIsEmpty
            ? "Route text is empty. Preview shows only resolved endpoints."
            : preview.segments.length > 0
              ? `Preview uses ${preview.points.length} resolved point${preview.points.length === 1 ? "" : "s"} and ${preview.segments.length} segment${preview.segments.length === 1 ? "" : "s"}. Hover the map for point and segment labels.`
              : "No route segments could be built yet. Check airport codes and route tokens."}
        </div>
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
          {!preview.hasDepartureCoordinates || !preview.hasArrivalCoordinates
            ? "Departure or arrival airport is missing coordinates in the airport catalog, so preview may stay incomplete."
            : preview.unresolvedTokens.length > 0
              ? `Unresolved route tokens: ${preview.unresolvedTokens.slice(0, 8).join(", ")}${preview.unresolvedTokens.length > 8 ? ` +${preview.unresolvedTokens.length - 8}` : ""}`
              : "All visible route tokens were resolved against the airport catalog or used as segment labels."}
        </div>
      </div>
    </div>
  );
}