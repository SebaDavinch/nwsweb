import { useCallback, useEffect, useState } from "react";

export interface AudioOutput {
  deviceId: string;
  label: string;
}

const DEVICE_KEY = "nws.radio.sinkId";

export function getSavedSinkId(): string {
  try {
    return window.localStorage.getItem(DEVICE_KEY) || "";
  } catch {
    return "";
  }
}
export function setSavedSinkId(id: string) {
  try {
    window.localStorage.setItem(DEVICE_KEY, id);
  } catch {
    /* ignore */
  }
}

/** Поддерживается ли выбор устройства вывода (setSinkId есть в Chromium/WebView2). */
export function isSinkSelectable(): boolean {
  return typeof window !== "undefined" && "setSinkId" in HTMLMediaElement.prototype;
}

/** Список устройств вывода звука. Метки доступны после первого взаимодействия/разрешения. */
export function useAudioOutputs() {
  const [devices, setDevices] = useState<AudioOutput[]>([]);

  const refresh = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      const outs = all
        .filter((d) => d.kind === "audiooutput")
        .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Устройство ${i + 1}` }));
      setDevices(outs);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void refresh();
    navigator.mediaDevices?.addEventListener?.("devicechange", refresh);
    return () => navigator.mediaDevices?.removeEventListener?.("devicechange", refresh);
  }, [refresh]);

  return { devices, refresh };
}
