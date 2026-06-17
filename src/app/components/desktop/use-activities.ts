import { useCallback, useEffect, useState } from "react";

export interface PublicActivity {
  id: string;
  originalId: number | null; // vAMSYS activity id — для записи
  title: string;
  content?: string;
  summary?: string;
  date: string;
  status?: string;
  featured?: boolean;
  imageUrl?: string | null;
  activityType?: string;
  registrationOpen?: boolean;
  registrations?: number;
  completions?: number;
  points?: number;
  start?: string;
  end?: string;
  tags?: string[];
}

export interface ActivityRegistration {
  id: number; // registrationId
  activityId: number; // vAMSYS activity id
  createdAt: string | null;
}

const ts = (v?: string) => {
  const t = new Date(String(v || "")).getTime();
  return Number.isFinite(t) ? t : 0;
};

/** Каталог мероприятий + регистрации пилота с действиями записи/отписки. */
export function useActivities() {
  const [activities, setActivities] = useState<PublicActivity[]>([]);
  const [registrations, setRegistrations] = useState<ActivityRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const loadActivities = useCallback(async () => {
    try {
      const r = await fetch("/api/public/activities", { credentials: "include" });
      const p = await r.json().catch(() => null);
      const list: PublicActivity[] = Array.isArray(p?.activities) ? p.activities : [];
      list.sort((a, b) => (a.featured !== b.featured ? (a.featured ? -1 : 1) : ts(b.date) - ts(a.date)));
      setActivities(list);
    } catch {
      /* ignore */
    }
  }, []);

  const loadRegistrations = useCallback(async () => {
    try {
      const r = await fetch("/api/pilot/activities/registrations", { credentials: "include" });
      if (!r.ok) {
        setRegistrations([]);
        return;
      }
      const p = await r.json().catch(() => null);
      setRegistrations(Array.isArray(p?.registrations) ? p.registrations : []);
    } catch {
      setRegistrations([]);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      await Promise.all([loadActivities(), loadRegistrations()]);
      setLoading(false);
    })();
  }, [loadActivities, loadRegistrations]);

  // activityId (vAMSYS) -> registrationId
  const registrationByActivity = new Map(registrations.map((r) => [r.activityId, r.id]));

  const register = useCallback(
    async (activityId: number) => {
      if (!activityId) return false;
      setBusyId(activityId);
      try {
        const r = await fetch(`/api/pilot/activities/${activityId}/register`, { method: "POST", credentials: "include" });
        if (r.ok) {
          await loadRegistrations();
          return true;
        }
        return false;
      } catch {
        return false;
      } finally {
        setBusyId(null);
      }
    },
    [loadRegistrations]
  );

  const unregister = useCallback(
    async (activityId: number) => {
      const registrationId = registrationByActivity.get(activityId);
      if (!registrationId) return false;
      setBusyId(activityId);
      try {
        const r = await fetch(`/api/pilot/activities/registrations/${registrationId}`, { method: "DELETE", credentials: "include" });
        if (r.ok || r.status === 204) {
          await loadRegistrations();
          return true;
        }
        return false;
      } catch {
        return false;
      } finally {
        setBusyId(null);
      }
    },
    [registrationByActivity, loadRegistrations]
  );

  return {
    activities,
    registrations,
    registrationByActivity,
    loading,
    busyId,
    register,
    unregister,
    refresh: () => Promise.all([loadActivities(), loadRegistrations()]),
  };
}
