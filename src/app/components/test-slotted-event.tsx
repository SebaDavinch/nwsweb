import { useRef, useState } from "react";
import { Link } from "react-router";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock,
  ExternalLink,
  Lock,
  MapPin,
  Plane,
  Star,
  Users,
  X,
  Zap,
  Info,
} from "lucide-react";
import { Button } from "./ui/button";

// ─── Mock data ────────────────────────────────────────────────────────────────

interface MockSlot {
  id: number;
  time: string; // ISO UTC
  state: "open" | "taken" | "mine";
}

const EVENT_NAME = "Nordwind Summer Fly-In 2026";
const EVENT_DESC = `Приглашаем всех пилотов Nordwind Virtual принять участие в летнем слётном ивенте!

Рейс выполняется по маршруту Шереметьево → Адлер. Ожидается высокая загрузка VATSIM-секторов московского FIR и сочинского TMA — рекомендуем заранее изучить стандарты Краснодарского ATC.

Участники набирают бонусные очки, а лучшие пилоты по итогам ивента получат уникальный бейдж «Лётнее расписание 2026».`;

const EVENT_DATE = "28 июля 2026";
const EVENT_TIME = "09:00 – 16:00 UTC";
const EVENT_DEP = "UUEE";
const EVENT_ARR = "URSS";
const SLOT_INTERVAL = 10;
const POINTS = 250;
const VATSIM_MAP = "https://map.vatsim.net";

// Generate 48 slots from 09:00 to 16:50 UTC, every 10 min
function generateSlots(): MockSlot[] {
  const base = new Date("2026-07-28T09:00:00Z");
  const takenIds = new Set([0, 1, 3, 4, 5, 7, 10, 11, 12, 15, 18, 20, 22, 23, 25, 28, 30, 31, 35, 38, 40]);
  return Array.from({ length: 42 }, (_, i) => {
    const t = new Date(base.getTime() + i * SLOT_INTERVAL * 60000);
    return {
      id: i,
      time: t.toISOString(),
      state: i === 6 ? "mine" : takenIds.has(i) ? "taken" : "open",
    };
  });
}

const SLOTS = generateSlots();

const OPEN_COUNT = SLOTS.filter((s) => s.state === "open").length;
const TAKEN_COUNT = SLOTS.filter((s) => s.state === "taken").length;
const TOTAL = SLOTS.length;
const FILL_PCT = Math.round((TAKEN_COUNT / TOTAL) * 100);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtTime = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
};

const fmtHour = (iso: string) => String(new Date(iso).getUTCHours()).padStart(2, "0");

// ─── Sub-components ───────────────────────────────────────────────────────────

function Legend() {
  return (
    <div className="mt-6 flex flex-wrap items-center gap-4 text-xs text-gray-400 dark:text-gray-500">
      {[
        { cls: "border-gray-200 bg-white dark:border-white/8 dark:bg-white/[0.04]", label: "Свободен" },
        { cls: "border-emerald-300 bg-emerald-50 dark:border-emerald-500/40 dark:bg-emerald-500/10", label: "Ваш слот" },
        { cls: "border-gray-100 bg-gray-50 opacity-50 dark:border-white/5 dark:bg-white/[0.02]", label: "Занят" },
      ].map(({ cls, label }) => (
        <span key={label} className="flex items-center gap-1.5">
          <span className={`inline-block h-3 w-3 rounded-sm border ${cls}`} />
          {label}
        </span>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function TestSlottedEvent() {
  const mySlotRef = useRef<HTMLButtonElement | null>(null);
  const [mySlot, setMySlot] = useState<number | null>(SLOTS.find((s) => s.state === "mine")?.id ?? null);
  const [slots, setSlots] = useState<MockSlot[]>(SLOTS);

  const handleBook = (id: number) => {
    if (mySlot !== null) return;
    setSlots((prev) => prev.map((s) => s.id === id ? { ...s, state: "mine" } : s));
    setMySlot(id);
    setTimeout(() => mySlotRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
  };

  const handleCancel = () => {
    if (mySlot === null) return;
    setSlots((prev) => prev.map((s) => s.id === mySlot ? { ...s, state: "open" } : s));
    setMySlot(null);
  };

  // Group by hour
  const byHour = slots.reduce<Record<string, MockSlot[]>>((acc, s) => {
    const h = fmtHour(s.time);
    (acc[h] ??= []).push(s);
    return acc;
  }, {});

  const openCount = slots.filter((s) => s.state === "open").length;
  const takenCount = slots.filter((s) => s.state === "taken" || s.state === "mine").length;
  const fillPct = Math.round((takenCount / TOTAL) * 100);
  const mySlotData = mySlot !== null ? slots.find((s) => s.id === mySlot) ?? null : null;

  return (
    <div className="min-h-screen bg-[#f8f9fb] dark:bg-[#0c0f14]">

      {/* ─── DEV BANNER ─── */}
      <div className="flex items-center justify-center gap-2 bg-amber-400 px-4 py-2 text-xs font-bold text-amber-900">
        <Info className="h-3.5 w-3.5 shrink-0" />
        ДИЗАЙН-ПРОТОТИП · данные статические · /testivent
      </div>

      {/* ─── HERO ─── */}
      <div className="relative overflow-hidden">
        {/* Background: dark cinematic gradient */}
        <div className="absolute inset-0 bg-[linear-gradient(135deg,#0b0f1a_0%,#131929_45%,#1a0a0c_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_-10%,rgba(227,30,36,0.35),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_10%_90%,rgba(30,80,180,0.2),transparent_50%)]" />
        {/* Grid */}
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.8) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.8) 1px,transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
        {/* Fade bottom */}
        <div className="absolute bottom-0 inset-x-0 h-28 bg-gradient-to-t from-[#f8f9fb] dark:from-[#0c0f14] to-transparent" />

        <div className="relative mx-auto max-w-6xl px-6 pb-14 pt-7">
          {/* Back */}
          <Link
            to="/activities"
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/8 px-3.5 py-1.5 text-sm font-medium text-white/75 backdrop-blur-md transition-colors hover:bg-white/15 hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Мероприятия
          </Link>

          <div className="mt-7 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex-1">
              {/* Badges */}
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E31E24]/35 bg-[#E31E24]/18 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-red-200 backdrop-blur-sm">
                  <Plane className="h-3 w-3" />
                  Слотовый ивент
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/12 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-amber-300 backdrop-blur-sm">
                  <Star className="h-3 w-3" />
                  {POINTS} pts
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-sky-300 backdrop-blur-sm">
                  <Zap className="h-3 w-3" />
                  VATSIM Event
                </span>
                {mySlot !== null && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-400/15 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-emerald-300 backdrop-blur-sm">
                    <CheckCircle2 className="h-3 w-3" />
                    Вы зарегистрированы
                  </span>
                )}
              </div>

              {/* Title */}
              <h1 className="text-4xl font-black leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
                {EVENT_NAME}
              </h1>

              {/* Meta row */}
              <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/60">
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5 shrink-0 text-white/40" />
                  {EVENT_DATE}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 shrink-0 text-white/40" />
                  {EVENT_TIME} UTC
                </span>
                <span className="flex items-center gap-1.5 font-mono font-semibold text-white/75">
                  <MapPin className="h-3.5 w-3.5 shrink-0 font-normal text-white/40" />
                  {EVENT_DEP}
                  <span className="text-white/35 font-normal mx-0.5">→</span>
                  {EVENT_ARR}
                </span>
                <span className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 shrink-0 text-white/40" />
                  {takenCount} участников
                </span>
              </div>
            </div>

            {/* Hero stat blocks — desktop */}
            <div className="hidden shrink-0 lg:flex items-stretch gap-3">
              {[
                { n: openCount, label: "Свободно", color: "text-emerald-400" },
                { n: takenCount, label: "Занято", color: "text-[#E31E24]" },
                { n: TOTAL, label: "Всего", color: "text-white" },
              ].map(({ n, label, color }) => (
                <div
                  key={label}
                  className="flex min-w-[80px] flex-col items-center justify-center gap-0.5 rounded-2xl border border-white/10 bg-white/7 px-5 py-4 backdrop-blur-md"
                >
                  <span className={`text-3xl font-black tabular-nums ${color}`}>{n}</span>
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-white/40">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Fill bar */}
          <div className="mt-6 max-w-md">
            <div className="mb-1.5 flex items-center justify-between text-[11px] text-white/45">
              <span>{fillPct}% занято</span>
              <span>{openCount} слотов свободно</span>
            </div>
            <div className="relative h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#E31E24] to-rose-400 transition-[width] duration-700"
                style={{ width: `${fillPct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ─── BODY ─── */}
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_304px]">

          {/* ── LEFT ── */}
          <div className="space-y-8 min-w-0">

            {/* My slot banner */}
            {mySlotData && (
              <div className="relative overflow-hidden rounded-2xl border border-emerald-200/60 bg-gradient-to-r from-emerald-50 to-teal-50 dark:border-emerald-500/20 dark:from-emerald-950/40 dark:to-teal-950/30 p-5">
                <div className="absolute right-0 top-0 h-full w-40 bg-[radial-gradient(ellipse_at_100%_50%,rgba(52,211,153,0.15),transparent_70%)]" />
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-500/20">
                      <CheckCircle2 className="h-5.5 w-5.5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600/70 dark:text-emerald-500/60">
                        Вы зарегистрированы
                      </p>
                      <p className="mt-0.5 text-2xl font-black tabular-nums text-emerald-800 dark:text-emerald-300">
                        {fmtTime(mySlotData.time)}
                        <span className="ml-1.5 text-sm font-semibold text-emerald-600/60 dark:text-emerald-500/50">UTC</span>
                      </p>
                      <p className="mt-1 text-xs text-emerald-700/60 dark:text-emerald-500/50">
                        {EVENT_DEP} → {EVENT_ARR} · {EVENT_DATE}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      className="bg-emerald-600 text-white hover:bg-emerald-700"
                      onClick={() => window.open(VATSIM_MAP, "_blank", "noopener,noreferrer")}
                    >
                      <Plane className="mr-1.5 h-3.5 w-3.5" />
                      Диспетчер
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-emerald-600/70 hover:bg-emerald-100 hover:text-emerald-700 dark:text-emerald-500/60 dark:hover:bg-emerald-500/10"
                      onClick={handleCancel}
                    >
                      <X className="mr-1.5 h-3.5 w-3.5" />
                      Отменить
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Description */}
            <div className="rounded-2xl border border-gray-200/70 bg-white px-6 py-5 shadow-sm dark:border-white/8 dark:bg-white/[0.03]">
              <h2 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Описание</h2>
              <p className="whitespace-pre-wrap text-sm leading-7 text-gray-600 dark:text-gray-300">{EVENT_DESC}</p>
            </div>

            {/* ── SLOT GRID ── */}
            <div>
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  Слоты вылета
                  <span className="ml-2 normal-case font-normal text-gray-300">
                    · {SLOT_INTERVAL} мин/слот
                  </span>
                </h2>
                {/* Mobile stats */}
                <div className="flex items-center gap-3 lg:hidden text-xs">
                  <span className="text-emerald-600 font-bold">{openCount} св.</span>
                  <span className="text-gray-300">/</span>
                  <span className="text-gray-500">{TOTAL} всего</span>
                </div>
              </div>

              <div className="space-y-6">
                {Object.entries(byHour).map(([hour, hourSlots]) => {
                  const hourOpen = hourSlots.filter((s) => s.state === "open").length;
                  return (
                    <div key={hour}>
                      {/* Hour divider */}
                      <div className="mb-3 flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-gray-800 dark:text-gray-200">{hour}:xx</span>
                          <span className="text-[10px] text-gray-400">UTC</span>
                        </div>
                        <div className="h-px flex-1 bg-gray-200/70 dark:bg-white/8" />
                        <span className="text-[10px] font-medium text-gray-400">{hourOpen} св.</span>
                      </div>

                      {/* Cards */}
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6">
                        {hourSlots.map((slot) => {
                          const isMine = slot.state === "mine";
                          const isTaken = slot.state === "taken";
                          const canBook = !isMine && !isTaken && mySlot === null;

                          return (
                            <button
                              key={slot.id}
                              ref={isMine ? mySlotRef : undefined}
                              type="button"
                              disabled={isTaken || (mySlot !== null && !isMine)}
                              onClick={() => {
                                if (isMine) handleCancel();
                                else if (canBook) handleBook(slot.id);
                              }}
                              className={[
                                "group relative flex flex-col items-center justify-center gap-1.5 rounded-xl border px-2 py-3.5 text-center transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E31E24]/50",
                                isMine
                                  ? "border-emerald-300 bg-emerald-50 shadow-[0_0_0_3px_rgba(52,211,153,0.12)] dark:border-emerald-500/40 dark:bg-emerald-500/10"
                                  : isTaken
                                  ? "border-gray-100 bg-gray-50/80 cursor-not-allowed opacity-45 dark:border-white/5 dark:bg-white/[0.02]"
                                  : mySlot !== null
                                  ? "border-gray-100 bg-gray-50/80 cursor-default opacity-60 dark:border-white/5 dark:bg-white/[0.02]"
                                  : "border-gray-200/80 bg-white shadow-sm hover:border-[#E31E24]/40 hover:shadow-[0_4px_20px_rgba(227,30,36,0.1)] hover:scale-[1.03] active:scale-[0.98] cursor-pointer dark:border-white/8 dark:bg-white/[0.04] dark:hover:border-[#E31E24]/35 dark:hover:bg-[#E31E24]/5",
                              ].join(" ")}
                            >
                              {/* Icon */}
                              <div className="h-4 flex items-center justify-center">
                                {isMine ? (
                                  <CheckCircle2 className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
                                ) : isTaken ? (
                                  <Lock className="h-3 w-3 text-gray-300 dark:text-gray-600" />
                                ) : (
                                  <Plane className="h-3.5 w-3.5 text-gray-300 opacity-0 transition-opacity duration-150 group-hover:opacity-100 dark:text-gray-500" />
                                )}
                              </div>

                              {/* Time */}
                              <span className={[
                                "font-mono text-[15px] font-black leading-none tabular-nums",
                                isMine
                                  ? "text-emerald-700 dark:text-emerald-300"
                                  : isTaken
                                  ? "text-gray-300 dark:text-gray-600"
                                  : "text-gray-800 dark:text-gray-100",
                              ].join(" ")}>
                                {fmtTime(slot.time)}
                              </span>

                              {/* Label */}
                              <span className={[
                                "text-[9px] font-bold uppercase tracking-[0.12em] leading-none",
                                isMine
                                  ? "text-emerald-600 dark:text-emerald-500"
                                  : isTaken
                                  ? "text-gray-300 dark:text-gray-600"
                                  : "text-gray-400 group-hover:text-[#E31E24]/70",
                              ].join(" ")}>
                                {isMine ? "Ваш" : isTaken ? "Занят" : "Свободен"}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              <Legend />
            </div>
          </div>

          {/* ── RIGHT SIDEBAR ── */}
          <div className="space-y-4">
            <div className="sticky top-6 space-y-4">

              {/* Info card */}
              <div className="overflow-hidden rounded-2xl border border-gray-200/70 bg-white shadow-sm dark:border-white/8 dark:bg-white/[0.03]">
                <div className="border-b border-gray-100 dark:border-white/6 px-5 py-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Информация</p>
                </div>
                <div className="divide-y divide-gray-100/70 dark:divide-white/5">
                  {[
                    { label: "Дата", value: EVENT_DATE },
                    { label: "Время (UTC)", value: EVENT_TIME },
                    { label: "Интервал", value: `${SLOT_INTERVAL} мин` },
                    { label: "Баллы", value: `${POINTS} pts` },
                    { label: "Вылет", value: EVENT_DEP },
                    { label: "Прилёт", value: EVENT_ARR },
                    { label: "Дистанция", value: "878 nm" },
                    { label: "Эшелон", value: "FL360" },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-start justify-between gap-3 px-5 py-3">
                      <span className="shrink-0 text-xs text-gray-400">{label}</span>
                      <span className="text-right text-xs font-semibold text-gray-800 dark:text-gray-200">{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Occupancy card */}
              <div className="overflow-hidden rounded-2xl border border-gray-200/70 bg-white shadow-sm dark:border-white/8 dark:bg-white/[0.03]">
                <div className="border-b border-gray-100 dark:border-white/6 px-5 py-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Заполненность</p>
                </div>
                <div className="px-5 py-4 space-y-4">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    {[
                      { n: openCount, label: "Своб.", color: "text-emerald-600 dark:text-emerald-400" },
                      { n: takenCount, label: "Занято", color: "text-[#E31E24]" },
                      { n: TOTAL, label: "Всего", color: "text-gray-800 dark:text-gray-200" },
                    ].map(({ n, label, color }) => (
                      <div key={label} className="rounded-xl bg-gray-50 dark:bg-white/[0.04] py-3">
                        <div className={`text-2xl font-black tabular-nums ${color}`}>{n}</div>
                        <div className="mt-0.5 text-[9px] font-semibold uppercase tracking-wider text-gray-400">{label}</div>
                      </div>
                    ))}
                  </div>
                  <div>
                    <div className="mb-1.5 flex items-center justify-between text-[10px] text-gray-400">
                      <span>{fillPct}% занято</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-white/8">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#c71f28] to-[#E31E24] transition-[width] duration-700"
                        style={{ width: `${fillPct}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* VATSIM card */}
              <div className="overflow-hidden rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50 to-blue-50 shadow-sm dark:border-sky-500/15 dark:from-sky-950/30 dark:to-blue-950/20 px-5 py-4">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-sky-500">VATSIM</p>
                <p className="text-xs text-sky-700/80 dark:text-sky-400/70 leading-relaxed mb-3">
                  Ожидается плановое ATC-покрытие секторов Москва-Центр и Краснодар-Подход. Рекомендуем подать флайплан заранее.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full border-sky-200 text-sky-700 hover:bg-sky-100 dark:border-sky-500/25 dark:text-sky-400 dark:hover:bg-sky-500/10"
                  onClick={() => window.open(VATSIM_MAP, "_blank", "noopener,noreferrer")}
                >
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                  Карта VATSIM
                </Button>
              </div>

            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
