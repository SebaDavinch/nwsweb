import { useCallback, useEffect, useState } from "react";
import { useNotifications } from "../../context/notifications-context";
import { useLanguage } from "../../context/language-context";
import { notify } from "./notify";

export interface AchievementTier {
  id: string;
  threshold: number;
  label: string;
  labelRu?: string;
  labelEn?: string;
  rewardBadgeId?: string | null;
  unlocked: boolean;
  unlockedAt: string | null;
  badgeId?: string | null;
}
export interface Achievement {
  id: string;
  title: string;
  titleRu?: string;
  titleEn?: string;
  icon: string;
  metric: string;
  value: number;
  tiersUnlocked: number;
  tiersTotal: number;
  nextThreshold: number | null;
  nextLabel: string | null;
  nextLabelRu?: string | null;
  nextLabelEn?: string | null;
  progressToNext: number;
  tiers: AchievementTier[];
}

/** Локализованный заголовок достижения с фолбэком на legacy-поле. */
export function localizeAchievementTitle(a: Achievement, language: string): string {
  return (language === "ru" ? a.titleRu : a.titleEn) || a.title;
}
/** Локализованная подпись тира с фолбэком на legacy-поле. */
export function localizeTierLabel(t: AchievementTier, language: string): string {
  return (language === "ru" ? t.labelRu : t.labelEn) || t.label;
}

const SEEN_KEY = "nws.achievements.seen";

function getSeen(): Set<string> {
  try {
    return new Set(JSON.parse(window.localStorage.getItem(SEEN_KEY) || "[]"));
  } catch {
    return new Set();
  }
}
function saveSeen(seen: Set<string>) {
  try {
    window.localStorage.setItem(SEEN_KEY, JSON.stringify(Array.from(seen).slice(-500)));
  } catch {
    /* ignore */
  }
}

interface NewlyUnlocked {
  achievement: string;
  achievementRu?: string;
  achievementEn?: string;
  tier: string;
  tierRu?: string;
  tierEn?: string;
  icon: string;
  id: string;
}

/**
 * Грузит достижения и при новых разблокировках шлёт Steam-style уведомление:
 * системный toast (Windows) + запись в колокольчик. Дедуп по localStorage,
 * чтобы не повторять при каждом опросе/перезапуске.
 */
export function useAchievements(pollMs = 60000) {
  const { addNotification } = useNotifications();
  const { language } = useLanguage();

  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);

  const handleNewly = useCallback(
    (newly: NewlyUnlocked[]) => {
      if (!newly?.length) return;
      const ru = language === "ru";
      const seen = getSeen();
      for (const n of newly) {
        if (seen.has(n.id)) continue;
        seen.add(n.id);
        // Локаль фиксируется на момент анбоксинга достижения.
        const achievement = (ru ? n.achievementRu : n.achievementEn) || n.achievement;
        const tier = (ru ? n.tierRu : n.tierEn) || n.tier;
        const title = ru ? "🏆 Достижение получено!" : "🏆 Achievement unlocked!";
        const body = `${achievement}: ${tier}`;
        void notify(title, body);
        addNotification({
          category: "achievement",
          title,
          description: body,
          dedupeKey: `ach:${n.id}`,
        });
      }
      saveSeen(seen);
    },
    [addNotification, language]
  );

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/pilot/achievements", { credentials: "include" });
      if (!res.ok) return;
      const payload = (await res.json().catch(() => null)) as
        | { achievements?: Achievement[]; newlyUnlocked?: NewlyUnlocked[] }
        | null;
      if (Array.isArray(payload?.achievements)) setAchievements(payload!.achievements!);
      handleNewly(payload?.newlyUnlocked || []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [handleNewly]);

  useEffect(() => {
    void load();
    const id = window.setInterval(load, pollMs);
    return () => window.clearInterval(id);
  }, [load, pollMs]);

  return { achievements, loading, reload: load };
}
