import { useEffect, useState } from "react";
import { useLanguage } from "../../context/language-context";

export interface DestinationPhoto {
  url: string;
  title: string;
  descriptionUrl: string | null;
}

export interface DestinationInfo {
  icao: string;
  city: string;
  country: string;
  countryIso2: string | null;
  latitude: number | null;
  longitude: number | null;
  summary: { extract: string; url: string | null } | null;
  photos: DestinationPhoto[];
  video: { searchUrl: string; query: string } | null;
}

/** Гид по пункту назначения (описание города, фото, видео) по ICAO. */
export function useDestination(icao: string | null | undefined): { data: DestinationInfo | null; loading: boolean } {
  const { language } = useLanguage();
  const [data, setData] = useState<DestinationInfo | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const code = String(icao || "").trim().toUpperCase();
    if (!/^[A-Z]{4}$/.test(code)) {
      setData(null);
      return;
    }
    let active = true;
    setLoading(true);
    fetch(`/api/pilot/destination/${code}?lang=${language === "en" ? "en" : "ru"}`, { credentials: "include" })
      .then((r) => r.json().catch(() => null))
      .then((p) => {
        if (active && p && !p.error) setData(p as DestinationInfo);
      })
      .catch(() => null)
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [icao, language]);

  return { data, loading };
}
