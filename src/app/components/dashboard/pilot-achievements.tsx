import { useEffect, useMemo, useState } from "react";
import { Trophy, Clock, Plane, Award, Camera, Check, Plus, Lock, Loader2, FolderOpen } from "lucide-react";
import { useLanguage } from "../../context/language-context";

interface AchievementTier {
  id: string;
  threshold: number;
  label: string;
  labelRu?: string;
  labelEn?: string;
  rewardBadgeId?: string | null;
  unlocked: boolean;
  unlockedAt: string | null;
}
interface Achievement {
  id: string;
  title: string;
  titleRu?: string;
  titleEn?: string;
  icon: string;
  metric: string;
  categoryId?: string | null;
  value: number;
  tiersUnlocked: number;
  tiersTotal: number;
  nextThreshold: number | null;
  progressToNext: number;
  tiers: AchievementTier[];
}
interface Category {
  id: string;
  titleRu: string;
  titleEn: string;
  icon: string;
  order: number;
}

const ICONS: Record<string, React.ReactNode> = {
  clock: <Clock className="h-5 w-5" />,
  plane: <Plane className="h-5 w-5" />,
  award: <Award className="h-5 w-5" />,
  camera: <Camera className="h-5 w-5" />,
  trophy: <Trophy className="h-5 w-5" />,
};

function AchievementCard({ a, language }: { a: Achievement; language: string }) {
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);
  const title = (language === "ru" ? a.titleRu : a.titleEn) || a.title;
  const localizeTier = (t: AchievementTier) => (language === "ru" ? t.labelRu : t.labelEn) || t.label;
  const allDone = a.nextThreshold == null;
  const nextTier = a.tiers.find((t) => !t.unlocked) || null;
  const pct = allDone ? 100 : Math.max(0, Math.min(100, Number(a.progressToNext || 0)));
  const nextLabel = nextTier ? localizeTier(nextTier) : null;

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl text-white ${allDone ? "bg-gradient-to-br from-emerald-400 to-emerald-600" : "bg-gradient-to-br from-amber-400 to-amber-600"}`}>
          {ICONS[a.icon] || <Trophy className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold text-[#1d1d1f]">{title}</div>
          <div className="text-[11px] font-medium text-gray-400">
            {a.tiersUnlocked} / {a.tiersTotal} {tr("целей", "goals")}
          </div>
        </div>
        {allDone ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
            <Check className="h-3 w-3" />
            {tr("Всё", "All")}
          </span>
        ) : null}
      </div>

      {/* Steam-style прогресс к следующей цели */}
      <div className="mb-3">
        <div className="mb-1 flex items-center justify-between text-[11px] font-semibold">
          <span className="text-gray-500">
            {allDone ? tr("Все цели достигнуты", "All goals reached") : tr(`Следующая: ${nextLabel}`, `Next: ${nextLabel}`)}
          </span>
          <span className="tabular-nums text-gray-400">
            {allDone ? `${a.value}` : `${a.value} / ${a.nextThreshold}`}
          </span>
        </div>
        <div className="relative h-2.5 overflow-hidden rounded-full bg-gray-100">
          <div
            className={`h-full rounded-full transition-[width] duration-700 ${allDone ? "bg-gradient-to-r from-emerald-500 to-emerald-400" : "bg-gradient-to-r from-amber-400 via-amber-500 to-orange-400"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Медальоны целей */}
      <div className="flex flex-wrap gap-1.5">
        {a.tiers.map((t) => {
          const isNext = nextTier?.id === t.id;
          return (
            <span
              key={t.id}
              title={localizeTier(t)}
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                t.unlocked
                  ? "border-amber-300 bg-amber-50 text-amber-700"
                  : isNext
                    ? "border-sky-300 bg-sky-50 text-sky-700"
                    : "border-gray-200 bg-gray-50 text-gray-400"
              }`}
            >
              {t.unlocked ? <Check className="h-2.5 w-2.5" /> : isNext ? <Plus className="h-2.5 w-2.5" /> : <Lock className="h-2.5 w-2.5" />}
              {localizeTier(t)}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function PilotAchievements() {
  const { language } = useLanguage();
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/pilot/achievements", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => {
        if (!active) return;
        if (Array.isArray(p?.achievements)) setAchievements(p.achievements);
        if (Array.isArray(p?.categories)) setCategories(p.categories);
      })
      .catch(() => null)
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const catTitle = (c: Category) => (language === "ru" ? c.titleRu : c.titleEn) || c.titleRu || c.titleEn || c.id;
  const groups = useMemo(() => {
    const sorted = categories.slice().sort((a, b) => a.order - b.order);
    const result: Array<{ category: Category | null; entries: Achievement[] }> = [];
    for (const c of sorted) {
      const entries = achievements.filter((a) => a.categoryId === c.id);
      if (entries.length) result.push({ category: c, entries });
    }
    const known = new Set(sorted.map((c) => c.id));
    const orphans = achievements.filter((a) => !a.categoryId || !known.has(a.categoryId));
    if (orphans.length) result.push({ category: null, entries: orphans });
    return result;
  }, [achievements, categories]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-[#1d1d1f]">
          <Trophy className="h-6 w-6 text-amber-500" />
          {tr("Достижения", "Achievements")}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {tr("Ваш прогресс по достижениям Nordwind Virtual.", "Your Nordwind Virtual achievement progress.")}
        </p>
      </div>

      {loading ? (
        <div className="flex min-h-[200px] items-center justify-center gap-2 rounded-2xl border border-dashed border-gray-200 bg-white text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          {tr("Загрузка…", "Loading…")}
        </div>
      ) : achievements.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-5 py-10 text-center text-sm text-gray-500">
          {tr("Достижения пока недоступны.", "No achievements available yet.")}
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.category?.id || "uncategorized"} className="space-y-3">
              {groups.length > 1 || group.category ? (
                <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
                  {group.category ? (ICONS[group.category.icon] || <Trophy className="h-4 w-4" />) : <FolderOpen className="h-4 w-4" />}
                  {group.category ? catTitle(group.category) : tr("Другое", "Other")}
                </div>
              ) : null}
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {group.entries.map((a) => (
                  <AchievementCard key={a.id} a={a} language={language} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
