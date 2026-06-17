import { useEffect, useRef, useState } from "react";
import { Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, Plus, Trash2, Radio, Music, Youtube } from "lucide-react";
import { useLanguage } from "../../context/language-context";
import { useYouTubePlaylist } from "./use-youtube-playlist";
import { loadYouTubeApi, type YTPlayer } from "./youtube-api";
import { StationsPlayer } from "./stations-player";

const VOL_KEY = "nws.radio.volume";

export function RadioPlayer() {
  const { language } = useLanguage();
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);
  const { tracks, add, remove } = useYouTubePlaylist();
  const [source, setSource] = useState<"youtube" | "stations">("stations");

  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState<number>(() => {
    const v = Number(window.localStorage.getItem(VOL_KEY));
    return Number.isFinite(v) && v >= 0 && v <= 100 ? v : 60;
  });
  const [input, setInput] = useState("");
  const [ready, setReady] = useState(false);
  const playerRef = useRef<YTPlayer | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const currentRef = useRef(current);
  currentRef.current = current;

  // инициализация плеера (один раз)
  useEffect(() => {
    let destroyed = false;
    void loadYouTubeApi().then((YT) => {
      if (destroyed || !hostRef.current) return;
      playerRef.current = new YT.Player(hostRef.current, {
        width: "100%",
        height: "100%",
        playerVars: { autoplay: 0, controls: 1, rel: 0, modestbranding: 1 },
        events: {
          onReady: (e) => {
            e.target.setVolume(volume);
            setReady(true);
          },
          onStateChange: (e) => {
            if (e.data === YT.PlayerState.ENDED) {
              // авто-следующий
              setCurrent((c) => (tracks.length ? (c + 1) % tracks.length : 0));
            }
            setPlaying(e.data === YT.PlayerState.PLAYING);
          },
        },
      });
    });
    return () => {
      destroyed = true;
      try {
        playerRef.current?.destroy();
      } catch {
        /* ignore */
      }
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // смена трека
  useEffect(() => {
    const t = tracks[current];
    if (ready && playerRef.current && t) {
      try {
        playerRef.current.loadVideoById(t.id);
        playerRef.current.setVolume(volume);
      } catch {
        /* ignore */
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, ready]);

  useEffect(() => {
    window.localStorage.setItem(VOL_KEY, String(volume));
    try {
      playerRef.current?.setVolume(volume);
    } catch {
      /* ignore */
    }
  }, [volume]);

  const playPause = () => {
    const p = playerRef.current;
    if (!p) return;
    if (playing) p.pauseVideo();
    else p.playVideo();
  };
  const next = () => setCurrent((c) => (tracks.length ? (c + 1) % tracks.length : 0));
  const prev = () => setCurrent((c) => (tracks.length ? (c - 1 + tracks.length) % tracks.length : 0));

  const handleAdd = () => {
    if (add(input)) setInput("");
  };

  const track = tracks[current];

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Radio className="h-5 w-5 text-red-500" />
          <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{tr("Радио", "Radio")}</h1>
        </div>
        <div className="inline-flex rounded-xl border border-zinc-200 bg-white p-1 dark:border-white/10 dark:bg-zinc-900">
          <button
            type="button"
            onClick={() => setSource("stations")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              source === "stations" ? "bg-red-500 text-white" : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            }`}
          >
            <Radio className="h-4 w-4" />
            {tr("Станции", "Stations")}
          </button>
          <button
            type="button"
            onClick={() => setSource("youtube")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              source === "youtube" ? "bg-red-500 text-white" : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            }`}
          >
            <Youtube className="h-4 w-4" />
            YouTube
          </button>
        </div>
      </div>

      {source === "stations" ? <StationsPlayer /> : null}

      {/* Плеер YouTube */}
      <div className={`overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-white/10 dark:bg-zinc-900 ${source === "youtube" ? "" : "hidden"}`}>
        <div className="aspect-video w-full bg-black">
          <div ref={hostRef} className="h-full w-full" />
        </div>
        <div className="flex items-center gap-3 p-3">
          <button type="button" onClick={prev} className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-white/5">
            <SkipBack className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={playPause}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-400"
          >
            {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </button>
          <button type="button" onClick={next} className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-white/5">
            <SkipForward className="h-4 w-4" />
          </button>

          <div className="min-w-0 flex-1 px-2">
            <div className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">
              {track ? track.title : tr("Плейлист пуст", "Playlist is empty")}
            </div>
          </div>

          <button type="button" onClick={() => setVolume((v) => (v > 0 ? 0 : 60))} className="text-zinc-400">
            {volume > 0 ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>
          <input
            type="range"
            min={0}
            max={100}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="w-24 accent-red-500"
          />
        </div>
      </div>

      {/* Добавить трек */}
      <div className={`flex gap-2 ${source === "youtube" ? "" : "hidden"}`}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAdd();
          }}
          placeholder={tr("Вставьте ссылку YouTube…", "Paste a YouTube link…")}
          className="flex-1 rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-sm text-zinc-800 placeholder:text-zinc-400 focus:border-red-500/50 focus:outline-none dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-100"
        />
        <button
          type="button"
          onClick={handleAdd}
          className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900"
        >
          <Plus className="h-4 w-4" />
          {tr("Добавить", "Add")}
        </button>
      </div>

      {/* Плейлист */}
      <div className={`overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-white/10 dark:bg-zinc-900 ${source === "youtube" ? "" : "hidden"}`}>
        {tracks.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <Music className="h-8 w-8 text-zinc-300 dark:text-zinc-600" />
            <div className="text-sm text-zinc-400">{tr("Добавьте треки по ссылкам YouTube", "Add tracks via YouTube links")}</div>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-white/5">
            {tracks.map((t, i) => (
              <div
                key={t.id}
                className={`flex items-center gap-3 px-4 py-2.5 ${i === current ? "bg-red-50/60 dark:bg-red-500/5" : ""}`}
              >
                <button
                  type="button"
                  onClick={() => setCurrent(i)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-white/5 dark:text-zinc-400"
                >
                  {i === current && playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                </button>
                <button type="button" onClick={() => setCurrent(i)} className="min-w-0 flex-1 text-left">
                  <div className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">{t.title}</div>
                  <div className="truncate text-xs text-zinc-400">{t.url}</div>
                </button>
                <button
                  type="button"
                  onClick={() => remove(t.id)}
                  className="rounded p-1 text-zinc-400 hover:text-red-500"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
