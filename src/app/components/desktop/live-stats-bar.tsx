import { useEffect, useState } from "react";
import { Plane, Radio, Clock, Globe } from "lucide-react";
import { useLanguage } from "../../context/language-context";
import { useAuth } from "../../context/auth-context";
import { useLiveFlights } from "./use-live-flights";
import { useAppHealth, type ServiceState } from "./use-app-health";
import { externalLinkProps } from "./open-external";

const SITE_URL = "https://vnws.org";
const DISCORD_URL = "https://discord.gg/MfTT8KU5yC";

function DiscordIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515a.07.07 0 0 0-.079.037c-.21.375-.444.865-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.6 12.6 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.74 19.74 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.08.08 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106a13.1 13.1 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10 10 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.3 12.3 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.84 19.84 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.06.06 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

function useUtcClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return now.toISOString().slice(11, 19);
}

const STATE_COLOR: Record<ServiceState, string> = {
  online: "bg-emerald-500",
  offline: "bg-red-500",
  unknown: "bg-zinc-400",
};

function StatusDot({ label, state, title }: { label: string; state: ServiceState; title: string }) {
  return (
    <span className="inline-flex items-center gap-1" title={`${title}: ${state}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${STATE_COLOR[state]}`} />
      <span className="hidden text-[11px] lg:inline">{label}</span>
    </span>
  );
}

function VacChip({ label, count, color }: { label: string; count: number; color: string }) {
  if (count <= 0) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {label} <span className="text-zinc-700 dark:text-zinc-200">{count}</span>
    </span>
  );
}

export function LiveStatsBar() {
  const { language } = useLanguage();
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);
  const { pilot, isAuthenticated, isAuthLoading } = useAuth();
  const { flights, count, byVac, loading } = useLiveFlights();
  const { backend, vamsys } = useAppHealth();
  const utc = useUtcClock();

  const authState: ServiceState = isAuthLoading ? "unknown" : isAuthenticated ? "online" : "offline";

  const myFlight = isAuthenticated && pilot
    ? flights.find((f) => String(f.pilotId ?? "") === String(pilot.id))
    : undefined;

  const fmtAlt = (alt?: number | null) => {
    if (!Number.isFinite(Number(alt))) return null;
    const a = Number(alt);
    return a >= 1000 ? `FL${Math.round(a / 100)}` : `${Math.round(a)} ft`;
  };

  const linkBtn =
    "inline-flex h-5 w-5 items-center justify-center rounded text-zinc-400 transition-colors hover:text-zinc-700 dark:hover:text-zinc-100";

  return (
    <footer className="flex h-7 shrink-0 items-center justify-between gap-3 border-t border-zinc-200 bg-zinc-50 px-3 text-xs text-zinc-500 dark:border-white/5 dark:bg-zinc-900 dark:text-zinc-400">
      {/* Слева: всего в воздухе + разбивка по ВАК */}
      <div className="flex min-w-0 items-center gap-3">
        <span className="inline-flex items-center gap-1.5 font-medium">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <Plane className="h-3.5 w-3.5 text-zinc-400" />
          <span className="text-zinc-700 dark:text-zinc-200">{loading ? "…" : count}</span>
          <span className="hidden sm:inline">{tr("в воздухе", "airborne")}</span>
        </span>
        <span className="hidden h-3 w-px bg-zinc-300 dark:bg-white/10 md:block" />
        <div className="hidden items-center gap-3 md:flex">
          <VacChip label="NWS" count={byVac.NWS} color="#E31E24" />
          <VacChip label="KAR" count={byVac.KAR} color="#2563eb" />
          <VacChip label="STW" count={byVac.STW} color="#ea580c" />
        </div>
      </div>

      {/* Справа: мой рейс · статусы · UTC · ссылки */}
      <div className="flex items-center gap-3">
        {myFlight ? (
          <span className="hidden items-center gap-1.5 sm:inline-flex">
            <Radio className="h-3.5 w-3.5 text-emerald-500" />
            <span className="font-medium text-zinc-700 dark:text-zinc-200">
              {myFlight.flightNumber}
            </span>
            <span className="hidden text-zinc-400 lg:inline">
              {myFlight.departure} → {myFlight.destination || myFlight.arrival}
            </span>
            {fmtAlt(myFlight.altitude) ? <span className="text-zinc-400">· {fmtAlt(myFlight.altitude)}</span> : null}
          </span>
        ) : null}

        {/* Индикаторы состояния */}
        <div className="flex items-center gap-2.5">
          <StatusDot label="vAMSYS" state={vamsys} title={tr("vAMSYS API", "vAMSYS API")} />
          <StatusDot label={tr("Сервер", "Backend")} state={backend} title={tr("Бэкенд", "Backend")} />
          <StatusDot label={tr("Авторизация", "Auth server")} state={authState} title={tr("Сервер авторизации", "Authorization server")} />
        </div>

        <span className="hidden h-3 w-px bg-zinc-300 dark:bg-white/10 sm:block" />

        <span className="inline-flex items-center gap-1 tabular-nums">
          <Clock className="h-3.5 w-3.5 text-zinc-400" />
          {utc} <span className="text-zinc-400">UTC</span>
        </span>

        <span className="h-3 w-px bg-zinc-300 dark:bg-white/10" />

        {/* Ссылки (в .exe открываются в системном браузере) */}
        <a {...externalLinkProps(SITE_URL)} className={linkBtn} title={tr("Сайт VNWS", "VNWS website")}>
          <Globe className="h-4 w-4" />
        </a>
        <a
          {...externalLinkProps(DISCORD_URL)}
          className="inline-flex h-5 w-5 items-center justify-center rounded text-zinc-400 transition-colors hover:text-[#5865F2]"
          title="Discord"
        >
          <DiscordIcon />
        </a>
      </div>
    </footer>
  );
}
