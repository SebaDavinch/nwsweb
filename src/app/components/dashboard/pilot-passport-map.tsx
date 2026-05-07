import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import * as countries from "i18n-iso-countries";
import { feature } from "topojson-client";

interface CountryMapSummary {
  iso2: string;
  name: string;
  visitedAirports: number;
  totalAirports: number;
}

interface PilotPassportMapProps {
  countries: CountryMapSummary[];
  selectedCountryIso2: string | null;
  countryNameByIso2: Record<string, string>;
  onSelectCountry: (countryIso2: string) => void;
  visibilityFilter?: "all" | "visited" | "not-visited";
}

type CountriesTopology = {
  objects?: {
    countries?: unknown;
  };
};

const normalizeIso2 = (value: unknown) => {
  const iso2 = String(value || "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(iso2) ? iso2 : null;
};

const unwrapRing = (ring: unknown) => {
  if (!Array.isArray(ring)) {
    return ring;
  }

  let previousLongitude: number | null = null;
  return ring.map((point) => {
    if (!Array.isArray(point) || point.length < 2) {
      return point;
    }

    let longitude = Number(point[0]);
    const latitude = Number(point[1]);
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
      return point;
    }

    if (previousLongitude != null) {
      while (longitude - previousLongitude > 180) longitude -= 360;
      while (previousLongitude - longitude > 180) longitude += 360;
    }

    previousLongitude = longitude;
    return [longitude, latitude, ...point.slice(2)];
  });
};

const normalizeGeometryCoordinates = (coordinates: unknown): unknown => {
  if (!Array.isArray(coordinates) || coordinates.length === 0) {
    return coordinates;
  }

  if (Array.isArray(coordinates[0]) && typeof coordinates[0][0] === "number") {
    return unwrapRing(coordinates);
  }

  return coordinates.map((entry) => normalizeGeometryCoordinates(entry));
};

const normalizeFeatureCollection = (geoJson: GeoJSON.FeatureCollection): GeoJSON.FeatureCollection => ({
  ...geoJson,
  features: Array.isArray(geoJson.features)
    ? geoJson.features.map((entry) => {
        if (!entry?.geometry || !("coordinates" in entry.geometry)) {
          return entry;
        }

        return {
          ...entry,
          geometry: {
            ...entry.geometry,
            coordinates: normalizeGeometryCoordinates(entry.geometry.coordinates) as never,
          },
        };
      })
    : [],
});

const resolveFeatureIso2 = (entry: { id?: string | number; properties?: Record<string, unknown> }) => {
  const propertyIso2 = normalizeIso2(entry?.properties?.iso_a2 || entry?.properties?.iso2);
  if (propertyIso2) {
    return propertyIso2;
  }

  const rawId = String(entry?.id || entry?.properties?.iso_n3 || "").trim();
  if (!/^\d+$/.test(rawId)) {
    return null;
  }

  return normalizeIso2(countries.numericToAlpha2(rawId.padStart(3, "0")));
};

export function PilotPassportMap({
  countries: countrySummaries,
  selectedCountryIso2,
  countryNameByIso2,
  onSelectCountry,
  visibilityFilter = "all",
}: PilotPassportMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.GeoJSON | null>(null);
  const [topology, setTopology] = useState<CountriesTopology | null>(null);

  useEffect(() => {
    let active = true;

    fetch("/countries-110m.json")
      .then((response) => response.json())
      .then((payload) => {
        if (active) {
          setTopology(payload as CountriesTopology);
        }
      })
      .catch(() => {
        if (active) {
          setTopology(null);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    const map = L.map(containerRef.current, {
      center: [28, 15],
      zoom: 2.2,
      minZoom: 2,
      maxZoom: 6,
      zoomControl: false,
      attributionControl: false,
      scrollWheelZoom: false,
      dragging: true,
      worldCopyJump: false,
      zoomSnap: 0.25,
      preferCanvas: true,
    });

    containerRef.current.style.background = "radial-gradient(circle at top left, rgba(255,255,255,0.22), transparent 34%), linear-gradient(180deg, #eaf3ff 0%, #d5e7ff 52%, #bfdcff 100%)";

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !topology?.objects?.countries) {
      return;
    }

    if (layerRef.current) {
      layerRef.current.remove();
      layerRef.current = null;
    }

    const countrySummaryMap = new Map(countrySummaries.map((item) => [item.iso2.toUpperCase(), item]));
    const rawGeoJson = feature(topology as never, topology.objects.countries as never) as unknown as GeoJSON.FeatureCollection;
    const geoJson = normalizeFeatureCollection(rawGeoJson);

    const layer = L.geoJSON(geoJson as GeoJSON.GeoJsonObject, {
      style: (entry) => {
        const iso2 = resolveFeatureIso2((entry || {}) as { id?: string | number; properties?: Record<string, unknown> });
        const summary = iso2 ? countrySummaryMap.get(iso2) : null;
        const totalAirports = summary?.totalAirports || 0;
        const visitedAirports = summary?.visitedAirports || 0;
        const progress = totalAirports > 0 ? Math.min(1, visitedAirports / totalAirports) : visitedAirports > 0 ? 1 : 0;
        const hasNetworkCoverage = totalAirports > 0;
        const hasVisits = visitedAirports > 0;
        const isSelected = Boolean(iso2 && selectedCountryIso2 && iso2 === selectedCountryIso2);
        const matchesFilter =
          visibilityFilter === "all" ||
          (visibilityFilter === "visited" ? hasVisits : hasNetworkCoverage && !hasVisits);

        let fillColor = "#d8e3f3";
        let fillOpacity = 0.34;
        let borderColor = "#b8c9de";
        let borderWeight = 0.8;

        if (hasNetworkCoverage) {
          const hue = 46 + Math.round(progress * 112);
          const saturation = 76;
          const lightness = 86 - Math.round(progress * 34);
          fillColor = `hsl(${hue} ${saturation}% ${lightness}%)`;
          fillOpacity = hasVisits ? 0.82 : 0.56;
          borderColor = progress >= 0.99 ? "#0f766e" : hasVisits ? "#2a9d8f" : "#c8a449";
          borderWeight = hasVisits ? 1.2 : 0.95;
        } else if (hasVisits) {
          fillColor = "#48b3a5";
          fillOpacity = 0.72;
          borderColor = "#17756a";
          borderWeight = 1.1;
        }

        if (!matchesFilter) {
          fillOpacity *= 0.22;
          borderWeight = Math.max(0.6, borderWeight - 0.2);
          borderColor = "#cbd5e1";
        }

        return {
          color: isSelected ? "#0f172a" : borderColor,
          weight: isSelected ? 1.8 : borderWeight,
          fillColor: isSelected ? "#0f766e" : fillColor,
          fillOpacity: isSelected ? 0.92 : fillOpacity,
          lineJoin: "round",
        };
      },
      onEachFeature: (entry, entryLayer) => {
        const iso2 = resolveFeatureIso2(entry as { id?: string | number; properties?: Record<string, unknown> });
        if (!iso2) {
          return;
        }

        const summary = countrySummaryMap.get(iso2);
        const countryName = countryNameByIso2[iso2] || String(entry.properties?.name || iso2).trim() || iso2;
        const tooltipLines = [countryName];
        if (summary?.totalAirports) {
          tooltipLines.push(`${summary.visitedAirports} / ${summary.totalAirports} airports`);
        } else if (summary?.visitedAirports) {
          tooltipLines.push(`${summary.visitedAirports} visited airports`);
        }

        entryLayer.bindTooltip(tooltipLines.join("\n"), {
          sticky: true,
          direction: "top",
          className: "pilot-passport-map-tooltip",
        });
        if (summary && (summary.totalAirports > 0 || summary.visitedAirports > 0)) {
          entryLayer.on("click", () => onSelectCountry(iso2));
          if (entryLayer instanceof L.Path) {
            entryLayer.on("mouseover", () => {
              entryLayer.setStyle({ weight: 1.8, color: "#0f172a" });
            });
            entryLayer.on("mouseout", () => {
              layer.resetStyle(entryLayer);
            });
          }
        }
      },
    }).addTo(mapRef.current);

    layerRef.current = layer;
  }, [countryNameByIso2, countrySummaries, onSelectCountry, selectedCountryIso2, topology, visibilityFilter]);

  return (
    <div className="relative h-full min-h-[620px] overflow-hidden rounded-[28px] border border-white/40 bg-[#d9e9ff] shadow-[0_24px_80px_rgba(15,23,42,0.14)]">
      <div ref={containerRef} className="h-full min-h-[620px] w-full" />
    </div>
  );
}