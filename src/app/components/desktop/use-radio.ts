import { useSyncExternalStore } from "react";
import { getSavedSinkId, setSavedSinkId } from "./use-audio-outputs";

// Общий стор радио-станций: единый <audio>, живёт на уровне модуля и переживает
// навигацию между вкладками. Источники синхронизированы: вкладка «Радио» и виджет
// «сейчас играет» в футере используют один и тот же стор.

export interface RadioStation {
  id: string;
  name: string;
  url: string;
  region?: string;
}

interface RadioState {
  station: RadioStation | null;
  playing: boolean;
  loading: boolean;
  volume: number; // 0..100
  sinkId: string;
}

const VOL_KEY = "nws.radio.station.volume";

const readVol = (): number => {
  const v = Number(window.localStorage.getItem(VOL_KEY));
  return Number.isFinite(v) && v >= 0 && v <= 100 ? v : 70;
};

type AudioWithSink = HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> };
let audio: AudioWithSink | null = null;

let state: RadioState = {
  station: null,
  playing: false,
  loading: false,
  volume: readVol(),
  sinkId: getSavedSinkId(),
};

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const setState = (patch: Partial<RadioState>) => {
  state = { ...state, ...patch };
  emit();
};

const ensureAudio = (): AudioWithSink => {
  if (audio) return audio;
  const a = new Audio() as AudioWithSink;
  a.preload = "none";
  a.volume = state.volume / 100;
  a.addEventListener("playing", () => setState({ playing: true, loading: false }));
  a.addEventListener("pause", () => setState({ playing: false }));
  a.addEventListener("waiting", () => setState({ loading: true }));
  a.addEventListener("error", () => setState({ playing: false, loading: false }));
  audio = a;
  return a;
};

/** Запустить станцию (или пауза, если она же сейчас играет). */
export async function playStation(s: RadioStation): Promise<void> {
  const a = ensureAudio();
  if (state.station?.id === s.id && state.playing) {
    a.pause();
    setState({ playing: false });
    return;
  }
  setState({ station: s, loading: true });
  a.src = s.url;
  a.volume = state.volume / 100;
  try {
    if (a.setSinkId && state.sinkId) await a.setSinkId(state.sinkId).catch(() => {});
    await a.play();
    setState({ playing: true });
  } catch {
    setState({ playing: false });
  } finally {
    setState({ loading: false });
  }
}

/** Play/pause текущей станции. */
export function toggleRadio(): void {
  const a = ensureAudio();
  if (!state.station) return;
  if (state.playing) a.pause();
  else void a.play().catch(() => setState({ playing: false }));
}

export function stopRadio(): void {
  if (audio) audio.pause();
  setState({ playing: false });
}

export function setRadioVolume(v: number): void {
  const vol = Math.max(0, Math.min(100, Math.round(v)));
  window.localStorage.setItem(VOL_KEY, String(vol));
  if (audio) audio.volume = vol / 100;
  setState({ volume: vol });
}

export function setRadioSink(id: string): void {
  setSavedSinkId(id);
  setState({ sinkId: id });
  if (audio?.setSinkId) audio.setSinkId(id).catch(() => {});
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};
const getSnapshot = () => state;

export function useRadio(): RadioState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
