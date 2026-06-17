import { useEffect, useState } from "react";
import { isTauri } from "./use-tauri";

export interface SimTelemetry {
  connected: boolean;
  source: string; // "fsuipc" | "xpuipc" | "simconnect" | "none"
  latitude: number;
  longitude: number;
  altitude_ft: number;
  heading_deg: number;
  ground_speed_kt: number;
  ias_kt: number;
  vertical_speed_fpm: number;
  on_ground: boolean;
}

const EMPTY: SimTelemetry = {
  connected: false,
  source: "none",
  latitude: 0,
  longitude: 0,
  altitude_ft: 0,
  heading_deg: 0,
  ground_speed_kt: 0,
  ias_kt: 0,
  vertical_speed_fpm: 0,
  on_ground: false,
};

/**
 * Телеметрия из симулятора через Tauri-команду sim_read (FSUIPC/XPUIPC; SimConnect позже).
 * В браузере/dev — всегда «не подключено». При enabled=false не опрашивает.
 */
export function useSimTelemetry(enabled = true, pollMs = 2000): SimTelemetry {
  const [data, setData] = useState<SimTelemetry>(EMPTY);

  useEffect(() => {
    if (!enabled || !isTauri()) {
      setData(EMPTY);
      return;
    }
    let active = true;
    let invoke: ((cmd: string) => Promise<unknown>) | null = null;

    const tick = async () => {
      try {
        if (!invoke) {
          const mod = await import("@tauri-apps/api/core");
          invoke = (cmd: string) => mod.invoke(cmd);
        }
        const res = (await invoke("sim_read")) as Partial<SimTelemetry> | null;
        if (!active) return;
        setData(res && typeof res === "object" ? { ...EMPTY, ...res } : EMPTY);
      } catch {
        if (active) setData(EMPTY);
      }
    };

    void tick();
    const id = window.setInterval(tick, pollMs);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, [enabled, pollMs]);

  return data;
}
