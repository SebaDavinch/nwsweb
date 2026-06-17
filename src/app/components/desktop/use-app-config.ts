import { useEffect, useState } from "react";

export interface RadioStation {
  id: string;
  name: string;
  url: string;
  kind?: string;
  region?: string; // europe | russia | cis | atc | other
}

export interface AppConfig {
  features: {
    chat: boolean;
    map: boolean;
    radio: boolean;
    screenshots: boolean;
    notifications: boolean;
    discordPresence: boolean;
  };
  links: { site: string; discord: string };
  discordAppId: string;
  screenshotPinTtlMinutes: number;
  defaultTheme: "light" | "dark";
  defaultLanguage: "ru" | "en";
  radioStations: RadioStation[];
  announcement: { enabled: boolean; text: string; level: "info" | "warning" };
  minVersion: string;
  chatModerators: string[];
  updatedAt: string | null;
}

const DEFAULT_CONFIG: AppConfig = {
  features: { chat: true, map: true, radio: true, screenshots: true, notifications: true, discordPresence: true },
  links: { site: "https://vnws.org", discord: "https://discord.gg/MfTT8KU5yC" },
  discordAppId: "",
  screenshotPinTtlMinutes: 30,
  defaultTheme: "dark",
  defaultLanguage: "ru",
  radioStations: [],
  announcement: { enabled: false, text: "", level: "info" },
  minVersion: "",
  chatModerators: [],
  updatedAt: null,
};

/** Конфиг приложения, управляемый из админки сайта (`/api/app/config`). */
export function useAppConfig(): { config: AppConfig; loading: boolean } {
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/app/config", { credentials: "include" })
      .then((r) => r.json().catch(() => null))
      .then((payload) => {
        if (active && payload && typeof payload === "object") {
          setConfig({ ...DEFAULT_CONFIG, ...payload, features: { ...DEFAULT_CONFIG.features, ...(payload.features || {}) } });
        }
      })
      .catch(() => null)
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return { config, loading };
}
