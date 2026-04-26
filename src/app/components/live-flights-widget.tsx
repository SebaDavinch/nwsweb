import { useLanguage } from "../context/language-context";
import { Plane, MapPin, Clock } from "lucide-react";
import { Link } from "react-router";
import { useEffect, useState } from "react";

const HOME_FLIGHTS_REFRESH_MS = 5000;

interface Flight {
  id?: number;
  flightNumber: string;
  departure: string;
  departureCity: string;
  destination?: string;
  destinationCity?: string;
  arrival?: string;
  arrivalCity?: string;
  status: string;
  pilot: string;
  pilotId: string | number;
  aircraft: string;
  progress: number;
}

export function LiveFlightsWidget() {
  const { t } = useLanguage();
  const [flights, setFlights] = useState<Flight[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadFlights = async () => {
      if (mounted) {
        setIsLoading(true);
      }
      try {
        const response = await fetch("/api/vamsys/flight-map", {
          credentials: "include",
        });

        if (!response.ok) {
          if (mounted) {
            setFlights([]);
          }
          return;
        }

        const payload = await response.json();
        const source = Array.isArray(payload?.flights) ? payload.flights : [];
        const normalized: Flight[] = source.slice(0, 4).map((item: Flight) => ({
          ...item,
          destination: item.destination || item.arrival || "—",
          destinationCity: item.destinationCity || item.arrivalCity || "—",
          departure: item.departure || "—",
          departureCity: item.departureCity || "—",
          pilot: item.pilot || "—",
          pilotId: item.pilotId || "—",
          aircraft: item.aircraft || "—",
          progress: Number.isFinite(Number(item.progress)) ? Number(item.progress) : 0,
        }));
        if (mounted) {
          setFlights(normalized);
        }
      } catch {
        if (mounted) {
          setFlights([]);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    loadFlights();
    const timer = setInterval(loadFlights, HOME_FLIGHTS_REFRESH_MS);

    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "boarding":
        return "text-blue-600 bg-blue-50";
      case "climbing":
      case "en route":
        return "text-green-600 bg-green-50";
      case "approach":
      case "descending":
        return "text-orange-600 bg-orange-50";
      case "landed":
        return "text-gray-600 bg-gray-50";
      default:
        return "text-gray-600 bg-gray-50";
    }
  };

  return (
    <section className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl md:text-4xl mb-2">
              {t("home.liveFlights.title")}{" "}
              <span className="text-[#E31E24]">{t("home.liveFlights.live")}</span>
            </h2>
            <p className="text-gray-600">{t("home.liveFlights.subtitle")}</p>
          </div>
          <Link
            to="/live"
            className="hidden md:block text-[#E31E24] hover:underline"
          >
            {t("home.liveFlights.viewAll")} →
          </Link>
        </div>

        {/* Flights Grid */}
        {isLoading ? (
          <div className="text-gray-500">Loading live flights...</div>
        ) : !flights.length ? (
          <div className="text-gray-500">No active flights right now.</div>
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {flights.map((flight, index) => (
            <div
              key={flight.id || index}
              className="bg-gray-50 rounded-lg p-6 border border-gray-200 hover:border-[#E31E24] hover:shadow-lg transition-all"
            >
              {/* Flight Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="bg-[#E31E24] p-2 rounded">
                    <Plane className="text-white" size={20} />
                  </div>
                  <div>
                    <div className="font-mono text-lg">{flight.flightNumber}</div>
                    <div className="text-sm text-gray-600">{flight.aircraft}</div>
                  </div>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs ${getStatusColor(
                    flight.status
                  )}`}
                >
                  {flight.status}
                </span>
              </div>

              {/* Route */}
              <div className="flex items-center justify-between mb-4">
                <div className="text-center flex-1">
                  <div className="flex flex-col items-center gap-1 mb-1">
                    <div className="flex items-center gap-1">
                      <MapPin size={14} className="text-gray-400" />
                      <span className="font-mono text-2xl font-bold">{flight.departure}</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {flight.departureCity}
                    </div>
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {t("home.liveFlights.departure")}
                  </div>
                </div>

                <div className="flex-1 px-4">
                  <div className="relative">
                    <div className="h-1 bg-gray-200 rounded-full">
                      <div
                        className="h-1 bg-[#E31E24] rounded-full transition-all duration-500"
                        style={{ width: `${flight.progress}%` }}
                      ></div>
                    </div>
                    <Plane
                      className="absolute text-[#E31E24] transform -translate-y-1/2"
                      style={{ left: `${flight.progress}%`, top: "50%" }}
                      size={16}
                    />
                  </div>
                </div>

                <div className="text-center flex-1">
                  <div className="flex flex-col items-center gap-1 mb-1">
                    <div className="flex items-center gap-1">
                      <span className="font-mono text-2xl font-bold">{flight.destination || "—"}</span>
                      <MapPin size={14} className="text-gray-400" />
                    </div>
                    <div className="text-xs text-gray-500">
                      {flight.destinationCity || "—"}
                    </div>
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {t("home.liveFlights.arrival")}
                  </div>
                </div>
              </div>

              {/* Pilot Info */}
              <div className="flex items-center gap-2 pt-3 border-t border-gray-200">
                <div className="text-xl">
                  👨‍✈️
                </div>
                <div className="text-sm text-gray-600">
                  {t("home.liveFlights.pilot")}: <span className="text-gray-900">{flight.pilot} - {flight.pilotId}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
        )}

        {/* View All Link for Mobile */}
        <div className="text-center md:hidden">
          <Link
            to="/live"
            className="inline-block text-[#E31E24] hover:underline"
          >
            {t("home.liveFlights.viewAll")} →
          </Link>
        </div>

        {/* Info Note */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Clock className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
            <p className="text-sm text-blue-800">
              {t("home.liveFlights.note")}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}