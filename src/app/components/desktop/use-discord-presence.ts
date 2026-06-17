import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../context/auth-context";
import { isTauri } from "./use-tauri";
import { normalizeFlightPhase, type FlightPhase } from "../dashboard/flight-phase";
import { useAppConfig } from "./use-app-config";

// Статус подключения Discord Rich Presence (для настроек).
export type DiscordRpStatus = "disabled" | "no-app-id" | "not-tauri" | "connected" | "error";
let rpStatus: DiscordRpStatus = "disabled";
const rpListeners = new Set<() => void>();
function setRpStatus(s: DiscordRpStatus) {
  if (s === rpStatus) return;
  rpStatus = s;
  rpListeners.forEach((l) => l());
}
export function getDiscordRpStatus(): DiscordRpStatus {
  return rpStatus;
}
export function subscribeDiscordRp(cb: () => void): () => void {
  rpListeners.add(cb);
  return () => rpListeners.delete(cb);
}

const RP_ENABLED_KEY = "nws.discord.rp.enabled";
export function isDiscordRpEnabled(): boolean {
  try {
    return window.localStorage.getItem(RP_ENABLED_KEY) !== "0";
  } catch {
    return true;
  }
}
export function setDiscordRpEnabled(on: boolean) {
  try {
    window.localStorage.setItem(RP_ENABLED_KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
  rpListeners.forEach((l) => l());
}

const PHASE_LABEL: Record<FlightPhase, string> = {
  scheduled: "Подготовка к рейсу",
  boarding: "Посадка пассажиров",
  pushback: "Буксировка",
  taxi: "Руление",
  takeoff: "Взлёт",
  climb: "Набор высоты",
  cruise: "В крейсерском полёте",
  diverting: "Уход на запасной",
  descent: "Снижение",
  approach: "Заход на посадку",
  landing: "Посадка",
  taxiIn: "Руление к гейту",
  arrived: "Прибыл",
};

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function str(v: unknown, f = ""): string {
  const s = String(v ?? "").trim();
  return s || f;
}

async function setActivity(
  appId: string,
  args: {
    details: string;
    status: string;
    largeText?: string;
    smallText?: string;
    startUnix?: number;
  }
) {
  if (!isTauri()) {
    setRpStatus("not-tauri");
    return;
  }
  if (!appId) {
    setRpStatus("no-app-id");
    return;
  }
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("discord_set_activity", {
      appId,
      details: args.details,
      status: args.status,
      largeImage: "nordwind",
      largeText: args.largeText || "Nordwind Virtual",
      smallImage: "",
      smallText: args.smallText || "",
      startUnix: args.startUnix ?? null,
    });
    setRpStatus("connected");
  } catch {
    setRpStatus("error");
  }
}

async function clearActivity() {
  if (!isTauri()) return;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("discord_clear");
  } catch {
    /* ignore */
  }
}

/**
 * Discord Rich Presence по активному рейсу пилота: показывает фазу, маршрут,
 * callsign и таймер. Вне полёта (в Хабе) — idle-статус. Только в Tauri.
 */
export function useDiscordPresence(pollMs = 15000) {
  const { isAuthenticated, pilot } = useAuth();
  const { config } = useAppConfig();
  const appId = config.discordAppId || (import.meta.env.VITE_DISCORD_APP_ID as string) || "";
  const [enabled, setEnabled] = useState(isDiscordRpEnabled());
  const startRef = useRef<number | null>(null);

  // следим за переключением в настройках
  useEffect(() => subscribeDiscordRp(() => setEnabled(isDiscordRpEnabled())), []);

  useEffect(() => {
    if (!isTauri()) {
      setRpStatus("not-tauri");
      return;
    }
    if (!enabled) {
      setRpStatus("disabled");
      void clearActivity();
      return;
    }
    if (!appId) {
      setRpStatus("no-app-id");
      return;
    }
    let active = true;

    const tick = async () => {
      try {
        if (!isAuthenticated || !pilot) {
          await setActivity(appId, { details: "В главном меню", status: "Nordwind Virtual" });
          return;
        }
        const res = await fetch("/api/vamsys/flight-map", { credentials: "include" });
        const payload = res.ok ? ((await res.json().catch(() => null)) as { flights?: Record<string, unknown>[] } | null) : null;
        const mine = (payload?.flights || []).find((f) => String(f.pilotId ?? "") === String(pilot.id));

        if (!active) return;

        if (!mine) {
          startRef.current = null;
          await setActivity(appId, {
            details: "В хабе",
            status: pilot.callsign ? `${pilot.callsign} · готов к вылету` : "Готов к вылету",
          });
          return;
        }

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
        const route = `${str(mine.departure, "—")} → ${str(mine.destination || mine.arrival, "—")}`;
        const callsign = str(mine.flightNumber || mine.callsign, "");
        if (startRef.current === null) startRef.current = Math.floor(Date.now() / 1000);

        await setActivity(appId, {
          details: `${callsign} · ${route}`.trim(),
          status: phase ? PHASE_LABEL[phase] : "В полёте",
          largeText: str(mine.aircraft, "Nordwind Virtual"),
          smallText: callsign,
          startUnix: startRef.current ?? undefined,
        });
      } catch {
        /* ignore */
      }
    };

    void tick();
    const id = window.setInterval(tick, pollMs);
    return () => {
      active = false;
      window.clearInterval(id);
      void clearActivity();
    };
  }, [isAuthenticated, pilot?.id, pilot?.callsign, pollMs, appId, enabled]);
}
