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

/** Прогресс по мероприятиям, на которые записан пилот (для трекинга на обзорной). */
export function useActivityProgress(limit = 4): { items: ActivityProgressItem[]; loading: boolean } {
  const [items, setItems] = useState<ActivityProgressItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch(`/api/pilot/activities/progress-widget?limit=${limit}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => {
        if (active && Array.isArray(p?.items)) setItems(p.items);
      })
      .catch(() => null)
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [limit]);

  return { items, loading };
}
