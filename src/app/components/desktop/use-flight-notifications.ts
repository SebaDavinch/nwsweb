import { useEffect, useRef } from "react";
import { useAuth } from "../../context/auth-context";
import { useLanguage } from "../../context/language-context";
import { normalizeFlightPhase, type FlightPhase } from "../dashboard/flight-phase";
import { notify } from "./notify";
import { getNotificationsEnabled } from "./app-settings";
import { log } from "./app-logger";

function num(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
function str(value: unknown, fallback = ""): string {
  const s = String(value ?? "").trim();
  return s || fallback;
}

// фазы, означающие, что вылет состоялся (для события «рейс начался»)
const DEPARTED: FlightPhase[] = ["pushback", "taxi", "takeoff", "climb"];
// фазы прибытия (для приветствия — на случай, если момент касания пропущен между опросами)
const ARRIVING: FlightPhase[] = ["landing", "taxiIn", "arrived"];

function firedKey(flightId: string, event: string) {
  return `nws.notif.${flightId}.${event}`;
}
function alreadyFired(flightId: string, event: string) {
  try {
    return window.localStorage.getItem(firedKey(flightId, event)) === "1";
  } catch {
    return false;
  }
}
function markFired(flightId: string, event: string) {
  try {
    window.localStorage.setItem(firedKey(flightId, event), "1");
  } catch {
    /* ignore */
  }
}

/**
 * Следит за активным рейсом пилота и шлёт системные уведомления о ключевых событиях:
 *  • после начала буксировки — «Рейс начался»;
 *  • после касания (посадки) — приветствие в аэропорту прибытия + напоминание завершить полёт в Pegasus.
 * Каждое событие срабатывает один раз на рейс (дедуп через localStorage).
 */
export function useFlightNotifications(pollMs = 12000) {
  const { isAuthenticated, pilot } = useAuth();
  const { language } = useLanguage();
  const langRef = useRef(language);
  langRef.current = language;
  const prevPhaseRef = useRef<FlightPhase | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !pilot) return;
    let active = true;

    const tick = async () => {
      try {
        const res = await fetch("/api/vamsys/flight-map", { credentials: "include" });
        if (!res.ok) return;
        const payload = (await res.json().catch(() => null)) as { flights?: Record<string, unknown>[] } | null;
        const flights = Array.isArray(payload?.flights) ? payload!.flights! : [];
        const mine = flights.find((f) => String(f.pilotId ?? "") === String(pilot.id));
        if (!mine) {
          prevPhaseRef.current = null;
          return;
        }

        const flightId = str(mine.id ?? mine.flightNumber ?? mine.callsign, "flight");
        const phase = normalizeFlightPhase(str(mine.status), {
          altitude: num(mine.altitude),
          speed: num(mine.speed),
          progress: num(mine.progress),
          currentLat: num(mine.currentLat ?? mine.latitude ?? mine.lat),
          currentLon: num(mine.currentLon ?? mine.longitude ?? mine.lon),
          departureLat: num(mine.departureLat),
          departureLon: num(mine.departureLon),
          arrivalLat: num(mine.arrivalLat),
          arrivalLon: num(mine.arrivalLon),
        });
        if (!active || !phase) return;
        if (!getNotificationsEnabled()) {
          prevPhaseRef.current = phase;
          return;
        }

        const ru = langRef.current === "ru";
        const flightNo = str(mine.flightNumber || mine.callsign, "—");

        if (DEPARTED.includes(phase) && !alreadyFired(flightId, "started")) {
          markFired(flightId, "started");
          log.info("flight", `Departed ${flightNo} (${phase})`);
          const route = `${str(mine.departure, "—")} → ${str(mine.destination || mine.arrival, "—")}`;
          await notify(
            ru ? "Рейс начался" : "Flight started",
            ru
              ? `${flightNo}: буксировка началась. ${route}. Удачного полёта!`
              : `${flightNo}: pushback started. ${route}. Have a great flight!`
          );
        }

        if (ARRIVING.includes(phase) && !alreadyFired(flightId, "landed")) {
          markFired(flightId, "landed");
          log.info("flight", `Arrived ${flightNo} (${phase})`);
          const dest = str(
            mine.destinationCity || mine.arrivalCity || mine.destination || mine.arrival,
            ru ? "аэропорт назначения" : "destination"
          );
          await notify(
            ru ? `Добро пожаловать в ${dest}` : `Welcome to ${dest}`,
            ru
              ? "Не забудьте завершить полёт в Pegasus после заруливания."
              : "Don't forget to complete the flight in Pegasus after taxi-in."
          );
        }

        prevPhaseRef.current = phase;
      } catch {
        /* ignore */
      }
    };

    void tick();
    const id = window.setInterval(tick, pollMs);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, [isAuthenticated, pilot?.id, pollMs]);
}
