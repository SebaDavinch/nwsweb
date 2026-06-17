import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../../context/language-context";
import logo from "@/assets/99be6a8339eae76151119a13613864930c8bf6e7.png";
import { NordwindJet } from "./nordwind-jet";

// Авиа-надписи под баром загрузки (с лёгким юмором, как просили).
const PHRASES: { ru: string; en: string }[] = [
  { ru: "Подготавливаем стоянку…", en: "Preparing the stand…" },
  { ru: "Подгоняем трап…", en: "Rolling up the jet bridge…" },
  { ru: "Готовим вкусный кофе…", en: "Brewing fresh coffee…" },
  { ru: "Загружаем багаж…", en: "Loading the baggage…" },
  { ru: "Проверяем метео…", en: "Checking the weather…" },
  { ru: "Запрашиваем эшелон…", en: "Requesting flight level…" },
  { ru: "Заправляем борт…", en: "Fuelling the aircraft…" },
  { ru: "Получаем разрешение на запуск…", en: "Getting pushback clearance…" },
];

const MIN_SHOW_MS = 1300; // минимум держим сплэш, чтобы не мелькал
const MAX_WAIT_MS = 12000; // фолбэк: уходим даже если данные не пришли (сбой сети)
const FADE_MS = 500;

/**
 * Загрузочный сплэш. Держится ровно до готовности данных (`ready`):
 * бар асимптотически ползёт к ~92%, при ready добегает до 100% и делает fade-out.
 * Соблюдает минимальное время показа и максимальный таймаут.
 */
export function AppSplash({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  const { language } = useLanguage();
  const ru = language === "ru";
  const [progress, setProgress] = useState(0);
  const [phraseIdx, setPhraseIdx] = useState(0);
  const [fading, setFading] = useState(false);
  const startRef = useRef<number>(Date.now());
  const doneRef = useRef(false);

  // Прогресс-бар: пока не готово — асимптота к 92%; когда готово — добегает до 100%.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const elapsed = Date.now() - startRef.current;
      const minReached = elapsed >= MIN_SHOW_MS;
      const finished = (ready && minReached) || elapsed >= MAX_WAIT_MS;
      setProgress((p) => {
        const target = finished ? 100 : 92;
        // плавное приближение к цели
        return p + (target - p) * (finished ? 0.25 : 0.06);
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ready]);

  // Ротация надписей.
  useEffect(() => {
    const id = window.setInterval(() => setPhraseIdx((i) => (i + 1) % PHRASES.length), 750);
    return () => window.clearInterval(id);
  }, []);

  // Завершение: когда готово (или таймаут) и бар почти на 100% → fade-out → onDone.
  useEffect(() => {
    if (doneRef.current) return;
    const elapsed = Date.now() - startRef.current;
    const minReached = elapsed >= MIN_SHOW_MS;
    const finished = (ready && minReached) || elapsed >= MAX_WAIT_MS;
    if (finished && progress >= 99) {
      doneRef.current = true;
      setFading(true);
      const t = window.setTimeout(onDone, FADE_MS);
      return () => window.clearTimeout(t);
    }
  }, [ready, progress, onDone]);

  // Гарантированный фолбэк-таймаут (если progress по какой-то причине застрял).
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (!doneRef.current) {
        doneRef.current = true;
        setFading(true);
        window.setTimeout(onDone, FADE_MS);
      }
    }, MAX_WAIT_MS + 600);
    return () => window.clearTimeout(t);
  }, [onDone]);

  const phrase = PHRASES[phraseIdx];

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-zinc-950 transition-opacity"
      style={{ opacity: fading ? 0 : 1, transitionDuration: `${FADE_MS}ms` }}
    >
      {/* Фоновое красное свечение */}
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-red-600/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-24 h-96 w-96 rounded-full bg-red-900/30 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(239,68,68,0.14),transparent_45%)]" />

      {/* Парящий борт на фоне */}
      <NordwindJet className="nws-float pointer-events-none absolute right-[-60px] top-12 h-28 w-auto opacity-10" />

      {/* Лого */}
      <div className="relative mb-8 flex items-center justify-center rounded-3xl border border-white/10 bg-zinc-900/70 px-9 py-6 shadow-[0_20px_60px_rgba(0,0,0,0.5)] backdrop-blur">
        <img src={logo} alt="Nordwind Virtual" className="h-20 w-auto object-contain drop-shadow-[0_8px_24px_rgba(0,0,0,0.4)]" />
      </div>

      <div className="relative mb-2 text-lg font-bold tracking-wide text-white">NordwindHub</div>

      {/* Бар загрузки */}
      <div className="relative h-1.5 w-64 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-red-500 to-red-400 shadow-[0_0_12px_rgba(239,68,68,0.6)]"
          style={{ width: `${Math.min(100, Math.round(progress))}%`, transition: "width 160ms ease-out" }}
        />
      </div>

      {/* Сменяющаяся надпись */}
      <div className="relative mt-4 h-5 text-sm text-white/60">
        <span key={phraseIdx} className="inline-block animate-in fade-in slide-in-from-bottom-1 duration-300">
          {ru ? phrase.ru : phrase.en}
        </span>
      </div>
    </div>
  );
}
