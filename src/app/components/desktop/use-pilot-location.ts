import { useEffect, useState } from "react";

export interface PilotLocation {
  airportCode: string | null;
  airportName: string | null;
  locationLabel: string | null;
}

/**
 * Свежая локация пилота из /api/pilot/location (forceProfileRefresh + синк из vAMSYS).
 * Решает рассинхрон: пилот меняет локацию в vAMSYS — приложение её подхватывает,
 * не дожидаясь обновления сессии. Опрашивается периодически.
 */
export function usePilotLocation(pollMs = 4 * 60 * 1000): PilotLocation | null {
  const [loc, setLoc] = useState<PilotLocation | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const r = await fetch("/api/pilot/location", { credentials: "include" });
        if (!r.ok) return;
        const p = await r.json().catch(() => null);
        if (active && p?.ok) {
          setLoc({
            airportCode: p.airportCode || null,
            airportName: p.airportName || null,
            locationLabel: p.locationLabel || null,
          });
        }
      } catch {
        /* ignore */
      }
    };
    void load();
    const id = window.setInterval(load, pollMs);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, [pollMs]);

  return loc;
}
