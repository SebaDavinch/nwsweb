import { Trophy, Clock, Plane, Award, Camera, Lock, Check, Plus } from "lucide-react";
import { useLanguage } from "../../context/language-context";
import { useAchievements, localizeAchievementTitle, localizeTierLabel, type Achievement } from "./use-achievements";
import { PilotBadges } from "../dashboard/pilot-badges";

const ICONS: Record<string, React.ReactNode> = {
  clock: <Clock className="h-5 w-5" />,
  plane: <Plane className="h-5 w-5" />,
  award: <Award className="h-5 w-5" />,
  camera: <Camera className="h-5 w-5" />,
};

function AchievementCard({ a }: { a: Achievement }) {
  const { language } = useLanguage();
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);
  const allDone = a.nextThreshold == null;
  // Прогресс к следующей цели (Steam-style): текущее значение / следующий порог.
  const nextTier = a.tiers.find((t) => !t.unlocked) || null;
  const pct = allDone ? 100 : Math.max(0, Math.min(100, Number(a.progressToNext || 0)));
  const nextLabel = nextTier ? localizeTierLabel(nextTier, language) : null;

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#0e1424]">
      {/* Заголовок + счётчик целей */}
      <div className="mb-3 flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl text-white ${allDone ? "bg-gradient-to-br from-emerald-400 to-emerald-600" : "bg-gradient-to-br from-amber-400 to-amber-600"}`}>
          {ICONS[a.icon] || <Trophy className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold text-zinc-800 dark:text-zinc-100">{localizeAchievementTitle(a, language)}</div>
          <div className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500">
            {a.tiersUnlocked} / {a.tiersTotal} {tr("целей", "goals")}
          </div>
        </div>
        {allDone ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
            <Check className="h-3 w-3" />
            {tr("Всё", "All")}
          </span>
        ) : null}
      </div>

      {/* Steam-style прогресс-бар к следующей цели */}
      <div className="mb-3">
        <div className="mb-1 flex items-center justify-between text-[11px] font-semibold">
          <span className="text-zinc-500 dark:text-zinc-400">
            {allDone ? tr("Все цели достигнуты", "All goals reached") : tr(`Следующая: ${nextLabel}`, `Next: ${nextLabel}`)}
          </span>
          <span className="tabular-nums text-zinc-400 dark:text-zinc-500">
            {allDone ? `${a.value}` : `${a.value} / ${a.nextThreshold}`}
          </span>
        </div>
        <div className="relative h-2.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-white/10">
          <div
            className={`h-full rounded-full transition-[width] duration-700 ${allDone ? "bg-gradient-to-r from-emerald-500 to-emerald-400" : "bg-gradient-to-r from-amber-400 via-amber-500 to-orange-400"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Медальоны целей: получено / закрыто */}
      <div className="flex flex-wrap gap-1.5">
        {a.tiers.map((t) => {
          const isNext = nextTier?.id === t.id;
          return (
            <span
              key={t.id}
              title={localizeTierLabel(t, language)}
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                t.unlocked
                  ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
                  : isNext
                    ? "border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300"
                    : "border-zinc-200 bg-zinc-50 text-zinc-400 dark:border-white/10 dark:bg-white/[0.03] dark:text-zinc-500"
              }`}
            >
              {t.unlocked ? <Check className="h-2.5 w-2.5" /> : isNext ? <Plus className="h-2.5 w-2.5" /> : <Lock className="h-2.5 w-2.5" />}
              {localizeTierLabel(t, language)}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function AppAchievements() {
  const { language } = useLanguage();
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);
  const { achievements, loading } = useAchievements();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Trophy className="h-5 w-5 text-amber-500" />
        <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{tr("Достижения", "Achievements")}</h1>
      </div>

      {/* Наши прогресс-достижения */}
      {loading ? (
        <div className="text-sm text-zinc-400">{tr("Загрузка…", "Loading…")}</div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {achievements.map((a) => (
            <AchievementCard key={a.id} a={a} />
          ))}
        </div>
      )}

      {/* Бейджи vAMSYS — единый раздел */}
      <div>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          <Award className="h-4 w-4" />
          {tr("Бейджи vAMSYS", "vAMSYS badges")}
        </h2>
        <PilotBadges />
      </div>
    </div>
  );
}
