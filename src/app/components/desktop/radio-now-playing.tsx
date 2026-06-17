import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Radio, Play, Pause, Loader2, Volume2, VolumeX, ChevronUp, ExternalLink } from "lucide-react";
import { useLanguage } from "../../context/language-context";
import { useRadio, toggleRadio, setRadioVolume } from "./use-radio";

/**
 * Виджет «сейчас играет» в футере приложения. Заменяет пункт «Радио» в сайдбаре:
 * клик по названию → переход во вкладку радио; кнопка-шеврон открывает мини-плеер
 * вверх (play/pause, громкость). Состояние — из общего стора use-radio.
 */
export function RadioNowPlaying() {
  const { language } = useLanguage();
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);
  const navigate = useNavigate();
  const { station, playing, loading, volume } = useRadio();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [open]);

  const openRadioTab = () => navigate("/app/hub?section=radio");
  const label = station?.name || tr("Радио", "Radio");

  return (
    <div className="relative flex items-center" onClick={(e) => e.stopPropagation()}>
      {/* Кнопка play/pause — только при активной станции */}
      {station ? (
        <button
          type="button"
          onClick={() => toggleRadio()}
          className="flex h-5 w-5 items-center justify-center rounded text-zinc-500 transition-colors hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
          title={playing ? tr("Пауза", "Pause") : tr("Играть", "Play")}
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
        </button>
      ) : (
        <Radio className="h-3.5 w-3.5 text-zinc-400" />
      )}

      {/* Название → переход во вкладку */}
      <button
        type="button"
        onClick={openRadioTab}
        className="ml-1 inline-flex max-w-[140px] items-center gap-1 truncate text-[11px] font-medium text-zinc-500 transition-colors hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
        title={tr("Открыть радио", "Open radio")}
      >
        {playing ? <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-emerald-500" /> : null}
        <span className="truncate">{label}</span>
      </button>

      {/* Шеврон — мини-плеер вверх */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="ml-0.5 flex h-5 w-5 items-center justify-center rounded text-zinc-400 transition-colors hover:text-zinc-700 dark:hover:text-zinc-100"
        title={tr("Мини-плеер", "Mini player")}
      >
        <ChevronUp className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Дропдаун вверх */}
      {open ? (
        <div className="absolute bottom-full left-0 z-[60] mb-2 w-64 overflow-hidden rounded-2xl border border-zinc-200 bg-white p-3 shadow-2xl dark:border-white/10 dark:bg-zinc-900">
          <div className="mb-2 flex items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-red-500">
              <Radio className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">{label}</div>
              <div className="text-[11px] text-zinc-400">
                {station ? (playing ? tr("в эфире", "on air") : tr("на паузе", "paused")) : tr("ничего не играет", "nothing playing")}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => toggleRadio()}
              disabled={!station}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-500 text-white transition-colors hover:bg-red-400 disabled:opacity-40"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
            <button type="button" onClick={() => setRadioVolume(volume > 0 ? 0 : 70)} className="text-zinc-400">
              {volume > 0 ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </button>
            <input
              type="range"
              min={0}
              max={100}
              value={volume}
              onChange={(e) => setRadioVolume(Number(e.target.value))}
              className="flex-1 accent-red-500"
            />
          </div>

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              openRadioTab();
            }}
            className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg border border-zinc-200 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/5"
          >
            {tr("Открыть радио", "Open radio")}
            <ExternalLink className="h-3 w-3" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
