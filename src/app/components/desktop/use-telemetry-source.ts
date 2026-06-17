import { useFlightTelemetry, type FlightTelemetry } from "./use-flight-telemetry";
import { useSimTelemetry } from "./use-sim-telemetry";
import { normalizeFlightPhase } from "../dashboard/flight-phase";

const SIM_PREF_KEY = "nws.sim.enabled";

export function getSimSourceEnabled(): boolean {
  try {
    return window.localStorage.getItem(SIM_PREF_KEY) === "1";
  } catch {
    return false;
  }
}

export function setSimSourceEnabled(on: boolean): void {
  try {
    window.localStorage.setItem(SIM_PREF_KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export interface TelemetrySource {
  telemetry: FlightTelemetry;
  simConnected: boolean;
  simSource: string; // "fsuipc" | "xpuipc" | "simconnect" | "none"
  usingSim: boolean; // sim действительно перекрывает данные
}

/**
 * Единый источник телеметрии: рейс/маршрут/прогресс из vAMSYS, а при подключённом симе
 * (и включённом пользователем источнике) live-поля высоты/скорости/курса/позиции берутся из сима.
 * Это даёт точную «приборную» картину при сохранении контекста плана полёта из vAMSYS.
 */
export function useTelemetrySource(simEnabled: boolean, pollMs = 8000): TelemetrySource {
  const vamsys = useFlightTelemetry(pollMs);
  const sim = useSimTelemetry(simEnabled, 2000);

  const usingSim = simEnabled && sim.connected;
  if (!usingSim) {
    return { telemetry: vamsys, simConnected: sim.connected, simSource: sim.source, usingSim: false };
  }

  // Перекрываем live-поля симом, оставляя идентичность рейса и геометрию маршрута из vAMSYS.
  const merged: FlightTelemetry = {
    ...vamsys,
    found: vamsys.found || true,
    altitude: sim.altitude_ft,
    speed: sim.ground_speed_kt,
    heading: sim.heading_deg,
    currentLat: sim.latitude,
    currentLon: sim.longitude,
  };
  merged.phase = normalizeFlightPhase(vamsys.status, merged);

  return { telemetry: merged, simConnected: true, simSource: sim.source, usingSim: true };
}
