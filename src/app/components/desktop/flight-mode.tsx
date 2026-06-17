import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  Plane,
  CalendarPlus,
  Gauge,
  ArrowUp,
  Compass,
  Navigation,
  Ruler,
  Timer,
  Cloud,
  Info,
  Users,
  PlayCircle,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Radio,
  Send,
  Camera,
  CornerUpRight,
  Contact,
} from "lucide-react";
import { useLanguage } from "../../context/language-context";
import { useAuth } from "../../context/auth-context";
import { useActiveBooking } from "./use-active-booking";
import { useTelemetrySource, getSimSourceEnabled } from "./use-telemetry-source";
import { useCompanyAirports, findNearestAirport, distanceNm } from "./use-company-airports";
import { useDivertDetect } from "./use-divert-detect";
import { useDestination, type DestinationInfo } from "./use-destination";
import { usePilotNetwork, type NetworkMeta } from "./use-pilot-network";
import { FlightGlobe } from "./flight-globe";
import { AppLogin } from "./app-login";
import { FlightScreenshots } from "./flight-screenshots";
import { FlightCrewTab } from "./flight-crew-tab";
import { OfpViewer } from "./ofp-viewer";
import { FlightStatusIndicator } from "./flight-status-indicator";
import { PassengerManifest } from "../dashboard/passenger-manifest";
import { openExternal } from "./open-external";
import { icaoToCountry, getFlagUri } from "../dashboard/flag-data";

/** Локальный SVG-флаг по ICAO/ISO2. */
function Flag({ icao, iso2, className = "h-5 w-7" }: { icao?: string; iso2?: string | null; className?: string }) {
  const code = iso2 && /^[a-z]{2}$/i.test(iso2) ? iso2.toLowerCase() : icaoToCountry(icao || "");
  const uri = code ? getFlagUri(code) : "";
  if (!uri) return null;
  return <img src={uri} alt={code} className={`inline-block rounded-[3px] border border-white/10 object-cover ${className}`} />;
}

function TeleStat({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-center">
      <div className={`mx-auto mb-1 flex h-8 w-8 items-center justify-center rounded-lg ${accent}`}>{icon}</div>
      <div className="text-lg font-black tracking-tight text-white">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-white/50">{label}</div>
    </div>
  );
}

interface Metar {
  station: string;
  raw: string;
  observedAt?: string | null;
}
function useMetar(icao?: string | null): Metar | null {
  const [metar, setMetar] = useState<Metar | null>(null);
  useEffect(() => {
    const code = String(icao || "").trim().toUpperCase();
    if (!/^[A-Z]{4}$/.test(code)) {
      setMetar(null);
      return;
    }
    let active = true;
    fetch(`/api/weather/metar/${code}`, { credentials: "include" })
      .then((r) => r.json().catch(() => null))
      .then((p) => {
        if (active && p?.metar) setMetar(p.metar);
      })
      .catch(() => null);
    return () => {
      active = false;
    };
  }, [icao]);
  return metar;
}

export function FlightMode() {
  const { t, language } = useLanguage();
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);
  const locale = language === "ru" ? "ru-RU" : "en-US";
  const { isAuthenticated, isAuthLoading } = useAuth();
  const { booking, loading } = useActiveBooking();
  const { telemetry: tele, usingSim } = useTelemetrySource(getSimSourceEnabled());
  const companyAirports = useCompanyAirports();
  const { data: destination } = useDestination(booking?.arrivalCode);
  const { meta: network } = usePilotNetwork();
  const metarDep = useMetar(booking?.departureCode);
  const metarArr = useMetar(booking?.arrivalCode);
  const [tab, setTab] = useState<"info" | "crew" | "passengers" | "screenshots">("info");

  if (isAuthLoading || loading) {
    return <div className="p-8 text-sm text-zinc-500">{t("app.loading")}</div>;
  }
  if (!isAuthenticated) {
    return <AppLogin />;
  }
  if (!booking) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-5 p-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500">
          <Plane className="h-8 w-8" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{t("app.flight.empty.title")}</h2>
          <p className="mt-1 max-w-md text-sm text-zinc-500 dark:text-zinc-400">{t("app.flight.empty.subtitle")}</p>
        </div>
        <Link
          to="/app/dispatch"
          className="inline-flex items-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-400"
        >
          <CalendarPlus className="h-4 w-4" />
          {t("app.flight.empty.book")}
        </Link>
      </div>
    );
  }

  const fmtAlt = (a: number | null) => (a == null ? "—" : a >= 1000 ? `FL${Math.round(a / 100)}` : `${Math.round(a)} ft`);
  const airborne = tele.found;

  const totalNm = distanceNm(tele.departureLat, tele.departureLon, tele.arrivalLat, tele.arrivalLon);
  const remainingNm = distanceNm(tele.currentLat, tele.currentLon, tele.arrivalLat, tele.arrivalLon);
  const flownNm = totalNm != null && remainingNm != null ? Math.max(0, totalNm - remainingNm) : null;
  const computedProgress =
    totalNm != null && totalNm > 0 && remainingNm != null ? ((totalNm - remainingNm) / totalNm) * 100 : null;
  const progress = Math.max(0, Math.min(100, Number(tele.progress ?? computedProgress ?? 0)));

  // ETE по остатку и путевой скорости.
  const eteText = (() => {
    if (remainingNm == null || !tele.speed || tele.speed < 40) return "—";
    const hours = remainingNm / tele.speed;
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return h > 0 ? `${h}ч ${m.toString().padStart(2, "0")}м` : `${m}м`;
  })();

  const nearest = airborne
    ? findNearestAirport(companyAirports, tele.currentLat, tele.currentLon, [booking.departureCode, booking.arrivalCode])
    : null;

  // Уход на запасной: геометрия определяет кандидата → алерт-подтверждение → статус diverting.
  const divert = useDivertDetect(booking.id, tele, booking.arrivalCode);
  const isDiverting = divert.decision === "confirmed";
  const divertTo = divert.target;
  const divertCode = divertTo?.icao || null;

  const fmtNm = (n: number | null) => (n == null ? "—" : `${Math.round(n).toLocaleString(locale)} nm`);

  return (
    <div className="nws-scroll-hover h-full overflow-y-auto bg-zinc-950">
      <div className="mx-auto max-w-5xl space-y-5 p-6 text-zinc-100">
        {/* ── Верхний IFE-блок: прогресс маршрута ── */}
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-zinc-900 via-zinc-900 to-red-950 p-6 shadow-md">
          <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-red-500/20 blur-3xl" />
          <div className="relative">
            <div className="mb-4 flex items-start justify-between gap-2">
              {/* Красивый статус рейса — левый верхний угол */}
              <FlightStatusIndicator phase={isDiverting ? "diverting" : tele.phase} language={language} />
              {usingSim ? (
                <span className="mt-1 inline-flex items-center gap-1 rounded bg-sky-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-300">
                  SIM
                </span>
              ) : null}
            </div>

            <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-4">
              {/* Вылет */}
              <div>
                <div className="font-mono text-4xl font-black leading-none sm:text-5xl">{booking.departureCode}</div>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <Flag icao={booking.departureCode} className="h-4 w-6" />
                  <span className="truncate text-xs text-white/60">{booking.departureName}</span>
                </div>
                {flownNm != null ? (
                  <div className="mt-1 text-[11px] text-white/40">{fmtNm(flownNm)} {tr("пройдено", "flown")}</div>
                ) : null}
              </div>

              {/* Центр: ETE + мили над баром */}
              <div className="pb-1 text-center">
                <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-widest text-white/40">
                  <Timer className="h-3 w-3" /> ETE
                </div>
                <div className="text-xl font-black tabular-nums text-white">{airborne ? eteText : "—"}</div>
                <div className="mt-0.5 text-[11px] text-white/50">
                  {flownNm != null ? `${fmtNm(flownNm)}` : booking.callsign}
                </div>
              </div>

              {/* Прилёт */}
              <div className="text-right">
                {isDiverting && divertCode ? (
                  <>
                    {/* Уход на запасной: исходный пункт перечёркнут, новый — сверху со стрелкой */}
                    <div className="flex items-center justify-end gap-1.5 text-sm font-bold text-white/35">
                      <CornerUpRight className="h-3.5 w-3.5 text-red-400" />
                      <span className="font-mono line-through decoration-red-400 decoration-2">{booking.arrivalCode}</span>
                    </div>
                    <div className="mt-0.5 flex items-center justify-end gap-2">
                      <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-red-300">
                        {tr("Диверт", "Divert")}
                      </span>
                      <span className="font-mono text-4xl font-black leading-none text-red-300 sm:text-5xl">{divertCode}</span>
                    </div>
                    <div className="mt-1.5 flex items-center justify-end gap-1.5">
                      {divertTo?.base ? (
                        <span className="rounded bg-red-500/20 px-1 py-0.5 text-[9px] font-bold uppercase text-red-300">{tr("База", "Base")}</span>
                      ) : null}
                      <span className="truncate text-xs text-white/60">{divertTo?.city || divertTo?.name || ""}</span>
                      <Flag icao={divertCode} className="h-4 w-6" />
                    </div>
                    <div className="mt-1 text-[11px] text-white/40">
                      {divertTo && divertTo.distanceNm > 0 ? `${fmtNm(divertTo.distanceNm)} ${tr("до запасного", "to alternate")}` : ""}
                      <span className="ml-1 text-white/30">· {divert.manual ? tr("вручную", "manual") : tr("предполож.", "est.")}</span>
                    </div>
                    <div className="mt-1.5 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const code = window.prompt(tr("ICAO аэропорта диверта:", "Divert airport ICAO:"), divertCode || "")?.trim().toUpperCase();
                          if (code && /^[A-Z]{4}$/.test(code)) {
                            void divert.setManual(code).then((ok) => {
                              if (!ok) window.alert(tr("Аэропорт не найден", "Airport not found"));
                            });
                          }
                        }}
                        className="rounded-lg border border-white/15 px-2.5 py-1 text-[11px] font-medium text-white/70 hover:bg-white/5"
                      >
                        {tr("Сменить аэропорт", "Change airport")}
                      </button>
                      {divert.manual ? (
                        <button
                          type="button"
                          onClick={() => divert.clearManual()}
                          className="rounded-lg px-2 py-1 text-[11px] text-white/40 hover:text-white/70"
                        >
                          {tr("Авто", "Auto")}
                        </button>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="font-mono text-4xl font-black leading-none sm:text-5xl">{booking.arrivalCode}</div>
                    <div className="mt-1.5 flex items-center justify-end gap-1.5">
                      <span className="truncate text-xs text-white/60">{booking.arrivalName}</span>
                      <Flag icao={booking.arrivalCode} iso2={destination?.countryIso2} className="h-4 w-6" />
                    </div>
                    <div className="mt-1 text-[11px] text-white/40">
                      {remainingNm != null ? `${fmtNm(remainingNm)} ${tr("осталось", "left")}` : ""}
                      {totalNm != null ? ` · ${fmtNm(totalNm)} ${tr("всего", "total")}` : ""}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Прогресс-бар с бортом */}
            <div className="mt-4">
              <div className="relative h-1.5 rounded-full bg-white/10">
                <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-red-500 to-orange-400" style={{ width: `${progress}%` }} />
                <Plane
                  className="absolute top-1/2 h-4 w-4 text-white drop-shadow"
                  style={{ left: `calc(${progress}% - 8px)`, transform: "translateY(-50%) rotate(90deg)" }}
                />
              </div>
              <div className="mt-1 text-center text-[11px] text-white/40">
                {booking.callsign} · {booking.aircraft}
                {airborne ? ` · ${Math.round(progress)}%` : ""}
              </div>
            </div>
          </div>
        </div>

        {/* ── Алерт: возможный уход на запасной (подтверждение пользователя) ── */}
        {divert.candidate && divert.decision === "pending" ? (
          <DivertPrompt target={divertTo} onConfirm={divert.confirm} onDismiss={divert.dismiss} fmtNm={fmtNm} tr={tr} />
        ) : null}

        {/* ── Сеть + напоминание подать план ── */}
        <NetworkReminder network={network} airborne={airborne} tr={tr} />

        {/* ── Глобус + телеметрия + METAR ── */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          {/* Глобус */}
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-zinc-900 p-4">
            <div className="absolute left-4 top-4 z-10 text-[10px] font-semibold uppercase tracking-widest text-white/40">
              {tr("Маршрут полёта", "Flight route")}
            </div>
            <div className="mx-auto aspect-square w-full max-w-[340px]">
              <FlightGlobe
                departure={{ lat: tele.departureLat, lon: tele.departureLon }}
                arrival={{ lat: tele.arrivalLat, lon: tele.arrivalLon }}
                current={{ lat: tele.currentLat, lon: tele.currentLon }}
                divert={divertTo ? { lat: divertTo.lat, lon: divertTo.lon } : null}
              />
            </div>
          </div>

          {/* Телеметрия + ближайший аэропорт */}
          <div className="space-y-3">
            {airborne ? (
              <div className="grid grid-cols-2 gap-2">
                <TeleStat icon={<ArrowUp className="h-4 w-4 text-white" />} label={tr("Высота", "Alt")} value={fmtAlt(tele.altitude)} accent="bg-sky-500/30" />
                <TeleStat icon={<Gauge className="h-4 w-4 text-white" />} label={tr("Скорость", "GS")} value={tele.speed != null ? `${Math.round(tele.speed)} kt` : "—"} accent="bg-violet-500/30" />
                <TeleStat icon={<Compass className="h-4 w-4 text-white" />} label={tr("Курс", "HDG")} value={tele.heading != null ? `${Math.round(tele.heading)}°` : "—"} accent="bg-amber-500/30" />
                <TeleStat icon={<Ruler className="h-4 w-4 text-white" />} label={tr("Осталось", "Remaining")} value={fmtNm(remainingNm)} accent="bg-emerald-500/30" />
              </div>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/60">
                {tr(
                  "Телеметрия появится, когда вы начнёте рейс в симуляторе и ACARS выйдет на связь.",
                  "Telemetry appears once you start the flight in the sim and ACARS connects."
                )}
              </div>
            )}

            {nearest ? (
              <div className="flex items-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2.5">
                <Navigation className="h-4 w-4 shrink-0 text-sky-300" />
                <span className="text-[11px] uppercase tracking-wide text-white/40">{tr("Ближайший", "Nearest")}</span>
                <span className="font-mono text-sm font-bold text-white">{nearest.airport.icao || nearest.airport.code}</span>
                {nearest.airport.base ? (
                  <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-red-300">{tr("База", "Base")}</span>
                ) : null}
                <span className="ml-auto text-sm font-semibold text-sky-300">{fmtNm(nearest.distanceNm)}</span>
              </div>
            ) : null}

            <MetarRow label={tr("Погода вылета", "Departure wx")} icao={booking.departureCode} metar={metarDep} tr={tr} />
            <MetarRow label={tr("Погода прилёта", "Arrival wx")} icao={booking.arrivalCode} metar={metarArr} tr={tr} />
          </div>
        </div>

        {/* ── Гид по пункту назначения (главная фишка) ── */}
        <DestinationPanel destination={destination} booking={booking} tr={tr} />

        {/* ── Вкладки: информация о рейсе / пассажиры ── */}
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-zinc-900">
          <div className="flex border-b border-white/10">
            <TabBtn active={tab === "info"} onClick={() => setTab("info")} icon={<Info className="h-4 w-4" />} label={tr("Информация о рейсе", "Flight info")} />
            <TabBtn active={tab === "crew"} onClick={() => setTab("crew")} icon={<Contact className="h-4 w-4" />} label={tr("Экипаж", "Crew")} />
            <TabBtn active={tab === "passengers"} onClick={() => setTab("passengers")} icon={<Users className="h-4 w-4" />} label={tr("Пассажиры", "Passengers")} />
            <TabBtn active={tab === "screenshots"} onClick={() => setTab("screenshots")} icon={<Camera className="h-4 w-4" />} label={tr("Скриншоты", "Screenshots")} />
          </div>
          <div className="p-4">
            {tab === "info" ? (
              <FlightInfoTab booking={booking} totalNm={totalNm} remainingNm={remainingNm} eteText={airborne ? eteText : "—"} progress={progress} tr={tr} />
            ) : tab === "crew" ? (
              <FlightCrewTab booking={booking} language={language} tr={tr} />
            ) : tab === "passengers" ? (
              booking.departureCode && booking.arrivalCode ? (
                <PassengerManifest
                  bookingId={booking.id}
                  departureCode={booking.departureCode}
                  arrivalCode={booking.arrivalCode}
                  flightNumber={booking.flightNumber}
                />
              ) : null
            ) : (
              <FlightScreenshots
                bookingId={booking.id}
                callsign={booking.callsign}
                route={`${booking.departureCode} → ${booking.arrivalCode}`}
                aircraft={booking.aircraft}
                registration={booking.registration}
              />
            )}
          </div>
        </div>

        {/* OFP — быстрый просмотр */}
        <OfpViewer bookingId={booking.id} />
      </div>
    </div>
  );
}

function DivertPrompt({
  target,
  onConfirm,
  onDismiss,
  fmtNm,
  tr,
}: {
  target: import("./use-company-airports").NearestAirportInfo | null;
  onConfirm: () => void;
  onDismiss: () => void;
  fmtNm: (n: number | null) => string;
  tr: (ru: string, en: string) => string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-amber-500/30 bg-gradient-to-br from-amber-950/60 to-zinc-900 px-5 py-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-300">
        <CornerUpRight className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold text-white">{tr("Вы уходите на запасной?", "Are you diverting?")}</div>
        <div className="mt-0.5 text-xs text-white/60">
          {target
            ? tr(
                `Похоже, вы снижаетесь к ${target.icao}${target.city ? ` (${target.city})` : ""} — ${fmtNm(target.distanceNm)}.`,
                `Looks like you're descending toward ${target.icao}${target.city ? ` (${target.city})` : ""} — ${fmtNm(target.distanceNm)}.`
              )
            : tr("Похоже, вы отклонились от маршрута и снижаетесь.", "Looks like you've left the route and are descending.")}
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-xl border border-white/15 px-3.5 py-2 text-sm font-medium text-white/70 hover:bg-white/5"
        >
          {tr("Нет", "No")}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-amber-500/30 hover:bg-amber-400"
        >
          <CornerUpRight className="h-4 w-4" />
          {tr("Да, уходим", "Yes, diverting")}
        </button>
      </div>
    </div>
  );
}

function NetworkReminder({
  network,
  airborne,
  tr,
}: {
  network: NetworkMeta | null;
  airborne: boolean;
  tr: (ru: string, en: string) => string;
}) {
  // Оффлайн (или сеть не выбрана) — ничего не показываем.
  if (!network) return null;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-sky-500/20 bg-gradient-to-br from-sky-950/60 to-zinc-900 px-5 py-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/20 text-sky-300">
        <Radio className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-sky-300/70">{tr("Сеть", "Network")}</span>
          <span className="rounded-md bg-sky-500/20 px-2 py-0.5 text-xs font-black uppercase tracking-wide text-sky-200">
            {network.label}
          </span>
        </div>
        <div className="mt-0.5 text-sm text-white/70">
          {airborne
            ? tr(`Вы летаете в сети ${network.label}.`, `You're flying on ${network.label}.`)
            : tr("Не забудьте подать план полёта в сеть перед вылетом.", "Don't forget to file your flight plan before departure.")}
        </div>
      </div>
      {network.prefileUrl ? (
        <button
          type="button"
          onClick={() => void openExternal(network.prefileUrl!)}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-sky-500/30 transition-colors hover:bg-sky-400"
        >
          <Send className="h-4 w-4" />
          {tr("Подать план", "File flight plan")}
        </button>
      ) : null}
    </div>
  );
}

function MetarRow({
  label,
  icao,
  metar,
  tr,
}: {
  label: string;
  icao: string;
  metar: Metar | null;
  tr: (ru: string, en: string) => string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2.5">
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-white/40">
        <Cloud className="h-3 w-3" /> {label} · {icao}
      </div>
      <div className="mt-1 break-words font-mono text-[11px] leading-relaxed text-white/70">
        {metar?.raw || tr("METAR недоступен", "METAR unavailable")}
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex flex-1 items-center justify-center gap-2 px-4 py-3 text-sm font-semibold transition-colors",
        active ? "bg-white/[0.06] text-white" : "text-white/50 hover:bg-white/[0.03] hover:text-white/80",
      ].join(" ")}
    >
      {icon}
      {label}
    </button>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5">
      <div className="text-[10px] uppercase tracking-wide text-white/40">{label}</div>
      <div className="mt-0.5 truncate text-sm font-bold text-white">{value || "—"}</div>
    </div>
  );
}

function FlightInfoTab({
  booking,
  totalNm,
  remainingNm,
  eteText,
  progress,
  tr,
}: {
  booking: import("./use-active-booking").ActiveBooking;
  totalNm: number | null;
  remainingNm: number | null;
  eteText: string;
  progress: number;
  tr: (ru: string, en: string) => string;
}) {
  const fmt = (n: number | null) => (n == null ? "—" : `${Math.round(n)} nm`);
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      <InfoCell label={tr("Рейс", "Flight")} value={booking.flightNumber} />
      <InfoCell label={tr("Позывной", "Callsign")} value={booking.callsign} />
      <InfoCell label={tr("ВС", "Aircraft")} value={booking.aircraft} />
      <InfoCell label={tr("Регистрация", "Registration")} value={booking.registration || "—"} />
      <InfoCell label={tr("Маршрут", "Route")} value={`${booking.departureCode} → ${booking.arrivalCode}`} />
      <InfoCell label={tr("Статус", "Status")} value={booking.statusLabel || "—"} />
      <InfoCell label={tr("Дистанция", "Distance")} value={fmt(totalNm)} />
      <InfoCell label={tr("Осталось", "Remaining")} value={fmt(remainingNm)} />
      <InfoCell label="ETE" value={eteText} />
      <InfoCell label={tr("Прогресс", "Progress")} value={`${Math.round(progress)}%`} />
    </div>
  );
}

function DestinationPanel({
  destination,
  booking,
  tr,
}: {
  destination: DestinationInfo | null;
  booking: import("./use-active-booking").ActiveBooking;
  tr: (ru: string, en: string) => string;
}) {
  if (!destination || (!destination.summary && destination.photos.length === 0)) return null;
  const city = destination.city || booking.arrivalName || booking.arrivalCode;

  return (
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-zinc-900">
      <div className="border-b border-white/10 px-5 py-4">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-red-300">
          <MapPin className="h-3.5 w-3.5" />
          {tr("Пункт назначения", "Destination")}
        </div>
        <h2 className="mt-1 flex items-center gap-2 text-2xl font-black tracking-tight text-white">
          {city}
          {destination.country ? <span className="text-sm font-medium text-white/40">· {destination.country}</span> : null}
        </h2>
      </div>

      <div className="space-y-5 p-5">
        {/* Карусель фото */}
        {destination.photos.length > 0 ? <PhotoCarousel photos={destination.photos} /> : null}

        {/* Описание города */}
        {destination.summary?.extract ? (
          <div>
            <h3 className="mb-1.5 text-sm font-bold text-white/80">{tr("О городе", "About the city")}</h3>
            <p className="text-sm leading-relaxed text-white/60">{destination.summary.extract}</p>
            {destination.summary.url ? (
              <button
                type="button"
                onClick={() => void openExternal(destination.summary!.url!)}
                className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-red-300 hover:text-red-200"
              >
                {tr("Подробнее", "Read more")}
                <ExternalLink className="h-3 w-3" />
              </button>
            ) : null}
          </div>
        ) : null}

        {/* Значимость маршрута */}
        <div>
          <h3 className="mb-1.5 text-sm font-bold text-white/80">{tr("О маршруте", "About the route")}</h3>
          <p className="text-sm leading-relaxed text-white/60">
            {tr(
              `Рейс ${booking.flightNumber} соединяет ${booking.departureName} и ${booking.arrivalName}. Хорошего полёта и мягкой посадки в ${city}!`,
              `Flight ${booking.flightNumber} connects ${booking.departureName} and ${booking.arrivalName}. Have a great flight and a smooth landing in ${city}!`
            )}
          </p>
        </div>

        {/* Видео — посмотреть в полёте */}
        {destination.video?.searchUrl ? (
          <div>
            <h3 className="mb-1.5 flex items-center gap-1.5 text-sm font-bold text-white/80">
              <PlayCircle className="h-4 w-4 text-red-300" />
              {tr("Посмотреть в полёте", "Watch in flight")}
            </h3>
            <button
              type="button"
              onClick={() => void openExternal(destination.video!.searchUrl)}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-white/80 transition-colors hover:bg-white/[0.08]"
            >
              <PlayCircle className="h-4 w-4 text-red-400" />
              {tr(`Видео о городе «${city}» на YouTube`, `Videos about ${city} on YouTube`)}
              <ExternalLink className="h-3.5 w-3.5 text-white/40" />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PhotoCarousel({ photos }: { photos: DestinationInfo["photos"] }) {
  const [idx, setIdx] = useState(0);
  const count = photos.length;
  const safe = count ? idx % count : 0;

  useEffect(() => {
    if (count < 2) return;
    const id = window.setInterval(() => setIdx((i) => (i + 1) % count), 5000);
    return () => window.clearInterval(id);
  }, [count]);

  const go = (d: number) => setIdx((i) => (i + d + count) % count);
  const photo = photos[safe];

  return (
    <div className="relative overflow-hidden rounded-2xl">
      <div className="h-56 w-full bg-zinc-800 sm:h-72">
        <img src={photo.url} alt={photo.title} className="h-full w-full object-cover" loading="lazy" />
      </div>
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4">
        <div className="truncate text-xs text-white/80">{photo.title}</div>
      </div>
      {count > 1 ? (
        <>
          <button type="button" onClick={() => go(-1)} className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur hover:bg-black/60">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => go(1)} className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur hover:bg-black/60">
            <ChevronRight className="h-4 w-4" />
          </button>
          <div className="absolute bottom-2 right-3 flex gap-1.5">
            {photos.map((_, i) => (
              <button key={i} type="button" onClick={() => setIdx(i)} className={`h-1.5 rounded-full transition-all ${i === safe ? "w-5 bg-white" : "w-1.5 bg-white/50"}`} />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
