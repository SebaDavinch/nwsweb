import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface FlightDetailMapProps {
  depAirport: { lat: number; lon: number };
  arrAirport: { lat: number; lon: number };
  currentPos: [number, number];
  mapCenter: [number, number];
  gradientPath: [number, number][];
  weatherLayers: Record<string, boolean>;
  progress?: number;
}

// Create gradient airplane icon with rotation
const createGradientAirplaneIcon = (angle: number = -45) => {
  return L.divIcon({
    html: `<div style="transform: rotate(${angle}deg);">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="url(#planeGradient)" stroke="white" stroke-width="1">
        <defs>
          <linearGradient id="planeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#10b981;stop-opacity:1" />
            <stop offset="50%" style="stop-color:#3b82f6;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#8b5cf6;stop-opacity:1" />
          </linearGradient>
        </defs>
        <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
      </svg>
    </div>`,
    className: "gradient-airplane-marker",
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
};

// Create airport marker icon
const createAirportMarker = () => {
  return L.divIcon({
    html: `<div style="background: #10b981; border: 3px solid #065f46; border-radius: 50%; width: 16px; height: 16px; box-shadow: 0 0 10px rgba(16, 185, 129, 0.8);"></div>`,
    className: "airport-marker-custom",
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
};

export function FlightDetailMap({ depAirport, arrAirport, currentPos, mapCenter, gradientPath, weatherLayers: _weatherLayers, progress }: FlightDetailMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  void _weatherLayers;

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      center: mapCenter,
      zoom: 5,
      scrollWheelZoom: true,
      zoomControl: false,
    });

    // Dark theme tile layer
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
    }).addTo(map);

    mapInstanceRef.current = map;
    layerGroupRef.current = L.layerGroup().addTo(map);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [mapCenter]);

  useEffect(() => {
    if (!mapInstanceRef.current) {
      return;
    }
    mapInstanceRef.current.setView(mapCenter, mapInstanceRef.current.getZoom());
  }, [mapCenter]);

  // Update flight layers
  useEffect(() => {
    if (!mapInstanceRef.current || !layerGroupRef.current) return;

    // Clear existing layers
    layerGroupRef.current.clearLayers();

    // Create gradient route with three polylines
    const segment1 = gradientPath.slice(0, Math.floor(gradientPath.length / 3));
    const segment2 = gradientPath.slice(
      Math.floor(gradientPath.length / 3),
      Math.floor((2 * gradientPath.length) / 3)
    );
    const segment3 = gradientPath.slice(Math.floor((2 * gradientPath.length) / 3));

    L.polyline(segment1, {
      color: "#10b981",
      weight: 4,
      opacity: 0.8,
    }).addTo(layerGroupRef.current);

    L.polyline(segment2, {
      color: "#3b82f6",
      weight: 4,
      opacity: 0.8,
    }).addTo(layerGroupRef.current);

    L.polyline(segment3, {
      color: "#8b5cf6",
      weight: 4,
      opacity: 0.8,
    }).addTo(layerGroupRef.current);

    // Airport markers
    L.marker([depAirport.lat, depAirport.lon], {
      icon: createAirportMarker(),
    }).addTo(layerGroupRef.current);

    L.marker([arrAirport.lat, arrAirport.lon], {
      icon: createAirportMarker(),
    }).addTo(layerGroupRef.current);

    // Calculate heading angle for airplane rotation
    let heading = -45; // Default angle
    
    if (progress !== undefined) {
      const t = progress / 100;
      const delta = 0.01;
      
      const midLat = (depAirport.lat + arrAirport.lat) / 2;
      const midLon = (depAirport.lon + arrAirport.lon) / 2;
      const dx = arrAirport.lon - depAirport.lon;
      const dy = arrAirport.lat - depAirport.lat;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const arcHeight = distance * 0.15;
      const perpX = -dy / distance;
      const perpY = dx / distance;
      const controlLat = midLat + perpY * arcHeight;
      const controlLon = midLon + perpX * arcHeight;
      
      const lat1 = (1 - t) * (1 - t) * depAirport.lat + 2 * (1 - t) * t * controlLat + t * t * arrAirport.lat;
      const lon1 = (1 - t) * (1 - t) * depAirport.lon + 2 * (1 - t) * t * controlLon + t * t * arrAirport.lon;
      
      const t2 = Math.min(t + delta, 1);
      const lat2 = (1 - t2) * (1 - t2) * depAirport.lat + 2 * (1 - t2) * t2 * controlLat + t2 * t2 * arrAirport.lat;
      const lon2 = (1 - t2) * (1 - t2) * depAirport.lon + 2 * (1 - t2) * t2 * controlLon + t2 * t2 * arrAirport.lon;
      
      heading = Math.atan2(lon2 - lon1, lat2 - lat1) * 180 / Math.PI;
    }

    // Airplane marker
    L.marker(currentPos, {
      icon: createGradientAirplaneIcon(heading),
    }).addTo(layerGroupRef.current);
  }, [depAirport, arrAirport, currentPos, gradientPath, progress]);

  return <div ref={mapRef} className="w-full h-full" />;
}