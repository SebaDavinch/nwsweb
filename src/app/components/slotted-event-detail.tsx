import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  Lock,
  MapPin,
  Plane,
  Star,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../context/auth-context";
import { useLanguage } from "../context/language-context";
import { Button } from "./ui/button";

interface Slot {
  id: number;
  time: string;
  available: boolean;
  booked: boolean;
  registeredPilotId: number | null;
}

interface SlottedEvent {
  id: number;
  name: string;
  description: string | null;
  image: string | null;
  start: string | null;
  end: string | null;
  showFrom: string | null;
  slotInterval: number | null;
  points: number;
  registrationCount: number;
  departureAirport: string | null;
  arrivalAirport: string | null;
  hidden: boolean;
  slots: Slot[];
  totalSlots: number;
  availableSlots: number;
}

const fmtDate = (v: string | null | undefined, lang: string) => {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d.getTime()) ? v : d.toLocaleDateString(lang === "ru" ? "ru-RU" : "en-GB", {
    day: "numeric", month: "long", year: "numeric",
  });
};

const fmtTime = (v: string) => {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d.getTime()) ? v : d.toLocaleTimeString("en-GB", {
    hour: "2-digit", minute: "2-digit", timeZone: "UTC",
  });
};

const fmtHour = (v: string) => {
  if (!v) return "00";
  const d = new Date(v);
  return isNaN(d.getTime()) ? "00" : String(d.getUTCHours()).padStart(2, "0");
};

export function SlottedEventDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { language } = useLanguage();
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);

  const [event, setEvent] = useState<SlottedEvent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [myRegistrationId, setMyRegistrationId] = useState<number | null>(null);
  const [mySlotId, setMySlotId] = useState<number | null>(null);
  const [bookingSlotId, setBookingSlotId] = useState<number | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isUnregistering, setIsUnregistering] = useState(false);
  const mySlotRef = useRef<HTMLButtonElement | null>(null);

  const eventId = Number(id || 0) || 0;

  const loadEvent = async () => {
    if (!eventId) return;
    setIsLoading(true);
    try {
      const r = await fetch(`/api/public/slotted-events/${eventId}`, { credentials: "include" });
      const payload = await r.json().catch(() => null);
      if (!r.ok) throw new Error(payload?.error || "Failed");
      setEvent(payload?.slottedEvent ?? null);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setIsLoading(false);
    }
  };

  const loadMyRegistration = async () => {
    if (!isAuthenticated) return;
    try {
      const r = await fetch("/api/pilot/activities/registrations", { credentials: "include" });
      const payload = await r.json().catch(() => null);
      const regs = Array.isArray(payload?.registrations) ? payload.registrations : [];
      const mine = regs.find((reg: { activityId?: number; id?: number; slotId?: number }) =>
        Number(reg?.activityId || 0) === eventId
      );
      if (mine) {
        setMyRegistrationId(Number(mine.id || 0) || null);
        setMySlotId(Number(mine.slotId || mine.slot_id || 0) || null);
      }
    } catch { /* silent */ }
  };

  useEffect(() => { void loadEvent(); }, [eventId]);
  useEffect(() => { void loadMyRegistration(); }, [isAuthenticated, eventId]);

  // Scroll to your slot after data loads
  useEffect(() => {
    if (mySlotRef.current) {
      setTimeout(() => mySlotRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 300);
    }
  }, [mySlotId, event]);

  const handleRegister = async (slotId: number) => {
    if (!isAuthenticated) { navigate("/login"); return; }
    setIsRegistering(true);
    setBookingSlotId(slotId);
    try {
      const r = await fetch(`/api/pilot/activities/${eventId}/register`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slot_id: slotId }),
      });
      const payload = await r.json().catch(() => null);
      if (!r.ok) throw new Error(payload?.error || "Registration failed");
      toast.success(tr("Слот забронирован! Удачного полёта 🛫", "Slot booked! Have a great flight 🛫"));
      setMySlotId(slotId);
      setMyRegistrationId(Number(payload?.registrationId || payload?.id || 0) || null);
      void loadEvent();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setIsRegistering(false);
      setBookingSlotId(null);
    }
  };

  const handleUnregister = async () => {
    if (!myRegistrationId) return;
    setIsUnregistering(true);
    try {
      const r = await fetch(`/api/pilot/activities/registrations/${myRegistrationId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!r.ok) throw new Error("Failed");
      toast.success(tr("Регистрация отменена", "Registration cancelled"));
      setMyRegistrationId(null);
      setMySlotId(null);
      void loadEvent();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setIsUnregistering(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#E31E24]" />
          <p className="text-sm text-gray-400">{tr("Загрузка ивента...", "Loading event...")}</p>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-gray-500">
        <div className="text-4xl opacity-30">🛫</div>
        <p className="font-medium">{tr("Ивент не найден", "Event not found")}</p>
        <Button variant="outline" onClick={() => navigate("/activities")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {tr("К мероприятиям", "Back to activities")}
        </Button>
      </div>
    );
  }

  // Derived stats
  const openSlots = event.slots.filter((s) => s.available && !s.booked).length;
  const takenSlots = event.slots.filter((s) => !s.available || s.booked).length;
  const fillPct = event.slots.length > 0 ? Math.round((takenSlots / event.slots.length) * 100) : 0;
  const mySlot = event.slots.find((s) => s.id === mySlotId) ?? null;

  // Group by hour
  const slotsByHour = event.slots.reduce<Record<string, Slot[]>>((acc, slot) => {
    const hour = fmtHour(slot.time);
    (acc[hour] ??= []).push(slot);
    return acc;
  }, {});

  const infoRows = [
    { label: tr("Дата", "Date"), value: fmtDate(event.start, language) },
    {
      label: tr("Время (UTC)", "Time (UTC)"),
      value: `${fmtTime(event.start || "")} – ${fmtTime(event.end || "")}`,
    },
    event.slotInterval ? { label: tr("Интервал", "Slot interval"), value: `${event.slotInterval} ${tr("мин", "min")}` } : null,
    event.points > 0 ? { label: tr("Баллы", "Points"), value: `${event.points} pts` } : null,
    event.departureAirport ? { label: tr("Вылет", "Departure"), value: event.departureAirport } : null,
    event.arrivalAirport ? { label: tr("Прилёт", "Arrival"), value: event.arrivalAirport } : null,
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <div className="min-h-screen bg-[#f8f9fb] dark:bg-[#0c0f14]">

      {/* ─── HERO ─── */}
      <div className="relative overflow-hidden">
        {/* Background */}
        {event.image ? (
          <>
            <div className="absolute inset-0">
              <img src={event.image} alt={event.name} className="h-full w-full object-cover scale-105 blur-sm" />
              <div className="absolute inset-0 bg-black/65" />
            </div>
            <div className="absolute bottom-0 inset-x-0 h-24 bg-gradient-to-t from-[#f8f9fb] dark:from-[#0c0f14] to-transparent" />
          </>
        ) : (
          <>
            <div className="absolute inset-0 bg-[linear-gradient(135deg,#0b0f1a_0%,#131929_45%,#1a0a0c_100%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_-10%,rgba(227,30,36,0.35),transparent_55%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_10%_90%,rgba(30,80,180,0.2),transparent_50%)]" />
            {/* Decorative grid lines */}
            <div className="absolute inset-0 opacity-[0.04]"
              style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.8) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.8) 1px,transparent 1px)", backgroundSize: "60px 60px" }} />
            <div className="absolute bottom-0 inset-x-0 h-28 bg-gradient-to-t from-[#f8f9fb] dark:from-[#0c0f14] to-transparent" />
          </>
        )}

        <div className="relative mx-auto max-w-6xl px-6 pb-14 pt-7">
          {/* Back */}
          <Link
            to="/activities"
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/8 px-3.5 py-1.5 text-sm font-medium text-white/75 backdrop-blur-md transition-colors hover:bg-white/15 hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {tr("Мероприятия", "Activities")}
          </Link>

          <div className="mt-7 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex-1">
              {/* Badges */}
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E31E24]/35 bg-[#E31E24]/18 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-red-200 backdrop-blur-sm">
                  <Plane className="h-3 w-3" />
                  {tr("Слотовый ивент", "Slotted Event")}
                </span>
                {event.points > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/12 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-amber-300 backdrop-blur-sm">
                    <Star className="h-3 w-3" />
                    {event.points} pts
                  </span>
                )}
                {mySlotId && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-400/15 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-emerald-300 backdrop-blur-sm">
                    <CheckCircle2 className="h-3 w-3" />
                    {tr("Вы зарегистрированы", "You're registered")}
                  </span>
                )}
              </div>

              {/* Title */}
              <h1 className="text-4xl font-black leading-tight tracking-tight text-white sm:text-5xl">
                {event.name}
              </h1>

              {/* Meta */}
              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/60">
                {event.start && (
                  <span className="flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5 shrink-0 text-white/40" />
                    {fmtDate(event.start, language)}
                  </span>
                )}
                {event.start && event.end && (
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 shrink-0 text-white/40" />
                    {fmtTime(event.start)} – {fmtTime(event.end)} UTC
                  </span>
                )}
                {event.departureAirport && (
                  <span className="flex items-center gap-1.5 font-mono font-semibold text-white/75">
                    <MapPin className="h-3.5 w-3.5 shrink-0 font-normal text-white/40" />
                    {event.departureAirport}
                    {event.arrivalAirport ? (
                      <> <span className="text-white/35 font-normal">→</span> {event.arrivalAirport}</>
                    ) : null}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 shrink-0 text-white/40" />
                  {event.registrationCount} {tr("участников", "registered")}
                </span>
              </div>
            </div>

            {/* Hero stats (desktop) */}
            {event.slots.length > 0 && (
              <div className="hidden shrink-0 lg:flex items-stretch gap-3">
                {[
                  { n: openSlots, label: tr("Свободно", "Available"), color: "text-emerald-400" },
                  { n: takenSlots, label: tr("Занято", "Booked"), color: "text-[#E31E24]" },
                  { n: event.totalSlots, label: tr("Всего", "Total"), color: "text-white" },
                ].map(({ n, label, color }) => (
                  <div key={label}
                    className="flex min-w-[80px] flex-col items-center justify-center gap-0.5 rounded-2xl border border-white/10 bg-white/7 px-5 py-4 backdrop-blur-md"
                  >
                    <span className={`text-3xl font-black tabular-nums ${color}`}>{n}</span>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-white/40">{label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Fill bar (below title) */}
          {event.slots.length > 0 && (
            <div className="mt-6 max-w-md">
              <div className="mb-1.5 flex items-center justify-between text-[11px] text-white/45">
                <span>{fillPct}% {tr("занято", "filled")}</span>
                <span>{openSlots} {tr("слотов свободно", "slots open")}</span>
              </div>
              <div className="relative h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#E31E24] to-rose-400 transition-[width] duration-700"
                  style={{ width: `${fillPct}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── BODY ─── */}
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_304px]">

          {/* ── LEFT COLUMN ── */}
          <div className="space-y-8 min-w-0">

            {/* MY SLOT BANNER */}
            {mySlot && (
              <div className="relative overflow-hidden rounded-2xl border border-emerald-200/60 bg-gradient-to-r from-emerald-50 to-teal-50 dark:border-emerald-500/20 dark:from-emerald-950/40 dark:to-teal-950/30 p-5">
                <div className="absolute right-0 top-0 h-full w-32 bg-[radial-gradient(ellipse_at_100%_50%,rgba(52,211,153,0.15),transparent_70%)]" />
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-500/20">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600/70 dark:text-emerald-500/60">
                        {tr("Вы зарегистрированы", "You are registered")}
                      </p>
                      <p className="mt-0.5 text-xl font-black tabular-nums text-emerald-800 dark:text-emerald-300">
                        {fmtTime(mySlot.time)}
                        <span className="ml-1.5 text-sm font-semibold text-emerald-600/60 dark:text-emerald-500/50">UTC</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {event.departureAirport && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-emerald-300 bg-white/60 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-500/30 dark:bg-transparent dark:text-emerald-400 dark:hover:bg-emerald-500/10"
                        onClick={() => window.open(`https://vamsys.io`, "_blank", "noopener,noreferrer")}
                      >
                        <Plane className="mr-1.5 h-3.5 w-3.5" />
                        {tr("Диспетчер", "Dispatch")}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-emerald-600/70 hover:bg-emerald-100 hover:text-emerald-700 dark:text-emerald-500/60 dark:hover:bg-emerald-500/10"
                      onClick={() => void handleUnregister()}
                      disabled={isUnregistering}
                    >
                      {isUnregistering ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <X className="mr-1.5 h-3.5 w-3.5" />}
                      {tr("Отменить", "Cancel")}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Description */}
            {event.description && (
              <div className="rounded-2xl border border-gray-200/70 bg-white px-6 py-5 shadow-sm dark:border-white/8 dark:bg-white/[0.03]">
                <h2 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  {tr("Описание", "Description")}
                </h2>
                <p className="text-sm leading-7 text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{event.description}</p>
              </div>
            )}

            {/* SLOT GRID */}
            {event.slots.length > 0 ? (
              <div>
                <div className="mb-5 flex items-center justify-between">
                  <h2 className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                    {tr("Слоты вылета", "Departure Slots")}
                    {event.slotInterval ? (
                      <span className="ml-2 normal-case font-normal text-gray-300">
                        · {event.slotInterval} {tr("мин/слот", "min/slot")}
                      </span>
                    ) : null}
                  </h2>
                  {/* Mobile stats */}
                  <div className="flex items-center gap-3 lg:hidden text-xs">
                    <span className="text-emerald-600 font-bold">{openSlots} {tr("св.", "open")}</span>
                    <span className="text-gray-300">/</span>
                    <span className="text-gray-500">{event.totalSlots} {tr("всего", "total")}</span>
                  </div>
                </div>

                {/* Login prompt */}
                {!isAuthenticated && (
                  <div className="mb-6 flex items-center justify-between gap-4 rounded-2xl border border-blue-100 bg-blue-50/60 p-4 dark:border-blue-500/15 dark:bg-blue-500/5">
                    <p className="text-sm text-blue-700 dark:text-blue-400">
                      {tr("Войдите, чтобы записаться на слот", "Sign in to book a slot")}
                    </p>
                    <Button size="sm" className="shrink-0 bg-[#E31E24] text-white hover:bg-[#c21920]" asChild>
                      <Link to="/login">{tr("Войти", "Sign in")}</Link>
                    </Button>
                  </div>
                )}

                <div className="space-y-6">
                  {Object.entries(slotsByHour).map(([hour, slots]) => {
                    const hourOpen = slots.filter((s) => s.available && !s.booked).length;
                    return (
                      <div key={hour}>
                        {/* Hour divider */}
                        <div className="mb-3 flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-gray-800 dark:text-gray-200">
                              {hour}:xx
                            </span>
                            <span className="text-[10px] text-gray-400">UTC</span>
                          </div>
                          <div className="h-px flex-1 bg-gray-200/70 dark:bg-white/8" />
                          <span className="text-[10px] font-medium text-gray-400">
                            {hourOpen} {tr("св.", "open")}
                          </span>
                        </div>

                        {/* Slot cards */}
                        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6">
                          {slots.map((slot) => {
                            const isMine = mySlotId === slot.id;
                            const isTaken = !slot.available || slot.booked;
                            const isBookingThis = bookingSlotId === slot.id && isRegistering;
                            const isBlocked = isRegistering || isUnregistering;
                            const canBook = !isMine && !isTaken && !mySlotId;

                            return (
                              <button
                                key={slot.id}
                                ref={isMine ? mySlotRef : undefined}
                                type="button"
                                disabled={isTaken || isBlocked || (Boolean(mySlotId) && !isMine)}
                                onClick={() => isMine ? void handleUnregister() : canBook ? void handleRegister(slot.id) : undefined}
                                className={[
                                  "group relative flex flex-col items-center justify-center gap-1.5 rounded-xl border px-2 py-3.5 text-center transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E31E24]/50",
                                  isMine
                                    ? "border-emerald-300 bg-emerald-50 shadow-[0_0_0_3px_rgba(52,211,153,0.12)] dark:border-emerald-500/40 dark:bg-emerald-500/10"
                                    : isTaken
                                    ? "border-gray-100 bg-gray-50/80 cursor-not-allowed opacity-45 dark:border-white/5 dark:bg-white/[0.02]"
                                    : mySlotId
                                    ? "border-gray-100 bg-gray-50/80 cursor-default opacity-60 dark:border-white/5 dark:bg-white/[0.02]"
                                    : "border-gray-200/80 bg-white shadow-sm hover:border-[#E31E24]/40 hover:shadow-[0_4px_20px_rgba(227,30,36,0.1)] hover:scale-[1.03] active:scale-[0.98] cursor-pointer dark:border-white/8 dark:bg-white/[0.04] dark:hover:border-[#E31E24]/35 dark:hover:bg-[#E31E24]/5",
                                ].join(" ")}
                              >
                                {/* State icon */}
                                <div className="h-4 flex items-center justify-center">
                                  {isBookingThis ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />
                                  ) : isMine ? (
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
                                  {isMine
                                    ? tr("Ваш", "Yours")
                                    : isTaken
                                    ? tr("Занят", "Taken")
                                    : tr("Свободен", "Open")}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="mt-6 flex flex-wrap items-center gap-4 text-xs text-gray-400">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-3 w-3 rounded-sm border border-gray-200 bg-white dark:border-white/8 dark:bg-white/[0.04]" />
                    {tr("Свободен", "Available")}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-3 w-3 rounded-sm border border-emerald-300 bg-emerald-50 dark:border-emerald-500/40 dark:bg-emerald-500/10" />
                    {tr("Ваш слот", "Your slot")}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-3 w-3 rounded-sm border border-gray-100 bg-gray-50 opacity-50 dark:border-white/5 dark:bg-white/[0.02]" />
                    {tr("Занят", "Taken")}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-gray-200 py-16 text-gray-400 dark:border-white/8">
                <Clock className="h-8 w-8 opacity-30" />
                <p className="text-sm">{tr("Слоты ещё не опубликованы", "Slots not yet published")}</p>
              </div>
            )}
          </div>

          {/* ── RIGHT SIDEBAR ── */}
          <div className="space-y-4">

            {/* Info card */}
            <div className="sticky top-6 space-y-4">
              <div className="overflow-hidden rounded-2xl border border-gray-200/70 bg-white shadow-sm dark:border-white/8 dark:bg-white/[0.03]">
                {/* Card header */}
                <div className="border-b border-gray-100 dark:border-white/6 px-5 py-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                    {tr("Информация", "Event Info")}
                  </p>
                </div>

                {/* Info rows */}
                <div className="divide-y divide-gray-100/70 dark:divide-white/5">
                  {infoRows.map(({ label, value }) => (
                    <div key={label} className="flex items-start justify-between gap-3 px-5 py-3">
                      <span className="shrink-0 text-xs text-gray-400">{label}</span>
                      <span className="text-right text-xs font-semibold text-gray-800 dark:text-gray-200">{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Occupancy card */}
              {event.slots.length > 0 && (
                <div className="overflow-hidden rounded-2xl border border-gray-200/70 bg-white shadow-sm dark:border-white/8 dark:bg-white/[0.03]">
                  <div className="border-b border-gray-100 dark:border-white/6 px-5 py-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                      {tr("Заполненность", "Occupancy")}
                    </p>
                  </div>
                  <div className="px-5 py-4 space-y-4">
                    {/* Big numbers */}
                    <div className="grid grid-cols-3 gap-2 text-center">
                      {[
                        { n: openSlots, label: tr("Своб.", "Open"), color: "text-emerald-600 dark:text-emerald-400" },
                        { n: takenSlots, label: tr("Занято", "Taken"), color: "text-[#E31E24]" },
                        { n: event.totalSlots, label: tr("Всего", "Total"), color: "text-gray-800 dark:text-gray-200" },
                      ].map(({ n, label, color }) => (
                        <div key={label} className="rounded-xl bg-gray-50 dark:bg-white/[0.04] py-3">
                          <div className={`text-2xl font-black tabular-nums ${color}`}>{n}</div>
                          <div className="mt-0.5 text-[9px] font-semibold uppercase tracking-wider text-gray-400">{label}</div>
                        </div>
                      ))}
                    </div>

                    {/* Segmented fill bar */}
                    <div>
                      <div className="mb-1.5 flex items-center justify-between text-[10px] text-gray-400">
                        <span>{fillPct}% {tr("занято", "filled")}</span>
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
              )}

              {/* VATSIM Map button */}
              {event.departureAirport && (
                <button
                  type="button"
                  onClick={() => window.open(`https://map.vatsim.net/?search=${event.departureAirport}`, "_blank", "noopener,noreferrer")}
                  className="flex w-full items-center justify-between rounded-2xl border border-gray-200/70 bg-white px-5 py-3.5 text-sm font-medium text-gray-600 shadow-sm transition-colors hover:bg-gray-50 hover:text-gray-900 dark:border-white/8 dark:bg-white/[0.03] dark:text-gray-400 dark:hover:bg-white/[0.06] dark:hover:text-gray-200"
                >
                  <span className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-[#E31E24]" />
                    {tr("Карта VATSIM", "VATSIM Map")}
                  </span>
                  <ExternalLink className="h-3.5 w-3.5 text-gray-300 dark:text-gray-600" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
