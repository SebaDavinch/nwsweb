import type { LucideIcon } from "lucide-react";
import {
  CheckCircle2,
  Clock,
  Navigation2,
  Plane,
  PlaneLanding,
  PlaneTakeoff,
  TrendingDown,
  TrendingUp,
  Truck,
  Users,
} from "lucide-react";
import { useLanguage } from "../../context/language-context";
import { cn } from "../ui/utils";

export type FlightPhase =
  | "scheduled"
  | "boarding"
  | "pushback"
  | "taxi"
  | "takeoff"
  | "climb"
  | "cruise"
  | "diverting"
  | "descent"
  | "approach"
  | "landing"
  | "taxiIn"
  | "arrived";

interface PhaseMeta {
  icon: LucideIcon;
  labelKey: string;
  /** Tailwind classes: text + background tint + border for the pill */
  pill: string;
  /** Accent color for the pulsing dot / icon */
  dot: string;
  /** Whether this phase represents an in-air / in-progress state (pulse animation) */
  live: boolean;
}

export const FLIGHT_PHASE_META: Record<FlightPhase, PhaseMeta> = {
  scheduled: {
    icon: Clock,
    labelKey: "phase.scheduled",
    pill: "bg-slate-100 text-slate-600 border-slate-200",
    dot: "bg-slate-400",
    live: false,
  },
  boarding: {
    icon: Users,
    labelKey: "phase.boarding",
    pill: "bg-blue-50 text-blue-700 border-blue-200",
    dot: "bg-blue-500",
    live: true,
  },
  pushback: {
    icon: Truck,
    labelKey: "phase.pushback",
    pill: "bg-indigo-50 text-indigo-700 border-indigo-200",
    dot: "bg-indigo-500",
    live: true,
  },
  taxi: {
    icon: Navigation2,
    labelKey: "phase.taxi",
    pill: "bg-amber-50 text-amber-700 border-amber-200",
    dot: "bg-amber-500",
    live: true,
  },
  takeoff: {
    icon: PlaneTakeoff,
    labelKey: "phase.takeoff",
    pill: "bg-orange-50 text-orange-700 border-orange-200",
    dot: "bg-orange-500",
    live: true,
  },
  climb: {
    icon: TrendingUp,
    labelKey: "phase.climb",
    pill: "bg-sky-50 text-sky-700 border-sky-200",
    dot: "bg-sky-500",
    live: true,
  },
  cruise: {
    icon: Plane,
    labelKey: "phase.cruise",
    pill: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
    live: true,
  },
  diverting: {
    icon: Navigation2,
    labelKey: "phase.diverting",
    pill: "bg-red-50 text-red-700 border-red-200",
    dot: "bg-red-500",
    live: true,
  },
  descent: {
    icon: TrendingDown,
    labelKey: "phase.descent",
    pill: "bg-violet-50 text-violet-700 border-violet-200",
    dot: "bg-violet-500",
    live: true,
  },
  approach: {
    icon: PlaneLanding,
    labelKey: "phase.approach",
    pill: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200",
    dot: "bg-fuchsia-500",
    live: true,
  },
  landing: {
    icon: PlaneLanding,
    labelKey: "phase.landing",
    pill: "bg-rose-50 text-rose-700 border-rose-200",
    dot: "bg-rose-500",
    live: true,
  },
  taxiIn: {
    icon: Navigation2,
    labelKey: "phase.taxiIn",
    pill: "bg-amber-50 text-amber-700 border-amber-200",
    dot: "bg-amber-500",
    live: true,
  },
  arrived: {
    icon: CheckCircle2,
    labelKey: "phase.arrived",
    pill: "bg-green-50 text-green-700 border-green-200",
    dot: "bg-green-500",
    live: false,
  },
};

export interface FlightPhaseContext {
  altitude?: number | null; // MSL feet
  speed?: number | null; // ground speed, knots
  heading?: number | null; // degrees
  progress?: number | null; // 0..100
  currentLat?: number | null;
  currentLon?: number | null;
  departureLat?: number | null;
  departureLon?: number | null;
  arrivalLat?: number | null;
  arrivalLon?: number | null;
}

// Distance thresholds (nautical miles)
const ON_AIRPORT_NM = 3; // within this radius we consider the aircraft to be at the airport
const TERMINAL_NM = 35; // terminal area — climb-out / approach
// Ground speed thresholds (knots)
const STATIONARY_KT = 3;
const PUSHBACK_KT = 8;
const TAXI_KT = 50;
const CRUISE_FLOOR_FT = 18000;

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in nautical miles. Returns null if any coord is missing. */
function distanceNm(
  lat1?: number | null,
  lon1?: number | null,
  lat2?: number | null,
  lon2?: number | null
): number | null {
  const a1 = Number(lat1);
  const o1 = Number(lon1);
  const a2 = Number(lat2);
  const o2 = Number(lon2);
  if (![a1, o1, a2, o2].every(Number.isFinite)) {
    return null;
  }
  const R = 3440.065; // earth radius in nm
  const dLat = toRad(a2 - a1);
  const dLon = toRad(o2 - o1);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a1)) * Math.cos(toRad(a2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function classifyByString(s: string): FlightPhase | null {
  if (!s) return null;
  if (/divert/.test(s)) return "diverting";
  if (/arriv|complete|landed|finish|block|shutdown|parked|deboard/.test(s)) return "arrived";
  if (/taxi[\s_-]*(in|to gate|gate|arr)/.test(s)) return "taxiIn";
  if (/landing|flare|touchdown|roll\s*out|rollout/.test(s)) return "landing";
  if (/approach|final|\bapp\b|\bils\b/.test(s)) return "approach";
  if (/descen|\bstar\b|top of descent|\btod\b/.test(s)) return "descent";
  if (/cruise|cruising|en[\s_-]*route|enroute|level|\btoc\b/.test(s)) return "cruise";
  if (/climb|initial climb|departure climb/.test(s)) return "climb";
  if (/take[\s_-]*off|departing|depart|rotate|rolling|line\s*up/.test(s)) return "takeoff";
  if (/push[\s_-]*back|pushing/.test(s)) return "pushback";
  if (/taxi/.test(s)) return "taxi";
  if (/board/.test(s)) return "boarding";
  if (/schedul|plan|book|prefile|pre[\s_-]*flight|gate|ready/.test(s)) return "scheduled";
  return null;
}

/**
 * Geometry-driven phase: figure out where the aircraft is relative to its
 * departure/arrival airports and combine that with ground speed and altitude.
 *
 * vAMSYS altitude is MSL, so we never assume "altitude ~ 0 = on the ground"
 * (airports sit at very different elevations). Instead we treat the aircraft as
 * "at an airport" when its position is within a few nm of the field, then use
 * ground speed to tell apart boarding / pushback / taxi / takeoff / landing.
 */
function classifyByGeometry(ctx: FlightPhaseContext): FlightPhase | null {
  const alt = Number(ctx.altitude);
  const gs = Number(ctx.speed);
  const prog = Number(ctx.progress);

  const distDep = distanceNm(ctx.currentLat, ctx.currentLon, ctx.departureLat, ctx.departureLon);
  const distArr = distanceNm(ctx.currentLat, ctx.currentLon, ctx.arrivalLat, ctx.arrivalLon);

  const atDep = distDep != null && distDep <= ON_AIRPORT_NM;
  const atArr = distArr != null && distArr <= ON_AIRPORT_NM;
  const hasGs = Number.isFinite(gs);
  const slow = hasGs && gs < TAXI_KT;

  // 1) On the ground at an airport — never a flight phase.
  if (atDep && slow) {
    if (gs < STATIONARY_KT) return prog > 1 ? "taxi" : "boarding";
    if (gs < PUSHBACK_KT) return "pushback";
    return "taxi";
  }
  if (atArr && slow) {
    return gs < STATIONARY_KT ? "arrived" : "taxiIn";
  }
  // Fast but still over the field = takeoff / landing roll.
  if (atDep && hasGs) return "takeoff";
  if (atArr && hasGs) return "landing";

  // 2) Airborne — terminal areas first.
  if (distArr != null && distArr <= TERMINAL_NM) {
    return Number.isFinite(alt) && alt < 4000 ? "landing" : "approach";
  }
  if (distDep != null && distDep <= TERMINAL_NM) {
    return "climb";
  }

  // 3) En route — split by altitude / progress.
  // (Уход на запасной авто-фазой не выставляем: vAMSYS не даёт live-divert, а ложный показ
  //  пугает. Вместо этого UI показывает алерт-подтверждение — см. detectDivertCandidate.)
  if (Number.isFinite(alt)) {
    if (alt >= CRUISE_FLOOR_FT) {
      return Number.isFinite(prog) && prog > 80 ? "descent" : "cruise";
    }
    return Number.isFinite(prog) && prog > 55 ? "descent" : "climb";
  }

  if (Number.isFinite(prog)) {
    if (prog >= 99) return "arrived";
    if (prog < 10) return "takeoff";
    if (prog < 35) return "climb";
    if (prog > 80) return "approach";
    if (prog > 65) return "descent";
    return "cruise";
  }

  return null;
}

/**
 * Normalize an active flight into one of our canonical phases.
 *
 * Geometry (position vs airports + ground speed + altitude) is authoritative
 * when telemetry is available, because it correctly distinguishes ground vs
 * flight states. The vAMSYS phase/status string is used as a fallback (and as
 * the answer before any telemetry has arrived).
 */
export function normalizeFlightPhase(raw?: string | null, ctx?: FlightPhaseContext): FlightPhase | null {
  const s = String(raw || "").trim().toLowerCase();

  // Явный divert из vAMSYS/Pegasus (кнопка диверта) — абсолютный приоритет над геометрией.
  if (/divert/.test(s)) return "diverting";

  const hasGeo =
    ctx != null &&
    Number.isFinite(Number(ctx.currentLat)) &&
    Number.isFinite(Number(ctx.currentLon)) &&
    (Number.isFinite(Number(ctx.departureLat)) || Number.isFinite(Number(ctx.arrivalLat)));

  if (hasGeo) {
    const geoPhase = classifyByGeometry(ctx!);
    if (geoPhase) {
      return geoPhase;
    }
  }

  return classifyByString(s);
}

interface FlightPhaseBadgeProps {
  phase: FlightPhase;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function FlightPhaseBadge({ phase, size = "md", className }: FlightPhaseBadgeProps) {
  const { t } = useLanguage();
  const meta = FLIGHT_PHASE_META[phase] ?? FLIGHT_PHASE_META.scheduled;
  const Icon = meta.icon;

  const sizing =
    size === "lg"
      ? "px-4 py-1.5 text-sm gap-2"
      : size === "sm"
        ? "px-2.5 py-0.5 text-[11px] gap-1.5"
        : "px-3 py-1 text-xs gap-1.5";
  const iconSize = size === "lg" ? "h-4 w-4" : "h-3.5 w-3.5";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-semibold uppercase tracking-wide",
        meta.pill,
        sizing,
        className
      )}
    >
      <span className="relative flex h-2 w-2 items-center justify-center">
        {meta.live && (
          <span
            className={cn(
              "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
              meta.dot
            )}
          />
        )}
        <span className={cn("relative inline-flex h-2 w-2 rounded-full", meta.dot)} />
      </span>
      <Icon className={iconSize} />
      {t(meta.labelKey)}
    </span>
  );
}
