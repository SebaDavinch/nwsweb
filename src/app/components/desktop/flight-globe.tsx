import { useEffect, useRef } from "react";
import createGlobe, { type Marker, type Arc } from "cobe";

interface Pt {
  lat: number | null;
  lon: number | null;
}

/**
 * Лёгкий IFE-глобус (cobe): дуга маршрута вылет→прилёт, маркеры точек и борта,
 * авто-вращение к текущей позиции. Данные обновляются через globe.update без пересоздания.
 */
export function FlightGlobe({
  departure,
  arrival,
  current,
  divert,
  className = "",
}: {
  departure: Pt;
  arrival: Pt;
  current: Pt;
  divert?: Pt | null;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ptsRef = useRef({ departure, arrival, current, divert });
  ptsRef.current = { departure, arrival, current, divert };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let width = canvas.offsetWidth || 320;
    const onResize = () => {
      width = canvas.offsetWidth || width;
    };
    window.addEventListener("resize", onResize);

    const buildMarkers = (): Marker[] => {
      const { departure: d, arrival: a, current: c, divert: dv } = ptsRef.current;
      const m: Marker[] = [];
      if (d.lat != null && d.lon != null) m.push({ location: [d.lat, d.lon], size: 0.04 });
      if (a.lat != null && a.lon != null) m.push({ location: [a.lat, a.lon], size: 0.04 });
      if (dv?.lat != null && dv?.lon != null) m.push({ location: [dv.lat, dv.lon], size: 0.06, color: [0.95, 0.2, 0.2] });
      if (c.lat != null && c.lon != null) m.push({ location: [c.lat, c.lon], size: 0.07, color: [1, 1, 1] });
      return m;
    };
    const buildArcs = (): Arc[] => {
      const { departure: d, arrival: a, current: c, divert: dv } = ptsRef.current;
      const arcs: Arc[] = [];
      if (d.lat != null && d.lon != null && a.lat != null && a.lon != null) {
        arcs.push({ from: [d.lat, d.lon], to: [a.lat, a.lon] });
      }
      // Дуга диверта: от текущей позиции к запасному (как на FlightRadar).
      if (dv?.lat != null && dv?.lon != null && c.lat != null && c.lon != null) {
        arcs.push({ from: [c.lat, c.lon], to: [dv.lat, dv.lon], color: [0.95, 0.2, 0.2] });
      }
      return arcs;
    };

    let phi = 0;
    const globe = createGlobe(canvas, {
      devicePixelRatio: 2,
      width: width * 2,
      height: width * 2,
      phi: 0,
      theta: 0.3,
      dark: 1,
      diffuse: 1.2,
      mapSamples: 16000,
      mapBrightness: 6,
      baseColor: [0.25, 0.25, 0.3],
      markerColor: [0.89, 0.12, 0.14],
      glowColor: [0.35, 0.12, 0.14],
      markers: buildMarkers(),
      arcs: buildArcs(),
      arcColor: [0.95, 0.35, 0.2],
      arcWidth: 0.6,
      arcHeight: 0.4,
    });

    let raf = 0;
    const tick = () => {
      const { current: c, departure: d, arrival: a } = ptsRef.current;
      const focusLon = c.lon != null ? c.lon : d.lon != null && a.lon != null ? (d.lon + a.lon) / 2 : 0;
      const targetPhi = -(focusLon * Math.PI) / 180;
      phi += (targetPhi - phi) * 0.03 + 0.0015;
      globe.update({
        phi,
        width: width * 2,
        height: width * 2,
        markers: buildMarkers(),
        arcs: buildArcs(),
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      globe.destroy();
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: "100%", height: "100%", aspectRatio: "1", contain: "layout paint size" }}
    />
  );
}
