import { useState } from "react";
import { Play, Pause, Volume2, VolumeX, Radio, Loader2, Headphones, Info } from "lucide-react";
import { useLanguage } from "../../context/language-context";
import { useAppConfig } from "./use-app-config";
import { useAudioOutputs, isSinkSelectable } from "./use-audio-outputs";
import { useRadio, playStation, setRadioVolume, setRadioSink } from "./use-radio";

export function StationsPlayer() {
  const { language } = useLanguage();
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);
  const { config } = useAppConfig();
  const { devices, refresh } = useAudioOutputs();
  // Воспроизведение — из общего стора (переживает навигацию, синхрон с виджетом в футере).
  const { station, playing, loading, volume, sinkId } = useRadio();

  const allStations = (config.radioStations || []).filter(
    (s) => s.url && s.kind !== "youtube" && !/youtube\.com|youtu\.be/.test(s.url)
  );
  const [region, setRegion] = useState<string>("all");
  const REGIONS: { id: string; label: string }[] = [
    { id: "all", label: tr("Все", "All") },
    { id: "europe", label: tr("Европа", "Europe") },
    { id: "russia", label: tr("Россия", "Russia") },
    { id: "cis", label: tr("СНГ", "CIS") },
    { id: "atc", label: tr("ATC", "ATC") },
  ];
  const presentRegions = new Set(allStations.map((s) => String(s.region || "other")));
  const stations = region === "all" ? allStations : allStations.filter((s) => String(s.region || "other") === region);
  const activeId = station?.id ?? null;

  const play = async (id: string, name: string, url: string) => {
    await playStation({ id, name, url });
    void refresh(); // после play появятся метки устройств
  };

  return (
    <div className="space-y-3">
      {/* Выбор устройства вывода */}
      <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-zinc-900">
        <Headphones className="h-4 w-4 shrink-0 text-zinc-400" />
        {isSinkSelectable() ? (
          <select
            value={sinkId}
            onChange={(e) => setRadioSink(e.target.value)}
            className="flex-1 bg-transparent text-sm text-zinc-700 focus:outline-none dark:text-zinc-200"
          >
            <option value="">{tr("Устройство по умолчанию", "Default device")}</option>
            {devices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-xs text-zinc-400">{tr("Выбор устройства недоступен", "Device selection unavailable")}</span>
        )}
        <button type="button" onClick={() => setRadioVolume(volume > 0 ? 0 : 70)} className="text-zinc-400">
          {volume > 0 ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        </button>
        <input
          type="range"
          min={0}
          max={100}
          value={volume}
          onChange={(e) => setRadioVolume(Number(e.target.value))}
          className="w-24 accent-red-500"
        />
      </div>

      {/* Регионы */}
      {allStations.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {REGIONS.filter((r) => r.id === "all" || presentRegions.has(r.id)).map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setRegion(r.id)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                region === r.id ? "bg-red-500 text-white" : "bg-zinc-100 text-zinc-600 dark:bg-white/5 dark:text-zinc-300"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      ) : null}

      {/* Список станций */}
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-white/10 dark:bg-zinc-900">
        {stations.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <Radio className="h-8 w-8 text-zinc-300 dark:text-zinc-600" />
            <div className="text-sm text-zinc-400">{tr("Станции добавляются в админке", "Stations are managed in admin")}</div>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-white/5">
            {stations.map((s) => {
              const active = activeId === s.id;
              return (
                <div key={s.id} className={`flex items-center gap-3 px-4 py-2.5 ${active ? "bg-red-50/60 dark:bg-red-500/5" : ""}`}>
                  <button
                    type="button"
                    onClick={() => void play(s.id, s.name || s.url, s.url)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-400"
                  >
                    {active && loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : active && playing ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">{s.name || s.url}</div>
                    {active && playing ? (
                      <div className="flex items-center gap-1 text-xs text-emerald-500">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                        {tr("в эфире", "on air")}
                      </div>
                    ) : (
                      <div className="truncate text-xs text-zinc-400">{s.url}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex items-start gap-1.5 text-xs text-zinc-400">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>{tr("YouTube использует системное устройство вывода; станции — выбранное выше.", "YouTube uses the system output; stations use the device selected above.")}</span>
      </div>
    </div>
  );
}
