import { useMemo } from "react";
import {
  X,
  Plane,
  Clock,
  User,
  Gauge,
  Navigation,
  ArrowUpRight,
  Radio,
  Hash,
  ChevronLeft,
  MapPin
} from "lucide-react";

interface FlightDetailSidebarProps {
  flight: {
    flightNumber: string;
    departure: string;
    departureCity: string;
    destination: string;
    destinationCity: string;
    status: string;
    pilot: string;
    pilotId: string;
    aircraft: string;
    progress: number;
    vac: "NWS" | "KAR" | "STW";
    etd?: string;
    ete?: string;
    eta?: string;
    heading?: number | null;
    speed?: number | null;
    altitude?: number | null;
    currentLat?: number | null;
    currentLon?: number | null;
    passengers?: number | null;
    aircraftRegistration?: string;
    departureLat?: number | null;
    departureLon?: number | null;
    arrivalLat?: number | null;
    arrivalLon?: number | null;
    network?: string;
    hasLiveTelemetry?: boolean;
  };
  onClose: () => void;
}

const toFiniteOrNull = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const toTimeLabel = (value: unknown) => {
  const raw = String(value || "").trim();
  if (!raw) {
    return "—";
  }

  const hhmmMatch = raw.match(/^(\d{1,2}):(\d{2})/);
  if (hhmmMatch) {
    const hh = hhmmMatch[1].padStart(2, "0");
    return `${hh}:${hhmmMatch[2]}`;
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    const hh = String(parsed.getUTCHours()).padStart(2, "0");
    const mm = String(parsed.getUTCMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  return "—";
};

const haversineNm = (fromLat: number, fromLon: number, toLat: number, toLon: number) => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(toLat - fromLat);
  const dLon = toRad(toLon - fromLon);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(fromLat)) * Math.cos(toRad(toLat)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const earthRadiusKm = 6371;
  return earthRadiusKm * c * 0.539957;
};

const splitAircraft = (value: string, explicitRegistration?: string) => {
  const raw = String(value || "").trim();
  const forcedRegistration = String(explicitRegistration || "").trim();
  if (!raw) {
    return { registration: forcedRegistration || "—", type: "—" };
  }

  const byDash = raw.split(" - ").map((part) => part.trim()).filter(Boolean);
  if (byDash.length >= 2) {
    return {
      registration: forcedRegistration || byDash[0] || "—",
      type: byDash.slice(1).join(" - ") || byDash[0] || "—",
    };
  }

  return {
    registration: forcedRegistration || "—",
    type: raw,
  };
};

const formatAircraftBadge = (type: string) => {
  const raw = String(type || "").trim();
  if (!raw || raw === "—") {
    return "—";
  }

  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length >= 2 && /^(airbus|boeing|embraer|bombardier|cessna|atr)$/i.test(parts[0])) {
    return parts.slice(1).join(" ");
  }

  return raw;
};

const normalizeNetworkLabel = (value: unknown, hasLiveTelemetry?: boolean) => {
  const raw = String(value || "").trim();
  if (!raw) {
    return hasLiveTelemetry ? "ONLINE" : "OFFLINE";
  }

  const upper = raw.toUpperCase();
  if (upper.includes("VATSIM")) return "VATSIM";
  if (upper.includes("IVAO")) return "IVAO";
  if (upper.includes("PILOTEDGE")) return "PILOTEDGE";
  if (upper.includes("POSCON")) return "POSCON";
  return upper;
};

export function FlightDetailSidebar({ 
  flight, 
  onClose
}: FlightDetailSidebarProps) {
  
  const details = useMemo(() => {
    const callsign = String(flight.flightNumber || "").trim().toUpperCase();
    const numbers = (callsign.match(/\d+/) || [""])[0] || "—";
    const aircraft = splitAircraft(
      String(flight.aircraft || ""),
      String(flight.aircraftRegistration || "").trim()
    );

    const depLat = toFiniteOrNull(flight.departureLat);
    const depLon = toFiniteOrNull(flight.departureLon);
    const arrLat = toFiniteOrNull(flight.arrivalLat);
    const arrLon = toFiniteOrNull(flight.arrivalLon);
    const curLat = toFiniteOrNull(flight.currentLat);
    const curLon = toFiniteOrNull(flight.currentLon);

    const progress = Math.max(0, Math.min(100, Number(flight.progress) || 0));

    const liveRemainingNm =
      curLat !== null && curLon !== null && arrLat !== null && arrLon !== null
        ? haversineNm(curLat, curLon, arrLat, arrLon)
        : null;

    const routeTotalNm =
      depLat !== null && depLon !== null && arrLat !== null && arrLon !== null
        ? haversineNm(depLat, depLon, arrLat, arrLon)
        : null;

    const fallbackRemainingNm = routeTotalNm !== null ? routeTotalNm * (1 - progress / 100) : null;
    const remainingDistance = Math.max(0, Math.round(liveRemainingNm ?? fallbackRemainingNm ?? 0));

    return {
      callsignName: "Nordland",
      callsignNumber: numbers,
      callsign,
      flightNumber: callsign || "—",
      pilotCode: String(flight.pilotId || "—").trim() || "—",
      pilotName: String(flight.pilot || "—").trim() || "—",
      heading: toFiniteOrNull(flight.heading),
      speed: toFiniteOrNull(flight.speed),
      altitude: toFiniteOrNull(flight.altitude),
      remainingDistance,
      remainingTime: String(flight.ete || "").trim() || "—",
      registration: aircraft.registration,
      aircraftType: aircraft.type,
      std: toTimeLabel(flight.etd),
      atd: "—",
      sta: toTimeLabel(flight.eta),
      eta: toTimeLabel(flight.eta),
      passengers: toFiniteOrNull(flight.passengers),
      type: String(flight.status || "—").trim() || "—",
      network: normalizeNetworkLabel(flight.network, flight.hasLiveTelemetry),
      aircraftBadge: formatAircraftBadge(aircraft.type),
    };
  }, [flight]);

  const getBrandColor = () => {
    switch (flight.vac) {
      case "NWS": return "#E31E24";
      case "KAR": return "#16a34a";
      case "STW": return "#9333ea";
      default: return "#Eab308";
    }
  };

  const brandColor = getBrandColor();

  return (
    <div className="absolute top-0 left-0 bottom-0 w-[380px] bg-[#1a1f2e] text-slate-200 flex flex-col z-[1000] overflow-y-auto custom-scrollbar border-r border-slate-800 shadow-2xl animate-in slide-in-from-left duration-300">
      
      {/* Header Image Area */}
      <div className="relative h-48 shrink-0 group">
        <img
          src="https://images.unsplash.com/photo-1542296332-2e4473faf563?q=80&w=2670&auto=format&fit=crop"
          alt="Aircraft"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#1a1f2e] via-transparent to-transparent"></div>
        
        {/* Top Controls */}
        <div className="absolute top-4 left-4 right-4 flex justify-between items-center">
          <button 
            onClick={onClose}
            className="flex items-center gap-2 px-3 py-1.5 bg-black/40 hover:bg-black/60 backdrop-blur-md rounded text-xs font-medium text-white transition-colors border border-white/10"
          >
            <ChevronLeft size={14} />
            All Flights
          </button>
          <button 
            onClick={onClose}
            className="p-1.5 bg-black/40 hover:bg-black/60 backdrop-blur-md rounded-full text-white transition-colors border border-white/10"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="px-4 -mt-6 relative z-10 space-y-4 pb-8">
        
        {/* Route Card */}
        <div className="bg-[#242a38] rounded-lg border border-slate-700/50 overflow-hidden shadow-lg">
          <div className="grid grid-cols-2 divide-x divide-slate-700/50">
            {/* Departure */}
            <div className="p-4 flex flex-col justify-between h-full">
               <div>
                  <div className="flex items-center gap-2 mb-1">
                      <div className="text-3xl font-black text-white font-mono tracking-tight leading-none">{flight.departure}</div>
                      <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20 uppercase">Departure</span>
                  </div>
                  <div className="text-sm text-slate-400 font-medium truncate">{flight.departureCity}</div>
               </div>
               <div className="mt-6 space-y-1.5 border-t border-slate-700/30 pt-3">
                  <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500 font-bold">STD:</span>
                      <span className="text-slate-200 font-mono font-medium">{details.std} UTC</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500 font-bold">ATD:</span>
                      <span className="text-slate-200 font-mono font-medium">{details.atd} UTC</span>
                  </div>
               </div>
            </div>

            {/* Arrival */}
            <div className="p-4 flex flex-col justify-between h-full">
               <div>
                  <div className="flex items-center gap-2 mb-1">
                      <div className="text-3xl font-black text-white font-mono tracking-tight leading-none">{flight.destination}</div>
                      <span className="text-[10px] font-bold text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded border border-green-500/20 uppercase">Arrival</span>
                  </div>
                  <div className="text-sm text-slate-400 font-medium truncate">{flight.destinationCity}</div>
               </div>
               <div className="mt-6 space-y-1.5 border-t border-slate-700/30 pt-3">
                  <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500 font-bold">STA:</span>
                      <span className="text-slate-200 font-mono font-medium">{details.sta} UTC</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500 font-bold">ETA:</span>
                      <span className="text-slate-200 font-mono font-medium">{details.eta} UTC</span>
                  </div>
               </div>
            </div>
          </div>
        </div>

        {/* Progress Section */}
        <div className="bg-[#242a38] rounded-lg border border-slate-700/50 p-4 shadow-lg">
           <div className="flex justify-between items-center mb-4">
              <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status</span>
                  <span className="text-sm font-bold text-white uppercase">{flight.status}</span>
              </div>
              <div className="flex flex-col items-center">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Aircraft</span>
                  <span className="text-sm font-bold text-blue-400">{details.aircraftBadge}</span>
              </div>
              <div className="flex flex-col items-end">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Network</span>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase ${
                      details.network === "OFFLINE"
                        ? "text-red-400 bg-red-500/10 border-red-500/20"
                        : "text-green-400 bg-green-500/10 border-green-500/20"
                    }`}
                  >
                    {details.network}
                  </span>
              </div>
           </div>

           {/* Custom Slider with Plane Icon */}
           <div className="relative h-1 bg-slate-700/50 rounded-full mb-2 mt-2">
              <div 
                  className="absolute top-0 left-0 h-full rounded-full" 
                  style={{ width: `${flight.progress}%`, backgroundColor: brandColor }}
              ></div>
              <div 
                  className="absolute top-1/2 -translate-y-1/2 -ml-2"
                  style={{ left: `${flight.progress}%` }}
              >
                  <Plane 
                      size={20} 
                      className="rotate-45" 
                      fill={brandColor} 
                      color={brandColor === '#E31E24' ? 'white' : '#1a1f2e'} 
                      strokeWidth={1}
                  />
              </div>
           </div>

           <div className="flex justify-between items-center text-xs text-slate-400 mt-2 font-mono">
              <div className="flex items-center gap-1.5">
                  <MapPin size={12} />
                <span>{Number.isFinite(details.remainingDistance) ? `${details.remainingDistance} NM remaining` : "—"}</span>
              </div>
              <div className="flex items-center gap-1.5">
                  <Clock size={12} />
                  <span>{details.remainingTime}</span>
              </div>
           </div>
        </div>

        {/* Identification */}
        <div className="grid grid-cols-2 gap-3 h-24">
           <div className="bg-[#242a38] rounded-lg border border-slate-700/50 p-3 shadow-lg flex flex-col relative overflow-hidden group">
              <div className="flex items-center gap-2 text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1 z-10">
                  <Radio size={12} /> ATC Callsign
              </div>
              <div className="flex flex-col justify-center flex-1 z-10 items-center">
                  <div className="text-2xl font-bold text-white leading-none tracking-tight">{details.callsignName}</div>
              </div>
           </div>
           
           <div className="bg-[#242a38] rounded-lg border border-slate-700/50 p-3 shadow-lg flex flex-col relative overflow-hidden group">
              <div className="flex items-center gap-2 text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1 z-10">
                  <Hash size={12} /> Flight Number
              </div>
              <div className="flex flex-col justify-center flex-1 z-10 items-center">
                  <div className="text-2xl font-bold text-white font-mono tracking-tight">{details.flightNumber}</div>
              </div>
           </div>
        </div>

        {/* Pilot Info */}
        <div className="bg-[#242a38] rounded-lg border border-slate-700/50 p-4 shadow-lg">
           <div className="flex justify-between items-center mb-1">
              <div className="flex items-center gap-2">
                  <User size={14} className="text-slate-400" />
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Pilot</span>
              </div>
              <div className="text-xs font-mono font-bold text-slate-500">{details.pilotCode}</div>
           </div>
           <div className="text-2xl font-bold text-white tracking-tight">{details.pilotName}</div>
        </div>

        {/* Telemetry Grid */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-[#242a38] rounded-lg border border-slate-700/50 p-3 text-center shadow-lg">
             <Navigation size={16} className="mx-auto text-slate-500 mb-2" />
             <div className="text-lg font-bold text-white font-mono">{details.heading !== null ? `${Math.round(details.heading)}°` : "—"}</div>
          </div>
          <div className="bg-[#242a38] rounded-lg border border-slate-700/50 p-3 text-center shadow-lg">
             <Gauge size={16} className="mx-auto text-slate-500 mb-2" />
             <div className="text-lg font-bold text-white font-mono">
              {details.speed !== null ? Math.round(details.speed) : "—"} <span className="text-[10px] text-slate-500">kts</span>
             </div>
          </div>
          <div className="bg-[#242a38] rounded-lg border border-slate-700/50 p-3 text-center shadow-lg">
             <ArrowUpRight size={16} className="mx-auto text-slate-500 mb-2" />
             <div className="text-lg font-bold text-white font-mono">
              {details.altitude !== null ? Math.round(details.altitude).toLocaleString() : "—"} <span className="text-[10px] text-slate-500">ft</span>
             </div>
          </div>
        </div>

        {/* Passengers & Type */}
        <div className="grid grid-cols-2 gap-3">
           <div className="bg-[#242a38] rounded-lg border border-slate-700/50 p-3 flex justify-between items-center shadow-lg">
              <User size={16} className="text-slate-500" />
              <div className="text-right">
                  <div className="text-lg font-bold text-white font-mono">
                    {details.passengers !== null ? Math.round(details.passengers) : "—"}
                  </div>
              </div>
           </div>
           <div className="bg-[#242a38] rounded-lg border border-slate-700/50 p-3 flex justify-between items-center shadow-lg">
              <div className="text-xs font-bold text-slate-500 uppercase">Type</div>
              <div className="text-sm font-bold text-white">{details.type}</div>
           </div>
        </div>

        {/* Aircraft Details */}
        <div className="bg-[#242a38] rounded-lg border border-slate-700/50 p-3 shadow-lg">
           <div className="flex justify-between items-center">
               <div className="flex items-center gap-2">
                   <Plane size={14} className="text-slate-500" />
                   <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Aircraft</span>
               </div>
               <span className="text-xs font-bold text-white">{details.aircraftType.split(' ')[0]}</span>
           </div>
           <div className="mt-2 text-sm font-bold text-white border-t border-slate-700/50 pt-2">
               {details.registration && details.registration !== "—"
                 ? `${details.registration} - ${details.aircraftType}`
                 : details.aircraftType}
           </div>
        </div>

      </div>
    </div>
  );
}
