import { useEffect, useRef, useState } from "react";
import { log } from "./app-logger";

export type ServiceState = "online" | "offline" | "unknown";

interface AppHealth {
  backend: ServiceState;
  vamsys: ServiceState;
}

/** Опрос состояния бэкенда и vAMSYS API через /api/health (по умолчанию каждые 15с). */
export function useAppHealth(pollMs = 15000): AppHealth {
  const [health, setHealth] = useState<AppHealth>({ backend: "unknown", vamsys: "unknown" });
  const prevRef = useRef<AppHealth>({ backend: "unknown", vamsys: "unknown" });

  useEffect(() => {
    let active = true;
    const apply = (next: AppHealth) => {
      const prev = prevRef.current;
      if (prev.backend !== next.backend) log.info("health", `backend: ${prev.backend} → ${next.backend}`);
      if (prev.vamsys !== next.vamsys) log.info("health", `vamsys: ${prev.vamsys} → ${next.vamsys}`);
      prevRef.current = next;
      setHealth(next);
    };
    const check = async () => {
      try {
        const res = await fetch("/api/health", { credentials: "include" });
        if (!res.ok) {
          if (active) apply({ backend: "offline", vamsys: "offline" });
          return;
        }
        const payload = (await res.json().catch(() => null)) as { ok?: boolean; vamsys?: boolean } | null;
        if (!active) return;
        apply({
          backend: payload?.ok ? "online" : "offline",
          vamsys: payload?.vamsys ? "online" : "offline",
        });
      } catch {
        if (active) apply({ backend: "offline", vamsys: "offline" });
      }
    };
    void check();
    const id = window.setInterval(check, pollMs);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, [pollMs]);

  return health;
}
