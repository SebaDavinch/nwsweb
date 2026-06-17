import { useEffect, useRef, useState } from "react";
import { fetchNearestAirport, lookupAirport, type NearestAirportInfo } from "./use-company-airports";
import type { FlightTelemetry } from "./use-flight-telemetry";

const toRad = (d: number) => (d * Math.PI) / 180;
const R_NM = 3440.065;

function distNm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R_NM * Math.asin(Math.min(1, Math.sqrt(h)));
}
function bearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δλ = toRad(lon2 - lon1);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (Math.atan2(y, x) * 180) / Math.PI;
}
// Боковое отклонение от линии маршрута (nm).
function crossTrack(t: FlightTelemetry): number | null {
  const { currentLat: cLat, currentLon: cLon, departureLat: dLat, departureLon: dLon, arrivalLat: aLat, arrivalLon: aLon } = t;
  if ([cLat, cLon, dLat, dLon, aLat, aLon].some((v) => v == null)) return null;
  const d13 = distNm(dLat!, dLon!, cLat!, cLon!);
  const θ13 = toRad(bearing(dLat!, dLon!, cLat!, cLon!));
  const θ12 = toRad(bearing(dLat!, dLon!, aLat!, aLon!));
  return Math.abs(Math.asin(Math.sin(d13 / R_NM) * Math.sin(θ13 - θ12)) * R_NM);
}

// Пороги: «похоже на уход на запасной».
const OFF_TRACK_NM = 45; // ушёл вбок от маршрута (больше типичного спрямления)
const FAR_FROM_ARR_NM = 90; // ещё далеко до исходного прилёта
const LOW_ALT_FT = 14000; // снижается значительно ниже крейсера
const VERY_LOW_FT = 9000; // совсем низко далеко от пункта — почти наверняка диверт

export type DivertDecision = "pending" | "confirmed" | "dismissed";

export interface DivertDetect {
  candidate: boolean; // геометрия указывает на возможный уход на запасной
  decision: DivertDecision; // решение пользователя по этому рейсу
  target: NearestAirportInfo | null; // аэропорт диверта (ручной выбор приоритетнее авто-детекта)
  manual: boolean; // цель задана пользователем вручную
  confirm: () => void;
  dismiss: () => void;
  setManual: (icao: string) => Promise<boolean>; // выбрать аэропорт вручную по ICAO
  clearManual: () => void; // вернуться к авто-определению
}

function readDecision(bookingId: number): DivertDecision {
  try {
    return (window.localStorage.getItem(`nws.divert.${bookingId}`) as DivertDecision) || "pending";
  } catch {
    return "pending";
  }
}
function writeDecision(bookingId: number, d: DivertDecision) {
  try {
    window.localStorage.setItem(`nws.divert.${bookingId}`, d);
  } catch {
    /* ignore */
  }
}

/**
 * Геометрический детект ухода на запасной + определение аэропорта снижения.
 * НЕ меняет статус сам — отдаёт `candidate` для алерта-подтверждения. Решение пользователя
 * (confirm/dismiss) хранится на рейс (bookingId). Аэропорт цели — ближайший к позиции по
 * мировой базе (с приоритетом базы компании), исключая исходный прилёт.
 */
export function useDivertDetect(
  bookingId: number,
  tele: FlightTelemetry,
  originalArrivalIcao: string
): DivertDetect {
  const [decision, setDecision] = useState<DivertDecision>(() => readDecision(bookingId));
  const [autoTarget, setAutoTarget] = useState<NearestAirportInfo | null>(null);
  const [manualTarget, setManualTarget] = useState<NearestAirportInfo | null>(null);

  // при смене рейса — перечитываем решение + восстанавливаем ручной выбор
  useEffect(() => {
    setDecision(readDecision(bookingId));
    setAutoTarget(null);
    let active = true;
    try {
      const savedIcao = window.localStorage.getItem(`nws.divert.manual.${bookingId}`) || "";
      if (/^[A-Z]{4}$/.test(savedIcao)) {
        void lookupAirport(savedIcao).then((a) => {
          if (active) setManualTarget(a);
        });
      } else {
        setManualTarget(null);
      }
    } catch {
      setManualTarget(null);
    }
    return () => {
      active = false;
    };
  }, [bookingId]);

  // Геометрический признак кандидата.
  const distArr =
    tele.currentLat != null && tele.currentLon != null && tele.arrivalLat != null && tele.arrivalLon != null
      ? distNm(tele.currentLat, tele.currentLon, tele.arrivalLat, tele.arrivalLon)
      : null;
  const alt = tele.altitude;
  const xt = crossTrack(tele);
  const candidate =
    tele.found &&
    distArr != null &&
    distArr > FAR_FROM_ARR_NM &&
    alt != null &&
    (((xt ?? 0) > OFF_TRACK_NM && alt < LOW_ALT_FT) || alt < VERY_LOW_FT);

  // Авто-определение пункта (когда есть кандидат или уже подтверждён) — только если нет ручного.
  const latKey = tele.currentLat != null ? Math.round(tele.currentLat * 10) : null;
  const lonKey = tele.currentLon != null ? Math.round(tele.currentLon * 10) : null;
  const want = (candidate || decision === "confirmed") && !manualTarget;
  const wantRef = useRef(want);
  wantRef.current = want;
  useEffect(() => {
    if (!want || latKey == null || lonKey == null) {
      if (!want) setAutoTarget(null);
      return;
    }
    let active = true;
    void fetchNearestAirport(tele.currentLat, tele.currentLon, [originalArrivalIcao]).then((info) => {
      if (active && wantRef.current) setAutoTarget(info);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [want, latKey, lonKey, originalArrivalIcao]);

  return {
    candidate,
    decision,
    target: manualTarget || autoTarget,
    manual: Boolean(manualTarget),
    confirm: () => {
      writeDecision(bookingId, "confirmed");
      setDecision("confirmed");
    },
    dismiss: () => {
      writeDecision(bookingId, "dismissed");
      setDecision("dismissed");
    },
    setManual: async (icao: string) => {
      const a = await lookupAirport(icao);
      if (!a) return false;
      try {
        window.localStorage.setItem(`nws.divert.manual.${bookingId}`, a.icao);
      } catch {
        /* ignore */
      }
      setManualTarget(a);
      return true;
    },
    clearManual: () => {
      try {
        window.localStorage.removeItem(`nws.divert.manual.${bookingId}`);
      } catch {
        /* ignore */
      }
      setManualTarget(null);
    },
  };
}
