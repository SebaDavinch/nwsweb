import { useEffect, useState } from "react";

export interface ActivityProgressItem {
  registrationId: number;
  activityId: number;
  activityTitle: string;
  activityType: string;
  activityStart: string | null;
  registeredAt: string | null;
  progress: {
    status: string;
    progressPercent: number;
    legCompleted: number;
    legTotal: number;
  } | null;
}

export interface SlotWidgetItem {
  eventId: number;
  eventName: string;
  slotTime: string;
  callsign: string | null;
  departureAirport: string | null;
  arrivalAirport: string | null;
  routeId: number | null;
  registrationId: number;
}

/** Прогресс по мероприятиям + записанные слоты. */
export function useActivityProgress(limit = 4): {
  items: ActivityProgressItem[];
  slots: SlotWidgetItem[];
  loading: boolean;
} {
  const [items, setItems] = useState<ActivityProgressItem[]>([]);
  const [slots, setSlots] = useState<SlotWidgetItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch(`/api/pilot/activities/progress-widget?limit=${limit}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => {
        if (!active) return;
        if (Array.isArray(p?.items)) setItems(p.items);
        if (Array.isArray(p?.slots)) setSlots(p.slots);
      })
      .catch(() => null)
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [limit]);

  return { items, slots, loading };
}
