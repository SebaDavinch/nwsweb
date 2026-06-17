import { useMemo } from "react";
import { Plane, Users } from "lucide-react";
import { generateCrew, crewRoleLabel, type CrewMember } from "./flight-crew";

const AIRLINE_LABELS: Record<string, string> = {
  nordwind: "Nordwind",
  ikar: "Икар / Ikar",
  southwind: "Southwind",
};

// Цвет аватара-заглушки — детерминированный по инициалам.
const AVATAR_COLORS = [
  "bg-red-500/25 text-red-200",
  "bg-sky-500/25 text-sky-200",
  "bg-emerald-500/25 text-emerald-200",
  "bg-violet-500/25 text-violet-200",
  "bg-amber-500/25 text-amber-200",
  "bg-rose-500/25 text-rose-200",
  "bg-cyan-500/25 text-cyan-200",
];
function avatarColor(initials: string): string {
  let h = 0;
  for (let i = 0; i < initials.length; i++) h = (h + initials.charCodeAt(i)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[h];
}

function CrewCard({ member, language }: { member: CrewMember; language: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3.5 py-3">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-black ${avatarColor(member.initials)}`}>
        {member.initials}
      </div>
      <div className="min-w-0">
        <div className="truncate text-sm font-bold text-white">{member.name}</div>
        <div className="text-[11px] uppercase tracking-wide text-white/45">{crewRoleLabel(member.role, language)}</div>
      </div>
    </div>
  );
}

export function FlightCrewTab({
  booking,
  language,
  tr,
}: {
  booking: import("./use-active-booking").ActiveBooking;
  language: string;
  tr: (ru: string, en: string) => string;
}) {
  const crew = useMemo(
    () =>
      generateCrew({
        bookingId: booking.id,
        callsign: booking.callsign,
        flightNumber: booking.flightNumber,
        aircraft: booking.aircraft,
      }),
    [booking.id, booking.callsign, booking.flightNumber, booking.aircraft]
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-xs text-white/45">
          {tr(
            "Экипаж сформирован для этого рейса. Состав одинаков при каждом открытии.",
            "Crew assigned for this flight. The roster stays the same every time."
          )}
        </p>
        <span className="shrink-0 rounded-md bg-white/[0.06] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white/50">
          {AIRLINE_LABELS[crew.airline] || crew.airline}
        </span>
      </div>

      {/* Лётный экипаж */}
      <div>
        <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-white/40">
          <Plane className="h-3.5 w-3.5" />
          {tr("Лётный экипаж", "Flight deck")}
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {crew.flightDeck.map((m) => (
            <CrewCard key={`${m.role}-${m.name}`} member={m} language={language} />
          ))}
        </div>
      </div>

      {/* Кабинный экипаж */}
      <div>
        <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-white/40">
          <Users className="h-3.5 w-3.5" />
          {tr("Кабинный экипаж", "Cabin crew")} · {crew.cabin.length}
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {crew.cabin.map((m, i) => (
            <CrewCard key={`${m.role}-${m.name}-${i}`} member={m} language={language} />
          ))}
        </div>
      </div>
    </div>
  );
}
