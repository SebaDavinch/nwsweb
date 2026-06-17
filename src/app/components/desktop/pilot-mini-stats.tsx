import { Clock, Plane, CalendarDays } from "lucide-react";
import { useLanguage } from "../../context/language-context";
import { useAuth } from "../../context/auth-context";

function fmtJoin(value: string, locale: string): string {
  const v = String(value || "").trim();
  if (!v) return "—";
  const d = new Date(v);
  if (!Number.isFinite(d.getTime())) return v;
  return d.toLocaleDateString(locale, { year: "numeric", month: "short" });
}

/**
 * Компактная мини-статистика пилота для подвала сайдбара: аватар/имя +
 * налёт, число рейсов и дата вступления в ВАК. В свёрнутом режиме — только аватар.
 */
export function PilotMiniStats({ collapsed }: { collapsed: boolean }) {
  const { language } = useLanguage();
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);
  const locale = language === "ru" ? "ru-RU" : "en-US";
  const { pilot } = useAuth();
  if (!pilot) return null;

  const initials = `${pilot.firstName?.[0] || ""}${pilot.lastName?.[0] || ""}`.toUpperCase() || "?";

  if (collapsed) {
    return (
      <div className="mt-auto flex justify-center pt-2" title={`${pilot.firstName} ${pilot.lastName}`}>
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
          {pilot.avatar ? (
            <img src={pilot.avatar} alt="" className="h-9 w-9 rounded-full object-cover" />
          ) : (
            initials
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-auto rounded-xl border border-zinc-200 bg-white p-3 dark:border-white/10 dark:bg-zinc-950/40">
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
          {pilot.avatar ? <img src={pilot.avatar} alt="" className="h-9 w-9 rounded-full object-cover" /> : initials}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-zinc-800 dark:text-zinc-100">{pilot.firstName} {pilot.lastName}</div>
          <div className="truncate text-[11px] text-zinc-400">{pilot.callsign}</div>
        </div>
      </div>
      <div className="mt-2.5 grid grid-cols-3 gap-1 text-center">
        <div className="rounded-lg bg-zinc-50 py-1.5 dark:bg-white/5">
          <Clock className="mx-auto h-3.5 w-3.5 text-sky-500" />
          <div className="mt-0.5 text-xs font-bold text-zinc-800 dark:text-zinc-100">{pilot.totalHours ?? 0}</div>
          <div className="text-[9px] uppercase tracking-wide text-zinc-400">{tr("часы", "hrs")}</div>
        </div>
        <div className="rounded-lg bg-zinc-50 py-1.5 dark:bg-white/5">
          <Plane className="mx-auto h-3.5 w-3.5 text-violet-500" />
          <div className="mt-0.5 text-xs font-bold text-zinc-800 dark:text-zinc-100">{pilot.totalFlights ?? 0}</div>
          <div className="text-[9px] uppercase tracking-wide text-zinc-400">{tr("рейсы", "flts")}</div>
        </div>
        <div className="rounded-lg bg-zinc-50 py-1.5 dark:bg-white/5">
          <CalendarDays className="mx-auto h-3.5 w-3.5 text-emerald-500" />
          <div className="mt-0.5 text-[11px] font-bold text-zinc-800 dark:text-zinc-100">{fmtJoin(pilot.joinDate, locale)}</div>
          <div className="text-[9px] uppercase tracking-wide text-zinc-400">{tr("в ВАК", "joined")}</div>
        </div>
      </div>
    </div>
  );
}
