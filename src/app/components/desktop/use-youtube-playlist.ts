import { useCallback, useEffect, useState } from "react";

export interface Track {
  id: string; // YouTube video id
  url: string;
  title: string;
  addedAt: number;
}

const STORAGE_KEY = "nws.radio.playlist";

/** Извлекает YouTube videoId из разных форматов ссылок. */
export function parseYouTubeId(input: string): string | null {
  const s = String(input || "").trim();
  if (!s) return null;
  // голый id
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  try {
    const url = new URL(s);
    if (url.hostname.includes("youtu.be")) {
      const id = url.pathname.slice(1, 12);
      return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
    }
    if (url.hostname.includes("youtube.com")) {
      const v = url.searchParams.get("v");
      if (v && /^[A-Za-z0-9_-]{11}$/.test(v)) return v;
      const m = url.pathname.match(/\/(embed|shorts|live)\/([A-Za-z0-9_-]{11})/);
      if (m) return m[2];
    }
  } catch {
    /* not a url */
  }
  return null;
}

function readPlaylist(): Track[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/** Плейлист YouTube с кэшем в localStorage (переживает перезапуск приложения). */
export function useYouTubePlaylist() {
  const [tracks, setTracks] = useState<Track[]>(readPlaylist);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tracks));
    } catch {
      /* ignore */
    }
  }, [tracks]);

  const add = useCallback((url: string, title?: string): boolean => {
    const id = parseYouTubeId(url);
    if (!id) return false;
    setTracks((prev) => {
      if (prev.some((t) => t.id === id)) return prev;
      return [...prev, { id, url, title: title?.trim() || `YouTube · ${id}`, addedAt: Date.now() }];
    });
    return true;
  }, []);

  const remove = useCallback((id: string) => {
    setTracks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const setTitle = useCallback((id: string, title: string) => {
    setTracks((prev) => prev.map((t) => (t.id === id ? { ...t, title } : t)));
  }, []);

  const clear = useCallback(() => setTracks([]), []);

  return { tracks, add, remove, setTitle, clear };
}
