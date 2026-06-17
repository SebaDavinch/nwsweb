import {
  Truck,
  Navigation2,
  PlaneTakeoff,
  TrendingUp,
  Plane,
  TrendingDown,
  PlaneLanding,
  CheckCircle2,
  Users,
  Clock,
  type LucideIcon,
} from "lucide-react";
import type { FlightPhase } from "../dashboard/flight-phase";

interface StatusMeta {
  icon: LucideIcon;
  ru: string;
  en: string;
  gradient: string; // фон-градиент пилюли
  glow: string; // цвет свечения
  ring: string;
  live: boolean; // анимация полёта (бегущий блик)
}

// «Лётные» статусы с фирменным дизайном (тёмный IFE-стиль).
const STATUS: Record<FlightPhase, StatusMeta> = {
  scheduled: { icon: Clock, ru: "Готов к посадке", en: "Ready to Board", gradient: "from-slate-600 to-slate-700", glow: "shadow-slate-500/30", ring: "ring-slate-400/30", live: false },
  boarding: { icon: Users, ru: "Посадка", en: "Boarding", gradient: "from-blue-500 to-blue-600", glow: "shadow-blue-500/40", ring: "ring-blue-400/40", live: true },
  pushback: { icon: Truck, ru: "Буксировка", en: "Pushing Back", gradient: "from-indigo-500 to-indigo-600", glow: "shadow-indigo-500/40", ring: "ring-indigo-400/40", live: true },
  taxi: { icon: Navigation2, ru: "Руление", en: "Taxiing Out", gradient: "from-amber-500 to-orange-500", glow: "shadow-amber-500/40", ring: "ring-amber-400/40", live: true },
  takeoff: { icon: PlaneTakeoff, ru: "Взлёт", en: "Departing", gradient: "from-orange-500 to-red-500", glow: "shadow-orange-500/50", ring: "ring-orange-400/40", live: true },
  climb: { icon: TrendingUp, ru: "Набор высоты", en: "Climbing", gradient: "from-sky-500 to-cyan-500", glow: "shadow-sky-500/40", ring: "ring-sky-400/40", live: true },
  cruise: { icon: Plane, ru: "В крейсере", en: "En-Route", gradient: "from-emerald-500 to-teal-500", glow: "shadow-emerald-500/40", ring: "ring-emerald-400/40", live: true },
  diverting: { icon: Navigation2, ru: "Уход на запасной", en: "Diverting", gradient: "from-red-500 to-rose-600", glow: "shadow-red-500/50", ring: "ring-red-400/40", live: true },
  descent: { icon: TrendingDown, ru: "Снижение", en: "Descending", gradient: "from-violet-500 to-purple-500", glow: "shadow-violet-500/40", ring: "ring-violet-400/40", live: true },
  approach: { icon: PlaneLanding, ru: "Заход на посадку", en: "Approaching", gradient: "from-fuchsia-500 to-pink-500", glow: "shadow-fuchsia-500/40", ring: "ring-fuchsia-400/40", live: true },
  landing: { icon: PlaneLanding, ru: "Прибытие", en: "Arriving", gradient: "from-rose-500 to-red-500", glow: "shadow-rose-500/50", ring: "ring-rose-400/40", live: true },
  taxiIn: { icon: Navigation2, ru: "Руление к гейту", en: "Taxiing In", gradient: "from-amber-500 to-yellow-500", glow: "shadow-amber-500/40", ring: "ring-amber-400/40", live: true },
  arrived: { icon: CheckCircle2, ru: "На стоянке", en: "On Blocks", gradient: "from-green-500 to-emerald-600", glow: "shadow-green-500/40", ring: "ring-green-400/30", live: false },
};

/**
 * Красивый статус-индикатор рейса для левого верхнего угла страницы «Полёт».
 * Градиентная пилюля с иконкой фазы, свечением и бегущим бликом во время полёта.
 */
export function FlightStatusIndicator({
  phase,
  language,
  className = "",
}: {
  phase: FlightPhase | null;
  language: string;
  className?: string;
}) {
  const meta = STATUS[phase ?? "scheduled"];
  const Icon = meta.icon;
  const label = language === "ru" ? meta.ru : meta.en;

  return (
    <div
      className={`inline-flex items-center gap-2.5 rounded-2xl bg-gradient-to-br ${meta.gradient} py-1.5 pl-1.5 pr-3.5 shadow-lg ${meta.glow} ring-1 ${meta.ring} ${className}`}
    >
      {/* Иконка в кружке с бегущим бликом */}
      <span className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-xl bg-white/20">
        <Icon className="relative z-10 h-4 w-4 text-white" />
        {meta.live ? (
          <span className="absolute inset-0 -translate-x-full animate-[nws-shine_2.2s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/40 to-transparent" />
        ) : null}
      </span>
      <div className="leading-tight">
        <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/60">
          {language === "ru" ? "Статус рейса" : "Flight status"}
        </div>
        <div className="text-sm font-black tracking-tight text-white">{label}</div>
      </div>
    </div>
  );
}
