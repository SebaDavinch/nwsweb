import { useEffect, useMemo, useState } from "react";
import {
  Clock,
  Plane,
  Coins,
  PlaneTakeoff,
  CheckCircle2,
  Hourglass,
  Ban,
  XCircle,
  ArrowRight,
  History,
  CalendarCheck,
  Timer,
} from "lucide-react";
import { useLanguage } from "../../context/language-context";
import { useAuth } from "../../context/auth-context";
import { useAppTheme } from "./use-app-theme";
import { NotificationCenter } from "../dashboard/notification-center";
import { icaoToCountry, getFlagUri } from "../dashboard/flag-data";
import { useActiveBooking } from "./use-active-booking";
import { HubAgenda } from "./hub-agenda";
import { useActivityProgress } from "./use-activity-progress";

interface RecentFlight {
  id: number;
  flightNumber: string;
  departureIcao: string;
  arrivalIcao: string;
  departureCountryIso2?: string | null;
  arrivalCountryIso2?: string | null;
  aircraft: string;
  status: string;
  needReply?: boolean;
  completedDate?: string;
  date?: string;
}

type StatusKey = "accepted" | "awaiting_review" | "invalidated" | "rejected";

function statusKey(status?: string, needReply?: boolean): StatusKey | "needs_reply" {
  if (needReply) return "needs_reply";
  const n = String(status || "").trim().toLowerCase().replace(/\s+/g, "_");
  if (["accepted", "auto_accepted", "approved", "completed"].includes(n)) return "accepted";
  if (["rejected", "denied", "failed", "cancelled"].includes(n)) return "rejected";
  if (["invalidated", "invalid", "void"].includes(n)) return "invalidated";
  return "awaiting_review";
}

/** Локальный SVG-флаг по ICAO/ISO2 (без внешних запросов). */
function Flag({ icao, iso2, className = "h-4 w-6" }: { icao?: string; iso2?: string | null; className?: string }) {
  const code =
    iso2 && /^[a-z]{2}$/i.test(iso2) ? iso2.toLowerCase() : icaoToCountry(icao || "");
  const uri = code ? getFlagUri(code) : "";
  if (!uri) {
    return (
      <span
        className={`inline-flex items-center justify-center rounded-[3px] border border-black/10 bg-zinc-100 text-[8px] font-bold uppercase text-zinc-400 ${className}`}
      >
        {(icao || "").slice(0, 2) || "··"}
      </span>
    );
  }
  return <img src={uri} alt={code} className={`inline-block rounded-[3px] border border-black/10 object-cover ${className}`} />;
}

function StatusCard({
  icon,
  count,
  label,
  gradient,
  ring,
}: {
  icon: React.ReactNode;
  count: number;
  label: string;
  gradient: string;
  ring: string;
}) {
  return (
    <div className={`relative overflow-hidden rounded-2xl p-4 text-white shadow-sm ring-1 ${gradient} ${ring}`}>
      <div className="absolute -right-3 -top-3 opacity-20">
        <div className="[&>svg]:h-16 [&>svg]:w-16">{icon}</div>
      </div>
      <div className="relative">
        <div className="[&>svg]:h-5 [&>svg]:w-5">{icon}</div>
        <div className="mt-2 text-3xl font-black leading-none">{count}</div>
        <div className="mt-1 text-xs font-medium uppercase tracking-wide text-white/80">{label}</div>
      </div>
    </div>
  );
}

export function HubOverview({
  onOpenPirep,
  onOpenNotams,
  onOpenActivities,
}: {
  onOpenPirep: (id: number) => void;
  onOpenNotams?: () => void;
  onOpenActivities?: () => void;
}) {
  const { t, language } = useLanguage();
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);
  const locale = language === "ru" ? "ru-RU" : "en-US";
  const { pilot } = useAuth();
  const { isDark } = useAppTheme();
  const { booking, upcoming } = useActiveBooking();
  const { items: activityProgress, slots: slotProgress } = useActivityProgress(4);
  const [balance, setBalance] = useState<number | null>(null);
  const [flights, setFlights] = useState<RecentFlight[]>([]);
  const [heroShots, setHeroShots] = useState<string[]>([]);
  const [heroIdx, setHeroIdx] = useState(0);

  useEffect(() => {
    let active = true;
    fetch("/api/pilot/balance", { credentials: "include" })
      .then((r) => r.json().catch(() => null))
      .then((p) => {
        if (active && typeof p?.balance === "number") setBalance(p.balance);
      })
      .catch(() => null);
    fetch("/api/vamsys/recent-flights", { credentials: "include" })
      .then((r) => r.json().catch(() => null))
      .then((p) => {
        if (active && Array.isArray(p?.flights)) setFlights(p.flights as RecentFlight[]);
      })
      .catch(() => null);
    // фото бортов Nordwind для героя — топ-скриншоты сообщества
    fetch("/api/pilot/social-gallery", { credentials: "include" })
      .then((r) => r.json().catch(() => null))
      .then((p) => {
        if (!active) return;
        const pool: { assetUrl?: string }[] = Array.isArray(p?.topShots) && p.topShots.length
          ? p.topShots
          : Array.isArray(p?.communityMedia)
            ? p.communityMedia
            : [];
        const urls = pool.map((m) => String(m?.assetUrl || "")).filter(Boolean).slice(0, 6);
        setHeroShots(urls);
      })
      .catch(() => null);
    return () => {
      active = false;
    };
  }, []);

  // ротация фоновых фото героя
  useEffect(() => {
    if (heroShots.length < 2) return;
    const id = window.setInterval(() => setHeroIdx((i) => (i + 1) % heroShots.length), 7000);
    return () => window.clearInterval(id);
  }, [heroShots.length]);

  const counts = useMemo(() => {
    const acc: Record<StatusKey, number> = { accepted: 0, awaiting_review: 0, invalidated: 0, rejected: 0 };
    for (const f of flights) {
      const k = statusKey(f.status, f.needReply);
      if (k === "needs_reply") acc.awaiting_review += 1;
      else acc[k] += 1;
    }
    return acc;
  }, [flights]);

  const last3 = useMemo(() => {
    return [...flights]
      .sort((a, b) => new Date(b.completedDate || b.date || 0).getTime() - new Date(a.completedDate || a.date || 0).getTime())
      .slice(0, 3);
  }, [flights]);

  const fmtDate = (v?: string) => {
    const ts = new Date(String(v || "")).getTime();
    return Number.isFinite(ts) && ts > 0 ? new Date(ts).toLocaleDateString(locale, { day: "numeric", month: "short" }) : "—";
  };

  const statusBadge = (f: RecentFlight) => {
    const k = statusKey(f.status, f.needReply);
    const map: Record<string, { label: string; cls: string }> = {
      accepted: { label: tr("Принят", "Accepted"), cls: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400" },
      awaiting_review: { label: tr("На проверке", "Under review"), cls: "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400" },
      needs_reply: { label: tr("Нужен ответ", "Needs reply"), cls: "bg-orange-50 text-orange-600 dark:bg-orange-500/15 dark:text-orange-400" },
      invalidated: { label: tr("Аннулирован", "Invalidated"), cls: "bg-zinc-100 text-zinc-500 dark:bg-white/10 dark:text-zinc-400" },
      rejected: { label: tr("Отклонён", "Rejected"), cls: "bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-400" },
    };
    return map[k] || map.awaiting_review;
  };

  return (
    <div className={`${isDark ? "dark text-zinc-100" : "text-zinc-900"} relative min-h-full`}>
      {/* Фон Главной: ротация фото бортов Nordwind (затемнённое в тёмной теме, осветлённое в светлой) */}
      <div className="pointer-events-none absolute inset-0">
        <div className={`absolute inset-0 ${isDark ? "bg-zinc-950" : "bg-zinc-100"}`} />
        {heroShots.map((url, i) => (
          <div
            key={url}
            className="absolute inset-0 bg-cover bg-center transition-opacity duration-1000"
            style={{ backgroundImage: `url("${url}")`, opacity: i === heroIdx ? (isDark ? 0.4 : 0.22) : 0 }}
          />
        ))}
        {/* скрим для читаемости */}
        <div
          className={`absolute inset-0 ${
            isDark
              ? "bg-gradient-to-b from-zinc-950/80 via-zinc-950/85 to-zinc-950/95"
              : "bg-gradient-to-b from-zinc-100/80 via-zinc-100/85 to-zinc-100/95"
          }`}
        />
      </div>

      {/* Контент поверх фона */}
      <div className="relative z-10 space-y-6 p-5">
        {/* Приветствие + борт Nordwind + колокольчик */}
        <div className="relative flex items-start justify-between gap-4 overflow-hidden">
          <div className="relative z-10">
            <div className={`mb-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider backdrop-blur ${isDark ? "bg-white/10 text-red-200" : "bg-red-50 text-red-600"}`}>
              NordwindHub
            </div>
            <h1 className={`text-2xl font-black tracking-tight drop-shadow ${isDark ? "text-white" : "text-zinc-900"}`}>
              {tr("С возвращением", "Welcome back")}{pilot?.firstName ? `, ${pilot.firstName}` : ""}
            </h1>
            <p className={`mt-1 max-w-md text-sm ${isDark ? "text-white/70" : "text-zinc-500"}`}>{t("app.hub.subtitle")}</p>
          </div>
          <div className="relative z-10">
            <NotificationCenter />
          </div>
        </div>

      {/* Текущий букинг + быстрые метрики */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Текущий букинг (на 2 колонки) */}
        <div className="lg:col-span-2">
          {booking ? (
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-zinc-900 via-zinc-900 to-red-950 p-6 text-white shadow-md">
              <div className="absolute right-0 top-0 h-40 w-40 translate-x-10 -translate-y-10 rounded-full bg-red-500/20 blur-2xl" />
              <div className="relative">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-red-300">
                  <PlaneTakeoff className="h-3.5 w-3.5" />
                  {tr("Текущий рейс", "Current flight")}
                </div>
                <div className="mt-3 flex items-center gap-4">
                  <div className="flex flex-col items-center">
                    <Flag icao={booking.departureCode} iso2={null} className="h-7 w-10 shadow" />
                    <span className="mt-1 font-mono text-lg font-bold">{booking.departureCode}</span>
                  </div>
                  <div className="flex flex-1 flex-col items-center">
                    <Plane className="h-5 w-5 rotate-90 text-red-300" />
                    <div className="mt-1 h-px w-full bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                    <span className="mt-1 text-xs text-white/60">{booking.callsign}</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <Flag icao={booking.arrivalCode} iso2={null} className="h-7 w-10 shadow" />
                    <span className="mt-1 font-mono text-lg font-bold">{booking.arrivalCode}</span>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-sm text-white/70">{booking.aircraft}</span>
                  <a
                    href={`/dashboard/booking/${booking.id}`}
                    className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-1.5 text-sm font-semibold backdrop-blur transition-colors hover:bg-white/20"
                  >
                    {tr("Открыть", "Open")}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center rounded-3xl border border-dashed border-zinc-300 bg-white p-8 text-center dark:border-white/10 dark:bg-zinc-900">
              <Plane className="h-8 w-8 text-zinc-300 dark:text-zinc-600" />
              <div className="mt-2 text-sm font-medium text-zinc-500 dark:text-zinc-400">{tr("Нет активной брони", "No active booking")}</div>
              <a href="/app/dispatch" className="mt-2 text-sm font-semibold text-red-500 hover:text-red-600">
                {t("app.flight.empty.book")}
              </a>
            </div>
          )}
        </div>

        {/* Метрики */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-1">
          <div className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm dark:border-white/10 dark:bg-zinc-900">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-sky-500 dark:bg-sky-500/15 dark:text-sky-400"><Clock className="h-4 w-4" /></span>
            <div>
              <div className="text-[11px] uppercase tracking-wide text-zinc-400">{tr("Часы", "Hours")}</div>
              <div className="text-lg font-bold text-zinc-800 dark:text-zinc-100">{pilot?.totalHours ?? 0}h</div>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm dark:border-white/10 dark:bg-zinc-900">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-500 dark:bg-violet-500/15 dark:text-violet-400"><Plane className="h-4 w-4" /></span>
            <div>
              <div className="text-[11px] uppercase tracking-wide text-zinc-400">{tr("Рейсы", "Flights")}</div>
              <div className="text-lg font-bold text-zinc-800 dark:text-zinc-100">{pilot?.totalFlights ?? 0}</div>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm dark:border-white/10 dark:bg-zinc-900">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-500 dark:bg-amber-500/15 dark:text-amber-400"><Coins className="h-4 w-4" /></span>
            <div>
              <div className="text-[11px] uppercase tracking-wide text-zinc-400">{tr("Баланс", "Balance")}</div>
              <div className="text-lg font-bold text-zinc-800 dark:text-zinc-100">{balance !== null ? balance.toLocaleString(locale) : "—"}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Ваши запланированные полёты (Next Up) — если броней больше одной */}
      {upcoming.length > 1 ? (
        <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-white/10 dark:bg-zinc-900">
          <header className="flex items-center justify-between border-b border-zinc-100 px-4 py-3 dark:border-white/5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-100">
              <PlaneTakeoff className="h-4 w-4 text-red-500" />
              {tr("Ваши запланированные полёты", "Your scheduled flights")}
              <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold text-zinc-500 dark:bg-white/10 dark:text-zinc-400">{upcoming.length}</span>
            </h3>
          </header>
          <ol className="divide-y divide-zinc-100 dark:divide-white/5">
            {upcoming.map((b, i) => {
              const dt = b.departureTime ? new Date(b.departureTime) : null;
              const when = dt && Number.isFinite(dt.getTime())
                ? dt.toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
                : null;
              return (
                <li key={b.id}>
                  <a
                    href={`/dashboard/booking/${b.id}`}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-zinc-50 dark:hover:bg-white/5"
                  >
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${i === 0 ? "bg-red-500 text-white" : "bg-zinc-100 text-zinc-500 dark:bg-white/10 dark:text-zinc-400"}`}>
                      {i + 1}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Flag icao={b.departureCode} className="h-4 w-6" />
                      <span className="font-mono text-sm font-bold text-zinc-800 dark:text-zinc-100">{b.departureCode}</span>
                      <ArrowRight className="h-3 w-3 text-zinc-300 dark:text-zinc-600" />
                      <Flag icao={b.arrivalCode} className="h-4 w-6" />
                      <span className="font-mono text-sm font-bold text-zinc-800 dark:text-zinc-100">{b.arrivalCode}</span>
                    </div>
                    <div className="min-w-0 flex-1 text-xs text-zinc-400">
                      {b.callsign} · {b.aircraft}
                    </div>
                    <div className="shrink-0 text-right">
                      {i === 0 ? (
                        <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold uppercase text-red-600 dark:bg-red-500/15 dark:text-red-400">
                          {tr("Следующий", "Next up")}
                        </span>
                      ) : null}
                      {when ? <div className="mt-1 text-[11px] text-zinc-400">{when}</div> : null}
                    </div>
                  </a>
                </li>
              );
            })}
          </ol>
        </section>
      ) : null}

      {/* Цветные карточки статусов PIREP */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatusCard
          icon={<CheckCircle2 />}
          count={counts.accepted}
          label={tr("Принято", "Accepted")}
          gradient="bg-gradient-to-br from-emerald-500 to-emerald-600"
          ring="ring-emerald-400/30"
        />
        <StatusCard
          icon={<Hourglass />}
          count={counts.awaiting_review}
          label={tr("На проверке", "Under review")}
          gradient="bg-gradient-to-br from-amber-500 to-amber-600"
          ring="ring-amber-400/30"
        />
        <StatusCard
          icon={<Ban />}
          count={counts.invalidated}
          label={tr("Аннулировано", "Invalidated")}
          gradient="bg-gradient-to-br from-slate-500 to-slate-600"
          ring="ring-slate-400/30"
        />
        <StatusCard
          icon={<XCircle />}
          count={counts.rejected}
          label={tr("Отклонено", "Rejected")}
          gradient="bg-gradient-to-br from-red-500 to-red-600"
          ring="ring-red-400/30"
        />
      </div>

      {/* Мои мероприятия — прогресс + слоты */}
      {(activityProgress.length > 0 || slotProgress.length > 0) ? (
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-zinc-900">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-100">
              <CalendarCheck className="h-4 w-4 text-amber-500" />
              {tr("Мои мероприятия", "My activities")}
            </h3>
            {onOpenActivities ? (
              <button type="button" onClick={onOpenActivities} className="inline-flex items-center gap-1 text-xs font-medium text-red-500 hover:text-red-600">
                {tr("Все", "All")}
                <ArrowRight className="h-3 w-3" />
              </button>
            ) : null}
          </div>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {slotProgress.map((s) => {
              const slotDt = new Date(s.slotTime);
              const slotFmt = slotDt.toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
              const minsUntil = Math.round((slotDt.getTime() - Date.now()) / 60000);
              const soon = minsUntil >= 0 && minsUntil <= 60;
              return (
                <a
                  key={`slot-${s.eventId}`}
                  href="/activities"
                  className="rounded-xl border border-violet-200/60 bg-violet-50/60 p-3 text-left transition-colors hover:bg-violet-100/60 dark:border-violet-500/20 dark:bg-violet-500/10 dark:hover:bg-violet-500/20"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-zinc-800 dark:text-zinc-100">{s.eventName}</span>
                    <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${soon ? "bg-red-500 text-white" : "bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-300"}`}>
                      {tr("Слот", "Slot")}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                    <Timer className="h-3 w-3 shrink-0 text-violet-500" />
                    <span>{slotFmt}</span>
                    {s.callsign ? <span className="ml-1 font-mono font-bold text-violet-600 dark:text-violet-300">{s.callsign}</span> : null}
                  </div>
                  {s.departureAirport && s.arrivalAirport ? (
                    <div className="mt-1 font-mono text-[11px] text-zinc-400 dark:text-zinc-500">{s.departureAirport} → {s.arrivalAirport}</div>
                  ) : null}
                </a>
              );
            })}
            {activityProgress.map((a) => {
              const pct = a.progress?.progressPercent ?? 0;
              const done = a.progress?.status === "completed" || pct >= 100;
              return (
                <button
                  key={a.registrationId}
                  type="button"
                  onClick={onOpenActivities}
                  className="rounded-xl border border-zinc-100 bg-zinc-50/60 p-3 text-left transition-colors hover:bg-zinc-100 dark:border-white/5 dark:bg-white/5 dark:hover:bg-white/10"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-zinc-800 dark:text-zinc-100">{a.activityTitle}</span>
                    <span className={`shrink-0 text-[11px] font-bold ${done ? "text-emerald-500" : "text-zinc-500 dark:text-zinc-400"}`}>
                      {a.progress && a.progress.legTotal > 0 ? `${a.progress.legCompleted}/${a.progress.legTotal}` : `${pct}%`}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-white/10">
                    <div className={`h-full rounded-full ${done ? "bg-emerald-500" : "bg-gradient-to-r from-amber-500 to-orange-400"}`} style={{ width: `${pct}%` }} />
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Сегодня на повестке дня: события (карусель) + новости + NOTAM */}
      <HubAgenda onOpenNotams={onOpenNotams} />

      {/* Крайние 3 полёта */}
      <div className="grid grid-cols-1 gap-5">
        <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-white/10 dark:bg-zinc-900">
          <header className="flex items-center justify-between border-b border-zinc-100 px-4 py-3 dark:border-white/5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-100">
              <History className="h-4 w-4 text-zinc-400" />
              {tr("Крайние полёты", "Recent flights")}
            </h3>
          </header>
          <div className="divide-y divide-zinc-100 dark:divide-white/5">
            {last3.length === 0 ? (
              <div className="px-4 py-6 text-sm text-zinc-400">{tr("Полётов пока нет", "No flights yet")}</div>
            ) : (
              last3.map((f) => {
                const badge = statusBadge(f);
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => onOpenPirep(f.id)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-white/5"
                  >
                    <div className="flex items-center gap-1.5">
                      <Flag icao={f.departureIcao} iso2={f.departureCountryIso2} />
                      <ArrowRight className="h-3 w-3 text-zinc-300 dark:text-zinc-600" />
                      <Flag icao={f.arrivalIcao} iso2={f.arrivalCountryIso2} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-zinc-800 dark:text-zinc-100">{f.flightNumber}</div>
                      <div className="truncate text-xs text-zinc-400">
                        {f.departureIcao} → {f.arrivalIcao} · {f.aircraft}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.cls}`}>{badge.label}</span>
                      <div className="mt-1 text-[11px] text-zinc-400">{fmtDate(f.completedDate || f.date)}</div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>
      </div>
      </div>
    </div>
  );
}
