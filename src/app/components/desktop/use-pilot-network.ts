import { useEffect, useState } from "react";

export interface NetworkMeta {
  key: string;
  label: string;
  prefileUrl: string | null; // куда отправлять подачу плана; null — нет онлайн-подачи
}

// Сети онлайн-полётов и ссылки на подачу плана полёта.
const NETWORKS: Record<string, NetworkMeta> = {
  vatsim: { key: "vatsim", label: "VATSIM", prefileUrl: "https://my.vatsim.net/pilots/flightplan" },
  ivao: { key: "ivao", label: "IVAO", prefileUrl: "https://fpl.ivao.aero" },
  poscon: { key: "poscon", label: "POSCON", prefileUrl: "https://hq.poscon.net" },
  pilotedge: { key: "pilotedge", label: "PilotEdge", prefileUrl: "https://www.pilotedge.net/pages/flight-planning" },
  fscloud: { key: "fscloud", label: "FSCloud", prefileUrl: "https://fscloud.eu" },
  sayintentions: { key: "sayintentions", label: "SayIntentions", prefileUrl: "https://www.sayintentions.ai" },
  other: { key: "other", label: "Other", prefileUrl: null },
};

export function getNetworkMeta(key?: string | null): NetworkMeta | null {
  const k = String(key || "").trim().toLowerCase();
  if (!k || k === "offline") return null;
  return NETWORKS[k] || { key: k, label: k.toUpperCase(), prefileUrl: null };
}

/** Предпочитаемая сеть пилота (offline | vatsim | ivao | ...), из настроек ЛК. */
export function usePilotNetwork(): { network: string; meta: NetworkMeta | null; loading: boolean } {
  const [network, setNetwork] = useState("offline");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/pilot/preferences", { credentials: "include" })
      .then((r) => r.json().catch(() => null))
      .then((p) => {
        if (!active) return;
        const n = String(p?.pilotApiPreferences?.preferredNetwork || "offline").trim().toLowerCase();
        setNetwork(n || "offline");
      })
      .catch(() => null)
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return { network, meta: getNetworkMeta(network), loading };
}
