import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { getIcaoFlagUri, getFlagUri, icaoToCountry } from "./flag-data";

export interface Airport {
  code?: string;
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

export interface HubData {
  code: string;
  name: string;
  lat: number;
  lon: number;
  routeCount: number;
  selected?: boolean;
}

interface FlightMapProps {
  route: Route | null;
  airports?: Airport[];
  availableRoutes?: SelectableRoute[];
  hubs?: HubData[];
  originAirport?: Airport | null;
  selectedAirportCode?: string | null;
  selectedHubCode?: string | null;
  onAirportSelect?: (airportCode: string) => void;
  onHubSelect?: (hubCode: string) => void;
  onHubHover?: (hubCode: string | null) => void;
  showOriginMarker?: boolean;
  mode?: "default" | "hubs";
  theme?: "light" | "dark";
  focusRouteId?: string | null;
}

// ── SVG pin factory ───────────────────────────────────────────────────────────

function makePinIcon(opts: {
  label?: string;
  bg?: string;
  border?: string;
  textColor?: string;
  size?: "sm" | "md" | "lg";
  pulse?: boolean;
  count?: number;
}) {
  const { label = "", bg = "#E31E24", border = "#fff", textColor = "#fff", size = "md", pulse = false, count } = opts;

  const dims = { sm: [28, 38], md: [36, 48], lg: [48, 62] }[size];
  const [w, h] = dims;
  const r = w / 2;
  const fontSize = size === "lg" ? 11 : size === "md" ? 10 : 9;
  const labelText = count !== undefined ? String(count) : (label.slice(0, 4));

  const pulseHtml = pulse
    ? `<div style="position:absolute;inset:-6px;border-radius:50%;border:2px solid ${bg};opacity:0.35;animation:pinPulse 2s infinite;"></div>`
    : "";

  return L.divIcon({
    html: `
      <div style="position:relative;width:${w}px;height:${h}px;">
        ${pulseHtml}
        <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 4px 8px rgba(0,0,0,0.28));">
          <path d="M${r} 2 C${r * 0.3} 2, 2 ${r * 0.7}, 2 ${r + 2} C2 ${r * 1.8}, ${r * 0.6} ${h * 0.72}, ${r} ${h - 2} C${r * 1.4} ${h * 0.72}, ${w - 2} ${r * 1.8}, ${w - 2} ${r + 2} C${w - 2} ${r * 0.7}, ${r * 1.7} 2, ${r} 2 Z" fill="${bg}" stroke="${border}" stroke-width="2"/>
          <circle cx="${r}" cy="${r + 1}" r="${r * 0.52}" fill="${border}" opacity="0.18"/>
          <text x="${r}" y="${r + 5}" text-anchor="middle" font-family="-apple-system,system-ui,sans-serif" font-weight="700" font-size="${fontSize}" fill="${textColor}" letter-spacing="-0.3">${labelText}</text>
        </svg>
      </div>
    `,
    className: "",
    iconSize: [w, h],
    iconAnchor: [r, h - 2],
    popupAnchor: [0, -(h - 4)],
  });
}

function makeDestPinIcon(code: string, selected: boolean, dark = false, flag = "") {
  const bg = selected ? "#E31E24" : (dark ? "#1e3a5f" : "#1e293b");
  const border = dark && !selected ? "#60a5fa" : "white";
  const d = 28;
  const flagUri = getFlagUri(flag);
  const flagBadge = flagUri
    ? `<div style="position:absolute;top:-4px;right:-7px;width:15px;height:10px;border:1.5px solid white;border-radius:2px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.45);flex-shrink:0;">
        <img src="${flagUri}" style="width:100%;height:100%;object-fit:cover;display:block;" />
       </div>`
    : "";
  return L.divIcon({
    html: `
      <div class="nws-marker-scale" style="position:relative;width:${d}px;height:${d}px;">
        <div style="width:${d}px;height:${d}px;border-radius:50%;background:${bg};border:2px solid ${border};box-shadow:0 3px 6px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;">
          <span style="font-family:-apple-system,system-ui,sans-serif;font-weight:700;font-size:7.5px;line-height:1;color:#fff;letter-spacing:-0.3px;">${code.slice(0, 4)}</span>
        </div>
        ${flagBadge}
      </div>
    `,
    className: "",
    iconSize: [d, d],
    iconAnchor: [d / 2, d / 2],
    popupAnchor: [0, -(d / 2 + 6)],
  });
}

function makeHubPinIcon(code: string, count: number, selected: boolean, dark = false, flag = "") {
  const bg = selected ? "#E31E24" : (dark ? "#1e3a5f" : "#0f172a");
  const border = dark && !selected ? "#60a5fa" : "white";
  const d = 46;
  const flagUri = getFlagUri(flag);
  const flagBadge = flagUri
    ? `<div style="position:absolute;top:-3px;right:-7px;width:18px;height:12px;border:1.5px solid white;border-radius:2px;overflow:hidden;box-shadow:0 2px 6px rgba(0,0,0,0.5);">
        <img src="${flagUri}" style="width:100%;height:100%;object-fit:cover;display:block;" />
       </div>`
    : "";
  return L.divIcon({
    html: `
      <div class="nws-marker-scale" style="position:relative;width:${d}px;height:${d}px;">
        ${selected ? `<div style="position:absolute;inset:-8px;border-radius:50%;border:2px solid rgba(227,30,36,0.4);animation:pinPulse 2s infinite;"></div>` : ""}
        <div style="width:${d}px;height:${d}px;border-radius:50%;background:${bg};border:2.5px solid ${border};box-shadow:0 6px 16px rgba(0,0,0,0.45);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;">
          <span style="font-family:-apple-system,system-ui,sans-serif;font-weight:800;font-size:11px;line-height:1;color:#fff;letter-spacing:-0.3px;">${code.slice(0, 4)}</span>
          <span style="font-family:-apple-system,system-ui,sans-serif;font-weight:600;font-size:8.5px;line-height:1;color:rgba(255,255,255,0.75);">${count} rts</span>
        </div>
        ${flagBadge}
      </div>
    `,
    className: "",
    iconSize: [d, d],
    iconAnchor: [d / 2, d / 2],
    popupAnchor: [0, -(d / 2 + 8)],
  });
}

// ── Component ────────────────────────────────────────────────────────────────

export function FlightMap({
  route,
  airports = [],
  availableRoutes = [],
  hubs = [],
  originAirport = null,
  selectedAirportCode = null,
  selectedHubCode = null,
  onAirportSelect,
  onHubSelect,
  onHubHover,
  showOriginMarker = true,
  mode = "default",
  theme = "light",
  focusRouteId = null,
}: FlightMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const layersRef = useRef<L.Layer[]>([]);
  // Защита от сброса зума: fitBounds выполняется только при смене набора данных,
  // а не при каждом перерендере родителя (hover-коллбэки пересоздают пропсы)
  const fitKeyRef = useRef<string>("");
  const fitOnce = (key: string, fit: () => void) => {
    if (fitKeyRef.current === key) return;
    fitKeyRef.current = key;
    fit();
  };

  // Inject pulse animation once
  useEffect(() => {
    if (typeof document !== "undefined" && !document.getElementById("pin-pulse-style")) {
      const style = document.createElement("style");
      style.id = "pin-pulse-style";
      style.textContent = `@keyframes pinPulse { 0%,100%{opacity:.35;transform:scale(1)} 50%{opacity:.15;transform:scale(1.25)} }`;
      document.head.appendChild(style);
    }
  }, []);

  // Init map once
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    mapRef.current = L.map(mapContainerRef.current, {
      center: [52.0, 42.0],
      zoom: 4,
      zoomControl: false,
      attributionControl: false,
    });

    const tileUrl = theme === "dark"
      ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

    L.tileLayer(tileUrl, {
      subdomains: "abcd",
      maxZoom: 19,
    }).addTo(mapRef.current);

    L.control.zoom({ position: "bottomright" }).addTo(mapRef.current);

    // Динамический масштаб маркеров: мельче на обзорном зуме, крупнее при приближении
    const applyMarkerScale = () => {
      const z = mapRef.current?.getZoom() ?? 4;
      const scale = Math.min(1.05, Math.max(0.5, 0.28 + z * 0.105));
      mapContainerRef.current?.style.setProperty("--nws-marker-scale", String(scale));
    };
    applyMarkerScale();
    mapRef.current.on("zoom", applyMarkerScale);
    mapRef.current.on("zoomend", applyMarkerScale);

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fly-to when a route is focused (without hiding other routes)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusRouteId || !availableRoutes?.length) return;
    const r = availableRoutes.find((x) => x.id === focusRouteId);
    if (!r || !Number.isFinite(r.from.lat) || !Number.isFinite(r.to.lat)) return;
    const b = L.latLngBounds([[r.from.lat, r.from.lon], [r.to.lat, r.to.lon]]);
    if (b.isValid()) map.flyToBounds(b, { padding: [100, 100], maxZoom: 7, duration: 0.7 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRouteId]);

  // Re-draw layers whenever data changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    layersRef.current.forEach((l) => map.removeLayer(l));
    layersRef.current = [];

    const add = (l: L.Layer) => { l.addTo(map); layersRef.current.push(l); return l; };
    const bounds = L.latLngBounds([]);
    const isDark = theme === "dark";

    const inactiveColor = isDark ? "#f87171" : "#fca5a5";
    const inactiveOpacity = isDark ? 0.5 : 0.3;
    const inactiveWeight = isDark ? 1.5 : 1.2;

    // ── Mode: hubs ──────────────────────────────────────────────────────────
    if (mode === "hubs") {
      const hubBounds = L.latLngBounds([]);
      const destBounds = L.latLngBounds([]);
      const destSeen = new Set<string>();

      // 1. Draw ALL routes as very dim background network lines (inactive first)
      availableRoutes.forEach((r) => {
        if (!Number.isFinite(r.from.lat) || !Number.isFinite(r.to.lat)) return;
        if (Boolean(r.active)) return; // draw active on top
        const fromLL = L.latLng(r.from.lat, r.from.lon);
        const toLL = L.latLng(r.to.lat, r.to.lon);
        const isHubMatch = !selectedHubCode || (r.from.icao || r.from.code || "").toUpperCase() === selectedHubCode;
        add(L.polyline(createCurvedPath(fromLL, toLL), {
          color: isDark ? "#f87171" : "#f87171",
          weight: isHubMatch && selectedHubCode ? 1.5 : 1,
          opacity: isDark
            ? (isHubMatch && selectedHubCode ? 0.40 : 0.14)
            : (isHubMatch && selectedHubCode ? 0.35 : 0.22),
          dashArray: isHubMatch && selectedHubCode ? "5 8" : "3 10",
        }).bindTooltip(r.label || `${r.from.icao || r.from.code} → ${r.to.icao || r.to.code}`, {
          direction: "top", sticky: true, offset: [0, -8],
          className: "nws-route-tip",
        }));
      });

      // 2. Draw ACTIVE routes with multi-layer glow on top
      availableRoutes.filter((r) => Boolean(r.active)).forEach((r) => {
        if (!Number.isFinite(r.from.lat) || !Number.isFinite(r.to.lat)) return;
        const fromLL = L.latLng(r.from.lat, r.from.lon);
        const toLL = L.latLng(r.to.lat, r.to.lon);
        const destCode = (r.to.icao || r.to.code || "").toUpperCase();
        const path = createCurvedPath(fromLL, toLL);

        // Glow layers: wide dim → medium → thin solid
        add(L.polyline(path, { color: "#E31E24", weight: 28, opacity: 0.05 }));
        add(L.polyline(path, { color: "#E31E24", weight: 12, opacity: 0.11 }));
        add(L.polyline(path, { color: "#E31E24", weight: 4, opacity: 0.35 }));
        add(L.polyline(path, { color: "#ff5a5f", weight: 2.5, opacity: 0.98 }));

        if (!destSeen.has(destCode)) {
          destSeen.add(destCode);
          const m = add(
            L.marker(toLL, { icon: makeDestPinIcon(destCode, true, isDark, icaoToCountry(destCode)), zIndexOffset: 600 })
              .bindPopup(
                `<div style="font-family:-apple-system,system-ui,sans-serif;"><div style="font-weight:800;font-size:14px;color:#0f172a">${destCode}</div><div style="color:#64748b;font-size:12px;margin-top:1px">${r.to.name}</div></div>`,
                { closeButton: false, className: "nws-popup" }
              )
          );
          if (onAirportSelect) m.on("click", () => onAirportSelect(destCode));
        }
      });

      // 3. Destination markers for hub-selected routes (non-active)
      if (selectedHubCode) {
        availableRoutes
          .filter((r) => !r.active && (r.from.icao || r.from.code || "").toUpperCase() === selectedHubCode)
          .forEach((r) => {
            if (!Number.isFinite(r.to.lat)) return;
            const toLL = L.latLng(r.to.lat, r.to.lon);
            const destCode = (r.to.icao || r.to.code || "").toUpperCase();
            destBounds.extend(toLL);
            if (!destSeen.has(destCode)) {
              destSeen.add(destCode);
              const m = add(
                L.marker(toLL, { icon: makeDestPinIcon(destCode, false, isDark, icaoToCountry(destCode)), zIndexOffset: 0 })
                  .bindPopup(
                    `<div style="font-family:-apple-system,system-ui,sans-serif;"><div style="font-weight:800;font-size:14px;color:#0f172a">${destCode}</div><div style="color:#64748b;font-size:12px;margin-top:1px">${r.to.name}</div></div>`,
                    { closeButton: false, className: "nws-popup" }
                  )
              );
              if (onAirportSelect) m.on("click", () => onAirportSelect(destCode));
            }
          });
      }

      // 4. Hub markers on top of everything
      hubs.forEach((hub) => {
        const ll = L.latLng(hub.lat, hub.lon);
        hubBounds.extend(ll);
        const isSelected = hub.code === selectedHubCode;
        const marker = add(
          L.marker(ll, { icon: makeHubPinIcon(hub.code, hub.routeCount, isSelected, isDark, icaoToCountry(hub.code)), zIndexOffset: isSelected ? 2000 : 1000 })
            .bindPopup(
              `<div style="font-family:-apple-system,system-ui,sans-serif;min-width:160px;">
                <div style="display:flex;align-items:center;gap:7px;">
                  ${getIcaoFlagUri(hub.code) ? `<img src="${getIcaoFlagUri(hub.code)}" style="width:20px;height:14px;border-radius:2px;object-fit:cover;border:1px solid rgba(0,0,0,0.1);" />` : ""}
                  <div style="font-weight:800;font-size:15px;color:#0f172a">${hub.code}</div>
                </div>
                <div style="color:#64748b;font-size:12px;margin-top:3px">${hub.name}</div>
                <div style="margin-top:8px;display:flex;align-items:center;gap:6px;">
                  <span style="background:#E31E24;color:#fff;border-radius:99px;padding:2px 10px;font-size:11px;font-weight:700">${hub.routeCount} рейсов</span>
                </div>
              </div>`,
              { closeButton: false, className: "nws-popup" }
            )
        );
        if (onHubSelect) marker.on("click", () => onHubSelect(hub.code));
        if (onHubHover) {
          marker.on("mouseover", () => onHubHover(hub.code));
          marker.on("mouseout", () => onHubHover(null));
        }
      });

      // 5. Fit bounds: hub routes when hub selected, all hubs otherwise
      fitOnce(`hubs|${selectedHubCode || ""}|${hubs.map((h) => h.code).join(",")}`, () => {
        if (selectedHubCode) {
          const selectedHub = hubs.find((h) => h.code === selectedHubCode);
          const pts: [number, number][] = [];
          if (selectedHub) pts.push([selectedHub.lat, selectedHub.lon]);
          if (destBounds.isValid()) {
            pts.push([destBounds.getNorth(), destBounds.getEast()]);
            pts.push([destBounds.getSouth(), destBounds.getWest()]);
          }
          const b = L.latLngBounds(pts);
          if (b.isValid()) map.fitBounds(b, { padding: [70, 70], maxZoom: 6 });
        } else if (hubBounds.isValid()) {
          map.fitBounds(hubBounds, { padding: [60, 60], maxZoom: 5 });
        }
      });
      return;
    }

    // ── Mode: single selected route ─────────────────────────────────────────
    if (route) {
      route.legs.forEach((leg) => {
        const fromLL = L.latLng(leg.from.lat, leg.from.lon);
        const toLL = L.latLng(leg.to.lat, leg.to.lon);
        const fromCode = (leg.from.icao || leg.from.code || "UNK").toUpperCase();
        const toCode = (leg.to.icao || leg.to.code || "UNK").toUpperCase();

        bounds.extend(fromLL);
        bounds.extend(toLL);

        const path = createCurvedPath(fromLL, toLL);

        if (isDark) {
          add(L.polyline(path, { color: "#E31E24", weight: 14, opacity: 0.12 }));
          add(L.polyline(path, { color: "#E31E24", weight: 5, opacity: 0.3 }));
        }
        add(L.polyline(path, { color: "#E31E24", weight: 2.5, opacity: 0.9 }));

        const mid = path[25];
        add(L.marker(mid, {
          icon: L.divIcon({
            html: `<div style="width:32px;height:32px;background:#E31E24;border:2.5px solid white;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 16px rgba(227,30,36,0.55);">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg>
            </div>`,
            className: "",
            iconSize: [32, 32],
            iconAnchor: [16, 16],
          }),
          zIndexOffset: 1000,
        }));

        add(L.marker(fromLL, { icon: makeHubPinIcon(fromCode, 1, false, isDark, icaoToCountry(fromCode)) })
          .bindPopup(`<div style="font-family:-apple-system,system-ui,sans-serif;"><div style="font-weight:800;font-size:14px">${fromCode}</div><div style="color:#64748b;font-size:12px">${leg.from.name}</div></div>`,
            { closeButton: false, className: "nws-popup" }));
        add(L.marker(toLL, { icon: makeDestPinIcon(toCode, true, isDark, icaoToCountry(toCode)) })
          .bindPopup(`<div style="font-family:-apple-system,system-ui,sans-serif;"><div style="font-weight:800;font-size:14px">${toCode}</div><div style="color:#64748b;font-size:12px">${leg.to.name}</div></div>`,
            { closeButton: false, className: "nws-popup" }));
      });

      fitOnce(`route|${route.id}`, () => {
        if (bounds.isValid()) map.fitBounds(bounds, { padding: [80, 80] });
      });
      return;
    }

    // ── Mode: default multi-route ───────────────────────────────────────────
    if (availableRoutes.length > 0) {
      const destMarkers = new Map<string, Airport>();
      const originCodes = new Set(availableRoutes.map((r) => (r.from.icao || r.from.code || "").toUpperCase()));
      const effectiveOrigin = originAirport || availableRoutes[0]?.from || null;
      const singleOrigin = originCodes.size <= 1;

      if (effectiveOrigin && showOriginMarker && singleOrigin) {
        const ll = L.latLng(effectiveOrigin.lat, effectiveOrigin.lon);
        const hubCode = (effectiveOrigin.icao || effectiveOrigin.code || "HUB").toUpperCase();
        bounds.extend(ll);
        const originMarker = add(L.marker(ll, {
          icon: makeHubPinIcon(hubCode, availableRoutes.length, false, isDark, icaoToCountry(effectiveOrigin.icao || effectiveOrigin.code)),
          zIndexOffset: 2000,
        }));
        if (onHubHover) {
          originMarker.on("mouseover", () => onHubHover(hubCode));
          originMarker.on("mouseout", () => onHubHover(null));
        }
      }

      availableRoutes.forEach((r) => {
        const fromLL = L.latLng(r.from.lat, r.from.lon);
        const toLL = L.latLng(r.to.lat, r.to.lon);
        const destCode = (r.to.icao || r.to.code || "").toUpperCase();
        const isActive = Boolean(r.active || (selectedAirportCode && destCode === selectedAirportCode));

        bounds.extend(fromLL);
        bounds.extend(toLL);

        const path = createCurvedPath(fromLL, toLL);

        if (isActive && isDark) {
          add(L.polyline(path, { color: "#E31E24", weight: 10, opacity: 0.15 }));
        }
        const line = add(L.polyline(path, {
          color: isActive ? "#E31E24" : inactiveColor,
          weight: isActive ? 2.5 : inactiveWeight,
          opacity: isActive ? 0.9 : inactiveOpacity,
          dashArray: isActive ? undefined : (isDark ? "4 6" : "5 8"),
        }).bindTooltip(r.label || `${r.from.icao || r.from.code} → ${r.to.icao || r.to.code}`, { direction: "top" }));

        if (onAirportSelect && destCode) line.on("click", () => onAirportSelect(destCode));
        if (destCode && !destMarkers.has(destCode)) destMarkers.set(destCode, r.to);
      });

      destMarkers.forEach((airport, code) => {
        const ll = L.latLng(airport.lat, airport.lon);
        const isSelected = code === selectedAirportCode;
        const m = add(L.marker(ll, { icon: makeDestPinIcon(code, isSelected, isDark, icaoToCountry(code)), zIndexOffset: isSelected ? 500 : 0 })
          .bindPopup(
            `<div style="font-family:-apple-system,system-ui,sans-serif;"><div style="font-weight:800;font-size:14px">${code}</div><div style="color:#64748b;font-size:12px">${airport.name}</div></div>`,
            { closeButton: false, className: "nws-popup" }
          ));
        if (onAirportSelect) m.on("click", () => onAirportSelect(code));
      });

      fitOnce(`multi|${availableRoutes.map((r) => r.id).join(",")}`, () => {
        if (bounds.isValid()) map.fitBounds(bounds, { padding: [50, 50], maxZoom: 6 });
      });
      return;
    }

    // ── Fallback: plain airport pins ────────────────────────────────────────
    airports.forEach((airport) => {
      const code = (airport.icao || airport.code || "UNK").toUpperCase();
      const ll = L.latLng(airport.lat, airport.lon);
      bounds.extend(ll);
      const m = add(L.marker(ll, { icon: makeDestPinIcon(code, false, isDark, icaoToCountry(code)) })
        .bindPopup(
          `<div style="font-family:-apple-system,system-ui,sans-serif;"><div style="font-weight:800;font-size:14px">${code}</div><div style="color:#64748b;font-size:12px">${airport.name}</div></div>`,
          { closeButton: false, className: "nws-popup" }
        ));
      if (onAirportSelect) m.on("click", () => onAirportSelect(code));
    });

    fitOnce(`apts|${airports.map((a) => a.icao || a.code).join(",")}`, () => {
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [60, 60], maxZoom: 5 });
    });
  }, [route, airports, availableRoutes, hubs, originAirport, selectedAirportCode, selectedHubCode, showOriginMarker, mode, theme, onAirportSelect, onHubSelect, onHubHover]);

  return (
    <>
      <style>{`
        .nws-popup .leaflet-popup-content-wrapper {
          border-radius: 12px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.18);
          padding: 0;
          border: 1px solid rgba(0,0,0,0.06);
        }
        .nws-popup .leaflet-popup-content { margin: 12px 14px; }
        .nws-popup .leaflet-popup-tip { display: none; }
        .nws-route-tip { background: rgba(15,23,42,0.92) !important; border: 1px solid rgba(255,255,255,0.1) !important; color: #e2e8f0 !important; font-size: 11px !important; font-weight: 600 !important; border-radius: 6px !important; box-shadow: 0 4px 12px rgba(0,0,0,0.3) !important; }
        .nws-route-tip::before { display: none !important; }
        .leaflet-container { font-family: -apple-system, system-ui, sans-serif; }
        .nws-marker-scale {
          transform: scale(var(--nws-marker-scale, 1));
          transform-origin: center center;
          transition: transform 0.15s ease-out;
        }
        .leaflet-control-zoom a {
          background: rgba(15,23,42,0.85) !important;
          color: #e2e8f0 !important;
          border-color: rgba(255,255,255,0.1) !important;
        }
        .leaflet-control-zoom a:hover {
          background: rgba(30,58,95,0.95) !important;
          color: #fff !important;
        }
      `}</style>
      <div ref={mapContainerRef} className="w-full h-full min-h-[400px]" style={{ zIndex: 0 }} />
    </>
  );
}

function createCurvedPath(start: L.LatLng, end: L.LatLng): L.LatLng[] {
  const points: L.LatLng[] = [];
  const steps = 50;
  const midLat = (start.lat + end.lat) / 2;
  const midLng = (start.lng + end.lng) / 2;
  const dx = end.lng - start.lng;
  const dy = end.lat - start.lat;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist === 0) return [start, end];
  const curv = dist * 0.14;
  const ctrlLat = midLat - (dx / dist) * curv;
  const ctrlLng = midLng + (dy / dist) * curv;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, inv = 1 - t;
    points.push(L.latLng(
      inv * inv * start.lat + 2 * inv * t * ctrlLat + t * t * end.lat,
      inv * inv * start.lng + 2 * inv * t * ctrlLng + t * t * end.lng,
    ));
  }
  return points;
}
