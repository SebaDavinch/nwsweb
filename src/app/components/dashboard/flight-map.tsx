import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Interface definitions (matching Where2Fly)
export interface Airport {
  code?: string; // Support both code (old) and icao (new)
  icao?: string;
  iata?: string;
  name: string;
  city?: string;
  country?: string;
  lat: number;
  lon: number;
}

export interface FlightLeg {
  from: Airport;
  to: Airport;
  distance: number;
  duration: number;
}

export interface Route {
  id: string;
  airline: string;
  legs: FlightLeg[];
  totalDistance: number;
  totalDuration: number;
  aircraft: string;
  registration?: string;
}

export interface SelectableRoute {
  id: string;
  from: Airport;
  to: Airport;
  label?: string;
  active?: boolean;
}

interface FlightMapProps {
  route: Route | null;
  airports?: Airport[]; // Optional list of airports to display when no route is active
  availableRoutes?: SelectableRoute[];
  originAirport?: Airport | null;
  selectedAirportCode?: string | null;
  onAirportSelect?: (airportCode: string) => void;
  showOriginMarker?: boolean;
}

export function FlightMap({
  route,
  airports = [],
  availableRoutes = [],
  originAirport = null,
  selectedAirportCode = null,
  onAirportSelect,
  showOriginMarker = true,
}: FlightMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.Layer[]>([]);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Initialize map only once
    if (!mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current, {
        center: [48.0, 40.0], // General view
        zoom: 3,
        zoomControl: true,
        attributionControl: false
      });

      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19
      }).addTo(mapRef.current);
    }

    return () => {
      // Cleanup on unmount
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;

    const map = mapRef.current;

    // Clear existing markers/layers
    markersRef.current.forEach(layer => map.removeLayer(layer));
    markersRef.current = [];

    // Custom icons
    const airportIcon = L.divIcon({
      html: `<div style="width: 8px; height: 8px; background-color: #E31E24; border-radius: 50%; box-shadow: 0 0 4px rgba(227, 30, 36, 0.5);"></div>`,
      className: "",
      iconSize: [8, 8],
      iconAnchor: [4, 4],
    });

    const originIcon = L.divIcon({
      html: `
        <div style="
          width: 18px;
          height: 18px;
          background: linear-gradient(135deg, #2563eb, #38bdf8);
          border: 3px solid white;
          border-radius: 999px;
          box-shadow: 0 6px 18px rgba(37, 99, 235, 0.35);
        "></div>
      `,
      className: "",
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });

    const destinationIcon = L.divIcon({
      html: `
        <div style="
          width: 14px;
          height: 14px;
          background-color: white;
          border: 2px solid #64748b;
          border-radius: 999px;
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.15);
        "></div>
      `,
      className: "",
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });

    const selectedDestinationIcon = L.divIcon({
      html: `
        <div style="
          width: 18px;
          height: 18px;
          background-color: #E31E24;
          border: 3px solid white;
          border-radius: 999px;
          box-shadow: 0 6px 18px rgba(227, 30, 36, 0.32);
        "></div>
      `,
      className: "",
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });

    const activeAirportIcon = L.divIcon({
      html: `
        <div style="
          width: 16px;
          height: 16px;
          background-color: #E31E24;
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        "></div>
      `,
      className: "",
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });

    if (route) {
      // Draw Selected Route
      const bounds = L.latLngBounds([]);
      const visitedAirports = new Set<string>();

      route.legs.forEach((leg) => {
        const fromLat = leg.from.lat;
        const fromLon = leg.from.lon;
        const toLat = leg.to.lat;
        const toLon = leg.to.lon;
        
        const fromCode = leg.from.icao || leg.from.code || "UNK";
        const toCode = leg.to.icao || leg.to.code || "UNK";

        const fromLatLng = L.latLng(fromLat, fromLon);
        const toLatLng = L.latLng(toLat, toLon);

        bounds.extend(fromLatLng);
        bounds.extend(toLatLng);

        // Add markers for airports
        if (!visitedAirports.has(fromCode)) {
          const marker = L.marker(fromLatLng, { icon: activeAirportIcon })
            .bindPopup(`<b>${fromCode}</b><br/>${leg.from.name}`, { closeButton: false })
            .addTo(map);
          markersRef.current.push(marker);
          visitedAirports.add(fromCode);
        }

        if (!visitedAirports.has(toCode)) {
          const marker = L.marker(toLatLng, { icon: activeAirportIcon })
            .bindPopup(`<b>${toCode}</b><br/>${leg.to.name}`, { closeButton: false })
            .addTo(map);
          markersRef.current.push(marker);
          visitedAirports.add(toCode);
        }

        // Create curved line
        const curvedPath = createCurvedPath(fromLatLng, toLatLng);
        const pathLine = L.polyline(curvedPath, {
          color: "#E31E24",
          weight: 3,
          opacity: 0.8,
          smoothFactor: 1,
        }).addTo(map);
        markersRef.current.push(pathLine);

        // Add plane icon
        const planeIcon = L.divIcon({
          html: `
            <div style="
              width: 24px; height: 24px; background-color: white; border: 2px solid #E31E24; border-radius: 50%;
              display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(227, 30, 36, 0.4);
            ">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="#E31E24">
                <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
              </svg>
            </div>
          `,
          className: "",
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });

        const midPoint = curvedPath[Math.floor(curvedPath.length / 2)];
        const planeMarker = L.marker(midPoint, { icon: planeIcon })
          .bindTooltip(`Flight ${route.id}`, { permanent: false, direction: "top" })
          .addTo(map);
        markersRef.current.push(planeMarker);
      });

      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [50, 50] });
      }

    } else if (availableRoutes.length > 0) {
      const bounds = L.latLngBounds([]);
      const destinationMarkers = new Map<string, Airport>();
      const effectiveOrigin = originAirport || availableRoutes[0]?.from || null;

      const originCodes = new Set(
        availableRoutes
          .map((item) => String(item.from.icao || item.from.code || "").trim().toUpperCase())
          .filter(Boolean)
      );
      const shouldShowOriginMarker = showOriginMarker && originCodes.size <= 1;

      if (effectiveOrigin && shouldShowOriginMarker) {
        const originLatLng = L.latLng(effectiveOrigin.lat, effectiveOrigin.lon);
        bounds.extend(originLatLng);
        const marker = L.marker(originLatLng, { icon: originIcon })
          .bindTooltip(`<b>${effectiveOrigin.icao || effectiveOrigin.code || "UNK"}</b><br/>${effectiveOrigin.name}<br/>Current location`, {
            direction: "top",
          })
          .addTo(map);
        markersRef.current.push(marker);
      }

      availableRoutes.forEach((selectionRoute) => {
        const fromLatLng = L.latLng(selectionRoute.from.lat, selectionRoute.from.lon);
        const toLatLng = L.latLng(selectionRoute.to.lat, selectionRoute.to.lon);
        const destinationCode = String(selectionRoute.to.icao || selectionRoute.to.code || "").trim().toUpperCase();
        const isActive = Boolean(
          selectionRoute.active || (selectedAirportCode && destinationCode === String(selectedAirportCode).trim().toUpperCase())
        );

        bounds.extend(fromLatLng);
        bounds.extend(toLatLng);

        const curvedPath = createCurvedPath(fromLatLng, toLatLng);
        const pathLine = L.polyline(curvedPath, {
          color: isActive ? "#E31E24" : "#6366f1",
          weight: isActive ? 3 : 1.2,
          opacity: isActive ? 0.9 : 0.28,
          dashArray: isActive ? undefined : "6 9",
          smoothFactor: 1,
        })
          .bindTooltip(selectionRoute.label || `${selectionRoute.from.icao || selectionRoute.from.code || "—"} → ${selectionRoute.to.icao || selectionRoute.to.code || "—"}`, {
            direction: "top",
          })
          .addTo(map);

        if (onAirportSelect && destinationCode) {
          pathLine.on("click", () => onAirportSelect(destinationCode));
        }

        markersRef.current.push(pathLine);

        if (destinationCode && !destinationMarkers.has(destinationCode)) {
          destinationMarkers.set(destinationCode, selectionRoute.to);
        }
      });

      destinationMarkers.forEach((airport, airportCode) => {
        const latLng = L.latLng(airport.lat, airport.lon);
        const isSelected = Boolean(selectedAirportCode && airportCode === String(selectedAirportCode).trim().toUpperCase());
        const marker = L.marker(latLng, {
          icon: isSelected ? selectedDestinationIcon : destinationIcon,
        })
          .bindTooltip(`<b>${airportCode}</b><br/>${airport.name}`, { direction: "top" })
          .addTo(map);

        if (onAirportSelect) {
          marker.on("click", () => onAirportSelect(airportCode));
        }

        markersRef.current.push(marker);
      });

      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 6 });
      }

    } else if (airports.length > 0) {
      // Show all available airports if no route is selected
      const bounds = L.latLngBounds([]);
      
      airports.forEach(airport => {
        const code = airport.icao || airport.code || "UNK";
        const latLng = L.latLng(airport.lat, airport.lon);
        bounds.extend(latLng);

        const iataLine = airport.iata ? ` / ${airport.iata}` : "";
        const cityLine = airport.city ? `<br/>${airport.city}` : "";
        const countryLine = airport.country ? `<br/><span style="color:#888">${airport.country}</span>` : "";
        const marker = L.marker(latLng, { icon: airportIcon })
          .bindTooltip(`<b>${code}${iataLine}</b><br/>${airport.name}${cityLine}${countryLine}`, { direction: "top", opacity: 0.95 })
          .addTo(map);

        if (onAirportSelect) {
          marker.on("click", () => onAirportSelect(code));
        }

        markersRef.current.push(marker);
      });

      if (bounds.isValid()) {
        // Don't zoom in too much if it's just dots
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 5 });
      }
    }

  }, [availableRoutes, airports, onAirportSelect, originAirport, route, selectedAirportCode, showOriginMarker]);

  return (
    <div
      ref={mapContainerRef}
      className="w-full h-full min-h-[400px] bg-gray-100"
      style={{ zIndex: 0 }}
    />
  );
}

// Helper function to create curved path
function createCurvedPath(start: L.LatLng, end: L.LatLng): L.LatLng[] {
  const points: L.LatLng[] = [];
  const steps = 50;
  const midLat = (start.lat + end.lat) / 2;
  const midLng = (start.lng + end.lng) / 2;
  const dx = end.lng - start.lng;
  const dy = end.lat - start.lat;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const curvature = distance * 0.15; // Slightly less curvature
  const controlLat = midLat - (dx / distance) * curvature;
  const controlLng = midLng + (dy / distance) * curvature;

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const invT = 1 - t;
    const lat = invT * invT * start.lat + 2 * invT * t * controlLat + t * t * end.lat;
    const lng = invT * invT * start.lng + 2 * invT * t * controlLng + t * t * end.lng;
    points.push(L.latLng(lat, lng));
  }
  return points;
}
