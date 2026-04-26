import { useState, useMemo } from "react";
import {
  X,
  Plane,
  Clock,
  User,
  Gauge,
  Wind,
  Cloud,
  Eye,
  Navigation,
  Hash,
  ChevronLeft,
  ArrowUpRight,
  Radio,
  MapPin
} from "lucide-react";
import { FlightDetailMap } from "./flight-detail-map";

interface FlightDetailProps {
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
  };
  onClose: () => void;
}

// Airport coordinates (reused)
const airports: Record<string, { lat: number; lon: number }> = {
  UUEE: { lat: 55.9726, lon: 37.4146 },
  UUDD: { lat: 55.4088, lon: 37.9063 },
  ULLI: { lat: 59.8003, lon: 30.2625 },
  LEBL: { lat: 41.2971, lon: 2.0785 },
  LTAI: { lat: 36.8987, lon: 30.8005 },
  OMDB: { lat: 25.2528, lon: 55.3644 },
  LTFM: { lat: 41.2753, lon: 28.7519 },
  URSS: { lat: 43.4499, lon: 39.9566 },
  LTBS: { lat: 37.2506, lon: 27.6643 },
  LEMD: { lat: 40.4936, lon: -3.5668 },
};

export function FlightDetail({ flight, onClose }: FlightDetailProps) {
  // Mock extended details based on the flight prop
  const details = useMemo(() => {
    // Generate some consistent random-ish data based on flight number
    const seed = flight.flightNumber.length;
    
    return {
      callsign: flight.flightNumber,
      flightNumber: flight.flightNumber.replace(/[A-Z]+/, ""),
      rank: "PROBATIONARY FIRST OFFICER",
      registrationCode: flight.pilotId,
      pilotName: flight.pilot.split(" ")[0], // Just first name as in screenshot "Wally"
      heading: 234,
      speed: 463,
      altitude: 36027,
      remainingDistance: Math.round((100 - flight.progress) * 15),
      remainingTime: flight.ete || "00:22",
      registration: "RA-" + (70000 + seed * 100), // Russian style reg for Nordwind
      aircraftType: flight.aircraft,
      std: flight.etd || "10:00",
      atd: flight.etd ? addMinutes(flight.etd, 15) : "10:15",
      sta: flight.eta || "14:00",
      eta: flight.eta || "14:00",
      passengers: 140 + seed,
      type: "Scheduled"
    };
  }, [flight]);

  const [weatherLayers, setWeatherLayers] = useState({
    windSpeed: false,
    windBarbs: false,
    windGusts: false,
    gustBarbs: false,
    lowClouds: false,
    midClouds: false,
    highClouds: false,
    cloudCover: false,
    surfaceVisibility: false,
  });

  const toggleWeatherLayer = (layer: keyof typeof weatherLayers) => {
    setWeatherLayers((prev) => ({ ...prev, [layer]: !prev[layer] }));
  };

  // Calculate positions for map
  const depAirport = airports[flight.departure] || { lat: 0, lon: 0 };
  const arrAirport = airports[flight.destination] || { lat: 0, lon: 0 };

  // Generate curved path
  const generateCurvedPath = () => {
    if (!depAirport.lat || !arrAirport.lat) return [];
    
    const segments = 50;
    const points: [number, number][] = [];
    const midLat = (depAirport.lat + arrAirport.lat) / 2;
    const midLon = (depAirport.lon + arrAirport.lon) / 2;
    const dx = arrAirport.lon - depAirport.lon;
    const dy = arrAirport.lat - depAirport.lat;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const arcHeight = distance * 0.15;
    const perpX = -dy / distance;
    const perpY = dx / distance;
    const controlLat = midLat + perpY * arcHeight;
    const controlLon = midLon + perpX * arcHeight;

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const lat = (1 - t) * (1 - t) * depAirport.lat + 2 * (1 - t) * t * controlLat + t * t * arrAirport.lat;
      const lon = (1 - t) * (1 - t) * depAirport.lon + 2 * (1 - t) * t * controlLon + t * t * arrAirport.lon;
      points.push([lat, lon]);
    }
    return points;
  };

  const gradientPath = generateCurvedPath();

  // Current pos calculation
  const progressRatio = flight.progress / 100;
  // (Simplified calculation for brevity, reusing the logic conceptually)
  // In a real app we'd extract this logic
  const midLat = (depAirport.lat + arrAirport.lat) / 2;
  const midLon = (depAirport.lon + arrAirport.lon) / 2;
  const dx = arrAirport.lon - depAirport.lon;
  const dy = arrAirport.lat - depAirport.lat;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const arcHeight = distance * 0.15;
  const perpX = -dy / distance;
  const perpY = dx / distance;
  const controlLat = midLat + perpY * arcHeight;
  const controlLon = midLon + perpX * arcHeight;

  const currentPos: [number, number] = [
    (1 - progressRatio) * (1 - progressRatio) * depAirport.lat + 2 * (1 - progressRatio) * progressRatio * controlLat + progressRatio * progressRatio * arrAirport.lat,
    (1 - progressRatio) * (1 - progressRatio) * depAirport.lon + 2 * (1 - progressRatio) * progressRatio * controlLon + progressRatio * progressRatio * arrAirport.lon,
  ];

  const mapCenter: [number, number] = [
    (depAirport.lat + arrAirport.lat) / 2,
    (depAirport.lon + arrAirport.lon) / 2,
  ];

  const getBrandColor = () => {
    switch (flight.vac) {
      case "NWS": return "#E31E24";
      case "KAR": return "#16a34a";
      case "STW": return "#9333ea";
      default: return "#Eab308"; // Default yellow from screenshot
    }
  };

  const brandColor = getBrandColor();

  return (
    <div className="w-full h-[800px] flex rounded-xl overflow-hidden shadow-2xl border border-gray-800 bg-[#0f172a]">
      {/* Sidebar */}
      <div className="w-[380px] bg-[#1a1f2e] text-slate-200 flex flex-col h-full relative z-20 overflow-y-auto custom-scrollbar border-r border-slate-800">
        
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
              <div className="p-3 relative">
                 <div className="absolute top-3 right-3">
                    <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20 uppercase">Departure</span>
                 </div>
                 <div className="flex flex-col h-full justify-between">
                    <div>
                        <div className="text-2xl font-black text-white font-mono tracking-tight">{flight.departure}</div>
                        <div className="text-xs text-slate-400 font-medium truncate pr-14">{flight.departureCity}</div>
                    </div>
                    <div className="mt-4 space-y-1">
                        <div className="flex justify-between text-[10px]">
                            <span className="text-slate-500 font-medium">STD:</span>
                            <span className="text-slate-300 font-mono">{details.std}</span>
                        </div>
                        <div className="flex justify-between text-[10px]">
                            <span className="text-slate-500 font-medium">ATD:</span>
                            <span className="text-slate-300 font-mono">{details.atd}</span>
                        </div>
                    </div>
                 </div>
              </div>

              {/* Arrival */}
              <div className="p-3 relative">
                 <div className="absolute top-3 right-3">
                    <span className="text-[10px] font-bold text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded border border-green-500/20 uppercase">Arrival</span>
                 </div>
                 <div className="flex flex-col h-full justify-between">
                    <div>
                        <div className="text-2xl font-black text-white font-mono tracking-tight">{flight.destination}</div>
                        <div className="text-xs text-slate-400 font-medium truncate pr-14">{flight.destinationCity}</div>
                    </div>
                    <div className="mt-4 space-y-1">
                        <div className="flex justify-between text-[10px]">
                            <span className="text-slate-500 font-medium">STA:</span>
                            <span className="text-slate-300 font-mono">{details.sta}</span>
                        </div>
                        <div className="flex justify-between text-[10px]">
                            <span className="text-slate-500 font-medium">ETA:</span>
                            <span className="text-slate-300 font-mono">{details.eta}</span>
                        </div>
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
                    <span className="text-sm font-bold text-blue-400">{flight.aircraft.split(' ')[0]}</span>
                </div>
                <div className="flex flex-col items-end">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Network</span>
                    <span className="text-[10px] font-bold text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20 uppercase">Offline</span>
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
                        className="rotate-90" 
                        fill={brandColor} 
                        color={brandColor === '#E31E24' ? 'white' : '#1a1f2e'} // Contrast stroke
                        strokeWidth={1}
                    />
                </div>
             </div>

             <div className="flex justify-between items-center text-xs text-slate-400 mt-2 font-mono">
                <div className="flex items-center gap-1.5">
                    <MapPin size={12} />
                    <span>{details.remainingDistance} NM remaining</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <Clock size={12} />
                    <span>{details.remainingTime}</span>
                </div>
             </div>
          </div>

          {/* Identification */}
          <div className="grid grid-cols-2 gap-3">
             <div className="bg-[#242a38] rounded-lg border border-slate-700/50 p-3 shadow-lg">
                <div className="flex items-center gap-2 text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">
                    <Radio size={10} /> Callsign
                </div>
                <div className="text-lg font-bold text-white font-mono">{details.callsign}</div>
             </div>
             <div className="bg-[#242a38] rounded-lg border border-slate-700/50 p-3 shadow-lg">
                <div className="flex items-center gap-2 text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">
                    <Hash size={10} /> Flight Number
                </div>
                <div className="text-lg font-bold text-white font-mono">{details.flightNumber}</div>
             </div>
          </div>

          {/* Pilot Info */}
          <div className="bg-[#242a38] rounded-lg border border-slate-700/50 p-4 shadow-lg">
             <div className="flex justify-between items-start">
                <div className="flex items-center gap-2 mb-2">
                    <User size={14} className="text-slate-400" />
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{details.rank}</span>
                </div>
                <div className="text-xs font-mono font-bold text-slate-500">{details.registrationCode}</div>
             </div>
             <div className="text-xl font-bold text-white">{details.pilotName}</div>
          </div>

          {/* Telemetry Grid */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-[#242a38] rounded-lg border border-slate-700/50 p-3 text-center shadow-lg">
               <Navigation size={16} className="mx-auto text-slate-500 mb-2" />
               <div className="text-lg font-bold text-white font-mono">{details.heading}°</div>
            </div>
            <div className="bg-[#242a38] rounded-lg border border-slate-700/50 p-3 text-center shadow-lg">
               <Gauge size={16} className="mx-auto text-slate-500 mb-2" />
               <div className="text-lg font-bold text-white font-mono">{details.speed} <span className="text-[10px] text-slate-500">kts</span></div>
            </div>
            <div className="bg-[#242a38] rounded-lg border border-slate-700/50 p-3 text-center shadow-lg">
               <ArrowUpRight size={16} className="mx-auto text-slate-500 mb-2" />
               <div className="text-lg font-bold text-white font-mono">{details.altitude.toLocaleString()} <span className="text-[10px] text-slate-500">ft</span></div>
            </div>
          </div>

          {/* Passengers & Type */}
          <div className="grid grid-cols-2 gap-3">
             <div className="bg-[#242a38] rounded-lg border border-slate-700/50 p-3 flex justify-between items-center shadow-lg">
                <User size={16} className="text-slate-500" />
                <div className="text-right">
                    <div className="text-lg font-bold text-white font-mono">{details.passengers}</div>
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
                 {details.registration} - {details.aircraftType}
             </div>
          </div>

          {/* Weather Toggles */}
          <div className="bg-[#242a38] rounded-lg border border-slate-700/50 overflow-hidden shadow-lg">
            <WeatherToggle label="Wind Speed" icon={<Wind size={14}/>} enabled={weatherLayers.windSpeed} onToggle={() => toggleWeatherLayer("windSpeed")} />
            <WeatherToggle label="Wind Barbs" icon={<Wind size={14}/>} enabled={weatherLayers.windBarbs} onToggle={() => toggleWeatherLayer("windBarbs")} />
            <WeatherToggle label="Wind Gusts" icon={<Wind size={14} className="text-orange-400"/>} enabled={weatherLayers.windGusts} onToggle={() => toggleWeatherLayer("windGusts")} />
            <WeatherToggle label="Gust Barbs" icon={<Wind size={14} className="text-orange-400"/>} enabled={weatherLayers.gustBarbs} onToggle={() => toggleWeatherLayer("gustBarbs")} />
            <WeatherToggle label="Low Clouds" sublabel="(Sfc-FL065)" icon={<Cloud size={14}/>} enabled={weatherLayers.lowClouds} onToggle={() => toggleWeatherLayer("lowClouds")} />
            <WeatherToggle label="Mid Clouds" sublabel="(FL065-200)" icon={<Cloud size={14}/>} enabled={weatherLayers.midClouds} onToggle={() => toggleWeatherLayer("midClouds")} />
            <WeatherToggle label="High Clouds" sublabel="(>FL200)" icon={<Cloud size={14}/>} enabled={weatherLayers.highClouds} onToggle={() => toggleWeatherLayer("highClouds")} />
            <WeatherToggle label="Total Cloud Cover" icon={<Cloud size={14}/>} enabled={weatherLayers.cloudCover} onToggle={() => toggleWeatherLayer("cloudCover")} />
            <WeatherToggle label="Surface Visibility" icon={<Eye size={14}/>} enabled={weatherLayers.surfaceVisibility} onToggle={() => toggleWeatherLayer("surfaceVisibility")} />
          </div>

          <div className="flex items-center gap-2 text-[10px] text-slate-500 justify-center pt-2">
            <CameraIcon />
            <span>Photo by: Marc Charon</span>
          </div>

        </div>
      </div>

      {/* Map Area */}
      <div className="flex-1 relative h-full bg-[#111827]">
        <FlightDetailMap
          depAirport={depAirport}
          arrAirport={arrAirport}
          currentPos={currentPos}
          mapCenter={mapCenter}
          gradientPath={gradientPath}
          weatherLayers={weatherLayers}
          progress={flight.progress}
        />
        
        {/* Filters Top Right Overlay */}
        <div className="absolute top-4 right-4 z-[400]">
           <button className="flex items-center gap-2 px-3 py-1.5 bg-[#1a1f2e] border border-slate-700 rounded text-xs font-medium text-slate-300 hover:text-white transition-colors">
              <FilterIcon />
              Filters - 5 flights
           </button>
        </div>
      </div>
    </div>
  );
}

function WeatherToggle({
  icon,
  label,
  sublabel,
  enabled,
  onToggle,
}: {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between p-3 border-b border-slate-700/50 last:border-0 hover:bg-slate-700/30 transition-colors cursor-pointer" onClick={onToggle}>
      <div className="flex items-center gap-3">
        <div className="text-slate-400">{icon}</div>
        <div className="flex flex-col">
           <span className="text-xs font-bold text-slate-300">{label}</span>
           {sublabel && <span className="text-[10px] text-slate-500">{sublabel}</span>}
        </div>
      </div>
      <div className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
        enabled 
          ? "bg-blue-500 text-white" 
          : "bg-slate-700 text-slate-400"
      }`}>
        {enabled ? "ON" : "OFF"}
      </div>
    </div>
  );
}

function CameraIcon() {
    return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
}

function FilterIcon() {
    return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
}

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const date = new Date();
  date.setHours(h, m + minutes);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
