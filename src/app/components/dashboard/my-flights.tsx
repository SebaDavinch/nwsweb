import { useEffect, useState } from "react";
import { Link } from "react-router";
import {
  Plane,
  CalendarPlus,
  Clock,
  ArrowRight,
  Loader2,
  Trash2,
  ExternalLink,
  RefreshCcw,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "../../context/language-context";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { RecentFlights } from "./recent-flights";
import { icaoToCountry, getFlagUri } from "./flag-data";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";

interface Booking {
  id: number;
  routeId?: number | null;
  flightNumber: string;
  callsign: string;
  departureCode: string;
  departureName: string;
  arrivalCode: string;
  arrivalName: string;
  aircraft: string;
  network?: string;
  departureTime?: string | null;
  validTo?: string | null;
  createdAt?: string | null;
  status: string;
  statusLabel: string;
  canCancel: boolean;
}

const cityFromName = (name?: string | null, fallback?: string) => {
  const raw = String(name || "").trim();
  if (!raw) return String(fallback || "").trim().toUpperCase();
  return raw
    .replace(/\s*\([A-Z]{3,4}\)\s*/g, " ")
    .replace(/\binternational\s+airport\b/gi, "")
    .replace(/\bairport\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim() || String(fallback || "").trim().toUpperCase();
};

function IcaoFlag({ icao, className = "h-3.5 w-5" }: { icao?: string; className?: string }) {
  const code = icaoToCountry(String(icao || "").trim());
  const uri = code ? getFlagUri(code) : "";
  if (!uri) return null;
  return <img src={uri} alt={code} className={`inline-block shrink-0 rounded-[2px] border border-black/10 object-cover ${className}`} />;
}

const fmt = (iso?: string | null, lang = "ru") => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return d.toLocaleString(lang === "ru" ? "ru-RU" : "en-US", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const statusBadgeCls = (status: string) => {
  const s = String(status || "").toLowerCase();
  if (["active", "confirmed", "booked"].some((k) => s.includes(k)))
    return "bg-sky-50 text-sky-700 border-sky-200";
  if (["pending"].some((k) => s.includes(k)))
    return "bg-amber-50 text-amber-700 border-amber-200";
  if (["expired", "cancelled", "deleted"].some((k) => s.includes(k)))
    return "bg-zinc-100 text-zinc-500 border-zinc-200";
  return "bg-zinc-100 text-zinc-600 border-zinc-200";
};

interface MyFlightsProps {
  onOpenPirep?: (id: number) => void;
}

export function MyFlights({ onOpenPirep }: MyFlightsProps) {
  const { t, language } = useLanguage();
  const ru = language === "ru";
  const tr = (r: string, e: string) => (ru ? r : e);

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoadingBookings, setIsLoadingBookings] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [connectionMsg, setConnectionMsg] = useState("");
  const [cancelId, setCancelId] = useState<number | null>(null);
  const [dispatchingId, setDispatchingId] = useState<number | null>(null);

  const loadBookings = async (silent = false) => {
    if (silent) setIsRefreshing(true);
    else setIsLoadingBookings(true);
    try {
      const res = await fetch("/api/pilot/bookings?page[size]=20&sort=departure_time", {
        credentials: "include",
      });
      const p = await res.json().catch(() => null);
      if (!res.ok) {
        setConnectionMsg(String(p?.error || tr("Не удалось загрузить букинги", "Failed to load bookings")));
        setBookings([]);
        return;
      }
      setBookings(Array.isArray(p?.bookings) ? p.bookings : []);
      setConnectionMsg("");
    } catch {
      setConnectionMsg(tr("Ошибка сети", "Network error"));
    } finally {
      setIsLoadingBookings(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => { void loadBookings(); }, []);

  const handleDispatch = async (b: Booking) => {
    if (!b.routeId) { toast.error(tr("Нет маршрута для диспатча", "No route for dispatch")); return; }
    setDispatchingId(b.id);
    try {
      const res = await fetch("/api/pilot/dispatch-url", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ routeId: b.routeId }),
      });
      const p = await res.json().catch(() => null);
      if (!res.ok || !p?.url) throw new Error(p?.error || "dispatch error");
      window.open(p.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(String(err));
    } finally {
      setDispatchingId(null);
    }
  };

  const handleCancel = async () => {
    if (!cancelId) return;
    try {
      const res = await fetch(`/api/pilot/bookings/${cancelId}`, { method: "DELETE", credentials: "include" });
      const p = await res.json().catch(() => null);
      if (!res.ok) throw new Error(p?.error || "cancel error");
      toast.success(tr("Букинг отменён", "Booking cancelled"));
      setCancelId(null);
      await loadBookings(true);
    } catch (err) {
      toast.error(String(err));
    }
  };

  return (
    <div className="space-y-10">
      {/* ─── Предстоящие рейсы ─────────────────────────────────────── */}
      <section>
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-[#1d1d1f]">{tr("Предстоящие рейсы", "Upcoming flights")}</h2>
            <p className="mt-0.5 text-sm text-zinc-500">{tr("Активные букинги и ближайшие вылеты", "Active bookings and scheduled departures")}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => void loadBookings(true)} disabled={isRefreshing}>
              {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
            </Button>
            <Button asChild className="bg-[#E31E24] text-white hover:bg-[#c21920]" size="sm">
              <Link to="/dashboard/dispatch">
                <CalendarPlus className="mr-2 h-4 w-4" />
                {tr("Новый рейс", "New flight")}
              </Link>
            </Button>
          </div>
        </div>

        {connectionMsg ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{connectionMsg}</div>
        ) : isLoadingBookings ? (
          <div className="flex items-center gap-3 rounded-xl border border-zinc-100 bg-white px-5 py-8 text-sm text-zinc-400 shadow-sm dark:border-white/5 dark:bg-zinc-900">
            <Loader2 className="h-4 w-4 animate-spin" />
            {tr("Загрузка букингов…", "Loading bookings…")}
          </div>
        ) : bookings.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-zinc-200 bg-white px-6 py-12 text-center shadow-sm dark:border-white/10 dark:bg-zinc-900">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
              <Plane className="h-6 w-6" />
            </div>
            <div>
              <div className="font-semibold text-zinc-800">{tr("Нет активных букингов", "No active bookings")}</div>
              <div className="mt-0.5 text-sm text-zinc-500">{tr("Выберите маршрут и создайте букинг", "Choose a route and book a flight")}</div>
            </div>
            <Button asChild className="mt-1 bg-[#E31E24] text-white hover:bg-[#c21920]">
              <Link to="/dashboard/dispatch">
                <CalendarPlus className="mr-2 h-4 w-4" />
                {tr("Создать букинг", "Book a flight")}
              </Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {bookings.map((b) => (
              <div
                key={b.id}
                className="group flex flex-col gap-3 rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-white/5 dark:bg-zinc-900"
              >
                {/* Row 1: flight + status */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#E31E24]/10 text-[#E31E24]">
                      <Plane className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="font-bold text-[#1d1d1f]">{b.flightNumber}</div>
                      <div className="text-xs text-zinc-400">{b.aircraft}</div>
                    </div>
                  </div>
                  <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${statusBadgeCls(b.status)}`}>
                    {b.statusLabel}
                  </span>
                </div>

                {/* Row 2: route */}
                <div className="flex items-center gap-1.5 text-sm font-semibold text-[#1d1d1f]">
                  <IcaoFlag icao={b.departureCode} />
                  <span>{cityFromName(b.departureName, b.departureCode)}</span>
                  <span className="font-mono text-xs font-normal text-zinc-400">({b.departureCode})</span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-zinc-300 mx-0.5" />
                  <IcaoFlag icao={b.arrivalCode} />
                  <span>{cityFromName(b.arrivalName, b.arrivalCode)}</span>
                  <span className="font-mono text-xs font-normal text-zinc-400">({b.arrivalCode})</span>
                </div>

                {/* Row 3: time */}
                {b.departureTime ? (
                  <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                    <Clock className="h-3.5 w-3.5 text-zinc-400" />
                    <span>{fmt(b.departureTime, language)}</span>
                    {b.network ? <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 font-medium text-zinc-600">{b.network}</span> : null}
                  </div>
                ) : null}

                {/* Row 4: actions */}
                <div className="flex flex-wrap gap-2 pt-0.5">
                  <Button asChild variant="outline" size="sm" className="h-7 px-3 text-xs">
                    <Link to={`/dashboard/booking/${b.id}`}>
                      <ChevronRight className="mr-1 h-3.5 w-3.5" />
                      {tr("Детали", "Details")}
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-3 text-xs"
                    onClick={() => void handleDispatch(b)}
                    disabled={dispatchingId === b.id || !b.routeId}
                  >
                    {dispatchingId === b.id ? (
                      <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ExternalLink className="mr-1 h-3.5 w-3.5" />
                    )}
                    Phoenix
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-auto h-7 px-3 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={() => setCancelId(b.id)}
                    disabled={!b.canCancel}
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                    {tr("Отменить", "Cancel")}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ─── Разделитель ────────────────────────────────────────────── */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center" aria-hidden>
          <div className="w-full border-t border-zinc-200" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-[#f5f5f7] px-4 text-xs font-semibold uppercase tracking-wider text-zinc-400">
            {tr("Завершённые рейсы", "Completed flights")}
          </span>
        </div>
      </div>

      {/* ─── Завершённые рейсы ──────────────────────────────────────── */}
      <section>
        <RecentFlights onOpenPirep={onOpenPirep} embedded />
      </section>

      {/* ─── Диалог отмены ──────────────────────────────────────────── */}
      <AlertDialog open={cancelId !== null} onOpenChange={(open) => !open && setCancelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tr("Отменить букинг?", "Cancel booking?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {tr("Это действие нельзя отменить. Букинг будет удалён.", "This action cannot be undone. The booking will be deleted.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tr("Оставить", "Keep")}</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={handleCancel}>
              {tr("Отменить рейс", "Cancel flight")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
