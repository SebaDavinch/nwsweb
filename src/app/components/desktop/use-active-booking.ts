import { useCallback, useEffect, useState } from "react";

export interface ActiveBooking {
  id: number;
  flightNumber: string;
  callsign: string;
  departureCode: string;
  departureName: string;
  arrivalCode: string;
  arrivalName: string;
  routeLabel: string;
  aircraft: string;
  registration?: string;
  statusLabel?: string;
  departureTime?: string | null;
}

interface BookingListResponse {
  bookings?: ActiveBooking[];
}

/** Статусы, которые не считаем «активным» рейсом (бронь закрыта/отменена). */
const INACTIVE_STATUS = /(cancel|отмен|complete|заверш|закрыт|filed|completed)/i;

function listActive(bookings: ActiveBooking[]): ActiveBooking[] {
  const live = bookings.filter((b) => !INACTIVE_STATUS.test(String(b.statusLabel || "")));
  // Сортируем по времени вылета (ближайший — первым); без времени — в конец.
  return live.slice().sort((a, b) => {
    const ta = Date.parse(String(a.departureTime || "")) || Number.POSITIVE_INFINITY;
    const tb = Date.parse(String(b.departureTime || "")) || Number.POSITIVE_INFINITY;
    return ta - tb;
  });
}

interface UseActiveBookingResult {
  booking: ActiveBooking | null;
  upcoming: ActiveBooking[];
  loading: boolean;
  error: boolean;
  refresh: () => Promise<void>;
}

/**
 * Опрашивает текущие брони пилота и выбирает активную/ближайшую.
 * Используется режимом «Полёт»: если активной брони нет — показываем CTA на бронирование.
 */
export function useActiveBooking(pollMs = 30000): UseActiveBookingResult {
  const [booking, setBooking] = useState<ActiveBooking | null>(null);
  const [upcoming, setUpcoming] = useState<ActiveBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/pilot/bookings?limit=150", { credentials: "include" });
      if (!res.ok) {
        setError(true);
        setBooking(null);
        setUpcoming([]);
        return;
      }
      const payload = (await res.json().catch(() => null)) as BookingListResponse | null;
      const list = Array.isArray(payload?.bookings) ? payload!.bookings! : [];
      const active = listActive(list);
      setUpcoming(active);
      setBooking(active[0] || null);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void refresh();
    const id = window.setInterval(() => {
      if (active) void refresh();
    }, pollMs);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, [refresh, pollMs]);

  return { booking, upcoming, loading, error, refresh };
}
